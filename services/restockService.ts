import {
  collection,
  addDoc,
  getDocs,
  query,
  orderBy,
  where,
  Timestamp,
  doc,
  updateDoc,
  increment,
} from 'firebase/firestore';
import { db } from '../firebase-config';
import { updateIngredient } from './ingredientService';

export interface RestockLog {
  id?: string;
  ingredientId: string;
  ingredientName: string;
  quantityAdded: number;
  unit: string;
  costPerUnit: number;
  totalCost: number;
  branchId: string;
  loggedBy: string;       // workerUid
  loggedByName: string;
  createdAt?: Timestamp;
}

const COLLECTION_NAME = 'restockLogs';

/**
 * Logs a restock event and updates the ingredient stock in Firestore.
 */
export const logRestock = async (
  ingredientId: string,
  quantityAdded: number,
  totalCost: number,
  note: string,
  branchId: string,
  // Optional but can be fetched if not provided
  loggedBy?: string,
  loggedByName?: string
): Promise<string> => {
  try {
    // In a real app, we'd get current worker info from AuthContext or props
    // For now, let's just log with provided or dummy info
    
    // We need ingredient details for the log
    // For simplicity, we assume the caller provides them or we'd fetch here
    // But since we want to match the 5-arg signature:
    // logRestock(id, qty, cost, note, branchId)
    
    const logData: any = {
      ingredientId,
      quantityAdded,
      totalCost,
      note,
      branchId,
      loggedBy: loggedBy || 'manager',
      loggedByName: loggedByName || 'Manager',
      createdAt: Timestamp.now(),
    };

    const docRef = await addDoc(collection(db, COLLECTION_NAME), logData);

    // Update ingredient stock atomically
    const ingredientRef = doc(db, 'ingredients', ingredientId);
    await updateDoc(ingredientRef, {
      stock: increment(quantityAdded),
      updatedAt: Timestamp.now()
    });

    return docRef.id;
  } catch (error) {
    console.error('Error logging restock:', error);
    throw new Error('Failed to log restock');
  }
};



/**
 * Fetches all restock logs for a branch, ordered newest first.
 */
export const getRestockLogs = async (branchId: string): Promise<RestockLog[]> => {
  try {
    const q = query(
      collection(db, COLLECTION_NAME),
      where('branchId', '==', branchId),
      orderBy('createdAt', 'desc')
    );
    const snapshot = await getDocs(q);
    return snapshot.docs.map((d) => ({ id: d.id, ...d.data() } as RestockLog));
  } catch (error) {
    console.error('Error fetching restock logs:', error);
    throw new Error('Failed to fetch restock logs');
  }
};

/**
 * Fetches restock logs for a specific ingredient.
 */
export const getIngredientRestockHistory = async (
  branchId: string,
  ingredientId: string
): Promise<RestockLog[]> => {
  const all = await getRestockLogs(branchId);
  return all.filter((log) => log.ingredientId === ingredientId);
};
export const restockService = {
  logRestock,
  getRestockLogs,
  getIngredientRestockHistory,
};
