"use client";

import { useState, useEffect } from "react";
import { Ingredient, ingredientService } from "@/services/ingredientService";
import { subscribeToIngredients, subscribeToCategories } from "@/stores/dataStore";
import { Category } from "@/services/categoryService";
import { useBranch } from "@/contexts/BranchContext";
import { restockService } from "@/services/restockService";
import TopBar from "@/components/TopBar";
import MobileTopBar from "@/components/MobileTopBar";
import LoadingSpinner from "@/components/LoadingSpinner";
import IngredientsIcon from "@/components/icons/SidebarNav/IngredientsIcon";
import PlusIcon from "@/components/icons/PlusIcon";
import ImageUpload from "@/components/ImageUpload";
import { MEDIA_BUCKETS } from "@/lib/firebaseStorage";
import { AnimatePresence, motion } from "motion/react";

// ─── Modals ───────────────────────────────────────────────────────────────────

function IngredientModal({ 
  isOpen, onClose, ingredient, categories, onSave 
}: { 
  isOpen: boolean; onClose: () => void; ingredient?: Ingredient | null; categories: Category[]; onSave: (data: Partial<Ingredient>) => Promise<void> 
}) {
  const [formData, setFormData] = useState<Partial<Ingredient>>({
    name: "", unit: "pcs", stock: 0, lowStockThreshold: 10, categoryId: "", costPerUnit: 0, imgUrl: ""
  });
  const [saving, setSaving] = useState(false);

  useEffect(() => {
    if (ingredient) {
      setFormData({
        name: ingredient.name ?? "",
        unit: ingredient.unit ?? "pcs",
        stock: ingredient.stock ?? 0,
        lowStockThreshold: ingredient.lowStockThreshold ?? 10,
        categoryId: ingredient.categoryId ?? categories[0]?.id ?? "",
        costPerUnit: ingredient.costPerUnit ?? 0,
        imgUrl: ingredient.imgUrl ?? "",
      });
    } else {
      setFormData({
        name: "",
        unit: "pcs",
        stock: 0,
        lowStockThreshold: 10,
        categoryId: categories[0]?.id || "",
        costPerUnit: 0,
        imgUrl: "",
      });
    }
  }, [ingredient, categories, isOpen]);

  return (
    <AnimatePresence>
      {isOpen && (
        <motion.div
          initial={{ opacity: 0 }}
          animate={{ opacity: 1 }}
          exit={{ opacity: 0 }}
          transition={{ duration: 0.2 }}
          className="fixed inset-0 z-50 flex items-center justify-center bg-black/40 backdrop-blur-sm px-4"
          onClick={() => !saving && onClose()}
        >
          <motion.div
            initial={{ opacity: 0, y: 14, scale: 0.98 }}
            animate={{ opacity: 1, y: 0, scale: 1 }}
            exit={{ opacity: 0, y: 10, scale: 0.98 }}
            transition={{ duration: 0.2 }}
            className="bg-white rounded-2xl shadow-2xl p-6 w-full max-w-md"
            onClick={(e) => e.stopPropagation()}
          >
        <h3 className="text-xl font-bold text-[var(--secondary)] mb-4">{ingredient ? "Edit Ingredient" : "Add Ingredient"}</h3>
        <div className="space-y-4">
          <div>
            <label className="block text-xs font-bold text-[var(--secondary)]/60 uppercase mb-1">Name</label>
            <input value={formData.name ?? ""} onChange={e => setFormData({...formData, name: e.target.value})} className="w-full px-4 py-2 rounded-xl border border-[var(--border)] focus:ring-2 focus:ring-[var(--accent)] outline-none transition-shadow" placeholder="e.g. Fresh Eggs" />
          </div>
          <div className="grid grid-cols-2 gap-4">
            <div>
              <label className="block text-xs font-bold text-[var(--secondary)]/60 uppercase mb-1">Unit</label>
              <input value={formData.unit ?? ""} onChange={e => setFormData({...formData, unit: e.target.value})} className="w-full px-4 py-2 rounded-xl border border-[var(--border)] focus:ring-2 focus:ring-[var(--accent)] outline-none transition-shadow" placeholder="pcs, ml, g..." />
            </div>
            <div>
              <label className="block text-xs font-bold text-[var(--secondary)]/60 uppercase mb-1">Category</label>
              <select value={formData.categoryId ?? ""} onChange={e => setFormData({...formData, categoryId: e.target.value})} className="w-full px-4 py-2 rounded-xl border border-[var(--border)] focus:ring-2 focus:ring-[var(--accent)] outline-none transition-shadow">
                {categories.map(c => <option key={c.id} value={c.id}>{c.name}</option>)}
              </select>
            </div>
          </div>
          <div className="grid grid-cols-2 gap-4">
            <div>
              <label className="block text-xs font-bold text-[var(--secondary)]/60 uppercase mb-1">Initial Stock</label>
              <input type="number" value={formData.stock ?? 0} onChange={e => setFormData({...formData, stock: Number(e.target.value)})} className="w-full px-4 py-2 rounded-xl border border-[var(--border)] focus:ring-2 focus:ring-[var(--accent)] outline-none transition-shadow" disabled={!!ingredient} />
            </div>
            <div>
              <label className="block text-xs font-bold text-[var(--secondary)]/60 uppercase mb-1">Low Threshold</label>
              <input type="number" value={formData.lowStockThreshold ?? 0} onChange={e => setFormData({...formData, lowStockThreshold: Number(e.target.value)})} className="w-full px-4 py-2 rounded-xl border border-[var(--border)] focus:ring-2 focus:ring-[var(--accent)] outline-none transition-shadow" />
            </div>
          </div>
          <ImageUpload
            currentImageUrl={formData.imgUrl ?? ""}
            onImageUpload={(imageUrl) => setFormData((prev) => ({ ...prev, imgUrl: imageUrl }))}
            onImageRemove={() => setFormData((prev) => ({ ...prev, imgUrl: "" }))}
            label="Ingredient Photo"
            bucket={MEDIA_BUCKETS.INGREDIENTS}
          />
        </div>
        <div className="flex gap-3 mt-8">
          <button onClick={() => !saving && onClose()} className="flex-1 py-2.5 rounded-xl border-2 border-[var(--border)] font-semibold hover:bg-gray-50 transition-all active:scale-95">Cancel</button>
          <button 
            disabled={saving || !formData.name || !formData.categoryId}
            onClick={async () => {
              setSaving(true);
              try {
                await onSave(formData);
                onClose();
              } finally {
                setSaving(false);
              }
            }}
            className="flex-[2] py-2.5 rounded-xl bg-[var(--accent)] text-[var(--secondary)] font-bold shadow-md hover:bg-[var(--accent)]/80 transition-all active:scale-95 disabled:opacity-50 disabled:cursor-not-allowed disabled:active:scale-100"
          >
            {saving ? "Saving..." : "Save Ingredient"}
          </button>
        </div>
          </motion.div>
        </motion.div>
      )}
    </AnimatePresence>
  );
}

