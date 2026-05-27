import {
	collection,
	query,
	orderBy,
	onSnapshot,
	Unsubscribe,
	Timestamp,
	where,
	doc,
	DocumentSnapshot,
} from "firebase/firestore";
import { db } from "../firebase-config";
import { Ingredient } from "../services/ingredientService";
import { MenuItem } from "../services/menuItemService";
import { Category } from "../services/categoryService";
import { Order } from "../services/orderService";
import { Discount } from "../services/discountService";
import { Branch } from "../services/branchService";
import { Worker } from "../services/workerService";

// ─── Event Emitter ────────────────────────────────────────────────────────────

class EventEmitter {
	private events: { [key: string]: Function[] } = {};

	on(event: string, callback: Function) {
		if (!this.events[event]) this.events[event] = [];
		this.events[event].push(callback);
	}

	off(event: string, callback: Function) {
		if (!this.events[event]) return;
		this.events[event] = this.events[event].filter((cb) => cb !== callback);
	}

	emit(event: string, data: any) {
		if (!this.events[event]) return;
		this.events[event].forEach((cb) => cb(data));
	}
}

// ─── DataStore Singleton ──────────────────────────────────────────────────────

class DataStore {
	private static instance: DataStore;
	private eventEmitter = new EventEmitter();

	// State
	private ingredients: { [branchId: string]: Ingredient[] } = {};
	private menuItems: { [branchId: string]: MenuItem[] } = {};
	private categories: Category[] = [];
	private orders: { [branchId: string]: Order[] } = {};
	private discounts: { [branchId: string]: Discount[] } = {};
	private branches: Branch[] = [];
	private workers: { [userId: string]: Worker } = {};

	// Listener tracking
	private ingredientsUnsubscribes: { [branchId: string]: Unsubscribe } = {};
	private menuItemsUnsubscribes: { [branchId: string]: Unsubscribe } = {};
	private categoriesUnsubscribe: Unsubscribe | null = null;
	private ordersUnsubscribes: { [branchId: string]: Unsubscribe } = {};
	private discountsUnsubscribes: { [branchId: string]: Unsubscribe } = {};
	private branchesUnsubscribe: Unsubscribe | null = null;
	private workersUnsubscribes: { [userId: string]: Unsubscribe } = {};

	private activeIngredientsListeners: Set<string> = new Set();
	private activeMenuItemsListeners: Set<string> = new Set();
	private isCategoriesListenerActive = false;
	private activeOrdersListeners: Set<string> = new Set();
	private activeDiscountsListeners: Set<string> = new Set();
	private isBranchesListenerActive = false;
	private activeWorkerListeners: Set<string> = new Set();

	private constructor() {
		if (typeof window !== "undefined") {
			this.initializeGlobalListeners();
		}
	}

	public static getInstance(): DataStore {
		if (!DataStore.instance) DataStore.instance = new DataStore();
		return DataStore.instance;
	}

	private initializeGlobalListeners() {
		if (typeof window === "undefined" || !db) return;
		this.startCategoriesListener();
	}

	// ── Ingredients (Branch-specific) ──────────────────────────────────────────

	private startIngredientsListener(branchId: string) {
		if (this.activeIngredientsListeners.has(branchId)) return;
		try {
			const q = query(
				collection(db, "ingredients"),
				where("branchId", "==", branchId),
				orderBy("createdAt", "desc")
			);
			this.ingredientsUnsubscribes[branchId] = onSnapshot(
				q,
				(snapshot) => {
					const items: Ingredient[] = [];
					snapshot.forEach((d) => {
						const data = d.data();
						if (data) {
							items.push({
								id: d.id,
								name: data.name || "",
								unit: data.unit || "pcs",
								stock: data.stock ?? 0,
								lowStockThreshold: data.lowStockThreshold ?? 5,
								costPerUnit: data.costPerUnit ?? 0,
								categoryId: data.categoryId || "",
								branchId: data.branchId || "",
								imgUrl: data.imgUrl || undefined,
								createdAt: data.createdAt || Timestamp.now(),
								updatedAt: data.updatedAt || Timestamp.now(),
							});
						}
					});
					this.ingredients[branchId] = items;
					this.eventEmitter.emit(`ingredientsChanged:${branchId}`, items);
				},
				(error) => {
					console.error(`Ingredients listener error for ${branchId}:`, error);
					this.ingredients[branchId] = [];
					this.eventEmitter.emit(`ingredientsChanged:${branchId}`, []);
				}
			);
			this.activeIngredientsListeners.add(branchId);
		} catch (error) {
			console.error(`Error starting ingredients listener for ${branchId}:`, error);
			this.ingredients[branchId] = [];
			this.eventEmitter.emit(`ingredientsChanged:${branchId}`, []);
		}
	}

