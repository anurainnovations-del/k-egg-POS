"use client";

import React, { createContext, useContext, useMemo, useState, useEffect } from "react";
import { Ingredient } from "@/services/ingredientService";
import { useRealtimeData } from "./RealtimeDataContext";

interface StockAlertContextType {
	lowStockItems: Ingredient[];
	criticalItems: Ingredient[];
	alertCount: number;
	dismissAlert: (id: string) => void;
	dismissedIds: Set<string>;
	notificationPermission: NotificationPermission;
	requestPermission: () => Promise<void>;
}

const StockAlertContext = createContext<StockAlertContextType | undefined>(undefined);

export function useStockAlerts() {
	return useContext(StockAlertContext);
}

export function StockAlertProvider({ children }: { children: React.ReactNode }) {
	const { ingredients, loading } = useRealtimeData();
	const [dismissedIds, setDismissedIds] = useState<Set<string>>(new Set());
	const [notificationPermission, setNotificationPermission] = useState<NotificationPermission>("default");
	const [lastCriticalCount, setLastCriticalCount] = useState(0);

	useEffect(() => {
		if (typeof window !== "undefined" && "Notification" in window) {
			setNotificationPermission(Notification.permission);
		}
	}, []);

	const requestPermission = async () => {
		if (typeof window !== "undefined" && "Notification" in window) {
			const permission = await Notification.requestPermission();
			setNotificationPermission(permission);
		}
	};

	// Derive low stock items
	const { lowStockItems, criticalItems } = useMemo(() => {
		if (loading.ingredients) return { lowStockItems: [], criticalItems: [] };
		
		const low: Ingredient[] = [];
		const critical: Ingredient[] = [];
		
		ingredients.forEach(item => {
			if (item.stock === 0) {
				critical.push(item);
			} else if (item.stock <= item.lowStockThreshold) {
				low.push(item);
			}
		});
		
		return { lowStockItems: low, criticalItems: critical };
	}, [ingredients, loading.ingredients]);

	const dismissAlert = (id: string) => {
		setDismissedIds(prev => {
			const next = new Set(prev);
			next.add(id);
			return next;
		});
	};

	// Active alerts (not dismissed)
	const activeAlertCount = useMemo(() => {
		return [...lowStockItems, ...criticalItems].filter(item => !dismissedIds.has(item.id || "")).length;
	}, [lowStockItems, criticalItems, dismissedIds]);

	// Trigger browser notifications for NEW critical items
	useEffect(() => {
		if (loading.ingredients) return;
		
		if (criticalItems.length > lastCriticalCount) {
			// Found new critical items
			if (notificationPermission === "granted") {
				const newestItem = criticalItems[criticalItems.length - 1];
				new Notification("Critical Stock Alert!", {
					body: `${newestItem.name} is OUT OF STOCK!`,
					icon: "/web-app-manifest-192x192.png",
					badge: "/web-app-manifest-192x192.png",
					tag: "stock-alert-" + newestItem.id,
					renotify: true
				} as any);
			}
		}
		setLastCriticalCount(criticalItems.length);
	}, [criticalItems.length, notificationPermission, loading.ingredients, criticalItems, lastCriticalCount]);

	const value: StockAlertContextType = {
		lowStockItems,
		criticalItems,
		alertCount: activeAlertCount,
		dismissAlert,
		dismissedIds,
		notificationPermission,
		requestPermission
	};

	return (
		<StockAlertContext.Provider value={value}>
			{children}
		</StockAlertContext.Provider>
	);
}
