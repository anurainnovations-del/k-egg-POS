"use client";

import { useState, useCallback, useEffect } from "react";
import { Category, categoryService } from "@/services/categoryService";
import { useRealtimeData } from "@/contexts/RealtimeDataContext";
import PlusIcon from "@/components/icons/PlusIcon";
import { AnimatePresence, motion } from "motion/react";

interface CategoryManagementModalProps {
  isOpen: boolean;
  onClose: () => void;
  type: "menu" | "ingredient";
}

// ─── Colour Swatch ────────────────────────────────────────────────────────────
function ColorSwatch({ color }: { color: string }) {
  return (
    <span
      className="inline-block w-5 h-5 rounded-md border border-black/10 flex-shrink-0"
      style={{ backgroundColor: color || "#e5e7eb" }}
    />
  );
}

// ─── Category Editor Modal (Sub-modal) ───────────────────────────────────────
function CategoryEditorModal({
  isOpen,
  onClose,
  category,
  defaultType,
}: {
  isOpen: boolean;
  onClose: () => void;
  category?: Category | null;
  defaultType: "ingredient" | "menu";
}) {
  const [name, setName] = useState("");
  const [color, setColor] = useState("#f59e0b");
  const [saving, setSaving] = useState(false);
  const [error, setError] = useState<string | null>(null);

  useEffect(() => {
    if (isOpen) {
      if (category) {
        setName(category.name);
        setColor(category.color || "#f59e0b");
      } else {
        setName("");
        setColor("#f59e0b");
      }
      setError(null);
    }
  }, [isOpen, category]);

  const handleSave = async () => {
    if (!name.trim()) { setError("Name is required."); return; }
    setSaving(true);
    setError(null);
    try {
      if (category) {
        await categoryService.updateCategory(category.id, { name: name.trim(), color, type: defaultType });
      } else {
        await categoryService.createCategory(name.trim(), color, defaultType);
      }
      onClose();
    } catch (e: unknown) {
      const err = e as Error;
      setError(err.message || "Failed to save category.");
    } finally {
      setSaving(false);
    }
  };

  return (
    <AnimatePresence>
      {isOpen && (
        <motion.div
          initial={{ opacity: 0 }} animate={{ opacity: 1 }} exit={{ opacity: 0 }}
          className="fixed inset-0 z-[70] flex items-center justify-center bg-black/60 backdrop-blur-sm px-4"
          onClick={() => !saving && onClose()}
        >
          <motion.div
            initial={{ opacity: 0, y: 14, scale: 0.97 }}
            animate={{ opacity: 1, y: 0, scale: 1 }}
            exit={{ opacity: 0, y: 10, scale: 0.97 }}
            className="bg-white rounded-2xl shadow-2xl p-6 w-full max-w-sm"
            onClick={(e) => e.stopPropagation()}
          >
            <h3 className="text-xl font-bold text-[var(--secondary)] mb-5">
              {category ? "Edit Category" : "New Category"}
            </h3>

            {error && (
              <div className="mb-4 p-3 bg-red-50 border border-red-200 rounded-xl text-red-700 text-sm">
                {error}
              </div>
            )}

            <div className="space-y-4">
              <div>
                <label className="block text-xs font-bold text-[var(--secondary)]/60 uppercase mb-1">Name</label>
                <input
                  value={name}
                  onChange={(e) => setName(e.target.value)}
                  placeholder="e.g. Beverages"
                  className="w-full px-4 py-2.5 rounded-xl border border-[var(--border)] focus:ring-2 focus:ring-[var(--accent)] outline-none text-sm"
                />
              </div>

              <div>
                <label className="block text-xs font-bold text-[var(--secondary)]/60 uppercase mb-1">Colour</label>
                <div className="flex items-center gap-3">
                  <input
                    type="color"
                    value={color}
                    onChange={(e) => setColor(e.target.value)}
                    className="w-12 h-10 rounded-lg border border-[var(--border)] cursor-pointer p-0.5 bg-white"
                  />
                  <span className="font-mono text-sm text-[var(--secondary)]/70">{color}</span>
                  <ColorSwatch color={color} />
                </div>
              </div>
            </div>

            <div className="flex gap-3 mt-6">
              <button onClick={() => !saving && onClose()} className="flex-1 py-2.5 rounded-xl border-2 border-[var(--border)] text-sm font-semibold hover:bg-gray-50 transition-all">Cancel</button>
              <button
                disabled={saving || !name.trim()}
                onClick={handleSave}
                className="flex-[2] py-2.5 rounded-xl bg-[var(--accent)] text-[var(--secondary)] font-bold text-sm shadow-md hover:brightness-110 transition-all disabled:opacity-50"
              >
                {saving ? "Saving…" : "Save"}
              </button>
            </div>
          </motion.div>
        </motion.div>
      )}
    </AnimatePresence>
  );
}

