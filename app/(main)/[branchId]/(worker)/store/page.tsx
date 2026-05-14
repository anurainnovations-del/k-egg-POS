"use client";

import { useState, useEffect } from "react";
import { MenuItem } from "@/services/menuItemService";
import { Ingredient } from "@/services/ingredientService";
import { useRealtimeData } from "@/contexts/RealtimeDataContext";
import { Category } from "@/services/categoryService";
import { createOrder } from "@/services/orderService";
import { getMenuItemsAvailability } from "@/services/availabilityService";
import { useAuth } from "@/contexts/AuthContext";
import { useBranch } from "@/contexts/BranchContext";
import { useBluetoothPrinter } from "@/contexts/BluetoothContext";
import { useTimeTracking } from "@/contexts/TimeTrackingContext";
import { Discount } from "@/services/discountService";
import { formatCurrency } from "@/lib/currency_formatter";
import { formatReceiptWithLogo } from "@/lib/esc_formatter";
import { loadSettingsFromLocal } from "@/services/settingsService";
import { AnimatePresence, motion } from "motion/react";
import TopBar from "@/components/TopBar";
import MobileTopBar from "@/components/MobileTopBar";
import LoadingSpinner from "@/components/LoadingSpinner";
import SafeImage from "@/components/SafeImage";
import ViewOnlyWrapper from "@/components/ViewOnlyWrapper";
import DiscountDropdown from "./components/DiscountDropdown";
import StoreIcon from "@/components/icons/SidebarNav/StoreIcon";
import QuickTimeWidget from "@/components/QuickTimeWidget";

// ─── Cart type ────────────────────────────────────────────────────────────────
interface CartItem {
  id: string;
  name: string;
  price: number;
  cost?: number;
  quantity: number;
  imgUrl?: string | null;
  categoryId: string;
}

// ─── Toast ────────────────────────────────────────────────────────────────────
function SuccessToast({ show, onClose, orderId }: { show: boolean; onClose: () => void; orderId: string }) {
  useEffect(() => {
    if (show) { const t = setTimeout(onClose, 3000); return () => clearTimeout(t); }
  }, [show, onClose]);
  if (!show) return null;
  return (
    <div className="fixed top-4 left-1/2 -translate-x-1/2 z-50 animate-in slide-in-from-top duration-300">
      <div className="bg-[var(--success)] text-white px-6 py-4 rounded-xl shadow-xl flex items-center gap-3 min-w-[300px]">
        <svg className="w-6 h-6 flex-shrink-0" fill="none" stroke="currentColor" viewBox="0 0 24 24">
          <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M9 12l2 2 4-4m6 2a9 9 0 11-18 0 9 9 0 0118 0z" />
        </svg>
        <div className="flex-1">
          <div className="font-semibold">Order Placed!</div>
          <div className="text-sm opacity-90">Order #{orderId.slice(-6).toUpperCase()}</div>
        </div>
        <button onClick={onClose} className="text-white/80 hover:text-white" aria-label="Close notification">
          <svg className="w-5 h-5" fill="none" stroke="currentColor" viewBox="0 0 24 24">
            <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M6 18L18 6M6 6l12 12" />
          </svg>
        </button>
      </div>
    </div>
  );
}

