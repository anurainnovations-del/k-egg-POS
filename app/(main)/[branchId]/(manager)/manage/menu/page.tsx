"use client";

import { useState, useEffect } from "react";
import { MenuItem, menuItemService } from "@/services/menuItemService";
import { Ingredient } from "@/services/ingredientService";
import { useRealtimeData } from "@/contexts/RealtimeDataContext";
import { Category } from "@/services/categoryService";
import { useBranch } from "@/contexts/BranchContext";
import TopBar from "@/components/TopBar";
import MobileTopBar from "@/components/MobileTopBar";
import LoadingSpinner from "@/components/LoadingSpinner";
import MenuIcon from "@/components/icons/SidebarNav/MenuIcon";
import PlusIcon from "@/components/icons/PlusIcon";
import SafeImage from "@/components/SafeImage";
import ImageUpload from "@/components/ImageUpload";
import { MEDIA_BUCKETS } from "@/lib/firebaseStorage";
import { formatCurrency } from "@/lib/currency_formatter";
import { AnimatePresence, motion } from "motion/react";
import CategoryManagementModal from "@/components/CategoryManagementModal";

interface RecipeItem {
  ingredientId: string;
  ingredientName: string;
  quantity: number;
  unit: string;
}

function RecipeBuilder({ 
  recipe, ingredients, onRecipeChange 
}: { 
  recipe: RecipeItem[]; ingredients: Ingredient[]; onRecipeChange: (newRecipe: RecipeItem[]) => void 
}) {
  const [selectedIngId, setSelectedIngId] = useState("");
  const [qty, setQty] = useState(0);

  const addIngredient = () => {
    const ing = ingredients.find(i => i.id === selectedIngId);
    if (!ing || qty <= 0) return;
    
    // Check if already in recipe
    if (recipe.some(r => r.ingredientId === ing.id)) return;

    const newItem: RecipeItem = {
      ingredientId: ing.id!,
      ingredientName: ing.name,
      quantity: qty,
      unit: ing.unit
    };
    onRecipeChange([...recipe, newItem]);
    setSelectedIngId("");
    setQty(0);
  };

  const removeIngredient = (id: string) => {
    onRecipeChange(recipe.filter(r => r.ingredientId !== id));
  };

  return (
    <div className="space-y-3 p-4 bg-gray-50 rounded-xl border border-[var(--border)]">
      <h4 className="text-xs font-bold text-[var(--secondary)]/70 uppercase">Recipe / BOM</h4>
      
      {/* List */}
      <div className="space-y-2">
        <AnimatePresence mode="popLayout">
          {recipe.map(item => (
            <motion.div
              key={item.ingredientId}
              layout
              initial={{ opacity: 0, y: 6 }}
              animate={{ opacity: 1, y: 0 }}
              exit={{ opacity: 0, y: -6 }}
              transition={{ duration: 0.15 }}
              className="flex items-center justify-between bg-white px-3 py-2 rounded-lg border border-gray-200 shadow-sm"
            >
              <div className="text-sm">
                <span className="font-bold text-[var(--secondary)]">{item.ingredientName}</span>
                <span className="ml-2 text-[var(--secondary)]/60 text-xs">{item.quantity} {item.unit}</span>
              </div>
              <button onClick={() => removeIngredient(item.ingredientId)} className="text-red-400 hover:text-red-600 transition-colors" aria-label={`Remove ${item.ingredientName}`}>
                <svg className="w-4 h-4" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                  <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M6 18L18 6M6 6l12 12" />
                </svg>
              </button>
            </motion.div>
          ))}
        </AnimatePresence>
        {recipe.length === 0 && <p className="text-[10px] text-center text-gray-400 italic">No ingredients added to recipe.</p>}
      </div>

      {/* Add Row */}
      <div className="flex gap-2 pt-2 border-t border-gray-200">
        <select value={selectedIngId} onChange={e => setSelectedIngId(e.target.value)} className="flex-1 min-w-0 px-3 py-1.5 rounded-lg border border-gray-300 text-xs bg-white">
          <option value="">Select Ingredient...</option>
          {ingredients.map(i => <option key={i.id} value={i.id}>{i.name} ({i.unit})</option>)}
        </select>
        <input type="number" value={qty} onChange={e => setQty(Number(e.target.value))} placeholder="Qty" className="w-20 px-3 py-1.5 rounded-lg border border-gray-300 text-xs" />
        <button onClick={addIngredient} disabled={!selectedIngId || qty <= 0} className="px-3 py-1.5 bg-[var(--secondary)] text-white rounded-lg text-xs font-bold transition-all hover:brightness-110 active:scale-95 disabled:opacity-30 disabled:cursor-not-allowed">+</button>
      </div>
    </div>
  );
}