	// ── Menu Items (Branch-specific) ────────────────────────────────────────────

	private startMenuItemsListener(branchId: string) {
		if (this.activeMenuItemsListeners.has(branchId)) return;
		try {
			const q = query(
				collection(db, "menuItems"),
				where("branchId", "==", branchId),
				orderBy("createdAt", "desc")
			);
			this.menuItemsUnsubscribes[branchId] = onSnapshot(
				q,
				(snapshot) => {
					const items: MenuItem[] = [];
					snapshot.forEach((d) => {
						const data = d.data();
						if (data) {
							items.push({
								id: d.id,
								name: data.name || "",
								price: data.price || 0,
								categoryId: data.categoryId || "",
								description: data.description || "",
								imgUrl: data.imgUrl || undefined,
								branchId: data.branchId || "",
								isAvailable: data.isAvailable !== false,
								recipe: data.recipe || [],
								createdAt: data.createdAt || Timestamp.now(),
								updatedAt: data.updatedAt || Timestamp.now(),
							});
						}
					});
					this.menuItems[branchId] = items;
					this.eventEmitter.emit(`menuItemsChanged:${branchId}`, items);
				},
				(error) => {
					console.error(`Menu items listener error for ${branchId}:`, error);
					this.menuItems[branchId] = [];
					this.eventEmitter.emit(`menuItemsChanged:${branchId}`, []);
				}
			);
			this.activeMenuItemsListeners.add(branchId);
		} catch (error) {
			console.error(`Error starting menu items listener for ${branchId}:`, error);
			this.menuItems[branchId] = [];
			this.eventEmitter.emit(`menuItemsChanged:${branchId}`, []);
		}
	}

	// ── Categories (Global) ────────────────────────────────────────────────────

	private startCategoriesListener() {
		if (this.isCategoriesListenerActive) return;
		try {
			const q = query(collection(db, "categories"), orderBy("name", "asc"));
			this.categoriesUnsubscribe = onSnapshot(
				q,
				(snapshot) => {
					const categories: Category[] = [];
					snapshot.forEach((d) => {
						const data = d.data();
						if (data) {
							categories.push({
								id: d.id,
								name: data.name || "",
								color: data.color || "#000000",
								type: data.type || "menu",
								createdAt: data.createdAt || Timestamp.now(),
							});
						}
					});
					this.categories = categories;
					this.eventEmitter.emit("categoriesChanged", categories);
				},
				(error) => {
					console.error("Categories listener error:", error);
					this.categories = [];
					this.eventEmitter.emit("categoriesChanged", []);
				}
			);
			this.isCategoriesListenerActive = true;
		} catch (error) {
			console.error("Error starting categories listener:", error);
			this.categories = [];
			this.eventEmitter.emit("categoriesChanged", []);
		}
	}

	// ── Branches (Global) ──────────────────────────────────────────────────────

	private startBranchesListener() {
		if (this.isBranchesListenerActive) return;
		try {
			const q = query(collection(db, "branches"), orderBy("name", "asc"));
			this.branchesUnsubscribe = onSnapshot(
				q,
				(snapshot) => {
					const branches: Branch[] = [];
					snapshot.forEach((d) => {
						const data = d.data();
						if (data) {
							branches.push({
								id: d.id,
								name: data.name || "",
								location: data.location || "",
								isActive: data.isActive ?? true,
								imgUrl: data.imgUrl || "",
								createdAt: data.createdAt || Timestamp.now(),
								updatedAt: data.updatedAt || Timestamp.now(),
							});
						}
					});
					this.branches = branches;
					this.eventEmitter.emit("branchesChanged", branches);
				},
				(error) => {
					console.error("Branches listener error:", error);
					this.branches = [];
					this.eventEmitter.emit("branchesChanged", []);
				}
			);
			this.isBranchesListenerActive = true;
		} catch (error) {
			console.error("Error starting branches listener:", error);
			this.branches = [];
			this.eventEmitter.emit("branchesChanged", []);
		}
	}

