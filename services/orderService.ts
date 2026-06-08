import {
  collection,
  doc,
  getDocs,
  query,
  orderBy,
  where,
  Timestamp,
  writeBatch,
  increment,
} from 'firebase/firestore';
import { db } from '../firebase-config';
import {
  IngredientDeduction,
  calculateDeductions,
  CartItem,
} from './ingredientDeductionService';
import { MenuItem } from './menuItemService';
import { getIngredients } from './ingredientService';

export interface OrderItem {
  menuItemId: string;
  name: string;
  price: number;
  cost: number;       // recipe cost at time of sale
  quantity: number;
  subtotal: number;
  profit: number;
  imgUrl: string;
  categoryId: string;
}

export interface Order {
  id: string;
  items: OrderItem[];
  ingredientDeductions: IngredientDeduction[];
  total: number;
  subtotal: number;
  discountAmount: number;
  totalProfit: number;
  discountCode: string;
  createdAt: Timestamp;
  orderType: 'DINE-IN' | 'TAKE OUT' | 'DELIVERY';
  timestamp: Timestamp;
  itemCount: number;
  uniqueItemCount: number;
  workerName: string;
  workerUid: string;
  branchId: string;
  status?: 'COMPLETED' | 'VOIDED';
  voidedAt?: Timestamp;
  voidedBy?: string;
}

export const createOrder = async (
  cartItems: Array<{
    id: string;
    name: string;
    price: number;
    cost?: number;
    quantity: number;
    imgUrl?: string;
    categoryId: number | string;
  }>,
  menuItemsMap: Map<string, MenuItem>,
  total: number,
  subtotal: number,
  workerName: string,
  workerUid: string,
  orderType: 'DINE-IN' | 'TAKE OUT' | 'DELIVERY' = 'TAKE OUT',
  discountAmount: number = 0,
  discountCode: string = '',
  branchId: string
): Promise<string> => {
  try {
    const now = Timestamp.now();

    // Build order items
    const orderItems: OrderItem[] = cartItems.map((item) => ({
      menuItemId: item.id,
      name: item.name,
      price: item.price,
      cost: item.cost || 0,
      quantity: item.quantity,
      subtotal: item.price * item.quantity,
      profit: (item.price - (item.cost || 0)) * item.quantity,
      imgUrl: item.imgUrl || '',
      categoryId: String(item.categoryId || ''),
    }));

    // Calculate ingredient deductions from recipes
    const deductions = calculateDeductions(
      cartItems as CartItem[],
      menuItemsMap
    );

    const batch = writeBatch(db);
    const orderRef = doc(collection(db, 'orders'));

    const order: Order = {
      id: orderRef.id,
      items: orderItems,
      ingredientDeductions: deductions,
      discountAmount,
      total,
      subtotal,
      createdAt: now,
      totalProfit: orderItems.reduce((s, i) => s + i.profit, 0),
      orderType,
      timestamp: now,
      workerName,
      workerUid,
      discountCode,
      itemCount: orderItems.reduce((s, i) => s + i.quantity, 0),
      uniqueItemCount: orderItems.length,
      branchId,
      status: 'COMPLETED',
    };

    // Save order
    batch.set(orderRef, order);

    // Decrement ingredient stock atomically with the order. increment() is
    // commutative, so it stays correct offline and across multiple terminals
    // (no lost updates), and `stock` is the field the POS availability logic
    // actually reads.
    //
    // Guard against recipes that reference a deleted/unknown ingredient: an
    // update() on a non-existent doc makes Firestore reject the WHOLE batch on
    // sync (even with permissive rules), which would silently roll back the
    // order after the receipt already printed. So we only touch ids that exist.
    if (deductions.length > 0) {
      try {
        const existing = await getIngredients(branchId);
        const existingIds = new Set(existing.map((i) => i.id));

        const usedByIngredient = new Map<string, number>();
        deductions.forEach((d) => {
          if (!existingIds.has(d.ingredientId)) return;
          const current = usedByIngredient.get(d.ingredientId) ?? 0;
          usedByIngredient.set(d.ingredientId, current + d.quantityUsed);
        });

        usedByIngredient.forEach((quantityUsed, ingredientId) => {
          batch.update(doc(db, 'ingredients', ingredientId), {
            stock: increment(-quantityUsed),
            updatedAt: now,
          });
        });
      } catch (stockErr) {
        // Never let stock bookkeeping block a sale whose receipt is printing.
        console.error('Could not prepare stock deduction; saving order without it:', stockErr);
      }
    }

    // With persistentLocalCache, commit() resolves against the local cache even
    // when offline, so awaiting keeps the optimistic feel while still surfacing
    // real write failures to the caller instead of silently dropping the order.
    await batch.commit();

    return orderRef.id;
  } catch (error) {
    console.error('Error creating order:', error);
    throw error;
  }
};

export const getAllOrders = async (): Promise<Order[]> => {
  try {
    const q = query(collection(db, 'orders'), orderBy('createdAt', 'desc'));
    const snapshot = await getDocs(q);
    return snapshot.docs.map((d) => ({ id: d.id, ...d.data() } as Order));
  } catch (error) {
    console.error('Error fetching orders:', error);
    return [];
  }
};

