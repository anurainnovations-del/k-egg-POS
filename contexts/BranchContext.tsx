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
	const loadBranches = async () => {
		if (!user) {
			setAvailableBranches([]);
			setCurrentBranch(null);
			setLoading(false);
			return;
		}

		try {
			setLoading(true);
			setError(null);

			// Load all branches and current worker in parallel
			const [branchesResult, workerResult] = await Promise.allSettled([
				branchService.getAllBranches(),
				workerService.getWorker(user.uid),
			]);

			// Handle branches result
			let branches: Branch[] = [];
			if (branchesResult.status === "fulfilled") {
				setAllBranches(branchesResult.value || []);
				branches = branchesResult.value || [];
			} else {
				console.error("Failed to load branches:", branchesResult.reason);
				setAllBranches([]);
			}

			// Handle worker result
			if (workerResult.status === "fulfilled") {
				setCurrentWorker(workerResult.value);
			} else {
				console.error("Failed to load worker data:", workerResult.reason);
				setCurrentWorker(null);
			}

			console.log("🔍 BranchContext Debug:", {
				userId: user.uid,
				isAdmin: isUserAdmin(),
				roleAssignments: user.roleAssignments,
				roleAssignmentsLength: user.roleAssignments?.length || 0,
			});

			// Filter branches for available branches (backwards compatibility)
			let availableBranches: Branch[];
			if (isUserAdmin()) {
				// Admin can see all branches
				console.log("👑 Loading all branches for admin");
				availableBranches = branches;
			} else {
				// Regular users can only see their assigned branches
				const userRoleAssignments = user.roleAssignments.map((assignment) => ({
					branchId: assignment.branchId,
					role: assignment.role,
				}));
				console.log("👤 Loading user branches:", userRoleAssignments);
				availableBranches = await branchService.getUserBranches(
					userRoleAssignments
				);
				console.log("✅ User branches loaded:", availableBranches);
			}

			setAvailableBranches(availableBranches);
			console.log(
				"🏢 Final available branches set:",
				availableBranches.length,
				"branches:",
				availableBranches.map((b) => ({ id: b.id, name: b.name }))
			);

			// Set current branch
			if (
				initialBranchId &&
				availableBranches.find((b) => b.id === initialBranchId)
			) {
				// Use the branch from URL if valid
				const branch = availableBranches.find((b) => b.id === initialBranchId);
				setCurrentBranch(branch || null);
			} else if (availableBranches.length > 0 && !isUserAdmin()) {
				// For non-admins: Default to first available branch
				// For admins: Don't auto-select a branch, let them choose from branch management
				setCurrentBranch(availableBranches[0]);
			} else {
				setCurrentBranch(null);
			}
		} catch (err) {
			console.error("Error loading branches:", err);
			setError("Failed to load branches");
			setAvailableBranches([]);
			setCurrentBranch(null);
		} finally {
			setLoading(false);
		}
	};

	// Load branches when user changes or component mounts
	useEffect(() => {
		loadBranches();
	}, [user, initialBranchId]);

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

	// Function to refresh branches
	const refreshBranches = async () => {
		await loadBranches();
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
