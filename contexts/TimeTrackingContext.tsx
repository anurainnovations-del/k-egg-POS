"use client";

import React, {
	createContext,
	useContext,
	useState,
	useEffect,
	useCallback,
} from "react";
import { useAuth } from "@/contexts/AuthContext";
import { workerService, Worker } from "@/services/workerService";
import { workSessionService } from "@/services/workSessionService";
import { subscribeToWorker } from "@/stores/dataStore";

interface TimeTrackingOptions {
	autoRefresh?: boolean;
	refreshInterval?: number;
}

interface TimeTrackingState {
	worker: Worker | null;
	isWorking: boolean;
	currentSession: any | null;
	workingDuration: number; // in minutes
	loading: boolean;
	error: string | null;
}

interface TimeTrackingActions {
	clockIn: (branchId: string, notes?: string) => Promise<void>;
	clockOut: (notes?: string) => Promise<void>;
	refreshStatus: () => Promise<void>;
	clearError: () => void;
}

interface TimeTrackingContextType
	extends TimeTrackingState,
		TimeTrackingActions {}

const TimeTrackingContext = createContext<TimeTrackingContextType | undefined>(
	undefined
);

export function useTimeTracking(
	options: TimeTrackingOptions = {}
): TimeTrackingContextType {
	const context = useContext(TimeTrackingContext);
	if (context === undefined) {
		throw new Error(
			"useTimeTracking must be used within a TimeTrackingProvider"
		);
	}
	return context;
}

interface TimeTrackingProviderProps {
	children: React.ReactNode;
	options?: TimeTrackingOptions;
}

export function TimeTrackingProvider({
	children,
	options = {},
}: TimeTrackingProviderProps) {
	const { user } = useAuth();
	const { autoRefresh = false, refreshInterval = 30000 } = options;

	const [state, setState] = useState<TimeTrackingState>({
		worker: null,
		isWorking: false,
		currentSession: null,
		workingDuration: 0,
		loading: true,
		error: null,
	});

	// Calculate working duration
	const calculateDuration = useCallback((session: any): number => {
		if (!session || !session.timeInAt) return 0;

		const startTime = session.timeInAt.toDate
			? session.timeInAt.toDate()
			: session.timeInAt;
		const now = new Date();
		return Math.floor((now.getTime() - startTime.getTime()) / (1000 * 60));
	}, []);

	// Worker data subscription using dataStore
	useEffect(() => {
		if (!user) {
			setState((prev) => ({
				...prev,
				worker: null,
				isWorking: false,
				currentSession: null,
				workingDuration: 0,
				loading: false,
			}));
			return;
		}

		setState((prev) => ({ ...prev, loading: true, error: null }));

		const unsubscribe = subscribeToWorker(user.uid, async (workerData) => {
			try {
				if (!workerData) {
					setState((prev) => ({
						...prev,
						worker: null,
						isWorking: false,
						currentSession: null,
						workingDuration: 0,
						loading: false,
					}));
					return;
				}

				const isWorking = workerData.currentStatus === "clocked_in";
				let currentSession = null;
				let workingDuration = 0;

				// Admins don't need time tracking since they're not assigned to branches
				const needsTimeTracking = !workerData.isAdmin;

				if (isWorking && needsTimeTracking) {
					try {
						currentSession = await workSessionService.getActiveWorkSession(
							user.uid
						);
						if (currentSession) {
							workingDuration = calculateDuration(currentSession);
						}
					} catch (sessionError) {
						console.warn("Could not fetch active session:", sessionError);
					}
				}

				console.log("TimeTracking Update:", {
					workerData,
					isWorking,
					currentSession,
					workingDuration,
				});
				setState({
					worker: workerData,
					isWorking,
					currentSession,
					workingDuration,
					loading: false,
					error: null,
				});
			} catch (err: any) {
				console.error("Error processing worker data:", err);
				setState((prev) => ({
					...prev,
					loading: false,
					error: err.message || "Failed to process worker data",
				}));
			}
		});

		return () => {
			unsubscribe();
		};
	}, [user, calculateDuration]);

	// Manual refresh function (now just triggers a re-fetch of current session)
	const refreshStatus = useCallback(async () => {
		if (!user || !state.worker || !state.isWorking) return;

		try {
			const currentSession = await workSessionService.getActiveWorkSession(
				user.uid
			);
			if (currentSession) {
				const workingDuration = calculateDuration(currentSession);
				setState((prev) => ({
					...prev,
					currentSession,
					workingDuration,
				}));
			}
		} catch (err: any) {
			console.warn("Could not refresh current session:", err);
		}
	}, [user, state.worker, state.isWorking, calculateDuration]);

	// Clock in
	const clockIn = useCallback(
		async (branchId: string, notes?: string) => {
			if (!user || !state.worker) {
				throw new Error("Unable to clock in");
			}

			// Admins don't use time tracking
			if (state.worker.isAdmin) {
				throw new Error(
					"Admins don't need to clock in - you have global access"
				);
			}

			try {
				setState((prev) => ({ ...prev, loading: true, error: null }));

				await workSessionService.timeInWorker(
					user.uid,
					branchId,
					notes || `Clock-in via POS at ${new Date().toLocaleString()}`
				);

				// Status will be updated automatically via dataStore subscription
			} catch (err: any) {
				const errorMessage = err.message || "Failed to clock in";
				setState((prev) => ({ ...prev, loading: false, error: errorMessage }));
				throw new Error(errorMessage);
			}
		},
		[user, state.worker]
	);

	// Clock out
	const clockOut = useCallback(
		async (notes?: string) => {
			if (!user) {
				throw new Error("Unable to clock out - no user logged in");
			}
			if (!state.worker) {
				throw new Error("Unable to clock out - no worker data");
			}
			if (!state.currentSession) {
				throw new Error("Unable to clock out - no active session");
			}
			try {
				setState((prev) => ({ ...prev, loading: true, error: null }));

				await workSessionService.timeOutWorker(
					user.uid,
					state.currentSession.id || user.uid,
					notes || `Clock-out via POS at ${new Date().toLocaleString()}`
				);

				// Status will be updated automatically via dataStore subscription
			} catch (err: any) {
				const errorMessage = err.message || "Failed to clock out";
				setState((prev) => ({ ...prev, loading: false, error: errorMessage }));
				throw new Error(errorMessage);
			}
		},
		[user, state.worker, state.currentSession]
	);

	// Clear error
	const clearError = useCallback(() => {
		setState((prev) => ({ ...prev, error: null }));
	}, []);

	// Auto refresh
	useEffect(() => {
		if (!autoRefresh || !state.isWorking) return;

		const interval = setInterval(() => {
			// Update working duration without full refresh when working
			if (state.currentSession) {
				setState((prev) => ({
					...prev,
					workingDuration: calculateDuration(state.currentSession),
				}));
			}

			// Occasionally refresh session data for accuracy
			if (Math.random() < 0.1) {
				// 10% chance for session refresh
				refreshStatus();
			}
		}, Math.min(refreshInterval, 60000)); // Max 1 minute intervals

		return () => clearInterval(interval);
	}, [
		autoRefresh,
		refreshInterval,
		state.isWorking,
		state.currentSession,
		calculateDuration,
		refreshStatus,
	]);

	const value: TimeTrackingContextType = {
		...state,
		clockIn,
		clockOut,
		refreshStatus,
		clearError,
	};

	return (
		<TimeTrackingContext.Provider value={value}>
			{children}
		</TimeTrackingContext.Provider>
	);
}

