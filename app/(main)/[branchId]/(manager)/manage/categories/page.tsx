"use client";

import { useState, useCallback, useEffect } from "react";
import { Category, categoryService } from "@/services/categoryService";
import { useRealtimeData } from "@/contexts/RealtimeDataContext";
import TopBar from "@/components/TopBar";
import MobileTopBar from "@/components/MobileTopBar";
import LoadingSpinner from "@/components/LoadingSpinner";
import PlusIcon from "@/components/icons/PlusIcon";
import CategoriesIcon from "@/components/icons/SidebarNav/CategoriesIcon";
import { AnimatePresence, motion } from "motion/react";

// ─── Colour Swatch ────────────────────────────────────────────────────────────
function ColorSwatch({ color }: { color: string }) {
  return (
    <span
      className="inline-block w-5 h-5 rounded-md border border-black/10 flex-shrink-0"
      style={{ backgroundColor: color || "#e5e7eb" }}
    />
  );
}

// ─── Category Modal (Create / Edit) ──────────────────────────────────────────
function CategoryModal({
  isOpen,
  onClose,
  category,
  defaultType,
  onSave,
}: {
  isOpen: boolean;
  onClose: () => void;
  category?: Category | null;
  defaultType: "ingredient" | "menu";
  onSave: () => void;
}) {
  const [name, setName] = useState("");
  const [color, setColor] = useState("#f59e0b");
  const [type, setType] = useState<"ingredient" | "menu">(defaultType);
  const [saving, setSaving] = useState(false);
  const [error, setError] = useState<string | null>(null);

  useEffect(() => {
    if (isOpen) {
      if (category) {
        setName(category.name);
        setColor(category.color || "#f59e0b");
        setType(category.type);
      } else {
        setName("");
        setColor("#f59e0b");
        setType(defaultType);
      }
      setError(null);
    }
  }, [isOpen, category, defaultType]);

  const handleSave = async () => {
    if (!name.trim()) { setError("Name is required."); return; }
    setSaving(true);
    setError(null);
    try {
      if (category) {
        await categoryService.updateCategory(category.id, { name: name.trim(), color, type });
      } else {
        await categoryService.createCategory(name.trim(), color, type);
      }
      onSave();
      onClose();
    } catch (e: any) {
      setError(e.message || "Failed to save category.");
    } finally {
      setSaving(false);
    }
  };

  return (
    <AnimatePresence>
      {isOpen && (
        <motion.div
          initial={{ opacity: 0 }} animate={{ opacity: 1 }} exit={{ opacity: 0 }}
          transition={{ duration: 0.2 }}
          className="fixed inset-0 z-50 flex items-center justify-center bg-black/40 backdrop-blur-sm px-4"
          onClick={() => !saving && onClose()}
        >
          <motion.div
            initial={{ opacity: 0, y: 14, scale: 0.97 }}
            animate={{ opacity: 1, y: 0, scale: 1 }}
            exit={{ opacity: 0, y: 10, scale: 0.97 }}
            transition={{ duration: 0.2 }}
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
              {/* Name */}
              <div>
                <label className="block text-xs font-bold text-[var(--secondary)]/60 uppercase mb-1">
                  Name
                </label>
                <input
                  value={name}
                  onChange={(e) => setName(e.target.value)}
                  placeholder="e.g. Beverages"
                  className="w-full px-4 py-2.5 rounded-xl border border-[var(--border)] focus:ring-2 focus:ring-[var(--accent)] outline-none transition-shadow text-sm"
                />
              </div>

              {/* Color */}
              <div>
                <label className="block text-xs font-bold text-[var(--secondary)]/60 uppercase mb-1">
                  Colour
                </label>
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

              {/* Type — locked if editing, choosable if creating */}
              <div>
                <label className="block text-xs font-bold text-[var(--secondary)]/60 uppercase mb-1">
                  Type
                </label>
                <div className="flex gap-2">
                  {(["menu", "ingredient"] as const).map((t) => (
                    <button
                      key={t}
                      disabled={!!category}
                      onClick={() => setType(t)}
                      className={`flex-1 py-2 rounded-xl text-sm font-bold transition-all border-2 ${
                        type === t
                          ? "bg-[var(--accent)] text-[var(--secondary)] border-[var(--accent)]"
                          : "bg-white text-[var(--secondary)]/50 border-[var(--border)] hover:border-[var(--accent)]"
                      } ${category ? "opacity-60 cursor-not-allowed" : ""}`}
                    >
                      {t === "menu" ? "Menu" : "Ingredient"}
                    </button>
                  ))}
                </div>
                {category && (
                  <p className="text-[10px] text-[var(--secondary)]/40 mt-1">Type cannot be changed after creation.</p>
                )}
              </div>
            </div>

            <div className="flex gap-3 mt-6">
              <button
                onClick={() => !saving && onClose()}
                className="flex-1 py-2.5 rounded-xl border-2 border-[var(--border)] text-sm font-semibold hover:bg-gray-50 transition-all active:scale-95"
              >
                Cancel
              </button>
              <button
                disabled={saving || !name.trim()}
                onClick={handleSave}
                className="flex-[2] py-2.5 rounded-xl bg-[var(--accent)] text-[var(--secondary)] font-bold text-sm shadow-md hover:brightness-110 transition-all active:scale-95 disabled:opacity-50 disabled:cursor-not-allowed"
              >
                {saving ? "Saving…" : category ? "Save Changes" : "Create Category"}
              </button>
            </div>
          </motion.div>
        </motion.div>
      )}
    </AnimatePresence>
  );
}

