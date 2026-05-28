"use client";

import React, { createContext, useContext, useEffect, useState, useCallback } from "react";
import { db } from "@/firebase-config";
import { onSnapshotsInSync, waitForPendingWrites } from "firebase/firestore";

interface NetworkContextType {
	isOnline: boolean;
	hasPendingWrites: boolean;
	checkPendingWrites: () => Promise<boolean>;
}

const NetworkContext = createContext<NetworkContextType>({
	isOnline: true,
	hasPendingWrites: false,
	checkPendingWrites: async () => false,
});

export const useNetwork = () => useContext(NetworkContext);

export function NetworkProvider({ children }: { children: React.ReactNode }) {
	const [isOnline, setIsOnline] = useState<boolean>(
		typeof navigator !== "undefined" ? navigator.onLine : true
	);
	const [hasPendingWrites, setHasPendingWrites] = useState<boolean>(false);

	const checkPendingWrites = useCallback(async (): Promise<boolean> => {
		if (typeof window === "undefined" || !db) return false;
		try {
			// If we are completely offline, waitForPendingWrites will never resolve.
			// In that case, we can quickly return true if navigator.onLine is false,
			// or do the Promise.race check.
			if (!navigator.onLine) {
				// If we're offline, check if there actually are writes in the queue.
				// Firestore's waitForPendingWrites will remain pending if there are queued writes,
				// but if the queue is empty, it resolves immediately even when offline!
				// Let's verify this: yes, if the queue is empty, waitForPendingWrites resolves immediately.
			}

			const isResolved = await Promise.race([
				waitForPendingWrites(db).then(() => true),
				new Promise<boolean>((resolve) => setTimeout(() => resolve(false), 80))
			]);

			const pending = !isResolved;
			setHasPendingWrites(pending);
			return pending;
		} catch (error) {
			console.error("Error checking pending writes:", error);
			return false;
		}
	}, []);

	useEffect(() => {
		if (typeof window === "undefined") return;

		const handleOnline = () => {
			setIsOnline(true);
			checkPendingWrites();
		};
		const handleOffline = () => {
			setIsOnline(false);
			checkPendingWrites();
		};

		window.addEventListener("online", handleOnline);
		window.addEventListener("offline", handleOffline);

		// Initial check
		checkPendingWrites();

		return () => {
			window.removeEventListener("online", handleOnline);
			window.removeEventListener("offline", handleOffline);
		};
	}, [checkPendingWrites]);

	useEffect(() => {
		if (typeof window === "undefined" || !db) return;

		// Listen to Firestore synchronization state
		// onSnapshotsInSync fires when all local modifications up to this point have been synchronized
		const unsubscribe = onSnapshotsInSync(db, () => {
			checkPendingWrites();
		});

		// Check periodically (every 3 seconds) to catch any background sync updates
		const interval = setInterval(() => {
			checkPendingWrites();
		}, 3000);

		return () => {
			unsubscribe();
			clearInterval(interval);
		};
	}, [checkPendingWrites]);

	const value: NetworkContextType = {
		isOnline,
		hasPendingWrites,
		checkPendingWrites,
	};

	return (
		<NetworkContext.Provider value={value}>
			{children}
		</NetworkContext.Provider>
	);
}
