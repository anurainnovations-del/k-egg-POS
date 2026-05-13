"use client";

import { useState, useEffect, useRef } from "react";
import { subscribeToDiscounts, Discount, calculateDiscountAmount } from "@/services/discountService";
import { Category } from "@/services/categoryService";
import { formatCurrency } from "@/lib/currency_formatter";

import { useParams } from "next/navigation";

interface DiscountDropdownProps {
  value: string;
  onChange: (code: string) => void;
  onDiscountApplied: (discount: Discount | null, amount: number) => void;
  subtotal: number;
  cartCategoryIds: string[];
  categories: Category[];
}

export default function DiscountDropdown({
  value,
  onChange,
  onDiscountApplied,
  subtotal,
  cartCategoryIds,
  categories
}: DiscountDropdownProps) {
  const { branchId } = useParams();
  const [discounts, setDiscounts] = useState<Discount[]>([]);
  const [filteredDiscounts, setFilteredDiscounts] = useState<Discount[]>([]);
  const [showSuggestions, setShowSuggestions] = useState(false);
  const [appliedDiscount, setAppliedDiscount] = useState<Discount | null>(null);
  const [isValidCode, setIsValidCode] = useState(false);
  const dropdownRef = useRef<HTMLDivElement>(null);
  const inputRef = useRef<HTMLInputElement>(null);

  // Subscribe to discounts from Firebase
  useEffect(() => {
    if (!branchId) return;
    const unsubscribe = subscribeToDiscounts(branchId as string, (discountsData) => {
      setDiscounts(discountsData);
    });

    return () => {
      if (unsubscribe) {
        unsubscribe();
      }
    };
  }, [branchId]);


  // Filter discounts based on input
  useEffect(() => {
    if (!value) {
      setFilteredDiscounts([]);
      setShowSuggestions(false);
      return;
    }

    const filtered = discounts.filter(discount =>
      discount.discount_code.toLowerCase().includes(value.toLowerCase())
    );

    setFilteredDiscounts(filtered);
    setShowSuggestions(filtered.length > 0 && value.length > 0);
  }, [value, discounts]);

  // Validate current discount code
  useEffect(() => {
    if (!value) {
      setAppliedDiscount(null);
      setIsValidCode(false);
      return;
    }

    const exactMatch = discounts.find(discount => 
      discount.discount_code.toLowerCase() === value.toLowerCase()
    );

    if (exactMatch) {
      setIsValidCode(true);
      setAppliedDiscount(exactMatch);
    } else {
      setIsValidCode(false);
      setAppliedDiscount(null);
    }
  }, [value, discounts]);

  // Handle clicking outside to close suggestions
  useEffect(() => {
    const handleClickOutside = (event: MouseEvent) => {
      if (dropdownRef.current && !dropdownRef.current.contains(event.target as Node)) {
        setShowSuggestions(false);
      }
    };

    document.addEventListener('mousedown', handleClickOutside);
    return () => {
      document.removeEventListener('mousedown', handleClickOutside);
    };
  }, []);

  const handleInputChange = (e: React.ChangeEvent<HTMLInputElement>) => {
    const newValue = e.target.value.toUpperCase();
    onChange(newValue);
  };

  const handleSuggestionClick = (discount: Discount) => {
    onChange(discount.discount_code);
    setShowSuggestions(false);
    inputRef.current?.blur();
  };

  const handleApplyDiscount = () => {
    if (appliedDiscount) {
      const discountAmount = calculateDiscountAmount(
        appliedDiscount, 
        subtotal, 
        cartCategoryIds
      );
      onDiscountApplied(appliedDiscount, discountAmount);
    } else {
      onDiscountApplied(null, 0);
    }
  };

  const getCategoryName = (categoryId: string | null): string => {
    if (!categoryId) return "All Items";
    const category = categories.find(cat => cat.id === categoryId);
    return category ? category.name : "Unknown Category";
  };

  const getDiscountPreview = (discount: Discount): number => {
    return calculateDiscountAmount(discount, subtotal, cartCategoryIds);
  };

  const canApplyDiscount = (discount: Discount): boolean => {
    if (!discount.applies_to) return true; // Applies to all items
    return cartCategoryIds.includes(discount.applies_to);
  };

  const getApplicabilityText = (discount: Discount): string => {
    if (!discount.applies_to) return "Applies to all items";
    const canApply = canApplyDiscount(discount);
    const categoryName = getCategoryName(discount.applies_to);
    return canApply 
      ? `Applies to ${categoryName} (✓ Available in cart)`
      : `Applies to ${categoryName} (✗ Not in cart)`;
  };

  return (
    <div className="relative" ref={dropdownRef}>
      <div className="flex flex-row border border-[var(--accent)] rounded-[6px] bg-[var(--light-accent)]/40">
        <input
          ref={inputRef}
          type="text"
          value={value}
          onChange={handleInputChange}
          onFocus={() => value && filteredDiscounts.length > 0 && setShowSuggestions(true)}
          className="flex-grow py-2 px-4 text-[12px] border-none rounded-l-[6px] focus:outline-none bg-transparent"
          placeholder="Enter discount coupon code"
        />
        <button
          onClick={handleApplyDiscount}
          className={`flex-shrink py-2 px-4 font-bold text-sm rounded-e-[6px] transition-all ${
            isValidCode 
              ? 'bg-[var(--accent)] text-[var(--primary)] hover:bg-[var(--accent)]/80' 
              : 'bg-[var(--accent)]/50 text-[var(--primary)] text-shadow-lg cursor-not-allowed'
          }`}
          disabled={!isValidCode}
        >
          {isValidCode ? (
            <span className="flex items-center gap-1">
              <svg className="w-4 h-4" fill="currentColor" viewBox="0 0 20 20">
                <path fillRule="evenodd" d="M16.707 5.293a1 1 0 010 1.414l-8 8a1 1 0 01-1.414 0l-4-4a1 1 0 011.414-1.414L8 12.586l7.293-7.293a1 1 0 011.414 0z" clipRule="evenodd" />
              </svg>
              APPLY
            </span>
          ) : (
            'APPLY'
          )}
        </button>
      </div>

      {/* Suggestions Dropdown */}
      {showSuggestions && (
        <div className="absolute top-full left-0 right-0 z-50 mt-1 bg-white border border-gray-200 rounded-lg shadow-lg max-h-64 overflow-y-auto">
          {filteredDiscounts.map((discount) => {
            const previewAmount = getDiscountPreview(discount);
            const canApply = canApplyDiscount(discount);
            const applicabilityText = getApplicabilityText(discount);

            return (
              <div
                key={discount.id}
                onClick={() => handleSuggestionClick(discount)}
                className={`p-3 border-b border-gray-100 last:border-b-0 cursor-pointer transition-colors ${
                  canApply ? 'hover:bg-gray-50' : 'bg-gray-50 opacity-75'
                }`}
              >
                <div className="flex items-center justify-between">
                  <div className="flex-1">
                    <div className="flex items-center gap-2">
                      <span className="font-semibold text-[var(--secondary)] text-sm">
                        {discount.discount_code}
                      </span>
                      {!canApply && (
                        <span className="text-xs text-[var(--error)] font-medium">
                          Not applicable
                        </span>
                      )}
                    </div>
                    <div className="text-xs text-[var(--secondary)] opacity-70 mt-1">
                      {discount.type === 'percentage' 
                        ? `${discount.value}% off`
                        : `₱${discount.value} off`
                      }
                      {previewAmount > 0 && canApply && (
                        <span className="text-[var(--success)] font-medium ml-2">
                          (-{formatCurrency(previewAmount)})
                        </span>
                      )}
                    </div>
                    <div className={`text-xs mt-1 ${
                      canApply ? 'text-[var(--success)]' : 'text-[var(--error)]'
                    }`}>
                      {applicabilityText}
                    </div>
                  </div>
                  {canApply && (
                    <div className="text-right">
                      <div className="text-xs text-gray-500">Savings</div>
                      <div className="font-semibold text-[var(--success)]">
                        {formatCurrency(previewAmount)}
                      </div>
                    </div>
                  )}
                </div>
              </div>
            );
          })}
          {filteredDiscounts.length === 0 && value && (
            <div className="p-3 text-center text-gray-500 text-sm">
              No discount codes found matching &quot;{value}&quot;
            </div>
          )}
        </div>
      )}

      {/* Current Discount Info */}
      {appliedDiscount && isValidCode && (
        <div className="mt-2 px-4 py-2 bg-[var(--accent)]/10 border border-dashed border-[var(--accent)] rounded-lg">
          <div className="flex items-center justify-between text-[14px]">
            <div>
              <span className="font-semibold text-[var(--secondary)]">
                {appliedDiscount.discount_code}
              </span>
              <span className="text-[var(--secondary)] ml-2">
                ({appliedDiscount.type === 'percentage' 
                  ? `${appliedDiscount.value}% off`
                  : `₱${appliedDiscount.value} off`
                })
              </span>
            </div>
            <div className="text-right">
              <div className="font-semibold text-[var(--secondary)]">
                -{formatCurrency(getDiscountPreview(appliedDiscount))}
              </div>
            </div>
          </div>
          <div className="text-[10px] text-[var(--secondary)] mt-1">
            {getApplicabilityText(appliedDiscount)}
          </div>
        </div>
      )}
    </div>
  );
}
