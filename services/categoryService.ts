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

export interface Category {
  id: string;
  name: string;
  color: string;
  type: 'ingredient' | 'menu'; // distinguishes ingredient vs menu categories
  createdAt?: Timestamp;
}

const COLLECTION_NAME = 'categories';

export const getCategories = async (): Promise<Category[]> => {
  try {
    const q = query(collection(db, COLLECTION_NAME), orderBy('name', 'asc'));
    const snapshot = await getDocs(q);
    return snapshot.docs.map((d) => ({ id: d.id, ...d.data() } as Category));
  } catch (error) {
    console.error('Error fetching categories:', error);
    throw new Error('Failed to fetch categories');
  }
};

export const getCategoriesByType = async (
  type: 'ingredient' | 'menu'
): Promise<Category[]> => {
  const all = await getCategories();
  return all.filter((c) => c.type === type);
};

export const createCategory = async (
  name: string,
  color: string,
  type: 'ingredient' | 'menu'
): Promise<string> => {
  try {
    const docRef = await addDoc(collection(db, COLLECTION_NAME), {
      name,
      color,
      type,
      createdAt: Timestamp.now(),
    });
    return docRef.id;
  } catch (error) {
    console.error('Error creating category:', error);
    throw new Error('Failed to create category');
  }
};

export const updateCategory = async (
  id: string,
  updates: Partial<Omit<Category, 'id'>>
): Promise<void> => {
  try {
    await updateDoc(doc(db, COLLECTION_NAME, id), updates);
  } catch (error) {
    console.error('Error updating category:', error);
    throw new Error('Failed to update category');
  }
};

export const deleteCategory = async (id: string): Promise<void> => {
  try {
    await deleteDoc(doc(db, COLLECTION_NAME, id));
  } catch (error) {
    console.error('Error deleting category:', error);
    throw new Error('Failed to delete category');
  }
};

export const subscribeToCategories = (
  callback: (categories: Category[]) => void
) => {
  const q = query(collection(db, COLLECTION_NAME), orderBy('name', 'asc'));
  return onSnapshot(
    q,
    (snapshot) => {
      const categories = snapshot.docs.map((d) => ({ id: d.id, ...d.data() } as Category));
      callback(categories);
    },
    (error) => console.error('Categories subscription error:', error)
  );
};
export const categoryService = {
  getCategories,
  getCategoriesByType,
  createCategory,
  updateCategory,
  deleteCategory,
  subscribeToCategories,
};
