import { 
  collection, 
  getDocs, 
  doc, 
  updateDoc, 
  deleteDoc, 
  query, 
  orderBy,
  onSnapshot,
  where,
  Timestamp,
  addDoc
} from 'firebase/firestore';
import { db } from '../firebase-config';

export interface Discount {
  id?: string;
  discount_code: string;
  type: 'percentage' | 'flat';
  value: number;
  applies_to: string | null; // category document ID or null for all
  branchId: string;
  created_at: Timestamp;
  modified_at: Timestamp;
  created_by: string;
}

const COLLECTION_NAME = 'discounts';

// Create a new discount
export const createDiscount = async (
  branchId: string,
  discountData: Omit<Discount, 'id' | 'created_at' | 'modified_at' | 'branchId'> & { created_by: string }
): Promise<string> => {
  try {
    const docData = {
      ...discountData,
      branchId,
      created_at: Timestamp.now(),
      modified_at: Timestamp.now()
    };
    
    const docRef = await addDoc(collection(db, COLLECTION_NAME), docData);
    return docRef.id;
  } catch (error) {
    console.error('Error creating discount:', error);
    throw new Error('Failed to create discount');
  }
};

// Get all discounts for a branch
export const getDiscounts = async (branchId: string): Promise<Discount[]> => {
  try {
    const q = query(
      collection(db, COLLECTION_NAME), 
      where('branchId', '==', branchId),
      orderBy('created_at', 'desc')
    );
    const querySnapshot = await getDocs(q);
    
    return querySnapshot.docs.map(d => ({
      id: d.id,
      ...d.data()
    } as Discount));
  } catch (error) {
    console.error('Error fetching discounts:', error);
    throw new Error('Failed to fetch discounts');
  }
};

// Update a discount
export const updateDiscount = async (
  branchId: string,
  discountId: string, 
  updates: Partial<Omit<Discount, 'id' | 'discount_code' | 'created_at' | 'created_by' | 'branchId'>>
): Promise<void> => {
  try {
    const discountRef = doc(db, COLLECTION_NAME, discountId);
    await updateDoc(discountRef, {
      ...updates,
      modified_at: Timestamp.now()
    });
  } catch (error) {
    console.error('Error updating discount:', error);
    throw new Error('Failed to update discount');
  }
};

// Delete a discount
export const deleteDiscount = async (discountId: string): Promise<void> => {
  try {
    const discountRef = doc(db, COLLECTION_NAME, discountId);
    await deleteDoc(discountRef);
  } catch (error) {
    console.error('Error deleting discount:', error);
    throw new Error('Failed to delete discount');
  }
};

// Calculate discount amount
export const calculateDiscountAmount = (
  discount: Discount, 
  subtotal: number, 
  categoryIds: string[] = []
): number => {
  // If discount applies to specific category and none of the items match
  if (discount.applies_to && !categoryIds.includes(discount.applies_to)) {
    return 0;
  }
  
  if (discount.type === 'percentage') {
    return Math.round((subtotal * discount.value / 100) * 100) / 100; // Round to 2 decimal places
  } else {
    return Math.min(discount.value, subtotal); // Flat discount can't exceed subtotal
  }
};

// Get discount by code
export const getDiscountByCode = async (branchId: string, discount_code: string): Promise<Discount | null> => {
  try {
    const discounts = await getDiscounts(branchId);
    return discounts.find(discount => discount.discount_code === discount_code) || null;
  } catch (error) {
    console.error('Error getting discount by code:', error);
    throw new Error('Failed to get discount by code');
  }
};

// Validate discount code
export const validateDiscountCode = async (branchId: string, discount_code: string): Promise<boolean> => {
  try {
    const discount = await getDiscountByCode(branchId, discount_code);
    return discount !== null;
  } catch (error) {
    console.error('Error validating discount code:', error);
    return false;
  }
};

// Helper function to check if discounts is empty
export const isDiscountsEmpty = async (branchId: string): Promise<boolean> => {
  try {
    const discounts = await getDiscounts(branchId);
    return discounts.length === 0;
  } catch (error) {
    console.error('Error checking if discounts are empty:', error);
    return true; // Assume empty on error
  }
};

// Search discounts by code
export const searchDiscountsByCode = async (branchId: string, searchTerm: string): Promise<Discount[]> => {
  try {
    const allDiscounts = await getDiscounts(branchId);
    
    return allDiscounts.filter(discount => 
      discount.discount_code.toLowerCase().includes(searchTerm.toLowerCase())
    );
  } catch (error) {
    console.error('Error searching discounts:', error);
    throw new Error('Failed to search discounts');
  }
};

// Real-time listener for discounts
export const subscribeToDiscounts = (branchId: string, callback: (discounts: Discount[]) => void) => {
  try {
    const q = query(
      collection(db, COLLECTION_NAME), 
      where('branchId', '==', branchId),
      orderBy('created_at', 'desc')
    );
    
    const unsubscribe = onSnapshot(q, (querySnapshot) => {
      const discounts: Discount[] = [];
      querySnapshot.forEach((doc) => {
        discounts.push({
          id: doc.id,
          ...doc.data()
        } as Discount);
      });
      
      callback(discounts);
    }, (error) => {
      console.error('Error in discounts subscription:', error);
    });
    
    return unsubscribe;
  } catch (error) {
    console.error('Error setting up discounts subscription:', error);
    throw new Error('Failed to set up real-time discount updates');
  }
};

export const discountService = {
  createDiscount,
  getDiscounts,
  updateDiscount,
  deleteDiscount,
  calculateDiscountAmount,
  getDiscountByCode,
  validateDiscountCode,
  isDiscountsEmpty,
  searchDiscountsByCode,
  subscribeToDiscounts,
};
