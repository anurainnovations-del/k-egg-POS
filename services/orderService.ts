import { collection, doc, setDoc, getDocs, query, orderBy, where, Timestamp } from 'firebase/firestore';
import { db } from '../firebase-config';
import { IngredientDeduction, calculateDeductions, applyIngredientDeductions, CartItem } from './ingredientDeductionService';
import { MenuItem } from './menuItemService';

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
    const now = Timestamp.fromDate(new Date());

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
    };

    // Save order
    await setDoc(orderRef, order);

    // Deduct ingredients from stock
    await applyIngredientDeductions(branchId, deductions);

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
