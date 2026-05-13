import { MenuItem } from './menuItemService';
import { bulkDeductIngredientStock } from './ingredientService';

export interface IngredientDeduction {
  ingredientId: string;
  ingredientName: string;
  quantityUsed: number;
  unit: string;
}

export interface CartItem {
  id: string;       // menuItemId
  quantity: number;
  [key: string]: unknown;
}

/**
 * Calculates total ingredient deductions needed for a cart of menu items.
 * Groups deductions by ingredientId and sums quantities across all cart items.
 */
export const calculateDeductions = (
  cartItems: CartItem[],
  menuItemsMap: Map<string, MenuItem>
): IngredientDeduction[] => {
  const deductionMap = new Map<string, IngredientDeduction>();

  cartItems.forEach((cartItem) => {
    const menuItem = menuItemsMap.get(cartItem.id);
    if (!menuItem || !menuItem.recipe) return;

    menuItem.recipe.forEach((r) => {
      const totalNeeded = r.quantity * cartItem.quantity;
      const existing = deductionMap.get(r.ingredientId);

      if (existing) {
        existing.quantityUsed += totalNeeded;
      } else {
        deductionMap.set(r.ingredientId, {
          ingredientId: r.ingredientId,
          ingredientName: r.ingredientName,
          quantityUsed: totalNeeded,
          unit: r.unit,
        });
      }
    });
  });

  return Array.from(deductionMap.values());
};

/**
 * Applies ingredient deductions to Firestore.
 * Called after a successful order is created.
 */
export const applyIngredientDeductions = async (
  branchId: string,
  deductions: IngredientDeduction[]
): Promise<void> => {
  const updates = deductions.map((d) => ({
    id: d.ingredientId,
    amount: d.quantityUsed,
  }));
  await bulkDeductIngredientStock(branchId, updates);
};