// ─── Modal ────────────────────────────────────────────────────────────────────

function MenuModal({ 
  isOpen, onClose, item, categories, allIngredients, onSave 
}: { 
  isOpen: boolean; onClose: () => void; item?: MenuItem | null; categories: Category[]; allIngredients: Ingredient[]; onSave: (data: Partial<MenuItem>) => Promise<void> 
}) {
  const [formData, setFormData] = useState<Partial<MenuItem>>({
    name: "", price: 0, categoryId: "", description: "", imgUrl: "", recipe: [], isAvailable: true
  });
  const [saving, setSaving] = useState(false);

  useEffect(() => {
    if (item) {
      setFormData({
        name: item.name ?? "",
        price: item.price ?? 0,
        categoryId: item.categoryId ?? categories[0]?.id ?? "",
        description: item.description ?? "",
        imgUrl: item.imgUrl ?? "",
        recipe: item.recipe ?? [],
        isAvailable: item.isAvailable ?? true,
      });
    } else {
      setFormData({
        name: "",
        price: 0,
        categoryId: categories[0]?.id || "",
        description: "",
        imgUrl: "",
        recipe: [],
        isAvailable: true,
      });
    }
  }, [item, categories, isOpen]);

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
            initial={{ opacity: 0, y: 16, scale: 0.98 }}
            animate={{ opacity: 1, y: 0, scale: 1 }}
            exit={{ opacity: 0, y: 10, scale: 0.98 }}
            transition={{ duration: 0.2 }}
            className="bg-white rounded-2xl shadow-2xl p-6 w-full max-w-3xl flex flex-col md:flex-row gap-6 max-h-[90vh] overflow-y-auto md:overflow-visible"
            onClick={(e) => e.stopPropagation()}
          >
        {/* Left Side: General Info */}
        <div className="flex-1 space-y-4">
          <h3 className="text-xl font-bold text-[var(--secondary)]">{item ? "Edit Menu Item" : "New Menu Item"}</h3>
          
          <div>
            <label className="block text-xs font-bold text-[var(--secondary)]/60 uppercase mb-1">Name</label>
            <input value={formData.name ?? ""} onChange={e => setFormData({...formData, name: e.target.value})} className="w-full px-4 py-2 rounded-xl border border-[var(--border)] focus:ring-2 focus:ring-[var(--accent)] outline-none transition-shadow" />
          </div>
          
          <div className="grid grid-cols-2 gap-4">
            <div>
              <label className="block text-xs font-bold text-[var(--secondary)]/60 uppercase mb-1">Price (₱)</label>
              <input type="number" value={formData.price ?? 0} onChange={e => setFormData({...formData, price: Number(e.target.value)})} className="w-full px-4 py-2 rounded-xl border border-[var(--border)] outline-none transition-shadow focus:ring-2 focus:ring-[var(--accent)]" />
            </div>
            <div>
              <label className="block text-xs font-bold text-[var(--secondary)]/60 uppercase mb-1">Category</label>
              <select value={formData.categoryId ?? ""} onChange={e => setFormData({...formData, categoryId: e.target.value})} className="w-full px-4 py-2 rounded-xl border border-[var(--border)] outline-none transition-shadow focus:ring-2 focus:ring-[var(--accent)]">
                {categories.map(c => <option key={c.id} value={c.id}>{c.name}</option>)}
              </select>
            </div>
          </div>

          <div>
            <label className="block text-xs font-bold text-[var(--secondary)]/60 uppercase mb-1">Description</label>
            <textarea value={formData.description ?? ""} onChange={e => setFormData({...formData, description: e.target.value})} className="w-full px-4 py-2 rounded-xl border border-[var(--border)] outline-none h-20 resize-none transition-shadow focus:ring-2 focus:ring-[var(--accent)]" />
          </div>

          <ImageUpload
            currentImageUrl={formData.imgUrl ?? ""}
            onImageUpload={(imageUrl) => setFormData((prev) => ({ ...prev, imgUrl: imageUrl }))}
            onImageRemove={() => setFormData((prev) => ({ ...prev, imgUrl: "" }))}
            label="Menu Item Photo"
            bucket={MEDIA_BUCKETS.MENU_ITEMS}
          />

          <div className="flex items-center gap-2">
            <input type="checkbox" checked={!!formData.isAvailable} onChange={e => setFormData({...formData, isAvailable: e.target.checked})} id="isAvail" />
            <label htmlFor="isAvail" className="text-sm font-bold text-[var(--secondary)]">Currently Active on Menu</label>
          </div>
        </div>

        {/* Right Side: Recipe Builder */}
        <div className="w-full md:w-[280px] flex flex-col">
          <RecipeBuilder 
            recipe={formData.recipe || []} 
            ingredients={allIngredients} 
            onRecipeChange={(r) => setFormData({...formData, recipe: r})} 
          />
          
          <div className="mt-auto flex gap-3 pt-6">
            <button onClick={() => !saving && onClose()} className="flex-1 py-2 rounded-xl border-2 border-[var(--border)] text-sm font-semibold transition-all hover:bg-gray-50 active:scale-95">Cancel</button>
            <button 
              disabled={saving || !formData.name || !formData.categoryId || (formData.recipe || []).length === 0}
              onClick={async () => {
                setSaving(true);
                try {
                  await onSave(formData);
                  onClose();
                } finally {
                  setSaving(false);
                }
              }}
              className="flex-[2] py-2 rounded-xl bg-[var(--accent)] text-[var(--secondary)] font-bold text-sm shadow-md transition-all hover:brightness-110 active:scale-95 disabled:opacity-50 disabled:cursor-not-allowed disabled:hover:brightness-100 disabled:active:scale-100"
            >
              {saving ? "Saving..." : "Save Item"}
            </button>
          </div>
          {(formData.recipe || []).length === 0 && <p className="text-[10px] text-red-500 mt-2 text-center font-semibold">Recipe required to save item.</p>}
        </div>
          </motion.div>
        </motion.div>
      )}
    </AnimatePresence>
  );
}

