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

function StockBadge({ stock, threshold }: { stock: number; threshold: number }) {
  if (stock === 0) return <span className="px-2 py-0.5 rounded-full text-xs font-bold bg-red-100 text-red-700">Out</span>;
  if (stock <= threshold) return <span className="px-2 py-0.5 rounded-full text-xs font-bold bg-amber-100 text-amber-700">Low</span>;
  return <span className="px-2 py-0.5 rounded-full text-xs font-bold bg-green-100 text-green-700">OK</span>;
}

export default function IngredientsViewPage() {
  const { currentBranch } = useBranch();
  const [ingredients, setIngredients] = useState<Ingredient[]>([]);
  const [categories, setCategories] = useState<Category[]>([]);
  const [loading, setLoading] = useState(true);
  const [isClient, setIsClient] = useState(false);
  const [search, setSearch] = useState("");
  const [filterCat, setFilterCat] = useState("");

  useEffect(() => { setIsClient(true); }, []);

  useEffect(() => {
    if (!isClient || !currentBranch) return;
    setLoading(true);
    const unsub = subscribeToIngredients(currentBranch.id, (items) => {
      setIngredients(items);
      setLoading(false);
    });
    return () => unsub();
  }, [isClient, currentBranch]);

  useEffect(() => {
    if (!isClient) return;
    const unsub = subscribeToCategories(setCategories);
    return () => unsub();
  }, [isClient]);

  const ingCategories = categories.filter((c) => c.type === "ingredient");
  const getCatName = (id: string) => categories.find((c) => c.id === id)?.name ?? "—";

  const filtered = ingredients.filter((i) => {
    const matchSearch = !search || i.name.toLowerCase().includes(search.toLowerCase());
    const matchCat = !filterCat || i.categoryId === filterCat;
    return matchSearch && matchCat;
  });

  const lowCount = ingredients.filter((i) => i.stock > 0 && i.stock <= i.lowStockThreshold).length;
  const outCount = ingredients.filter((i) => i.stock === 0).length;

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
                  </tr>
                ))}
              </tbody>
            </table>
          </div>
        )}
      </div>
    </div>
  );
}
