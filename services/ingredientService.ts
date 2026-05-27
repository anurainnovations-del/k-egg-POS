import {
  collection,
  addDoc,
  getDocs,
  doc,
  updateDoc,
  deleteDoc,
  query,
  orderBy,
  onSnapshot,
  Timestamp,
  where,
  writeBatch,
} from 'firebase/firestore';
import { db } from '../firebase-config';
import { auditService } from './auditService';

export interface Ingredient {
  id?: string;
  name: string;
  unit: string;               // "pcs", "ml", "g", "kg", "tbsp", "tsp", "cup", "L"
  stock: number;              // current quantity in `unit`
  lowStockThreshold: number;  // alert when stock <= this
  costPerUnit: number;        // cost of 1 unit (for profit calculation)
  categoryId: string;
  branchId: string;
  imgUrl?: string;
  createdAt?: Timestamp;
  updatedAt?: Timestamp;
}

export interface Performer {
  id: string;
  name: string;
}

const COLLECTION_NAME = 'ingredients';

export const createIngredient = async (
  branchId: string,
  ingredient: Omit<Ingredient, 'id' | 'branchId' | 'createdAt' | 'updatedAt'>,
  performer?: Performer
): Promise<string> => {
  try {
    const data = {
      ...ingredient,
      branchId,
      createdAt: Timestamp.now(),
      updatedAt: Timestamp.now(),
    };
    const docRef = await addDoc(collection(db, COLLECTION_NAME), data);
    
    if (performer) {
      await auditService.logAction({
        branchId,
        userId: performer.id,
        userName: performer.name,
        action: "ENTITY_CREATE",
        entityType: "ingredient",
        entityId: docRef.id,
        details: { after: data, message: `Created ingredient: ${ingredient.name}` }
      });
    }

    return docRef.id;
  } catch (error) {
    console.error('Error creating ingredient:', error);
    throw new Error('Failed to create ingredient');
  }
};

export const getIngredients = async (branchId: string): Promise<Ingredient[]> => {
  try {
    const q = query(
      collection(db, COLLECTION_NAME),
      where('branchId', '==', branchId),
      orderBy('createdAt', 'desc')
    );
    const snapshot = await getDocs(q);
    return snapshot.docs.map((d) => ({ id: d.id, ...d.data() } as Ingredient));
  } catch (error) {
    console.error('Error fetching ingredients:', error);
    throw new Error('Failed to fetch ingredients');
  }
};

export const subscribeToIngredientItems = (
  branchId: string,
  callback: (items: Ingredient[]) => void
) => {
  const q = query(
    collection(db, COLLECTION_NAME),
    where('branchId', '==', branchId),
    orderBy('createdAt', 'desc')
  );
  return onSnapshot(
    q,
    (snapshot) => {
      const items = snapshot.docs.map((d) => ({ id: d.id, ...d.data() } as Ingredient));
      callback(items);
    },
    (error) => console.error('Ingredient subscription error:', error)
  );
};

export const updateIngredient = async (
  branchId: string,
  id: string,
  updates: Partial<Omit<Ingredient, 'id' | 'createdAt'>>,
  performer?: Performer
): Promise<void> => {
  try {
    const ref = doc(db, COLLECTION_NAME, id);
    
    if (performer) {
      // Fetch before state for logging
      const current = await getDocs(query(collection(db, COLLECTION_NAME), where('__name__', '==', id)));
      const beforeData = current.docs[0]?.data();
      
      await updateDoc(ref, { ...updates, branchId, updatedAt: Timestamp.now() });

      await auditService.logAction({
        branchId,
        userId: performer.id,
        userName: performer.name,
        action: updates.stock !== undefined ? "STOCK_ADJUSTMENT" : "STOCK_UPDATE",
        entityType: "ingredient",
        entityId: id,
        details: { 
          before: beforeData, 
          after: updates,
          message: updates.stock !== undefined 
            ? `Adjusted stock for ${beforeData?.name || 'ingredient'} to ${updates.stock}`
            : `Updated ingredient: ${beforeData?.name || 'ingredient'}`
        }
      });
    } else {
      await updateDoc(ref, { ...updates, branchId, updatedAt: Timestamp.now() });
    }
  } catch (error) {
    console.error('Error updating ingredient:', error);
    throw new Error('Failed to update ingredient');
  }
};

export const deleteIngredient = async (id: string, branchId: string, performer?: Performer): Promise<void> => {
  try {
    if (performer) {
      const current = await getDocs(query(collection(db, COLLECTION_NAME), where('__name__', '==', id)));
      const beforeData = current.docs[0]?.data();

      await deleteDoc(doc(db, COLLECTION_NAME, id));

      await auditService.logAction({
        branchId,
        userId: performer.id,
        userName: performer.name,
        action: "ENTITY_DELETE",
        entityType: "ingredient",
        entityId: id,
        details: { before: beforeData, message: `Deleted ingredient: ${beforeData?.name}` }
      });
    } else {
      await deleteDoc(doc(db, COLLECTION_NAME, id));
    }
  } catch (error) {
    console.error('Error deleting ingredient:', error);
    throw new Error('Failed to delete ingredient');
  }
};

export const getLowStockIngredients = async (
  branchId: string
): Promise<Ingredient[]> => {
  const all = await getIngredients(branchId);
  return all.filter((i) => i.stock <= i.lowStockThreshold);
};

/**
 * Bulk deduct ingredient stock (internal POS use)
 */
export const bulkDeductIngredientStock = async (
  branchId: string,
  deductions: { id: string; amount: number }[]
): Promise<void> => {
  try {
    const current = await getIngredients(branchId);
    const map = new Map(current.map((i) => [i.id!, i]));
    const batch = writeBatch(db);
    const now = Timestamp.now();

    deductions.forEach(({ id, amount }) => {
      const ingredient = map.get(id);
      if (ingredient) {
        const newStock = Math.max(0, ingredient.stock - amount);
        const ref = doc(db, COLLECTION_NAME, id);
        batch.update(ref, { stock: newStock, updatedAt: now });
      }
    });

    await batch.commit();
  } catch (error) {
    console.error('Error bulk deducting ingredient stock:', error);
    throw error;
  }
};

export const bulkAddIngredientStock = async (
  branchId: string,
  additions: { id: string; amount: number }[]
): Promise<void> => {
  try {
    const current = await getIngredients(branchId);
    const map = new Map(current.map((i) => [i.id!, i]));
    const batch = writeBatch(db);
    const now = Timestamp.now();

    additions.forEach(({ id, amount }) => {
      const ingredient = map.get(id);
      if (ingredient) {
        const newStock = ingredient.stock + amount;
        const ref = doc(db, COLLECTION_NAME, id);
        batch.update(ref, { stock: newStock, updatedAt: now });
      }
    });

    await batch.commit();
  } catch (error) {
    console.error('Error bulk adding ingredient stock:', error);
    throw error;
  }
};

export const ingredientService = {
  createIngredient,
  addIngredient: createIngredient, // alias
  getIngredients,
  subscribeToIngredientItems,
  updateIngredient,
  deleteIngredient,
  getLowStockIngredients,
  bulkDeductIngredientStock,
  bulkAddIngredientStock,
};