// ─── Main component ───────────────────────────────────────────────────────────
export default function StoreScreen() {
  const { user } = useAuth();
  const { currentBranch } = useBranch();
  const { printReceipt } = useBluetoothPrinter();
  const timeTracking = useTimeTracking({ autoRefresh: true });

  const { menuItems, ingredients, categories, loading: realtimeLoading } = useRealtimeData();
  const loading = realtimeLoading.menu || realtimeLoading.ingredients || realtimeLoading.categories;
  const [availability, setAvailability] = useState<Map<string, number>>(new Map());

  const [cart, setCart] = useState<CartItem[]>([]);
  const [selectedCategories, setSelectedCategories] = useState<string[]>([]);
  const [searchQuery, setSearchQuery] = useState("");
  const [hideUnavailable, setHideUnavailable] = useState(false);
  const [orderType, setOrderType] = useState<"DINE-IN" | "TAKE OUT" | "DELIVERY">("TAKE OUT");
  const [discountAmount, setDiscountAmount] = useState(0);
  const [appliedDiscount, setAppliedDiscount] = useState<Discount | null>(null);
  const [discountCode, setDiscountCode] = useState("");
  const [isPlacingOrder, setIsPlacingOrder] = useState(false);
  const [showConfirm, setShowConfirm] = useState(false);
  const [showToast, setShowToast] = useState(false);
  const [successOrderId, setSuccessOrderId] = useState("");
  const [showOrderMenu, setShowOrderMenu] = useState(false);

  const [isClient, setIsClient] = useState(false);

  // Initialize client state for settings
  useEffect(() => { setIsClient(true); }, []);

  // Recalculate availability whenever ingredients or menu items change
  useEffect(() => {
    setAvailability(getMenuItemsAvailability(menuItems, ingredients));
  }, [menuItems, ingredients]);

  // Load settings
  useEffect(() => {
    const s = loadSettingsFromLocal();
    setHideUnavailable(s.hideOutOfStock ?? false);
  }, []);

  // ── Helpers ──────────────────────────────────────────────────────────────────
  const menuCategories = categories.filter((c) => c.type === "menu");

  const getCategoryName = (categoryId: string) =>
    categories.find((c) => c.id === categoryId)?.name ?? "Uncategorised";

  const getCategoryColor = (categoryId: string) =>
    categories.find((c) => c.id === categoryId)?.color?.trim() ?? "transparent";

  const getAvailableServings = (itemId: string): number => {
    const fromStore = availability.get(itemId) ?? 0;
    const inCart = cart.find((c) => c.id === itemId)?.quantity ?? 0;
    return Math.max(0, fromStore - inCart);
  };

  const filteredItems = menuItems.filter((item) => {
    if (!item.isAvailable) return false;
    const maxServings = availability.get(item.id ?? "") ?? 0;
    if (hideUnavailable && maxServings === 0) return false;
    const matchSearch =
      !searchQuery ||
      item.name.toLowerCase().includes(searchQuery.toLowerCase()) ||
      item.description?.toLowerCase().includes(searchQuery.toLowerCase());
    const matchCat =
      selectedCategories.length === 0 ||
      selectedCategories.includes(getCategoryName(item.categoryId));
    return matchSearch && matchCat;
  });

  // ── Cart operations ───────────────────────────────────────────────────────────
  const addToCart = (item: MenuItem) => {
    if (getAvailableServings(item.id ?? "") <= 0) return;
    setCart((prev) => {
      const existing = prev.find((c) => c.id === item.id);
      if (existing) return prev.map((c) => c.id === item.id ? { ...c, quantity: c.quantity + 1 } : c);
      return [...prev, { id: item.id!, name: item.name, price: item.price, quantity: 1, imgUrl: item.imgUrl, categoryId: item.categoryId }];
    });
  };

  const updateQuantity = (id: string, delta: number) => {
    if (delta > 0 && getAvailableServings(id) <= 0) return;
    setCart((prev) =>
      prev.map((c) => c.id === id ? { ...c, quantity: Math.max(0, c.quantity + delta) } : c)
          .filter((c) => c.quantity > 0)
    );
  };

  const clearCart = () => {
    setCart([]);
    setDiscountAmount(0);
    setAppliedDiscount(null);
    setDiscountCode("");
  };

  const subtotal = cart.reduce((s, c) => s + c.price * c.quantity, 0);
  const total = Math.max(0, subtotal - discountAmount);
  const cartItemCount = cart.reduce((sum, item) => sum + item.quantity, 0);

  // ── Order placement ───────────────────────────────────────────────────────────
  const confirmPlaceOrder = async () => {
    if (!cart.length || isPlacingOrder || !user || !currentBranch) return;
    setIsPlacingOrder(true);
    try {
      const menuItemsMap = new Map(menuItems.map((m) => [m.id!, m]));
      const orderId = await createOrder(
        cart.map((c) => ({ id: c.id, name: c.name, price: c.price, cost: c.cost ?? 0, quantity: c.quantity, imgUrl: c.imgUrl ?? "", categoryId: c.categoryId })),
        menuItemsMap,
        total, subtotal,
        timeTracking.worker?.name ?? user.displayName ?? user.email ?? "Worker",
        timeTracking.worker?.id ?? user.uid,
        orderType,
        discountAmount,
        appliedDiscount?.discount_code ?? "",
        currentBranch.id
      );

      // Print receipt
      try {
        const bytes = await formatReceiptWithLogo({
          orderId, date: new Date(),
          items: cart.map((c) => ({ name: c.name, qty: c.quantity, price: c.price, total: c.price * c.quantity })),
          subtotal, discount: discountAmount, appliedDiscountCode: appliedDiscount?.discount_code ?? "",
          total, payment: total, change: 0,
          cashier: timeTracking.worker?.name ?? user.displayName ?? "Worker",
          cashierEmployeeId: timeTracking.worker?.employeeId ?? user.uid,
          storeName: "K-egg POS", branchName: currentBranch.name,
        });
        await printReceipt(bytes);
      } catch { /* printing is best-effort */ }

      setSuccessOrderId(orderId);
      setShowToast(true);
      clearCart();
      setShowConfirm(false);
      setShowOrderMenu(false); // Close mobile overlay after successful order
    } catch (err) {
      console.error("Order error:", err);
      alert("Failed to place order. Please try again.");
    } finally {
      setIsPlacingOrder(false);
    }
  };

  // ── Order Panel (shared between desktop sidebar and mobile sheet) ─────────────
  const OrderPanel = ({
    isMobile = false,
    onClose,
  }: {
    isMobile?: boolean;
    onClose?: () => void;
  } = {}) => (
    <div className="flex flex-col h-full">
      <div className={`flex-shrink-0 px-5 py-4 border-b ${isMobile ? "border-[var(--accent)] border-b-2" : "border-[var(--border)]"}`}>
        <div className="flex items-center justify-between gap-3">
          <h2 className="text-lg font-bold text-[var(--secondary)]">Current Order</h2>
          {isMobile && onClose && (
            <button
              onClick={onClose}
              className="w-10 h-10 flex items-center justify-center bg-[var(--light-accent)] rounded-full hover:bg-[var(--accent)] transition-all"
              aria-label="Close order panel">
              <svg className="w-5 h-5 text-[var(--secondary)]" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M6 18L18 6M6 6l12 12" />
              </svg>
            </button>
          )}
        </div>
        <div className="flex gap-2 mt-2 flex-wrap">
          {(["DINE-IN", "TAKE OUT", "DELIVERY"] as const).map((type) => (
            <button
              key={type}
              onClick={() => setOrderType(type)}
              className={`px-3 py-1 rounded-lg text-xs font-semibold transition-all ${
                orderType === type
                  ? "bg-[var(--accent)] text-[var(--secondary)]"
                  : "bg-[var(--background)] text-[var(--secondary)]/60 hover:bg-[var(--light-accent)]"
              }`}>
              {type}
            </button>
          ))}
        </div>
      </div>

      {/* Cart Items */}
      <div className="flex-1 overflow-y-auto px-5 py-3 space-y-2">
        {cart.length === 0 ? (
          <div className="flex flex-col items-center justify-center h-full py-12 opacity-50">
            <svg className="w-16 h-16 text-[var(--secondary)]" fill="none" stroke="currentColor" viewBox="0 0 24 24">
              <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={1.5} d="M3 3h2l.4 2M7 13h10l4-8H5.4M7 13l-1.5 6h13M7 13l-1-4m6 4v4m4-4v4" />
            </svg>
            <p className="mt-3 text-sm text-[var(--secondary)]">Cart is empty</p>
          </div>
        ) : (
          cart.map((item) => (
            <div key={item.id} className="flex items-center gap-3 bg-[var(--background)] rounded-xl p-2 pr-3">
              <div className="w-12 h-12 flex-shrink-0 bg-white rounded-lg overflow-hidden border border-[var(--border)] relative">
                {item.imgUrl ? (
                  <SafeImage src={item.imgUrl} alt={item.name} className="w-full h-full object-cover" />
                ) : (
                  <div className="w-full h-full flex items-center justify-center text-[var(--secondary)]/30">
                    <StoreIcon className="w-6 h-6" />
                  </div>
                )}
              </div>
              <div className="flex-1 min-w-0">
                <p className="font-semibold text-[13px] text-[var(--secondary)] whitespace-nowrap leading-tight">{item.name}</p>
                <p className="text-[10px] text-[var(--secondary)]/60">{formatCurrency(item.price)} each</p>
              </div>
              <div className="flex items-center gap-1.5">
                <button onClick={() => updateQuantity(item.id, -1)} className="w-6 h-6 rounded-full bg-[var(--accent)]/20 hover:bg-[var(--accent)]/40 text-[var(--secondary)] font-bold transition-all flex items-center justify-center text-sm">−</button>
                <span className="w-5 text-center font-bold text-[var(--secondary)] text-xs">{item.quantity}</span>
                <button onClick={() => updateQuantity(item.id, 1)} className="w-6 h-6 rounded-full bg-[var(--accent)]/20 hover:bg-[var(--accent)]/40 text-[var(--secondary)] font-bold transition-all flex items-center justify-center text-sm">+</button>
              </div>
              <span className="text-[13px] font-bold text-[var(--secondary)] w-14 text-right">{formatCurrency(item.price * item.quantity)}</span>
            </div>
          ))
        )}
      </div>

      {/* Summary */}
      {cart.length > 0 && (
        <div className="flex-shrink-0 px-5 py-4 border-t border-[var(--border)] space-y-3">
          <DiscountDropdown
            value={discountCode}
            onChange={setDiscountCode}
            subtotal={subtotal}
            cartCategoryIds={[...new Set(cart.map((c) => c.categoryId))]}
            onDiscountApplied={(d, amt) => { setAppliedDiscount(d); setDiscountAmount(amt); }}
            categories={categories}
          />
          <div className="space-y-1 text-sm text-[var(--secondary)]">
            <div className="flex justify-between"><span>Subtotal</span><span>{formatCurrency(subtotal)}</span></div>
            {discountAmount > 0 && (
              <div className="flex justify-between text-[var(--success)]"><span>Discount ({appliedDiscount?.discount_code})</span><span>−{formatCurrency(discountAmount)}</span></div>
            )}
            <div className="flex justify-between font-bold text-base pt-1 border-t border-[var(--border)]"><span>Total</span><span>{formatCurrency(total)}</span></div>
          </div>
          <div className="flex gap-2">
            <button onClick={clearCart} className="flex-1 py-2 rounded-xl border-2 border-[var(--accent)] text-[var(--secondary)] font-semibold text-sm hover:bg-[var(--light-accent)] transition-all">Clear</button>
            <button 
              onClick={() => {
                setShowConfirm(true);
                if (isMobile && onClose) onClose();
              }} 
              className="flex-[2] py-2 rounded-xl bg-[var(--accent)] text-[var(--secondary)] font-bold text-sm hover:bg-[var(--accent)]/80 transition-all shadow-md">
              Place Order
            </button>
          </div>
        </div>
      )}
    </div>
  );

  return (
    <ViewOnlyWrapper branchId={currentBranch?.id} pageName="store">
      <SuccessToast show={showToast} onClose={() => setShowToast(false)} orderId={successOrderId} />

      {/* Confirm Modal */}
      <AnimatePresence>
        {showConfirm && (
          <motion.div initial={{ opacity: 0 }} animate={{ opacity: 1 }} exit={{ opacity: 0 }}
            className="fixed inset-0 z-50 flex items-center justify-center bg-black/40 backdrop-blur-sm px-4">
            <motion.div initial={{ scale: 0.9, opacity: 0 }} animate={{ scale: 1, opacity: 1 }} exit={{ scale: 0.9, opacity: 0 }}
              className="bg-white rounded-2xl shadow-2xl p-6 w-full max-w-xl">
              <h3 className="text-lg font-bold text-[var(--secondary)] mb-1">Confirm Order</h3>
              <p className="text-sm text-[var(--secondary)]/60 mb-4">{cart.length} item(s) · {orderType}</p>
              <div className="border-t border-[var(--border)] py-3 space-y-1 text-sm text-[var(--secondary)] overflow-x-auto">
                {cart.map((c) => (
                  <div key={c.id} className="flex items-center gap-2">
                    <div className="w-8 h-8 flex-shrink-0 bg-gray-50 rounded overflow-hidden border border-[var(--border)] relative">
                      {c.imgUrl ? (
                        <SafeImage src={c.imgUrl} alt={c.name} className="w-full h-full object-cover" />
                      ) : (
                        <div className="w-full h-full flex items-center justify-center text-[var(--secondary)]/20">
                          <StoreIcon className="w-4 h-4" />
                        </div>
                      )}
                    </div>
                    <div className="flex-1 min-w-0">
                      <div className="flex justify-between text-xs gap-4">
                        <span className="whitespace-nowrap">{c.name} <span className="font-bold whitespace-nowrap">×{c.quantity}</span></span>
                        <span className="font-semibold whitespace-nowrap">{formatCurrency(c.price * c.quantity)}</span>
                      </div>
                    </div>
                  </div>
                ))}
                {discountAmount > 0 && <div className="flex justify-between text-[var(--success)]"><span>Discount</span><span>−{formatCurrency(discountAmount)}</span></div>}
                <div className="flex justify-between font-bold pt-1 border-t border-[var(--border)]"><span>Total</span><span>{formatCurrency(total)}</span></div>
              </div>
              <div className="flex gap-3 mt-4">
                <button onClick={() => setShowConfirm(false)} className="flex-1 py-2.5 rounded-xl border-2 border-[var(--border)] text-[var(--secondary)] font-semibold hover:bg-[var(--background)] transition-all">Cancel</button>
                <button onClick={confirmPlaceOrder} disabled={isPlacingOrder}
                  className="flex-[2] py-2.5 rounded-xl bg-[var(--accent)] text-[var(--secondary)] font-bold hover:bg-[var(--accent)]/80 transition-all shadow-md disabled:opacity-50">
                  {isPlacingOrder ? "Placing..." : "Confirm"}
                </button>
              </div>
            </motion.div>
          </motion.div>
        )}
      </AnimatePresence>

      <div className="flex h-full overflow-hidden">
        {/* ── Menu Area ── */}
        <div className="flex flex-col flex-1 h-full overflow-hidden">
          {/* Top Bar */}
          <div className="flex items-center justify-between">
            <div className="xl:hidden w-full">
              <MobileTopBar title="Store" icon={<StoreIcon />} showTimeTracking onOrderClick={() => setShowOrderMenu(!showOrderMenu)} />
            </div>
            <div className="hidden xl:block w-full">
              <TopBar title="Store" icon={<StoreIcon />} showTimeTracking />
            </div>
          </div>
          
          <div className="px-6 pt-4">
            <QuickTimeWidget />
          </div>

          {/* Search */}
          <div className="px-6 pt-4 pb-2">
            <input
              type="text" value={searchQuery} onChange={(e) => setSearchQuery(e.target.value)}
              placeholder="Search menu items…"
              className="w-full px-4 py-2.5 rounded-xl shadow-sm bg-white border border-[var(--border)] text-sm focus:outline-none focus:ring-2 focus:ring-[var(--accent)]"
            />
          </div>

          {/* Category Filters */}
          <div className="px-6 pb-2 flex gap-2 overflow-x-auto no-scrollbar">
            <button
              onClick={() => setSelectedCategories([])}
              className={`px-4 py-1.5 rounded-lg text-xs font-semibold whitespace-nowrap transition-all ${
                selectedCategories.length === 0 ? "bg-[var(--accent)] text-[var(--secondary)]" : "bg-white shadow-sm text-[var(--secondary)]/60 hover:bg-[var(--light-accent)]"
              }`}>
              All
            </button>
            {menuCategories.map((cat) => {
              const active = selectedCategories.includes(cat.name);
              return (
                <button key={cat.id}
                  onClick={() => setSelectedCategories((prev) => active ? prev.filter((n) => n !== cat.name) : [...prev, cat.name])}
                  className={`px-4 py-1.5 rounded-lg text-xs font-semibold whitespace-nowrap transition-all border-l-4 ${
                    active ? "bg-[var(--secondary)]/10 text-[var(--secondary)]" : "bg-white shadow-sm text-[var(--secondary)]/60 hover:bg-[var(--light-accent)]"
                  }`}
                  style={{ borderColor: cat.color }}>
                  {cat.name}
                </button>
              );
            })}
          </div>

          {/* Menu Grid */}
          <div className="flex-1 overflow-y-auto px-6 pb-6">
            {loading ? (
              <div className="flex items-center justify-center py-16 gap-3">
                <LoadingSpinner size="lg" />
                <span className="text-[var(--secondary)]/60 text-sm">Loading menu…</span>
              </div>
            ) : filteredItems.length === 0 ? (
              <div className="flex flex-col items-center justify-center py-16 opacity-50">
                <svg className="w-16 h-16 text-[var(--secondary)]" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                  <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={1.5} d="M9 5H7a2 2 0 00-2 2v12a2 2 0 002 2h10a2 2 0 002-2V7a2 2 0 00-2-2h-2M9 5a2 2 0 002 2h2a2 2 0 002-2M9 5a2 2 0 012-2h2a2 2 0 012 2" />
                </svg>
                <p className="mt-3 font-semibold text-[var(--secondary)]">No items found</p>
                <p className="text-sm text-[var(--secondary)]/50 mt-1">
                  {menuItems.length === 0 ? "Add menu items in the Menu page." : "Try a different search or category."}
                </p>
              </div>
            ) : (
              <div className="grid grid-cols-2 md:grid-cols-2 lg:grid-cols-4 xl:grid-cols-3 2xl:grid-cols-4 gap-4 mt-2">
                {filteredItems.map((item) => {
                  const maxServings = availability.get(item.id ?? "") ?? 0;
                  const available = getAvailableServings(item.id ?? "");
                  const isOut = maxServings === 0;
                  const cartQty = cart.find((c) => c.id === item.id)?.quantity ?? 0;

                  return (
                    <div key={item.id}
                      onClick={() => !isOut && addToCart(item)}
                      className={`bg-white rounded-2xl shadow-md overflow-hidden transition-all cursor-pointer
                        ${isOut ? "opacity-50 cursor-not-allowed" : "hover:shadow-xl hover:scale-[1.02] hover:border-[var(--accent)] border-2 border-transparent"}`}>
                      {/* Image */}
                      <div className="w-full aspect-square bg-[var(--background)] relative overflow-hidden">
                        {item.imgUrl ? (
                          <SafeImage src={item.imgUrl} alt={item.name} className="" />
                        ) : (
                          <div className="w-full h-full flex items-center justify-center text-[var(--secondary)]/50">
                            <StoreIcon className="w-12 h-12" />
                          </div>
                        )}
                        {isOut && (
                          <div className="absolute inset-0 bg-black/50 flex items-center justify-center">
                            <span className="text-white text-xs font-bold px-2 py-1 bg-black/60 rounded-lg">UNAVAILABLE</span>
                          </div>
                        )}
                        {!isOut && available <= 3 && (
                          <div className="absolute top-2 right-2 bg-amber-500 text-white text-[10px] font-bold px-1.5 py-0.5 rounded-full">
                            {available} left
                          </div>
                        )}
                        {cartQty > 0 && (
                          <div className="absolute top-2 left-2 bg-[var(--accent)] text-[var(--secondary)] text-xs font-bold w-6 h-6 rounded-full flex items-center justify-center shadow">
                            {cartQty}
                          </div>
                        )}
                      </div>
                      {/* Info */}
                      <div className="p-3">
                        <h3 className="font-bold text-sm text-[var(--secondary)] truncate">{item.name}</h3>
                        <div className="flex items-center justify-between mt-1.5 gap-2">
                          <span className="text-[10px] px-1.5 py-0.5 rounded-full font-bold text-white truncate max-w-[60%]"
                            style={{ backgroundColor: getCategoryColor(item.categoryId) || "#6b7280" }}>
                            {getCategoryName(item.categoryId)}
                          </span>
                          <span className="font-bold text-sm text-[var(--secondary)] whitespace-nowrap">{formatCurrency(item.price)}</span>
                        </div>
                      </div>
                    </div>
                  );
                })}
              </div>
            )}
          </div>
        </div>

        {/* ── Desktop Order Panel ── */}
        <div className="hidden xl:flex flex-col w-[480px] border-l border-[var(--border)] bg-white h-full overflow-hidden">
          <OrderPanel />
        </div>

        {/* ── Mobile Floating Order Button ── */}
        {!showOrderMenu && (
          <button
            onClick={() => setShowOrderMenu(true)}
            className="fixed xl:hidden bottom-5 right-5 z-40 bg-[var(--accent)] text-[var(--secondary)] rounded-2xl shadow-xl px-4 py-3 flex items-center gap-3 hover:scale-105 active:scale-95 transition-all"
            aria-label="Open order menu">
            <div className="relative">
              <svg className="w-6 h-6" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M3 3h2l.4 2M7 13h10l4-8H5.4M7 13l-1.5 6h13M7 13l-1-4m6 4v4m4-4v4" />
              </svg>
              {cartItemCount > 0 && (
                <span className="absolute -top-2 -right-2 min-w-5 h-5 px-1 rounded-full bg-[var(--secondary)] text-[var(--primary)] text-[10px] font-bold flex items-center justify-center">
                  {cartItemCount}
                </span>
              )}
            </div>
            <div className="text-left">
              <p className="text-[10px] font-semibold leading-none opacity-80">Current Order</p>
              <p className="text-xs font-bold">{formatCurrency(total)}</p>
            </div>
          </button>
        )}

        {/* ── Mobile Order Sheet ── */}
        <AnimatePresence>
          {showOrderMenu && (
            <div className="fixed inset-0 z-50 xl:hidden">
              <motion.div initial={{ opacity: 0 }} animate={{ opacity: 1 }} exit={{ opacity: 0 }}
                transition={{ duration: 0.3 }}
                className="absolute inset-0 bg-black/50" onClick={() => setShowOrderMenu(false)} />
              <motion.div initial={{ x: "100%" }} animate={{ x: 0 }} exit={{ x: "100%" }}
                transition={{ type: "spring", damping: 50, stiffness: 300 }}
                className="absolute top-0 right-0 bottom-0 w-full bg-[var(--primary)] shadow-2xl flex flex-col">
                <div className="flex-1 overflow-hidden">
                  <OrderPanel isMobile onClose={() => setShowOrderMenu(false)} />
                </div>
              </motion.div>
            </div>
          )}
        </AnimatePresence>
      </div>
    </ViewOnlyWrapper>
  );
}