// ─── Delete Confirm Modal ─────────────────────────────────────────────────────
function DeleteConfirmModal({
  isOpen,
  onClose,
  category,
  usageCount,
  onConfirm,
}: {
  isOpen: boolean;
  onClose: () => void;
  category: Category | null;
  usageCount: number;
  onConfirm: () => Promise<void>;
}) {
  const [deleting, setDeleting] = useState(false);

  const handleConfirm = async () => {
    setDeleting(true);
    try { await onConfirm(); onClose(); }
    finally { setDeleting(false); }
  };

  return (
    <AnimatePresence>
      {isOpen && category && (
        <motion.div
          initial={{ opacity: 0 }} animate={{ opacity: 1 }} exit={{ opacity: 0 }}
          className="fixed inset-0 z-[70] flex items-center justify-center bg-black/60 backdrop-blur-sm px-4"
          onClick={() => !deleting && onClose()}
        >
          <motion.div
            initial={{ opacity: 0, y: 14, scale: 0.97 }}
            animate={{ opacity: 1, y: 0, scale: 1 }}
            exit={{ opacity: 0, y: 10, scale: 0.97 }}
            className="bg-white rounded-2xl shadow-2xl p-6 w-full max-w-sm"
            onClick={(e) => e.stopPropagation()}
          >
            <h3 className="text-lg font-bold text-[var(--secondary)] mb-2 text-red-600">Delete Category?</h3>
            <p className="text-sm text-[var(--secondary)]/70 mb-4">Are you sure you want to delete <strong>{category.name}</strong>?</p>

            {usageCount > 0 && (
              <div className="mb-4 p-3 bg-amber-50 border border-amber-200 rounded-xl text-amber-800 text-sm">
                ⚠️ <strong>{usageCount}</strong> items use this category and will become <em>Uncategorised</em>.
              </div>
            )}

            <div className="flex gap-3">
              <button onClick={() => !deleting && onClose()} className="flex-1 py-2.5 rounded-xl border-2 border-[var(--border)] text-sm font-semibold hover:bg-gray-50 transition-all">Cancel</button>
              <button
                disabled={deleting}
                onClick={handleConfirm}
                className="flex-[2] py-2.5 rounded-xl bg-red-500 text-white font-bold text-sm shadow-md hover:bg-red-600 transition-all disabled:opacity-50"
              >
                {deleting ? "Deleting…" : "Delete"}
              </button>
            </div>
          </motion.div>
        </motion.div>
      )}
    </AnimatePresence>
  );
}