// Helper hook for checking POS access based on time tracking
export function usePOSAccessControl(branchId?: string) {
	const { user } = useAuth();
	const timeTracking = useTimeTracking();

	const canAccessPOS = useCallback(() => {
		if (!user || !timeTracking.worker) return false;

		// Admins always have full access to POS (no time tracking required)
		if (timeTracking.worker.isAdmin) return true;

		// Non-admin users must be clocked in to access POS
		if (!timeTracking.isWorking) return false;

		// Check branch access if specified
		if (branchId) {
			const hasAccessToBranch = timeTracking.worker.roleAssignments.some(
				(assignment) => assignment.branchId === branchId && assignment.isActive
			);
			return hasAccessToBranch;
		}

		return true;
	}, [user, timeTracking.worker, timeTracking.isWorking, branchId]);

	const accessMessage = useCallback(() => {
		if (!user || !timeTracking.worker) {
			return "Please log in to access the POS system";
		}

		// Admins have no access restrictions
		if (timeTracking.worker.isAdmin) {
			return null;
		}

		if (!timeTracking.isWorking) {
			return "Please clock in to access the POS system";
		}

		if (branchId) {
			const hasAccessToBranch = timeTracking.worker.roleAssignments.some(
				(assignment) => assignment.branchId === branchId && assignment.isActive
			);
			if (!hasAccessToBranch) {
				return "You don't have access to this branch location";
			}
		}

		return null;
	}, [user, timeTracking.worker, timeTracking.isWorking, branchId]);

	return {
		canAccessPOS: canAccessPOS(),
		accessMessage: accessMessage(),
		timeTracking,
	};
}