// ─── Delete Confirm Modal ─────────────────────────────────────────────────────
function DeleteModal({
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
          transition={{ duration: 0.2 }}
          className="fixed inset-0 z-50 flex items-center justify-center bg-black/40 backdrop-blur-sm px-4"
          onClick={() => !deleting && onClose()}
        >
          <motion.div
            initial={{ opacity: 0, y: 14, scale: 0.97 }}
            animate={{ opacity: 1, y: 0, scale: 1 }}
            exit={{ opacity: 0, y: 10, scale: 0.97 }}
            transition={{ duration: 0.2 }}
            className="bg-white rounded-2xl shadow-2xl p-6 w-full max-w-sm"
            onClick={(e) => e.stopPropagation()}
          >
            <div className="flex items-center gap-3 mb-4">
              <div className="w-10 h-10 rounded-xl bg-red-100 flex items-center justify-center flex-shrink-0">
                <svg className="w-5 h-5 text-red-600" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                  <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M19 7l-.867 12.142A2 2 0 0116.138 21H7.862a2 2 0 01-1.995-1.858L5 7m5 4v6m4-6v6m1-10V4a1 1 0 00-1-1h-4a1 1 0 00-1 1v3M4 7h16" />
                </svg>
              </div>
              <div>
                <h3 className="text-lg font-bold text-[var(--secondary)]">Delete Category</h3>
                <p className="text-sm text-[var(--secondary)]/60">{category.name}</p>
              </div>
            </div>

            {usageCount > 0 && (
              <div className="mb-4 p-3 bg-amber-50 border border-amber-200 rounded-xl text-amber-800 text-sm">
                ⚠️ <strong>{usageCount}</strong>{" "}
                {category.type === "menu" ? "menu item(s)" : "ingredient(s)"} use this category.
                They will appear as <em>Uncategorised</em> after deletion.
              </div>
            )}

            <p className="text-sm text-[var(--secondary)]/70 mb-6">
              This action cannot be undone.
            </p>

            <div className="flex gap-3">
              <button
                onClick={() => !deleting && onClose()}
                className="flex-1 py-2.5 rounded-xl border-2 border-[var(--border)] text-sm font-semibold hover:bg-gray-50 transition-all active:scale-95"
              >
                Cancel
              </button>
              <button
                disabled={deleting}
                onClick={handleConfirm}
                className="flex-[2] py-2.5 rounded-xl bg-red-500 text-white font-bold text-sm shadow-md hover:bg-red-600 transition-all active:scale-95 disabled:opacity-50"
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

// ─── Main Page ────────────────────────────────────────────────────────────────

export default function CategoriesPage() {
  const { categories, menuItems, ingredients, loading: realtimeLoading } = useRealtimeData();
  const loading = realtimeLoading.categories;

  const [activeType, setActiveType] = useState<"menu" | "ingredient">("menu");
  const [search, setSearch] = useState("");
  const [modalOpen, setModalOpen] = useState(false);
  const [selected, setSelected] = useState<Category | null>(null);
  const [deleteOpen, setDeleteOpen] = useState(false);
  const [deleteTarget, setDeleteTarget] = useState<Category | null>(null);
  const [deleteUsage, setDeleteUsage] = useState(0);

  const filtered = categories
    .filter((c) => c.type === activeType)
    .filter((c) => !search || c.name.toLowerCase().includes(search.toLowerCase()));

  const openCreate = () => { setSelected(null); setModalOpen(true); };
  const openEdit = (cat: Category) => { setSelected(cat); setModalOpen(true); };

  const openDelete = useCallback(
    (cat: Category) => {
      const usage =
        cat.type === "menu"
          ? menuItems.filter((m) => m.categoryId === cat.id).length
          : ingredients.filter((i) => i.categoryId === cat.id).length;
      setDeleteTarget(cat);
      setDeleteUsage(usage);
      setDeleteOpen(true);
    },
    [menuItems, ingredients]
  );

  const handleDelete = async () => {
    if (!deleteTarget) return;
    await categoryService.deleteCategory(deleteTarget.id);
  };

  return (
    <div className="flex flex-col h-full overflow-hidden">
      {/* Top Bars */}
      <div className="xl:hidden w-full">
        <MobileTopBar title="Categories" icon={<CategoriesIcon className="w-6 h-6" />} showTimeTracking={false} onOrderClick={() => {}} />
      </div>
      <div className="hidden xl:block w-full">
        <TopBar title="Categories" icon={<CategoriesIcon className="w-6 h-6" />} showTimeTracking={false} />
      </div>

      <div className="flex-1 overflow-y-auto px-6 py-6 space-y-6">
        {/* Toolbar */}
        <div className="flex items-center justify-between gap-4 flex-wrap">
          <div className="flex gap-2 items-center flex-wrap">
            {/* Tab switcher */}
            <div className="flex gap-1 p-1 bg-gray-100 rounded-xl">
              {(["menu", "ingredient"] as const).map((t) => (
                <button
                  key={t}
                  onClick={() => setActiveType(t)}
                  className={`px-4 py-1.5 rounded-lg text-xs font-bold transition-all ${
                    activeType === t
                      ? "bg-white shadow-sm text-[var(--secondary)]"
                      : "text-gray-500 hover:text-[var(--secondary)]"
                  }`}
                >
                  {t === "menu" ? "Menu" : "Ingredient"}
                </button>
              ))}
            </div>

            {/* Search */}
            <input
              value={search}
              onChange={(e) => setSearch(e.target.value)}
              placeholder="Search categories…"
              className="px-4 py-2 rounded-xl border border-[var(--border)] text-sm bg-white outline-none focus:ring-2 focus:ring-[var(--accent)] min-w-[200px]"
            />
          </div>

          <button
            onClick={openCreate}
            className="bg-[var(--accent)] text-[var(--secondary)] px-5 py-2 rounded-xl font-bold shadow-md hover:scale-105 active:scale-95 transition-all flex items-center gap-2"
          >
            <PlusIcon className="w-4 h-4" /> ADD CATEGORY
          </button>
        </div>

        {/* Category count summary */}
        <div className="flex gap-3">
          <div className="bg-white rounded-xl px-4 py-2.5 shadow-sm border border-[var(--border)] text-sm">
            <span className="text-[var(--secondary)]/60">
              {activeType === "menu" ? "Menu" : "Ingredient"} categories:{" "}
            </span>
            <span className="font-bold text-[var(--secondary)]">
              {categories.filter((c) => c.type === activeType).length}
            </span>
          </div>
        </div>

        {/* List */}
        {loading ? (
          <div className="flex items-center justify-center py-20">
            <LoadingSpinner size="lg" />
          </div>
        ) : filtered.length === 0 ? (
          <div className="flex flex-col items-center justify-center py-20 opacity-50">
            <CategoriesIcon className="w-16 h-16 text-[var(--secondary)]" />
            <p className="mt-3 font-semibold text-[var(--secondary)]">
              {search ? "No categories match your search." : "No categories yet."}
            </p>
            {!search && (
              <p className="text-sm text-[var(--secondary)]/50 mt-1">
                Add a category to organise your{" "}
                {activeType === "menu" ? "menu items" : "ingredients"}.
              </p>
            )}
          </div>
        ) : (
          <div className="bg-white rounded-2xl shadow-sm border border-[var(--border)] overflow-hidden">
            <table className="w-full text-sm">
              <thead className="bg-[var(--background)]">
                <tr>
                  <th className="text-left px-6 py-4 font-bold text-[var(--secondary)]/70 uppercase text-[10px] tracking-wider">
                    Name
                  </th>
                  <th className="text-center px-6 py-4 font-bold text-[var(--secondary)]/70 uppercase text-[10px] tracking-wider">
                    Colour
                  </th>
                  <th className="text-center px-6 py-4 font-bold text-[var(--secondary)]/70 uppercase text-[10px] tracking-wider">
                    Items Using
                  </th>
                  <th className="text-center px-6 py-4 font-bold text-[var(--secondary)]/70 uppercase text-[10px] tracking-wider">
                    Actions
                  </th>
                </tr>
              </thead>
              <tbody className="divide-y divide-[var(--border)]">
                <AnimatePresence mode="popLayout">
                  {filtered.map((cat) => {
                    const usage =
                      activeType === "menu"
                        ? menuItems.filter((m) => m.categoryId === cat.id).length
                        : ingredients.filter((i) => i.categoryId === cat.id).length;

                    return (
                      <motion.tr
                        key={cat.id}
                        layout
                        initial={{ opacity: 0, y: 6 }}
                        animate={{ opacity: 1, y: 0 }}
                        exit={{ opacity: 0, y: -6 }}
                        transition={{ duration: 0.15 }}
                        className="hover:bg-[var(--background)]/30 transition-colors"
                      >
                        {/* Name + colour chip */}
                        <td className="px-6 py-4">
                          <div className="flex items-center gap-3">
                            <ColorSwatch color={cat.color} />
                            <span
                              className="font-bold text-[var(--secondary)] px-2.5 py-0.5 rounded-full text-xs"
                              style={{ backgroundColor: cat.color + "33", color: cat.color }}
                            >
                              {cat.name}
                            </span>
                          </div>
                        </td>

                        {/* Hex value */}
                        <td className="px-6 py-4 text-center">
                          <span className="font-mono text-xs text-[var(--secondary)]/60 bg-gray-100 px-2 py-0.5 rounded">
                            {cat.color}
                          </span>
                        </td>

                        {/* Usage count */}
                        <td className="px-6 py-4 text-center">
                          <span
                            className={`text-xs font-bold px-2.5 py-0.5 rounded-full ${
                              usage > 0
                                ? "bg-blue-100 text-blue-700"
                                : "bg-gray-100 text-gray-400"
                            }`}
                          >
                            {usage} {activeType === "menu" ? "item(s)" : "ingredient(s)"}
                          </span>
                        </td>

                        {/* Actions */}
                        <td className="px-6 py-4">
                          <div className="flex items-center justify-center gap-2">
                            <button
                              onClick={() => openEdit(cat)}
                              className="p-2 text-[var(--secondary)]/60 hover:text-[var(--secondary)] hover:bg-gray-100 rounded-lg transition-colors"
                              title="Edit"
                            >
                              <svg className="w-4 h-4" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                                <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M15.232 5.232l3.536 3.536m-2.036-5.036a2.5 2.5 0 113.536 3.536L6.5 21.036H3v-3.572L16.732 3.732z" />
                              </svg>
                            </button>
                            <button
                              onClick={() => openDelete(cat)}
                              className="p-2 text-red-400 hover:text-red-600 hover:bg-red-50 rounded-lg transition-colors"
                              title="Delete"
                            >
                              <svg className="w-4 h-4" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                                <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M19 7l-.867 12.142A2 2 0 0116.138 21H7.862a2 2 0 01-1.995-1.858L5 7m5 4v6m4-6v6m1-10V4a1 1 0 00-1-1h-4a1 1 0 00-1 1v3M4 7h16" />
                              </svg>
                            </button>
                          </div>
                        </td>
                      </motion.tr>
                    );
                  })}
                </AnimatePresence>
              </tbody>
            </table>
          </div>
        )}
      </div>

      {/* Modals */}
      <CategoryModal
        isOpen={modalOpen}
        onClose={() => setModalOpen(false)}
        category={selected}
        defaultType={activeType}
        onSave={() => {}}
      />
      <DeleteModal
        isOpen={deleteOpen}
        onClose={() => setDeleteOpen(false)}
        category={deleteTarget}
        usageCount={deleteUsage}
        onConfirm={handleDelete}
      />
    </div>
  );
}