function RestockModal({ 
  isOpen, onClose, ingredient, onRestock 
}: { 
  isOpen: boolean; onClose: () => void; ingredient: Ingredient; onRestock: (qty: number, cost: number, note: string) => Promise<void> 
}) {
  const [qty, setQty] = useState(0);
  const [cost, setCost] = useState(0);
  const [note, setNote] = useState("");
  const [saving, setSaving] = useState(false);

  return (
    <AnimatePresence>
      {isOpen && (
        <motion.div
          initial={{ opacity: 0 }}
          animate={{ opacity: 1 }}
          exit={{ opacity: 0 }}
          transition={{ duration: 0.2 }}
          className="fixed inset-0 z-50 flex items-center justify-center bg-black/40 backdrop-blur-sm px-4"
          onClick={() => !saving && onClose()}
        >
          <motion.div
            initial={{ opacity: 0, y: 14, scale: 0.98 }}
            animate={{ opacity: 1, y: 0, scale: 1 }}
            exit={{ opacity: 0, y: 10, scale: 0.98 }}
            transition={{ duration: 0.2 }}
            className="bg-white rounded-2xl shadow-2xl p-6 w-full max-w-sm"
            onClick={(e) => e.stopPropagation()}
          >
        <h3 className="text-xl font-bold text-[var(--secondary)] mb-1">Restock Ingredient</h3>
        <p className="text-sm text-[var(--secondary)]/60 mb-6">{ingredient.name} (Current: {ingredient.stock} {ingredient.unit})</p>
        
        <div className="space-y-4">
          <div>
            <label className="block text-xs font-bold text-[var(--secondary)]/60 uppercase mb-1">Quantity to Add ({ingredient.unit})</label>
            <input type="number" value={qty} onChange={e => setQty(Number(e.target.value))} className="w-full px-4 py-3 text-lg font-bold rounded-xl border-2 border-[var(--accent)] focus:ring-2 focus:ring-[var(--accent)] outline-none" />
          </div>
          <div>
            <label className="block text-xs font-bold text-[var(--secondary)]/60 uppercase mb-1">Total Cost (Optional)</label>
            <input type="number" value={cost} onChange={e => setCost(Number(e.target.value))} className="w-full px-4 py-2 rounded-xl border border-[var(--border)] outline-none" placeholder="₱0.00" />
          </div>
          <div>
            <label className="block text-xs font-bold text-[var(--secondary)]/60 uppercase mb-1">Note</label>
            <input value={note} onChange={e => setNote(e.target.value)} className="w-full px-4 py-2 rounded-xl border border-[var(--border)] outline-none" placeholder="Supplier name, batch #..." />
          </div>
        </div>

        <div className="flex gap-3 mt-8">
          <button onClick={() => !saving && onClose()} className="flex-1 py-2.5 rounded-xl border-2 border-[var(--border)] font-semibold transition-all hover:bg-gray-50 active:scale-95">Cancel</button>
          <button 
            disabled={saving || qty <= 0}
            onClick={async () => {
              setSaving(true);
              try {
                await onRestock(qty, cost, note);
                onClose();
              } finally {
                setSaving(false);
              }
            }}
            className="flex-[2] py-2.5 rounded-xl bg-[var(--accent)] text-[var(--secondary)] font-bold shadow-md transition-all hover:brightness-110 active:scale-95 disabled:opacity-50 disabled:cursor-not-allowed disabled:hover:brightness-100 disabled:active:scale-100"
          >
            {saving ? "Updating..." : "Confirm Restock"}
          </button>
        </div>
          </motion.div>
        </motion.div>
      )}
    </AnimatePresence>
  );
}