	// ── Orders (Branch-specific) ───────────────────────────────────────────────

	private startOrdersListener(branchId: string) {
		if (this.activeOrdersListeners.has(branchId)) return;
		try {
			const thirtyOneDaysAgo = new Date();
			thirtyOneDaysAgo.setDate(thirtyOneDaysAgo.getDate() - 31);
			thirtyOneDaysAgo.setHours(0, 0, 0, 0);

			const q = query(
				collection(db, "orders"),
				where("branchId", "==", branchId),
				where("timestamp", ">=", Timestamp.fromDate(thirtyOneDaysAgo)),
				orderBy("timestamp", "desc")
			);
			this.ordersUnsubscribes[branchId] = onSnapshot(
				q,
				(snapshot) => {
					const orders: Order[] = [];
					snapshot.forEach((d) => {
						const data = d.data();
						if (data) {
							orders.push({
								id: d.id,
								items: data.items || [],
								ingredientDeductions: data.ingredientDeductions || [],
								subtotal: data.subtotal || 0,
								discountAmount: data.discountAmount || 0,
								discountCode: data.discountCode || "",
								total: data.total || 0,
								totalProfit: data.totalProfit || 0,
								orderType: data.orderType || "DINE-IN",
								timestamp: data.timestamp || Timestamp.now(),
								createdAt: data.createdAt || Timestamp.now(),
								itemCount: data.itemCount || 0,
								uniqueItemCount: data.uniqueItemCount || 0,
								workerName: data.workerName || "",
								workerUid: data.workerUid || "",
								branchId,
							});
						}
					});
					this.orders[branchId] = orders;
					this.eventEmitter.emit(`ordersChanged:${branchId}`, orders);
				},
				(error) => {
					console.error(`Orders listener error for ${branchId}:`, error);
					this.orders[branchId] = [];
					this.eventEmitter.emit(`ordersChanged:${branchId}`, []);
				}
			);
			this.activeOrdersListeners.add(branchId);
		} catch (error) {
			console.error(`Error starting orders listener for ${branchId}:`, error);
			this.orders[branchId] = [];
			this.eventEmitter.emit(`ordersChanged:${branchId}`, []);
		}
	}

	// ── Discounts (Branch-specific) ────────────────────────────────────────────

	private startDiscountsListener(branchId: string) {
		if (this.activeDiscountsListeners.has(branchId)) return;
		try {
			const q = query(
				collection(db, "discounts"),
				where("branchId", "==", branchId),
				orderBy("created_at", "desc")
			);
			this.discountsUnsubscribes[branchId] = onSnapshot(
				q,
				(snapshot) => {
					const discounts: Discount[] = [];
					snapshot.forEach((d) => {
						const data = d.data();
						if (data) {
							discounts.push({
								id: d.id,
								discount_code: data.discount_code || d.id,
								type: data.type || "flat",
								value: data.value || 0,
								applies_to: data.applies_to || null,
								created_at: data.created_at || Timestamp.now(),
								modified_at: data.modified_at || Timestamp.now(),
								created_by: data.created_by || "",
								branchId: data.branchId || branchId,
							});
						}
					});
					this.discounts[branchId] = discounts;
					this.eventEmitter.emit(`discountsChanged:${branchId}`, discounts);
				},
				(error) => {
					console.error(`Discounts listener error for ${branchId}:`, error);
					this.discounts[branchId] = [];
					this.eventEmitter.emit(`discountsChanged:${branchId}`, []);
				}
			);
			this.activeDiscountsListeners.add(branchId);
		} catch (error) {
			console.error(`Error starting discounts listener for ${branchId}:`, error);
			this.discounts[branchId] = [];
			this.eventEmitter.emit(`discountsChanged:${branchId}`, []);
		}
	}

	// ── Workers (User-specific) ────────────────────────────────────────────────

