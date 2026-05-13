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

export interface RecipeIngredient {
  ingredientId: string;
  ingredientName: string; // denormalized for display
  quantity: number;       // consumed per 1 menu item sold
  unit: string;           // denormalized from ingredient
}

export interface MenuItem {
  id?: string;
  name: string;
  price: number;
  categoryId: string;
  description: string;
  imgUrl?: string;
  branchId: string;
  isAvailable: boolean;
  recipe: RecipeIngredient[];
  createdAt?: Timestamp;
  updatedAt?: Timestamp;
}

const COLLECTION_NAME = 'menuItems';

export const createMenuItem = async (
  branchId: string,
  item: Omit<MenuItem, 'id' | 'branchId' | 'createdAt' | 'updatedAt'>
): Promise<string> => {
  try {
    const data = {
      ...item,
      branchId,
      createdAt: Timestamp.now(),
      updatedAt: Timestamp.now(),
    };
    const docRef = await addDoc(collection(db, COLLECTION_NAME), data);
    return docRef.id;
  } catch (error) {
    console.error('Error creating menu item:', error);
    throw new Error('Failed to create menu item');
  }
};

export const getMenuItems = async (branchId: string): Promise<MenuItem[]> => {
  try {
    const q = query(
      collection(db, COLLECTION_NAME),
      where('branchId', '==', branchId),
      orderBy('createdAt', 'desc')
    );
    const snapshot = await getDocs(q);
    return snapshot.docs.map((d) => ({ id: d.id, ...d.data() } as MenuItem));
  } catch (error) {
    console.error('Error fetching menu items:', error);
    throw new Error('Failed to fetch menu items');
  }
};

export const subscribeToMenuItems = (
  branchId: string,
  callback: (items: MenuItem[]) => void
) => {
  const q = query(
    collection(db, COLLECTION_NAME),
    where('branchId', '==', branchId),
    orderBy('createdAt', 'desc')
  );
  return onSnapshot(
    q,
    (snapshot) => {
      const items = snapshot.docs.map((d) => ({ id: d.id, ...d.data() } as MenuItem));
      callback(items);
    },
    (error) => console.error('Menu items subscription error:', error)
  );
};

export const updateMenuItem = async (
  branchId: string,
  id: string,
  updates: Partial<Omit<MenuItem, 'id' | 'createdAt'>>
): Promise<void> => {
  try {
    const ref = doc(db, COLLECTION_NAME, id);
    await updateDoc(ref, { ...updates, branchId, updatedAt: Timestamp.now() });
  } catch (error) {
    console.error('Error updating menu item:', error);
    throw new Error('Failed to update menu item');
  }
};

export const deleteMenuItem = async (id: string): Promise<void> => {
  try {
    await deleteDoc(doc(db, COLLECTION_NAME, id));
  } catch (error) {
    console.error('Error deleting menu item:', error);
    throw new Error('Failed to delete menu item');
  }
};

export const menuItemService = {
  createMenuItem,
  addMenuItem: createMenuItem, // alias
  getMenuItems,
  subscribeToMenuItems,
  updateMenuItem,
  deleteMenuItem,
};