export const getOrdersByBranch = async (branchId: string): Promise<Order[]> => {
  try {
    const q = query(
      collection(db, 'orders'),
      where('branchId', '==', branchId),
      orderBy('createdAt', 'desc')
    );
    const snapshot = await getDocs(q);
    return snapshot.docs.map((d) => ({ id: d.id, ...d.data() } as Order));
  } catch (error) {
    console.error('Error fetching branch orders:', error);
    return [];
  }
};

export const getOrdersByDateRange = async (
  startDate: Date,
  endDate: Date
): Promise<Order[]> => {
  try {
    const q = query(
      collection(db, 'orders'),
      where('createdAt', '>=', Timestamp.fromDate(startDate)),
      where('createdAt', '<=', Timestamp.fromDate(endDate)),
      orderBy('createdAt', 'desc')
    );
    const snapshot = await getDocs(q);
    return snapshot.docs.map((d) => ({ id: d.id, ...d.data() } as Order));
  } catch (error) {
    console.error('Error fetching orders by date range:', error);
    return [];
  }
};

export const calculateSalesStats = (orders: Order[]) => {
  const totalRevenue = orders.reduce((s, o) => s + o.total, 0);
  const totalProfit = orders.reduce((s, o) => s + o.totalProfit, 0);
  const totalItemsSold = orders.reduce((s, o) => s + o.itemCount, 0);
  const totalOrders = orders.length;
  const averageOrderValue = totalOrders > 0 ? totalRevenue / totalOrders : 0;
  return { totalRevenue, totalProfit, totalItemsSold, totalOrders, averageOrderValue };
};

export const getTopSellingItems = (orders: Order[], limit = 10) => {
  const itemStats = new Map<string, { name: string; quantity: number; revenue: number; profit: number }>();
  orders.forEach((order) => {
    order.items.forEach((item) => {
      const existing = itemStats.get(item.menuItemId) || {
        name: item.name, quantity: 0, revenue: 0, profit: 0,
      };
      existing.quantity += item.quantity;
      existing.revenue += item.subtotal;
      existing.profit += item.profit;
      itemStats.set(item.menuItemId, existing);
    });
  });
  return Array.from(itemStats.entries())
    .map(([id, stats]) => ({ id, ...stats }))
    .sort((a, b) => b.quantity - a.quantity)
    .slice(0, limit);
};

export const voidOrder = async (
  branchId: string,
  orderId: string,
  voidedByWorkerName: string,
  orderData?: Order
): Promise<void> => {
  try {
    let orderToVoid: Order;
    let orderDocRef = doc(db, 'orders', orderId);
    
    if (orderData) {
      orderToVoid = orderData;
    } else {
      // Reverse the ingredient deductions
      // First, we need to get the order details to know what to reverse
      const q = query(collection(db, 'orders'), where('id', '==', orderId), where('branchId', '==', branchId));
      const snapshot = await getDocs(q);
      
      if (snapshot.empty) {
        throw new Error('Order not found');
      }
      
      const orderDoc = snapshot.docs[0];
      orderToVoid = orderDoc.data() as Order;
      orderDocRef = orderDoc.ref;
    }
    
    if (orderToVoid.status === 'VOIDED') {
      throw new Error('Order is already voided');
    }

    const batch = writeBatch(db);
    const now = Timestamp.now();

    // Mark the order voided — the primary action, and the order doc is known to
    // exist, so this update is always safe.
    batch.update(orderDocRef, {
      status: 'VOIDED',
      voidedAt: now,
      voidedBy: voidedByWorkerName
    });

    // Restore the stock the order deducted (reverse of createOrder). Same guard
    // as createOrder: skip ids that no longer exist so a deleted ingredient
    // can't fail the batch and leave the order un-voided.
    if (orderToVoid.ingredientDeductions && orderToVoid.ingredientDeductions.length > 0) {
      try {
        const existing = await getIngredients(branchId);
        const existingIds = new Set(existing.map((i) => i.id));

        const restoreByIngredient = new Map<string, number>();
        orderToVoid.ingredientDeductions.forEach((d) => {
          if (!existingIds.has(d.ingredientId)) return;
          const current = restoreByIngredient.get(d.ingredientId) ?? 0;
          restoreByIngredient.set(d.ingredientId, current + d.quantityUsed);
        });

        restoreByIngredient.forEach((quantityUsed, ingredientId) => {
          batch.update(doc(db, 'ingredients', ingredientId), {
            stock: increment(quantityUsed),
            updatedAt: now,
          });
        });
      } catch (stockErr) {
        console.error('Could not prepare stock restore for void:', stockErr);
      }
    }

    // Commit batch atomically (which writes to cache first, resolving immediately if offline)
    await batch.commit();
    
  } catch (error) {
    console.error('Error voiding order:', error);
    throw new Error(error instanceof Error ? error.message : 'Failed to void order');
  }
};