// ─── Main Page ────────────────────────────────────────────────────────────────

export default function ManagerMenuPage() {
  const { currentBranch } = useBranch();
  const { menuItems, ingredients, categories, loading: realtimeLoading } = useRealtimeData();
  const loading = realtimeLoading.menu || realtimeLoading.categories;
  
  const [search, setSearch] = useState("");
  const [filterCat, setFilterCat] = useState("");
  const [modalOpen, setModalOpen] = useState(false);
  const [categoriesOpen, setCategoriesOpen] = useState(false);
  const [selectedItem, setSelectedItem] = useState<MenuItem | null>(null);

  const menuCategories = categories.filter(c => c.type === 'menu');
  const getCatName = (id: string) => categories.find(c => c.id === id)?.name ?? "—";

  const filtered = menuItems.filter(i => {
    const matchSearch = !search || i.name.toLowerCase().includes(search.toLowerCase());
    const matchCat = !filterCat || i.categoryId === filterCat;
    return matchSearch && matchCat;
  });

  const handleSave = async (data: Partial<MenuItem>) => {
    if (!currentBranch) return;
    if (selectedItem) {
      await menuItemService.updateMenuItem(currentBranch.id, selectedItem.id!, data);
    } else {
      const itemData: Omit<MenuItem, "id" | "branchId" | "createdAt" | "updatedAt"> = {
        name: data.name || "",
        price: data.price !== undefined ? data.price : 0,
        categoryId: data.categoryId || "",
        description: data.description || "",
        imgUrl: data.imgUrl,
        isAvailable: data.isAvailable !== undefined ? data.isAvailable : true,
        recipe: data.recipe || [],
      };
      await menuItemService.addMenuItem(currentBranch.id, itemData);
    }
  };

  const handleDelete = async (id: string) => {
    if (confirm("Delete this menu item?")) {
      await menuItemService.deleteMenuItem(id);
    }
  };

  return (
    <div className="flex flex-col h-full overflow-hidden">
      <div className="xl:hidden w-full">
        <MobileTopBar title="Manage Menu" icon={<MenuIcon className="w-6 h-6" />} showTimeTracking={false} />
      </div>
      <div className="hidden xl:block w-full">
        <TopBar title="Manage Menu" icon={<MenuIcon className="w-6 h-6" />} showTimeTracking={false} />
      </div>

      <div className="flex-1 overflow-y-auto px-6 py-6 space-y-6">
        <div className="flex items-center justify-between gap-4 flex-wrap">
          <div className="flex gap-3">
            <input value={search} onChange={e => setSearch(e.target.value)} placeholder="Search menu..." 
              className="px-4 py-2 rounded-xl border border-[var(--border)] text-sm bg-white outline-none min-w-[240px]" />
            <select value={filterCat} onChange={e => setFilterCat(e.target.value)} className="px-4 py-2 rounded-xl border border-[var(--border)] text-sm bg-white outline-none">
              <option value="">All Categories</option>
              {menuCategories.map(c => <option key={c.id} value={c.id}>{c.name}</option>)}
            </select>
          </div>
          <div className="flex gap-3">
            <button 
              onClick={() => setCategoriesOpen(true)}
              className="bg-white border border-[var(--border)] text-[var(--secondary)]/70 px-4 py-2 rounded-xl font-bold text-xs shadow-sm hover:bg-gray-50 active:scale-95 transition-all flex items-center gap-2"
            >
              CATEGORIES
            </button>
            <button 
              onClick={() => { setSelectedItem(null); setModalOpen(true); }}
              className="bg-[var(--accent)] text-[var(--secondary)] px-5 py-2 rounded-xl font-bold shadow-md hover:scale-105 active:scale-95 transition-all flex items-center gap-2"
            >
              <PlusIcon className="w-4 h-4" /> ADD MENU ITEM
            </button>
          </div>
        </div>

        {loading ? (
          <div className="flex items-center justify-center py-20"><LoadingSpinner size="lg" /></div>
        ) : (
          <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-3 xl:grid-cols-4 gap-6">
            {filtered.map(item => (
              <div key={item.id} className="bg-white rounded-2xl shadow-sm border border-[var(--border)] overflow-hidden group">
                <div className="h-40 bg-[var(--background)] relative">
                  {item.imgUrl ? (
                    <SafeImage src={item.imgUrl} alt={item.name} />
                  ) : (
                    <div className="w-full h-full flex items-center justify-center text-[var(--secondary)]/60">
                      <MenuIcon className="w-14 h-14" />
                    </div>
                  )}
                  <div className="absolute top-2 right-2 flex gap-1">
                    <button onClick={() => { setSelectedItem(item); setModalOpen(true); }} className="p-2 bg-white/90 rounded-lg shadow-sm text-[var(--secondary)] hover:bg-white transition-all"><svg className="w-4 h-4" fill="none" stroke="currentColor" viewBox="0 0 24 24"><path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M15.232 5.232l3.536 3.536m-2.036-5.036a2.5 2.5 0 113.536 3.536L6.5 21.036H3v-3.572L16.732 3.732z" /></svg></button>
                    <button onClick={() => handleDelete(item.id!)} className="p-2 bg-white/90 rounded-lg shadow-sm text-red-500 hover:bg-red-50 transition-all"><svg className="w-4 h-4" fill="none" stroke="currentColor" viewBox="0 0 24 24"><path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M19 7l-.867 12.142A2 2 0 0116.138 21H7.862a2 2 0 01-1.995-1.858L5 7m5 4v6m4-6v6m1-10V4a1 1 0 00-1-1h-4a1 1 0 00-1 1v3M4 7h16" /></svg></button>
                  </div>
                  {!item.isAvailable && <div className="absolute inset-0 bg-gray-500/20 flex items-center justify-center backdrop-blur-[1px]"><span className="bg-gray-800 text-white text-[10px] font-bold px-2 py-1 rounded-lg">INACTIVE</span></div>}
                </div>
                <div className="p-4">
                  <div className="flex justify-between items-start mb-1">
                    <h3 className="font-bold text-[var(--secondary)] truncate pr-2">{item.name}</h3>
                    <span className="font-black text-[var(--secondary)]">{formatCurrency(item.price)}</span>
                  </div>
                  <div className="text-[10px] text-[var(--secondary)]/50 uppercase mb-3">{getCatName(item.categoryId)}</div>
                  <div className="space-y-1">
                    <p className="text-[10px] font-bold text-[var(--secondary)]/60 uppercase">Recipe:</p>
                    <div className="flex flex-wrap gap-1">
                      {item.recipe.map(r => (
                        <span key={r.ingredientId} className="text-[9px] bg-gray-100 px-1.5 py-0.5 rounded text-[var(--secondary)]/70">{r.ingredientName}</span>
                      ))}
                    </div>
                  </div>
                </div>
              </div>
            ))}
          </div>
        )}
      </div>

      <MenuModal 
        isOpen={modalOpen} 
        onClose={() => setModalOpen(false)} 
        item={selectedItem} 
        categories={menuCategories} 
        allIngredients={ingredients} 
        onSave={handleSave} 
      />
      <CategoryManagementModal isOpen={categoriesOpen} onClose={() => setCategoriesOpen(false)} type="menu" />
    </div>
  );
}
