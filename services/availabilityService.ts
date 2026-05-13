import { Ingredient } from './ingredientService';
import { MenuItem } from './menuItemService';

/**
 * Returns the maximum number of servings that can be made for a given menu item
 * based on current ingredient stock levels.
 *
 * Returns Infinity if the item has no recipe (no ingredient requirements).
 * Returns 0 if any required ingredient is missing or out of stock.
 */
export const getMaxServings = (
  menuItem: MenuItem,
  ingredientMap: Map<string, Ingredient>
): number => {
  if (!menuItem.recipe || menuItem.recipe.length === 0) return Infinity;

  const servings = menuItem.recipe.map((r) => {
    const ing = ingredientMap.get(r.ingredientId);
    if (!ing || ing.stock <= 0 || r.quantity <= 0) return 0;
    return Math.floor(ing.stock / r.quantity);
  });

  return Math.min(...servings);
};

/**
 * Returns a Map of menuItemId -> maxServings for all menu items.
 * Useful for batch availability checks in the store page.
 */
export const getMenuItemsAvailability = (
  menuItems: MenuItem[],
  ingredients: Ingredient[]
): Map<string, number> => {
  const ingredientMap = new Map<string, Ingredient>(
    ingredients.map((i) => [i.id!, i])
  );

  const result = new Map<string, number>();
  menuItems.forEach((item) => {
    if (item.id) {
      result.set(item.id, getMaxServings(item, ingredientMap));
    }
  });
  return result;
};

/**
 * Returns whether a menu item is currently available (can make at least 1 serving).
 */
export const isMenuItemAvailable = (
  menuItem: MenuItem,
  ingredientMap: Map<string, Ingredient>
): boolean => {
  if (!menuItem.isAvailable) return false;
  return getMaxServings(menuItem, ingredientMap) > 0;
};

/**
 * Calculates the ingredient cost for producing 1 unit of a menu item.
 */
export const calculateRecipeCost = (
  menuItem: MenuItem,
  ingredientMap: Map<string, Ingredient>
): number => {
  if (!menuItem.recipe || menuItem.recipe.length === 0) return 0;
  return menuItem.recipe.reduce((total, r) => {
    const ing = ingredientMap.get(r.ingredientId);
    if (!ing) return total;
    return total + r.quantity * ing.costPerUnit;
  }, 0);
};
