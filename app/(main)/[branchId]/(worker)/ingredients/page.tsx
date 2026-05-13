"use client";

import { useState, useEffect } from "react";
import { Ingredient } from "@/services/ingredientService";
import { subscribeToIngredients, subscribeToCategories } from "@/stores/dataStore";
import { Category } from "@/services/categoryService";
import { useBranch } from "@/contexts/BranchContext";
import TopBar from "@/components/TopBar";
import MobileTopBar from "@/components/MobileTopBar";
import LoadingSpinner from "@/components/LoadingSpinner";
import IngredientsIcon from "@/components/icons/SidebarNav/IngredientsIcon";
import { formatCurrency } from "@/lib/currency_formatter";
import ManagerOverrideModal from "@/components/ManagerOverrideModal";
import { useRealtimeData } from "@/contexts/RealtimeDataContext";
import { ingredientService } from "@/services/ingredientService";
import { useAuth } from "@/contexts/AuthContext";
import { AnimatePresence, motion } from "motion/react";

function StockBadge({ stock, threshold }: { stock: number; threshold: number }) {
  if (stock === 0) return <span className="px-2 py-0.5 rounded-full text-xs font-bold bg-red-100 text-red-700">Out</span>;
  if (stock <= threshold) return <span className="px-2 py-0.5 rounded-full text-xs font-bold bg-amber-100 text-amber-700">Low</span>;
  return <span className="px-2 py-0.5 rounded-full text-xs font-bold bg-green-100 text-green-700">OK</span>;
}

