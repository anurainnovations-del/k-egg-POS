/**
 * Formats a number as Philippine Peso currency with thousands separators
 * Examples: 1000 -> ₱1,000.00, 1000000 -> ₱1,000,000.00
 */
export const formatCurrency = (amount: number): string => {
  // Handle edge cases
  if (isNaN(amount) || amount === null || amount === undefined) {
    return '₱0.00';
  }

  // Format the number with 2 decimal places and add thousands separators
  const formatted = amount.toLocaleString('en-US', {
    minimumFractionDigits: 2,
    maximumFractionDigits: 2
  });

  return `₱${formatted}`;
};

/**
 * Formats a percentage value
 */
export const formatPercentage = (value: number): string => {
  if (isNaN(value) || value === null || value === undefined) {
    return '0.0%';
  }
  return `${value.toFixed(1)}%`;
};

/**
 * Formats a number with thousands separators (no currency symbol)
 */
export const formatNumber = (value: number): string => {
  if (isNaN(value) || value === null || value === undefined) {
    return '0';
  }
  
  return value.toLocaleString('en-US');
};