	private startWorkerListener(userId: string) {
		if (this.activeWorkerListeners.has(userId)) return;
		try {
			const workerDocRef = doc(db, "users", userId);
			this.workersUnsubscribes[userId] = onSnapshot(
				workerDocRef,
				(docSnapshot: DocumentSnapshot) => {
					if (docSnapshot.exists()) {
						const data = docSnapshot.data();
						if (data) {
							const worker: Worker = {
								id: docSnapshot.id,
								name: data.name || "",
								email: data.email || "",
								phoneNumber: data.phoneNumber,
								employeeId: data.employeeId,
								roleAssignments: data.roleAssignments || [],
								isAdmin: data.isAdmin || false,
								adminAssignedBy: data.adminAssignedBy,
								adminAssignedAt: data.adminAssignedAt?.toDate(),
								currentStatus: data.isAdmin ? undefined : data.currentStatus || "clocked_out",
								currentBranchId: data.currentBranchId,
								lastTimeIn: data.lastTimeIn?.toDate(),
								lastTimeOut: data.lastTimeOut?.toDate(),
								profilePicture: data.profilePicture,
								createdAt: data.createdAt?.toDate() ?? new Date(),
								updatedAt: data.updatedAt?.toDate() ?? new Date(),
								createdBy: data.createdBy || "",
								isActive: data.isActive !== false,
								lastLoginAt: data.lastLoginAt?.toDate(),
								passwordResetRequired: data.passwordResetRequired || false,
								twoFactorEnabled: data.twoFactorEnabled || false,
							};
							this.workers[userId] = worker;
							this.eventEmitter.emit(`workerChanged:${userId}`, worker);
						}
					} else {
						delete this.workers[userId];
						this.eventEmitter.emit(`workerChanged:${userId}`, null);
					}
				},
				(error: any) => {
					console.error(`Worker listener error for ${userId}:`, error);
					delete this.workers[userId];
					this.eventEmitter.emit(`workerChanged:${userId}`, null);
				}
			);
			this.activeWorkerListeners.add(userId);
		} catch (error) {
			console.error(`Error starting worker listener for ${userId}:`, error);
			delete this.workers[userId];
			this.eventEmitter.emit(`workerChanged:${userId}`, null);
		}
	}

	// ── Public Subscribe Methods ───────────────────────────────────────────────

	public subscribeToIngredients(branchId: string, callback: (items: Ingredient[]) => void): () => void {
		if (!branchId) { callback([]); return () => {}; }
		if (typeof window !== "undefined" && !this.activeIngredientsListeners.has(branchId)) {
			this.startIngredientsListener(branchId);
		}
		callback(this.ingredients[branchId] || []);
		this.eventEmitter.on(`ingredientsChanged:${branchId}`, callback);
		return () => this.eventEmitter.off(`ingredientsChanged:${branchId}`, callback);
	}

	public subscribeToMenuItems(branchId: string, callback: (items: MenuItem[]) => void): () => void {
		if (!branchId) { callback([]); return () => {}; }
		if (typeof window !== "undefined" && !this.activeMenuItemsListeners.has(branchId)) {
			this.startMenuItemsListener(branchId);
		}
		callback(this.menuItems[branchId] || []);
		this.eventEmitter.on(`menuItemsChanged:${branchId}`, callback);
		return () => this.eventEmitter.off(`menuItemsChanged:${branchId}`, callback);
	}

	public subscribeToCategories(callback: (categories: Category[]) => void): () => void {
		if (typeof window !== "undefined" && !this.isCategoriesListenerActive) {
			this.startCategoriesListener();
		}
		callback(this.categories);
		this.eventEmitter.on("categoriesChanged", callback);
		return () => this.eventEmitter.off("categoriesChanged", callback);
	}

	public subscribeToBranches(callback: (branches: Branch[]) => void): () => void {
		if (typeof window !== "undefined" && !this.isBranchesListenerActive) {
			this.startBranchesListener();
		}
		callback(this.branches);
		this.eventEmitter.on("branchesChanged", callback);
		return () => this.eventEmitter.off("branchesChanged", callback);
	}

	public subscribeToOrders(branchId: string, callback: (orders: Order[]) => void): () => void {
		if (!branchId) { callback([]); return () => {}; }
		if (typeof window !== "undefined" && !this.activeOrdersListeners.has(branchId)) {
			this.startOrdersListener(branchId);
		}
		callback(this.orders[branchId] || []);
		this.eventEmitter.on(`ordersChanged:${branchId}`, callback);
		return () => this.eventEmitter.off(`ordersChanged:${branchId}`, callback);
	}