export default function IngredientsViewPage() {
  const { currentBranch } = useBranch();
  const { ingredients, categories, loading: realtimeLoading } = useRealtimeData();
  const loading = realtimeLoading.ingredients || realtimeLoading.categories;
  const [search, setSearch] = useState("");
  const [filterCat, setFilterCat] = useState("");

  const [restockItem, setRestockItem] = useState<Ingredient | null>(null);
  const [restockAmount, setRestockAmount] = useState<number | "">("");
  const [isRestockModalOpen, setIsRestockModalOpen] = useState(false);
  const [isOverrideModalOpen, setIsOverrideModalOpen] = useState(false);


  const { user } = useAuth();
  
  const ingCategories = categories.filter((c) => c.type === "ingredient");
  const getCatName = (id: string) => categories.find((c) => c.id === id)?.name ?? "—";

  const filtered = ingredients.filter((i) => {
    const matchSearch = !search || i.name.toLowerCase().includes(search.toLowerCase());
    const matchCat = !filterCat || i.categoryId === filterCat;
    return matchSearch && matchCat;
  });

  const lowCount = ingredients.filter((i) => i.stock > 0 && i.stock <= i.lowStockThreshold).length;
  const outCount = ingredients.filter((i) => i.stock === 0).length;

  const handleRestockClick = (item: Ingredient) => {
    setRestockItem(item);
    setRestockAmount("");
    setIsRestockModalOpen(true);
  };

  const handleRestockSubmit = () => {
    if (!restockAmount || Number(restockAmount) <= 0) return;
    setIsRestockModalOpen(false);
    setIsOverrideModalOpen(true);
  };

  const executeRestock = async () => {
    if (!currentBranch || !restockItem || !restockAmount) return;
    
    try {
      const performer = user ? { id: user.uid, name: user.displayName || user.email || "Unknown" } : undefined;
      
      await ingredientService.updateIngredient(currentBranch.id, restockItem.id!, {
        stock: restockItem.stock + Number(restockAmount)
      }, performer);

      setRestockItem(null);
      setRestockAmount("");
      setIsOverrideModalOpen(false);
    } catch (error) {
      console.error("Failed to restock:", error);
      // We could add a toast error here
    }
  };

  return (
    <div className="flex flex-col h-full overflow-hidden">
      <div className="xl:hidden w-full">
        <MobileTopBar title="Ingredients" icon={<IngredientsIcon className="w-6 h-6" />} showTimeTracking={false} onOrderClick={() => {}} />
      </div>
      <div className="hidden xl:block w-full">
        <TopBar title="Ingredients" icon={<IngredientsIcon className="w-6 h-6" />} showTimeTracking={false} />
      </div>

      <div className="flex-1 overflow-y-auto px-6 py-4 space-y-4">
        {/* Summary badges */}
        <div className="flex gap-3 flex-wrap">
          <div className="bg-white rounded-xl px-4 py-2.5 shadow-sm border border-[var(--border)] text-sm">
            <span className="text-[var(--secondary)]/60">Total: </span>
            <span className="font-bold text-[var(--secondary)]">{ingredients.length}</span>
          </div>
          {outCount > 0 && (
            <div className="bg-red-50 border border-red-200 rounded-xl px-4 py-2.5 text-sm font-semibold text-red-700">
              🔴 {outCount} out of stock
            </div>
          )}
          {lowCount > 0 && (
            <div className="bg-amber-50 border border-amber-200 rounded-xl px-4 py-2.5 text-sm font-semibold text-amber-700">
              🟡 {lowCount} low stock
            </div>
          )}
        </div>

        {/* Filters */}
        <div className="flex gap-3 flex-wrap">
          <input value={search} onChange={(e) => setSearch(e.target.value)} placeholder="Search ingredients…"
            className="flex-1 min-w-[200px] px-4 py-2 rounded-xl border border-[var(--border)] text-sm bg-white focus:outline-none focus:ring-2 focus:ring-[var(--accent)]" />
          <select value={filterCat} onChange={(e) => setFilterCat(e.target.value)}
            className="px-4 py-2 rounded-xl border border-[var(--border)] text-sm bg-white focus:outline-none focus:ring-2 focus:ring-[var(--accent)]">
            <option value="">All Categories</option>
            {ingCategories.map((c) => <option key={c.id} value={c.id}>{c.name}</option>)}
          </select>
        </div>

        {/* Table */}
        {loading ? (
          <div className="flex items-center justify-center py-12 gap-3">
            <LoadingSpinner size="lg" />
            <span className="text-sm text-[var(--secondary)]/60">Loading ingredients…</span>
          </div>
        ) : filtered.length === 0 ? (
          <div className="flex flex-col items-center justify-center py-16 opacity-50">
            <IngredientsIcon className="w-14 h-14 text-[var(--secondary)]" />
            <p className="mt-3 font-semibold text-[var(--secondary)]">No ingredients found</p>
          </div>
        ) : (
          <div className="bg-white rounded-2xl shadow-sm border border-[var(--border)] overflow-hidden">
            <table className="w-full text-sm">
              <thead className="bg-[var(--background)]">
                <tr>
                  <th className="text-left px-4 py-3 font-semibold text-[var(--secondary)]/70">Ingredient</th>
                  <th className="text-left px-4 py-3 font-semibold text-[var(--secondary)]/70">Category</th>
                  <th className="text-right px-4 py-3 font-semibold text-[var(--secondary)]/70">Stock</th>
                  <th className="text-right px-4 py-3 font-semibold text-[var(--secondary)]/70">Unit</th>
                  <th className="text-center px-4 py-3 font-semibold text-[var(--secondary)]/70">Status</th>
                  <th className="text-center px-4 py-3 font-semibold text-[var(--secondary)]/70">Action</th>
                </tr>
              </thead>
              <tbody className="divide-y divide-[var(--border)]">
                {filtered.map((ing) => (
                  <tr key={ing.id} className="hover:bg-[var(--background)]/50 transition-colors">
                    <td className="px-4 py-3 font-medium text-[var(--secondary)]">{ing.name}</td>
                    <td className="px-4 py-3 text-[var(--secondary)]/60">{getCatName(ing.categoryId)}</td>
                    <td className="px-4 py-3 text-right font-bold text-[var(--secondary)]">{ing.stock}</td>
                    <td className="px-4 py-3 text-right text-[var(--secondary)]/60">{ing.unit}</td>
                    <td className="px-4 py-3 text-center">
                      <StockBadge stock={ing.stock} threshold={ing.lowStockThreshold} />
                    </td>
                    <td className="px-4 py-3 text-center">
                      <button
                        onClick={() => handleRestockClick(ing)}
                        className="text-xs font-bold px-3 py-1.5 rounded-lg bg-[var(--accent)] text-[var(--secondary)] hover:brightness-110 transition-colors shadow-sm"
                      >
                        Restock
                      </button>
                    </td>
                  </tr>
                ))}
              </tbody>
            </table>
          </div>
        )}
      </div>

      {/* Restock Amount Modal */}
      <AnimatePresence>
        {isRestockModalOpen && restockItem && (
          <motion.div
            initial={{ opacity: 0 }}
            animate={{ opacity: 1 }}
            exit={{ opacity: 0 }}
            className="fixed inset-0 z-50 flex items-center justify-center bg-black/40 backdrop-blur-sm px-4"
            onClick={() => setIsRestockModalOpen(false)}
          >
            <motion.div
              initial={{ opacity: 0, y: 14, scale: 0.98 }}
              animate={{ opacity: 1, y: 0, scale: 1 }}
              exit={{ opacity: 0, y: 10, scale: 0.98 }}
              className="bg-white rounded-2xl shadow-2xl p-6 w-full max-w-sm"
              onClick={(e) => e.stopPropagation()}
            >
              <h3 className="text-xl font-bold text-[var(--secondary)] mb-2">Restock {restockItem.name}</h3>
              <p className="text-sm text-gray-500 mb-6">
                Current stock: <span className="font-bold">{restockItem.stock}</span> {restockItem.unit}
              </p>
              
              <div className="mb-6">
                <label className="block text-xs font-bold text-[var(--secondary)]/60 uppercase mb-2">Amount to Add</label>
                <div className="flex items-center gap-3">
                  <input 
                    type="number" 
                    min="1"
                    placeholder="0"
                    value={restockAmount}
                    onChange={(e) => setRestockAmount(e.target.value === "" ? "" : Number(e.target.value))}
                    className="flex-1 px-4 py-3 text-lg font-bold rounded-xl border-2 border-[var(--border)] focus:border-[var(--accent)] outline-none" 
                  />
                  <span className="font-bold text-[var(--secondary)]">{restockItem.unit}</span>
                </div>
              </div>

              <div className="flex gap-3">
                <button 
                  onClick={() => setIsRestockModalOpen(false)}
                  className="flex-1 py-3 rounded-xl border border-[var(--border)] font-bold text-gray-600 hover:bg-gray-50 transition-colors"
                >
                  Cancel
                </button>
                <button 
                  onClick={handleRestockSubmit}
                  disabled={!restockAmount || Number(restockAmount) <= 0}
                  className="flex-1 py-3 rounded-xl bg-[var(--accent)] text-[var(--secondary)] font-bold hover:brightness-110 transition-colors disabled:opacity-50"
                >
                  Continue
                </button>
              </div>
            </motion.div>
          </motion.div>
        )}
      </AnimatePresence>

      <ManagerOverrideModal 
        isOpen={isOverrideModalOpen}
        onClose={() => {
          setIsOverrideModalOpen(false);
        }}
        onSuccess={executeRestock}
        actionName={`Restock ${restockItem?.name} by ${restockAmount} ${restockItem?.unit}`}
      />
    </div>
  );
}
