"use client";

import React, { useState, useEffect } from 'react';
import { Discount, discountService } from '@/services/discountService';
import { useAuth } from '@/contexts/AuthContext';
import { subscribeToCategories } from '@/stores/dataStore';
import { Category } from '@/services/categoryService';
import { useBranch } from '@/contexts/BranchContext';
import DiscountsIcon from '@/components/icons/SidebarNav/DiscountsIcon';

interface DiscountModalProps {
  isOpen: boolean;
  onClose: () => void;
  discount?: Discount | null;
  onSuccess?: () => void;
}

export default function DiscountModal({ isOpen, onClose, discount, onSuccess }: DiscountModalProps) {
  const { user } = useAuth();
  const { currentBranch } = useBranch();
  const [loading, setLoading] = useState(false);
  const [categories, setCategories] = useState<Category[]>([]);
  
  const [formData, setFormData] = useState({
    discount_code: '',
    type: 'flat' as 'percentage' | 'flat',
    value: 0,
    applies_to: null as string | null
  });

  useEffect(() => {
    const unsubscribe = subscribeToCategories(setCategories);
    return unsubscribe;
  }, []);

  useEffect(() => {
    if (discount) {
      setFormData({
        discount_code: discount.discount_code,
        type: discount.type,
        value: discount.value,
        applies_to: discount.applies_to
      });
    } else {
      setFormData({
        discount_code: '',
        type: 'flat',
        value: 0,
        applies_to: null
      });
    }
  }, [discount, isOpen]);

  const handleSubmit = async (e: React.FormEvent) => {
    e.preventDefault();
    if (!user || !currentBranch) return;
    if (!formData.discount_code.trim()) return;

    setLoading(true);
    try {
      if (discount) {
        await discountService.updateDiscount(currentBranch.id, discount.id!, {
          ...formData
        });
      } else {
        await discountService.createDiscount(currentBranch.id, {
          ...formData,
          discount_code: formData.discount_code.trim().toUpperCase(),
          created_by: user.uid
        });
      }
      onSuccess?.();
      onClose();
    } catch (error) {
      console.error('Error saving discount:', error);
      alert('Failed to save discount.');
    } finally {
      setLoading(false);
    }
  };

  if (!isOpen) return null;

  return (
    <div className="fixed inset-0 bg-black/40 backdrop-blur-sm flex items-center justify-center z-50 px-4">
      <div className="bg-white rounded-2xl p-6 w-full max-w-md shadow-2xl">
        <div className="text-center mb-6">
          <div className="w-14 h-14 bg-[var(--light-accent)] rounded-xl mx-auto mb-3 flex items-center justify-center">
            <DiscountsIcon className='text-[var(--accent)] w-8 h-8'/>
          </div>
          <h3 className="text-xl font-bold text-[var(--secondary)]">
            {discount ? 'Edit Discount' : 'New Discount'}
          </h3>
        </div>

        <form onSubmit={handleSubmit} className="space-y-4">
          <div>
            <label className="block text-[10px] font-bold text-gray-500 uppercase mb-1">Discount Code</label>
            <input
              type="text"
              value={formData.discount_code}
              onChange={(e) => setFormData({ ...formData, discount_code: e.target.value })}
              className="w-full px-4 py-2 border border-gray-200 rounded-xl focus:ring-2 focus:ring-[var(--accent)] outline-none font-bold"
              placeholder="E.G. PROMO20"
              disabled={!!discount}
              required
            />
          </div>

          <div className="grid grid-cols-2 gap-4">
            <div>
              <label className="block text-[10px] font-bold text-gray-500 uppercase mb-1">Type</label>
              <select
                value={formData.type}
                onChange={(e) =>
                  setFormData({
                    ...formData,
                    type: e.target.value as Discount['type'],
                  })
                }
                className="w-full px-4 py-2 border border-gray-200 rounded-xl outline-none bg-white"
              >
                <option value="flat">₱ Flat</option>
                <option value="percentage">% Percentage</option>
              </select>
            </div>
            <div>
              <label className="block text-[10px] font-bold text-gray-500 uppercase mb-1">Value</label>
              <input
                type="number"
                value={formData.value}
                onChange={(e) => setFormData({ ...formData, value: Number(e.target.value) })}
                className="w-full px-4 py-2 border border-gray-200 rounded-xl focus:ring-2 focus:ring-[var(--accent)] outline-none"
                required
              />
            </div>
          </div>

          <div>
            <label className="block text-[10px] font-bold text-gray-500 uppercase mb-1">Applies To</label>
            <select
              value={formData.applies_to || ''}
              onChange={(e) => setFormData({ ...formData, applies_to: e.target.value || null })}
              className="w-full px-4 py-2 border border-gray-200 rounded-xl outline-none bg-white"
            >
              <option value="">All Categories</option>
              {categories.map((c) => (
                <option key={c.id} value={c.id}>{c.name}</option>
              ))}
            </select>
          </div>

          <div className="flex gap-3 pt-4">
            <button type="button" onClick={onClose} className="flex-1 py-2 text-sm font-bold text-gray-500 border border-gray-200 rounded-xl">Cancel</button>
            <button
              type="submit"
              disabled={loading}
              className="flex-[2] py-2 bg-[var(--accent)] text-[var(--secondary)] font-bold rounded-xl shadow-md disabled:opacity-50"
            >
              {loading ? 'Saving...' : 'Save Discount'}
            </button>
          </div>
        </form>
      </div>
    </div>
  );
}