	public subscribeToDiscounts(branchId: string, callback: (discounts: Discount[]) => void): () => void {
		if (!branchId) { callback([]); return () => {}; }
		if (typeof window !== "undefined" && !this.activeDiscountsListeners.has(branchId)) {
			this.startDiscountsListener(branchId);
		}
		callback(this.discounts[branchId] || []);
		this.eventEmitter.on(`discountsChanged:${branchId}`, callback);
		return () => this.eventEmitter.off(`discountsChanged:${branchId}`, callback);
	}

	public subscribeToWorker(userId: string, callback: (worker: Worker | null) => void): () => void {
		if (!userId) { callback(null); return () => {}; }
		if (typeof window !== "undefined" && !this.activeWorkerListeners.has(userId)) {
			this.startWorkerListener(userId);
		}
		callback(this.workers[userId] || null);
		this.eventEmitter.on(`workerChanged:${userId}`, callback);
		return () => this.eventEmitter.off(`workerChanged:${userId}`, callback);
	}

	// ── Synchronous Getters ────────────────────────────────────────────────────

	public getIngredients(branchId: string): Ingredient[] {
		return [...(this.ingredients[branchId] || [])];
	}
	public getMenuItems(branchId: string): MenuItem[] {
		return [...(this.menuItems[branchId] || [])];
	}
	public getCategories(): Category[] { return [...this.categories]; }
	public getBranches(): Branch[] { return [...this.branches]; }
	public getOrders(branchId: string): Order[] { return [...(this.orders[branchId] || [])]; }
	public getDiscounts(branchId: string): Discount[] { return [...(this.discounts[branchId] || [])]; }
	public getWorker(userId: string): Worker | null { return this.workers[userId] || null; }

	// ── Cleanup ────────────────────────────────────────────────────────────────

	public cleanupBranch(branchId: string) {
		if (this.ingredientsUnsubscribes[branchId]) {
			this.ingredientsUnsubscribes[branchId]();
			delete this.ingredientsUnsubscribes[branchId];
			this.activeIngredientsListeners.delete(branchId);
		}
		if (this.menuItemsUnsubscribes[branchId]) {
			this.menuItemsUnsubscribes[branchId]();
			delete this.menuItemsUnsubscribes[branchId];
			this.activeMenuItemsListeners.delete(branchId);
		}
		if (this.ordersUnsubscribes[branchId]) {
			this.ordersUnsubscribes[branchId]();
			delete this.ordersUnsubscribes[branchId];
			this.activeOrdersListeners.delete(branchId);
		}
		if (this.discountsUnsubscribes[branchId]) {
			this.discountsUnsubscribes[branchId]();
			delete this.discountsUnsubscribes[branchId];
			this.activeDiscountsListeners.delete(branchId);
		}
	}

	public cleanupAll() {
		Object.values(this.ingredientsUnsubscribes).forEach((u) => u());
		Object.values(this.menuItemsUnsubscribes).forEach((u) => u());
		Object.values(this.ordersUnsubscribes).forEach((u) => u());
		Object.values(this.discountsUnsubscribes).forEach((u) => u());
		Object.values(this.workersUnsubscribes).forEach((u) => u());
		if (this.categoriesUnsubscribe) this.categoriesUnsubscribe();
		if (this.branchesUnsubscribe) this.branchesUnsubscribe();
	}
}

// ─── Singleton Export ─────────────────────────────────────────────────────────

const dataStore = DataStore.getInstance();
export default dataStore;

// Named convenience exports
export const subscribeToIngredients = (
	branchId: string,
	callback: (items: Ingredient[]) => void
) => dataStore.subscribeToIngredients(branchId, callback);

export const subscribeToMenuItems = (
	branchId: string,
	callback: (items: MenuItem[]) => void
) => dataStore.subscribeToMenuItems(branchId, callback);

export const subscribeToCategories = (
	callback: (categories: Category[]) => void
) => dataStore.subscribeToCategories(callback);

export const subscribeToBranches = (
	callback: (branches: Branch[]) => void
) => dataStore.subscribeToBranches(callback);

export const subscribeToOrders = (
	branchId: string,
	callback: (orders: Order[]) => void
) => dataStore.subscribeToOrders(branchId, callback);

export const subscribeToDiscounts = (
	branchId: string,
	callback: (discounts: Discount[]) => void
) => dataStore.subscribeToDiscounts(branchId, callback);

export const subscribeToWorker = (
	userId: string,
	callback: (worker: Worker | null) => void
) => dataStore.subscribeToWorker(userId, callback);