// ─── Main Component ───────────────────────────────────────────────────────────
export default function CategoryManagementModal({ isOpen, onClose, type }: CategoryManagementModalProps) {
  const { categories, menuItems, ingredients, loading: realtimeLoading } = useRealtimeData();
  const loading = realtimeLoading.categories;

  const [editorOpen, setEditorOpen] = useState(false);
  const [selectedCat, setSelectedCat] = useState<Category | null>(null);
  const [deleteOpen, setDeleteOpen] = useState(false);
  const [deleteTarget, setDeleteTarget] = useState<Category | null>(null);
  const [deleteUsage, setDeleteUsage] = useState(0);

  const filtered = categories.filter((c) => c.type === type);

  const openDelete = useCallback(
    (cat: Category) => {
      const usage = type === "menu"
        ? menuItems.filter((m) => m.categoryId === cat.id).length
        : ingredients.filter((i) => i.categoryId === cat.id).length;
      setDeleteTarget(cat);
      setDeleteUsage(usage);
      setDeleteOpen(true);
    },
    [menuItems, ingredients, type]
  );

  return (
    <>
      <AnimatePresence>
        {isOpen && (
          <motion.div
            initial={{ opacity: 0 }} animate={{ opacity: 1 }} exit={{ opacity: 0 }}
            className="fixed inset-0 z-[60] flex items-center justify-center bg-black/40 backdrop-blur-sm px-4"
            onClick={onClose}
          >
            <motion.div
              initial={{ opacity: 0, y: 20, scale: 0.95 }}
              animate={{ opacity: 1, y: 0, scale: 1 }}
              exit={{ opacity: 0, y: 15, scale: 0.95 }}
              className="bg-white rounded-3xl shadow-2xl p-6 w-full max-w-2xl max-h-[80vh] flex flex-col overflow-hidden"
              onClick={(e) => e.stopPropagation()}
            >
              <div className="flex items-center justify-between mb-6">
                <h2 className="text-2xl font-bold text-[var(--secondary)]">
                  Manage {type === "menu" ? "Menu" : "Ingredient"} Categories
                </h2>
                <button
                  onClick={() => { setSelectedCat(null); setEditorOpen(true); }}
                  className="bg-[var(--accent)] text-[var(--secondary)] px-4 py-2 rounded-xl font-bold text-sm shadow-md hover:scale-105 active:scale-95 transition-all flex items-center gap-2"
                >
                  <PlusIcon className="w-4 h-4" /> ADD CATEGORY
                </button>
              </div>

              <div className="flex-1 overflow-y-auto pr-2 custom-scrollbar">
                {loading ? (
                  <div className="flex items-center justify-center py-20 opacity-50">Loading categories...</div>
                ) : filtered.length === 0 ? (
                  <div className="text-center py-20 text-[var(--secondary)]/40 italic">No categories found. Add one to get started.</div>
                ) : (
                  <div className="space-y-2">
                    {filtered.map((cat) => {
                       const usage = type === "menu"
                         ? menuItems.filter((m) => m.categoryId === cat.id).length
                         : ingredients.filter((i) => i.categoryId === cat.id).length;
                       
                       return (
                         <div key={cat.id} className="flex items-center justify-between p-4 rounded-2xl bg-gray-50 border border-gray-100 hover:border-[var(--accent)]/30 transition-all">
                           <div className="flex items-center gap-4">
                             <ColorSwatch color={cat.color} />
                             <div>
                               <div className="font-bold text-[var(--secondary)]">{cat.name}</div>
                               <div className="text-[10px] text-[var(--secondary)]/50 uppercase font-bold tracking-wider">
                                 {usage} {type === "menu" ? "Items" : "Ingredients"}
                               </div>
                             </div>
                           </div>
                           <div className="flex items-center gap-2">
                             <button onClick={() => { setSelectedCat(cat); setEditorOpen(true); }} className="p-2 text-[var(--secondary)]/60 hover:text-[var(--secondary)] hover:bg-white rounded-xl transition-all shadow-sm border border-transparent hover:border-gray-200">
                               <svg className="w-4 h-4" fill="none" stroke="currentColor" viewBox="0 0 24 24"><path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M15.232 5.232l3.536 3.536m-2.036-5.036a2.5 2.5 0 113.536 3.536L6.5 21.036H3v-3.572L16.732 3.732z" /></svg>
                             </button>
                             <button onClick={() => openDelete(cat)} className="p-2 text-red-400 hover:text-red-600 hover:bg-white rounded-xl transition-all shadow-sm border border-transparent hover:border-red-100">
                               <svg className="w-4 h-4" fill="none" stroke="currentColor" viewBox="0 0 24 24"><path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M19 7l-.867 12.142A2 2 0 0116.138 21H7.862a2 2 0 01-1.995-1.858L5 7m5 4v6m4-6v6m1-10V4a1 1 0 00-1-1h-4a1 1 0 00-1 1v3M4 7h16" /></svg>
                             </button>
                           </div>
                         </div>
                       );
                    })}
                  </div>
                )}
              </div>

              <button onClick={onClose} className="mt-6 w-full py-3 rounded-2xl bg-gray-100 text-[var(--secondary)] font-bold hover:bg-gray-200 transition-all active:scale-[0.98]">Close</button>
            </motion.div>
          </motion.div>
        )}
      </AnimatePresence>

      <CategoryEditorModal isOpen={editorOpen} onClose={() => setEditorOpen(false)} category={selectedCat} defaultType={type} />
      <DeleteConfirmModal isOpen={deleteOpen} onClose={() => setDeleteOpen(false)} category={deleteTarget} usageCount={deleteUsage} onConfirm={async () => { if (deleteTarget) await categoryService.deleteCategory(deleteTarget.id); }} />
    </>
  );
}