// ─── Main Page ────────────────────────────────────────────────────────────────

export default function ManagerIngredientsPage() {
  const { currentBranch } = useBranch();
  const [ingredients, setIngredients] = useState<Ingredient[]>([]);
  const [categories, setCategories] = useState<Category[]>([]);
  const [loading, setLoading] = useState(true);
  const [isClient, setIsClient] = useState(false);
  
  const [search, setSearch] = useState("");
  const [filterCat, setFilterCat] = useState("");
  
  const [modalOpen, setModalOpen] = useState(false);
  const [selectedIng, setSelectedIng] = useState<Ingredient | null>(null);
  const [restockOpen, setRestockOpen] = useState(false);

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

  const ingCategories = categories.filter(c => c.type === 'ingredient');
  const getCatName = (id: string) => categories.find(c => c.id === id)?.name ?? "—";

  const filtered = ingredients.filter(i => {
    const matchSearch = !search || i.name.toLowerCase().includes(search.toLowerCase());
    const matchCat = !filterCat || i.categoryId === filterCat;
    return matchSearch && matchCat;
  });

  const handleSave = async (data: Partial<Ingredient>) => {
    if (!currentBranch) return;
    if (selectedIng) {
      await ingredientService.updateIngredient(currentBranch.id, selectedIng.id!, data);
    } else {
      const { id, branchId, createdAt, updatedAt, ...ingData } = data as any;
      await ingredientService.addIngredient(currentBranch.id, ingData);
    }
  };

  const handleRestock = async (qty: number, cost: number, note: string) => {
    if (!selectedIng || !currentBranch) return;
    await restockService.logRestock(selectedIng.id!, qty, cost, note, currentBranch.id);
  };

  const handleDelete = async (id: string) => {
    if (confirm("Are you sure you want to delete this ingredient? This cannot be undone.")) {
      await ingredientService.deleteIngredient(id);
    }
  };

  return (
    <div className="flex flex-col h-full overflow-hidden">
      <div className="xl:hidden w-full">
        <MobileTopBar title="Manage Ingredients" icon={<IngredientsIcon className="w-6 h-6" />} showTimeTracking={false} onOrderClick={() => {}} />
      </div>
      <div className="hidden xl:block w-full">
        <TopBar title="Manage Ingredients" icon={<IngredientsIcon className="w-6 h-6" />} showTimeTracking={false} />
      </div>

      <div className="flex-1 overflow-y-auto px-6 py-6 space-y-6">
        <div className="flex items-center justify-between gap-4 flex-wrap">
          <div className="flex gap-3">
            <input value={search} onChange={e => setSearch(e.target.value)} placeholder="Search ingredients..." 
              className="px-4 py-2 rounded-xl border border-[var(--border)] text-sm bg-white focus:ring-2 focus:ring-[var(--accent)] outline-none min-w-[240px]" />
            <select value={filterCat} onChange={e => setFilterCat(e.target.value)} className="px-4 py-2 rounded-xl border border-[var(--border)] text-sm bg-white outline-none">
              <option value="">All Categories</option>
              {ingCategories.map(c => <option key={c.id} value={c.id}>{c.name}</option>)}
            </select>
          </div>
          <button 
            onClick={() => { setSelectedIng(null); setModalOpen(true); }}
            className="bg-[var(--accent)] text-[var(--secondary)] px-5 py-2 rounded-xl font-bold shadow-md hover:scale-105 active:scale-95 transition-all flex items-center gap-2"
          >
            <PlusIcon className="w-4 h-4" /> ADD INGREDIENT
          </button>
        </div>

        {loading ? (
          <div className="flex items-center justify-center py-20"><LoadingSpinner size="lg" /></div>
        ) : (
          <div className="bg-white rounded-2xl shadow-sm border border-[var(--border)] overflow-hidden">
            <table className="w-full text-sm">
              <thead className="bg-[var(--background)]">
                <tr>
                  <th className="text-left px-6 py-4 font-bold text-[var(--secondary)]/70 uppercase text-[10px] tracking-wider">Ingredient</th>
                  <th className="text-left px-6 py-4 font-bold text-[var(--secondary)]/70 uppercase text-[10px] tracking-wider">Category</th>
                  <th className="text-right px-6 py-4 font-bold text-[var(--secondary)]/70 uppercase text-[10px] tracking-wider">Stock</th>
                  <th className="text-right px-6 py-4 font-bold text-[var(--secondary)]/70 uppercase text-[10px] tracking-wider">Status</th>
                  <th className="text-center px-6 py-4 font-bold text-[var(--secondary)]/70 uppercase text-[10px] tracking-wider">Actions</th>
                </tr>
              </thead>
              <tbody className="divide-y divide-[var(--border)]">
                {filtered.map(ing => (
                  <tr key={ing.id} className="hover:bg-[var(--background)]/30 transition-colors">
                    <td className="px-6 py-4">
                      <div className="font-bold text-[var(--secondary)]">{ing.name}</div>
                      <div className="text-[10px] text-[var(--secondary)]/50 uppercase">Unit: {ing.unit}</div>
                    </td>
                    <td className="px-6 py-4 text-[var(--secondary)]/60">{getCatName(ing.categoryId)}</td>
                    <td className="px-6 py-4 text-right">
                      <div className="font-black text-[var(--secondary)] text-base">{ing.stock}</div>
                    </td>
                    <td className="px-6 py-4 text-right">
                      {ing.stock === 0 ? <span className="text-red-600 font-bold">OUT</span> : 
                       ing.stock <= ing.lowStockThreshold ? <span className="text-amber-600 font-bold">LOW</span> : 
                       <span className="text-green-600 font-bold">OK</span>}
                    </td>
                    <td className="px-6 py-4">
                      <div className="flex items-center justify-center gap-2">
                        <button onClick={() => { setSelectedIng(ing); setRestockOpen(true); }} className="px-3 py-1 bg-green-100 text-green-700 rounded-lg font-bold text-[10px] hover:bg-green-200 transition-colors">RESTOCK</button>
                        <button onClick={() => { setSelectedIng(ing); setModalOpen(true); }} className="p-2 text-[var(--secondary)]/60 hover:text-[var(--secondary)] hover:bg-gray-100 rounded-lg transition-colors">
                          <svg className="w-4 h-4" fill="none" stroke="currentColor" viewBox="0 0 24 24"><path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M15.232 5.232l3.536 3.536m-2.036-5.036a2.5 2.5 0 113.536 3.536L6.5 21.036H3v-3.572L16.732 3.732z" /></svg>
                        </button>
                        <button onClick={() => handleDelete(ing.id!)} className="p-2 text-red-400 hover:text-red-600 hover:bg-red-50 rounded-lg transition-colors">
                          <svg className="w-4 h-4" fill="none" stroke="currentColor" viewBox="0 0 24 24"><path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M19 7l-.867 12.142A2 2 0 0116.138 21H7.862a2 2 0 01-1.995-1.858L5 7m5 4v6m4-6v6m1-10V4a1 1 0 00-1-1h-4a1 1 0 00-1 1v3M4 7h16" /></svg>
                        </button>
                      </div>
                    </td>
                  </tr>
                ))}
              </tbody>
            </table>
          </div>
        )}
      </div>

      <IngredientModal isOpen={modalOpen} onClose={() => setModalOpen(false)} ingredient={selectedIng} categories={ingCategories} onSave={handleSave} />
      {selectedIng && <RestockModal isOpen={restockOpen} onClose={() => setRestockOpen(false)} ingredient={selectedIng} onRestock={handleRestock} />}
    </div>
  );
}
