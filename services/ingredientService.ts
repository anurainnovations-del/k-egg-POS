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
} from 'firebase/firestore';
import { db } from '../firebase-config';

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

const COLLECTION_NAME = 'ingredients';

export const createIngredient = async (
  branchId: string,
  ingredient: Omit<Ingredient, 'id' | 'branchId' | 'createdAt' | 'updatedAt'>
): Promise<string> => {
  try {
    const data = {
      ...ingredient,
      branchId,
      createdAt: Timestamp.now(),
      updatedAt: Timestamp.now(),
    };
    const docRef = await addDoc(collection(db, COLLECTION_NAME), data);
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
  updates: Partial<Omit<Ingredient, 'id' | 'createdAt'>>
): Promise<void> => {
  try {
    const ref = doc(db, COLLECTION_NAME, id);
    await updateDoc(ref, { ...updates, branchId, updatedAt: Timestamp.now() });
  } catch (error) {
    console.error('Error updating ingredient:', error);
    throw new Error('Failed to update ingredient');
  }
};

export const deleteIngredient = async (id: string): Promise<void> => {
  try {
    await deleteDoc(doc(db, COLLECTION_NAME, id));
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
 * Bulk deduct ingredient quantities by absolute amounts (negative = reduce).
 * Used internally after order placement.
 */
export const bulkDeductIngredientStock = async (
  branchId: string,
  deductions: { id: string; amount: number }[]
): Promise<void> => {
  const current = await getIngredients(branchId);
  const map = new Map(current.map((i) => [i.id!, i]));

  const updates = deductions.map(({ id, amount }) => {
    const ingredient = map.get(id);
    if (!ingredient) return Promise.resolve();
    const newStock = Math.max(0, ingredient.stock - amount);
    return updateIngredient(branchId, id, { stock: newStock });
  });

  await Promise.all(updates);
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
};
