"use client";

import React, {
	createContext,
	useContext,
	useEffect,
	useState,
	useCallback,
} from "react";
import {
	subscribeToMenuItems,
	subscribeToIngredients,
	subscribeToOrders,
	subscribeToCategories,
} from "@/stores/dataStore";
import { MenuItem } from "@/services/menuItemService";
import { Ingredient } from "@/services/ingredientService";
import { Order } from "@/services/orderService";
import { Category } from "@/services/categoryService";

interface RealtimeDataContextType {
	menuItems: MenuItem[];
	ingredients: Ingredient[];
	orders: Order[];
	categories: Category[];
	loading: {
		menu: boolean;
		ingredients: boolean;
		orders: boolean;
		categories: boolean;
	};
	branchId: string | null;
}

const RealtimeDataContext = createContext<RealtimeDataContextType | undefined>(
	undefined
);

export function useRealtimeData() {
	const ctx = useContext(RealtimeDataContext);
	if (!ctx)
		throw new Error(
			"useRealtimeData must be used within a RealtimeDataProvider"
		);
	return ctx;
}

interface Props {
	children: React.ReactNode;
	branchId: string;
}

export function RealtimeDataProvider({ children, branchId }: Props) {
	const [menuItems, setMenuItems] = useState<MenuItem[]>([]);
	const [ingredients, setIngredients] = useState<Ingredient[]>([]);
	const [orders, setOrders] = useState<Order[]>([]);
	const [categories, setCategories] = useState<Category[]>([]);
	const [loadingMenu, setLoadingMenu] = useState(true);
	const [loadingIngredients, setLoadingIngredients] = useState(true);
	const [loadingOrders, setLoadingOrders] = useState(true);
	const [loadingCategories, setLoadingCategories] = useState(true);

	useEffect(() => {
		if (!branchId) return;

		// Reset loading when branch changes
		setLoadingMenu(true);
		setLoadingIngredients(true);
		setLoadingOrders(true);

		const unsubMenu = subscribeToMenuItems(branchId, (items) => {
			setMenuItems(items);
			setLoadingMenu(false);
		});

		const unsubIngredients = subscribeToIngredients(branchId, (items) => {
			setIngredients(items);
			setLoadingIngredients(false);
		});

		const unsubOrders = subscribeToOrders(branchId, (items) => {
			setOrders(items);
			setLoadingOrders(false);
		});

		return () => {
			unsubMenu();
			unsubIngredients();
			unsubOrders();
		};
	}, [branchId]);

	useEffect(() => {
		const unsubCategories = subscribeToCategories((cats) => {
			setCategories(cats);
			setLoadingCategories(false);
		});
		return () => unsubCategories();
	}, []);

	const value: RealtimeDataContextType = {
		menuItems,
		ingredients,
		orders,
		categories,
		loading: {
			menu: loadingMenu,
			ingredients: loadingIngredients,
			orders: loadingOrders,
			categories: loadingCategories,
		},
		branchId,
	};

	return (
		<RealtimeDataContext.Provider value={value}>
			{children}
		</RealtimeDataContext.Provider>
	);
}
