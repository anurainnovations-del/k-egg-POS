"use client";

import React, {
	createContext,
	useContext,
	useEffect,
	useState,
	useMemo,
} from "react";
import { useAuth } from "@/contexts/AuthContext";
import { branchService, Branch } from "@/services/branchService";
import { workerService, Worker } from "@/services/workerService";
import {
	getAccessibleBranches,
	canAccessBranch,
	getBranchAccessSummary,
	BranchAccessSummary,
} from "@/utils/branchAccess";
import { subscribeToBranches, subscribeToWorker } from "@/stores/dataStore";

interface BranchContextType {
	// Current branch management
	currentBranch: Branch | null;
	availableBranches: Branch[];
	loading: boolean;
	error: string | null;

	// Accessible branches data (from useAccessibleBranches hook)
	allBranches: Branch[];
	accessibleBranches: Branch[];
	currentWorker: Worker | null;
	summary: BranchAccessSummary;
	managerBranches: Branch[];
	workerBranches: Branch[];

	// Functions
	setCurrentBranchId: (branchId: string) => void;
	clearCurrentBranch: () => void;
	refreshBranches: () => Promise<void>;
	canUserAccessBranch: (branchId: string) => boolean;
	canAccess: (branchId: string) => boolean;
	clearError: () => void;
}

const BranchContext = createContext<BranchContextType | undefined>(undefined);

export function useBranch() {
	const context = useContext(BranchContext);
	if (context === undefined) {
		throw new Error("useBranch must be used within a BranchProvider");
	}
	return context;
}

interface BranchProviderProps {
	children: React.ReactNode;
	initialBranchId?: string; // For URL-based branch selection
}

