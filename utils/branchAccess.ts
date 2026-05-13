import { Branch } from "@/services/branchService";
import { Worker } from "@/services/workerService";
import { User } from "firebase/auth";

/**
 * Branch Access Control Utilities
 * Implements simple branch-based access control as specified in the architecture
 */

/**
 * Get all branches that a user has access to based on their role assignments
 */
export function getAccessibleBranches(
	user: User,
	worker: Worker | null,
	allBranches: Branch[]
): Branch[] {
	// Admin users have access to all branches
	if (worker?.isAdmin) {
		return allBranches;
	}

	// Non-admin users only have access to their assigned branches
	if (!worker || !worker.roleAssignments) {
		return [];
	}

	const accessibleBranchIds = worker.roleAssignments
		.filter((assignment) => assignment.isActive)
		.map((assignment) => assignment.branchId);

	return allBranches.filter((branch) =>
		accessibleBranchIds.includes(branch.id)
	);
}

/**
 * Check if a user has access to a specific branch
 */
export function canAccessBranch(
	user: User,
	worker: Worker | null,
	branchId: string
): boolean {
	// Admin users can access any branch
	if (worker?.isAdmin) {
		return true;
	}

	// Non-admin users can only access assigned branches
	if (!worker || !worker.roleAssignments) {
		return false;
	}

	return worker.roleAssignments.some(
		(assignment) => assignment.branchId === branchId && assignment.isActive
	);
}

/**
 * Get user's role in a specific branch
 */
export function getUserRoleInBranch(
	worker: Worker | null,
	branchId: string
): "admin" | "manager" | "worker" | null {
	// Admin users are always admin regardless of branch
	if (worker?.isAdmin) {
		return "admin";
	}

	if (!worker || !worker.roleAssignments) {
		return null;
	}

	const assignment = worker.roleAssignments.find(
		(assignment) => assignment.branchId === branchId && assignment.isActive
	);

	return assignment ? assignment.role : null;
}

/**
 * Check if a user can manage workers in a specific branch
 */
export function canManageWorkersInBranch(
	user: User,
	worker: Worker | null,
	branchId: string
): boolean {
	const role = getUserRoleInBranch(worker, branchId);
	return role === "admin" || role === "manager";
}

/**
 * Check if a user can manage a specific worker
 */
export function canManageWorker(
	currentUser: Worker | null,
	targetWorker: Worker
): boolean {
	// Admin users can manage anyone except other admins
	if (currentUser?.isAdmin) {
		return !targetWorker.isAdmin;
	}

	// Managers can only manage workers in their branches (not other managers or admins)
	if (!currentUser || !currentUser.roleAssignments) {
		return false;
	}

	// Target must not be admin or manager in any branch where current user is not admin
	if (targetWorker.isAdmin) {
		return false;
	}

	// Get branches where current user is manager
	const managerBranches = currentUser.roleAssignments
		.filter(
			(assignment) => assignment.role === "manager" && assignment.isActive
		)
		.map((assignment) => assignment.branchId);

	// Get branches where target worker has assignments
	const targetBranches = targetWorker.roleAssignments
		.filter((assignment) => assignment.isActive)
		.map((assignment) => assignment.branchId);

	// Check if there's overlap in branches and target is only a worker (not manager)
	const hasCommonBranches = managerBranches.some((branchId) =>
		targetBranches.includes(branchId)
	);

	const isTargetOnlyWorker = targetWorker.roleAssignments.every(
		(assignment) => assignment.role === "worker"
	);

	return hasCommonBranches && isTargetOnlyWorker;
}

/**
 * Filter workers based on current user's access permissions
 */
export function filterAccessibleWorkers(
	currentUser: Worker | null,
	allWorkers: Worker[]
): Worker[] {
	// Admin users can see all workers
	if (currentUser?.isAdmin) {
		return allWorkers;
	}

	// Managers can only see workers in their branches
	if (!currentUser || !currentUser.roleAssignments) {
		return [];
	}

	const managerBranches = currentUser.roleAssignments
		.filter(
			(assignment) => assignment.role === "manager" && assignment.isActive
		)
		.map((assignment) => assignment.branchId);

	return allWorkers.filter((worker) => {
		// Always include self
		if (worker.id === currentUser.id) {
			return true;
		}

		// Include workers who have assignments in manager's branches
		return worker.roleAssignments.some(
			(assignment) =>
				managerBranches.includes(assignment.branchId) && assignment.isActive
		);
	});
}

/**
 * Check if user needs to be clocked in to access POS for a specific branch
 */
export function requiresClockInForPOS(
	worker: Worker | null,
	branchId?: string
): boolean {
	// Admin users are exempt from time tracking
	if (!worker || worker.isAdmin) {
		return false;
	}

	// If no branch specified, require clock-in
	if (!branchId) {
		return true;
	}

	// Check if user has access to the branch
	const hasAccess = worker.roleAssignments.some(
		(assignment) => assignment.branchId === branchId && assignment.isActive
	);

	return hasAccess; // If they have access, they need to be clocked in
}

/**
 * Get default branch for a worker (first active assignment)
 */
export function getDefaultBranch(worker: Worker | null): string | null {
	if (!worker || !worker.roleAssignments) {
		return null;
	}

	const activeAssignment = worker.roleAssignments.find(
		(assignment) => assignment.isActive
	);
	return activeAssignment ? activeAssignment.branchId : null;
}

/**
 * Branch access summary for display purposes
 */
export interface BranchAccessSummary {
	totalBranches: number;
	accessibleBranches: number;
	managerBranches: number;
	workerBranches: number;
	isAdmin: boolean;
}

/**
 * Get a summary of user's branch access
 */
export function getBranchAccessSummary(
	worker: Worker | null,
	allBranches: Branch[]
): BranchAccessSummary {
	if (!worker) {
		return {
			totalBranches: allBranches.length,
			accessibleBranches: 0,
			managerBranches: 0,
			workerBranches: 0,
			isAdmin: false,
		};
	}

	if (worker.isAdmin) {
		return {
			totalBranches: allBranches.length,
			accessibleBranches: allBranches.length,
			managerBranches: allBranches.length,
			workerBranches: 0,
			isAdmin: true,
		};
	}

	const activeAssignments =
		worker.roleAssignments?.filter((assignment) => assignment.isActive) || [];
	const managerBranches = activeAssignments.filter(
		(assignment) => assignment.role === "manager"
	).length;
	const workerBranches = activeAssignments.filter(
		(assignment) => assignment.role === "worker"
	).length;

	return {
		totalBranches: allBranches.length,
		accessibleBranches: activeAssignments.length,
		managerBranches,
		workerBranches,
		isAdmin: false,
	};
}