export function BranchProvider({
	children,
	initialBranchId,
}: BranchProviderProps) {
	const { user, isUserAdmin, getAssignedBranches, canAccessBranch } = useAuth();
	const [currentBranch, setCurrentBranch] = useState<Branch | null>(null);
	const [availableBranches, setAvailableBranches] = useState<Branch[]>([]);
	const [allBranches, setAllBranches] = useState<Branch[]>([]);
	const [currentWorker, setCurrentWorker] = useState<Worker | null>(null);
	const [loading, setLoading] = useState(true);
	const [error, setError] = useState<string | null>(null);

	// Memoized calculations for accessible branches
	const accessibleBranches = useMemo(() => {
		if (!user || !currentWorker) return [];
		return getAccessibleBranches(user, currentWorker, allBranches);
	}, [user, currentWorker, allBranches]);

	const summary = useMemo(() => {
		return getBranchAccessSummary(currentWorker, allBranches);
	}, [currentWorker, allBranches]);

	const canAccess = useMemo(() => {
		return (branchId: string) => {
			if (!user || !currentWorker) return false;
			return canAccessBranch(branchId);
		};
	}, [user, currentWorker, canAccessBranch]);

	const managerBranches = useMemo(() => {
		if (!currentWorker || currentWorker.isAdmin) {
			return accessibleBranches; // Admins are managers everywhere
		}

		const managerBranchIds =
			currentWorker.roleAssignments
				?.filter(
					(assignment) => assignment.role === "manager" && assignment.isActive
				)
				.map((assignment) => assignment.branchId) || [];

		return allBranches.filter((branch) => managerBranchIds.includes(branch.id));
	}, [currentWorker, allBranches, accessibleBranches]);

	const workerBranches = useMemo(() => {
		if (!currentWorker || currentWorker.isAdmin) {
			return []; // Admins don't have worker roles
		}

		const workerBranchIds =
			currentWorker.roleAssignments
				?.filter(
					(assignment) => assignment.role === "worker" && assignment.isActive
				)
				.map((assignment) => assignment.branchId) || [];

		return allBranches.filter((branch) => workerBranchIds.includes(branch.id));
	}, [currentWorker, allBranches]);

	// Load branches based on user role
	useEffect(() => {
		if (!user) {
			setAvailableBranches([]);
			setCurrentBranch(null);
			setLoading(false);
			return;
		}

		let unsubBranches: (() => void) | null = null;
		let unsubWorker: (() => void) | null = null;

		setLoading(true);

		// Subscribe to global branches store
		unsubBranches = subscribeToBranches((branches) => {
			setAllBranches(branches);
			
			// If we are admin, available = all
			if (isUserAdmin()) {
				setAvailableBranches(branches);
			} else if (user) {
				// Regular users: filter by role assignments
				const userBranchIds = user.roleAssignments.map(ra => ra.branchId);
				setAvailableBranches(branches.filter(b => userBranchIds.includes(b.id)));
			}
		});

		// Subscribe to current worker data
		unsubWorker = subscribeToWorker(user.uid, (worker) => {
			setCurrentWorker(worker);
			setLoading(false);
		});

		return () => {
			if (unsubBranches) unsubBranches();
			if (unsubWorker) unsubWorker();
		};
	}, [user]);

	// Set current branch whenever availableBranches or initialBranchId changes
	useEffect(() => {
		if (loading || availableBranches.length === 0) return;

		if (initialBranchId) {
			const branch = availableBranches.find(b => b.id === initialBranchId);
			if (branch) {
				setCurrentBranch(branch);
			}
		} else if (!currentBranch && !isUserAdmin()) {
			// Auto-select first branch for non-admins if none selected
			setCurrentBranch(availableBranches[0]);
		}
	}, [availableBranches, initialBranchId, loading]);

	// Function to set current branch by ID
	const setCurrentBranchId = (branchId: string) => {
		const branch = availableBranches.find((b) => b.id === branchId);
		if (branch && canUserAccessBranch(branchId)) {
			setCurrentBranch(branch);
		} else {
			console.warn(`Cannot access branch ${branchId} or branch not found`);
		}
	};

	// Function to clear current branch (for admins to return to admin-only view)
	const clearCurrentBranch = () => {
		setCurrentBranch(null);
	};

	// Function to refresh branches (now just re-subscribes if needed)
	const refreshBranches = async () => {
		// DataStore handles realtime updates, but we can reset loading state if desired
		setLoading(true);
		// wait a bit to simulate refresh feel
		setTimeout(() => setLoading(false), 500);
	};

	// Function to check if user can access a specific branch
	const canUserAccessBranch = (branchId: string): boolean => {
		return canAccessBranch(branchId);
	};

	// Clear error function
	const clearError = () => {
		setError(null);
	};

	const value: BranchContextType = {
		// Current branch management
		currentBranch,
		availableBranches,
		loading,
		error,

		// Accessible branches data
		allBranches,
		accessibleBranches,
		currentWorker,
		summary,
		managerBranches,
		workerBranches,

		// Functions
		setCurrentBranchId,
		clearCurrentBranch,
		refreshBranches,
		canUserAccessBranch,
		canAccess,
		clearError,
	};

	return (
		<BranchContext.Provider value={value}>{children}</BranchContext.Provider>
	);
}

// Backward compatibility hooks that use the context
interface UseAccessibleBranchesOptions {
	autoRefresh?: boolean;
	refreshInterval?: number;
}

interface UseAccessibleBranchesResult {
	// Data
	allBranches: Branch[];
	accessibleBranches: Branch[];
	currentWorker: Worker | null;
	summary: BranchAccessSummary;

	// State
	loading: boolean;
	error: string | null;

	// Methods
	canAccess: (branchId: string) => boolean;
	refreshBranches: () => Promise<void>;
	clearError: () => void;
}

export function useAccessibleBranches(
	options: UseAccessibleBranchesOptions = {}
): UseAccessibleBranchesResult {
	const context = useBranch();

	return {
		allBranches: context.allBranches,
		accessibleBranches: context.accessibleBranches,
		currentWorker: context.currentWorker,
		summary: context.summary,
		loading: context.loading,
		error: context.error,
		canAccess: context.canAccess,
		refreshBranches: context.refreshBranches,
		clearError: context.clearError,
	};
}

// Specialized hook for getting branches where user has manager role
export function useManagerBranches(options: UseAccessibleBranchesOptions = {}) {
	const context = useBranch();

	return {
		...useAccessibleBranches(options),
		managerBranches: context.managerBranches,
	};
}

// Specialized hook for getting branches where user has worker role
export function useWorkerBranches(options: UseAccessibleBranchesOptions = {}) {
	const context = useBranch();

	return {
		...useAccessibleBranches(options),
		workerBranches: context.workerBranches,
	};
}
