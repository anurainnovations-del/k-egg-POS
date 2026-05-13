"use client";

import { useAuth } from "@/contexts/AuthContext";
import { useRouter } from "next/navigation";
import { useEffect } from "react";
import LoadingSpinner from "@/components/LoadingSpinner";

interface AuthGuardProps {
	children: React.ReactNode;
	requiredRole?: "manager" | "worker";
	requiredBranch?: string;
	adminOnly?: boolean;
}

export default function AuthGuard({
	children,
	requiredRole,
	requiredBranch,
	adminOnly,
}: AuthGuardProps) {
	const {
		loading,
		isAuthenticated,
		user,
		isUserAdmin,
		getUserRoleForBranch,
		canAccessBranch,
	} = useAuth();
	const router = useRouter();

	useEffect(() => {
		if (!loading && !isAuthenticated) {
			router.push("/login");
			return;
		}

		if (!loading && isAuthenticated && user) {
			// Check if user has no role assignments and is not admin (needs approval)
			if (!isUserAdmin() && (!user.roleAssignments || user.roleAssignments.length === 0)) {
				console.log("⏳ [AuthGuard] No roles for non-admin, sending to waiting room");
				router.push("/waiting-room");
				return;
			}

			// Check admin-only access
			if (adminOnly && !isUserAdmin()) {
				router.push("/login");
				return;
			}

			// Check branch access
			if (requiredBranch && !canAccessBranch(requiredBranch)) {
				router.push("/login"); // Redirect if user can't access the branch
				return;
			}

			// Check role requirements
			if (requiredRole && requiredBranch) {
				const userRole = getUserRoleForBranch(requiredBranch);
				if (
					!userRole ||
					(requiredRole === "manager" && userRole !== "manager")
				) {
					router.push("/login"); // Redirect if user doesn't have required role
					return;
				}
			}
		}
	}, [
		loading,
		isAuthenticated,
		user,
		adminOnly,
		requiredBranch,
		requiredRole,
		router,
		isUserAdmin,
		canAccessBranch,
		getUserRoleForBranch,
	]);
	// Show loading spinner while checking authentication
	if (loading) {
		return (
			<div className='flex items-center justify-center h-screen bg-[var(--background)]'>
				<div className='text-center flex flex-col items-center justify-center'>
					<LoadingSpinner />
					<p className='text-[var(--secondary)] mt-4'>
						Checking authentication...
					</p>
				</div>
			</div>
		);
	}

	// If not authenticated, don't render children (redirect will happen)
	if (!isAuthenticated || !user) {
		return null;
	}

	// Check if user has no role assignments (should be handled by redirect, but just in case)
	if (!isUserAdmin() && user.roleAssignments.length === 0) {
		return (
			<div className='flex items-center justify-center h-screen bg-[var(--background)]'>
				<div className='text-center'>
					<p className='text-[var(--secondary)]'>
						Your account is pending approval. Please wait for an administrator to assign you to a branch.
					</p>
				</div>
			</div>
		);
	}

	// Check admin-only access after authentication
	if (adminOnly && !isUserAdmin()) {
		return (
			<div className='flex items-center justify-center h-screen bg-[var(--background)]'>
				<div className='text-center'>
					<p className='text-[var(--secondary)]'>
						Access denied. Admin privileges required.
					</p>
				</div>
			</div>
		);
	}

	// Check branch access
	if (requiredBranch && !canAccessBranch(requiredBranch)) {
		return (
			<div className='flex items-center justify-center h-screen bg-[var(--background)]'>
				<div className='text-center'>
					<p className='text-[var(--secondary)]'>
						Access denied. You don&apos;t have access to this branch.
					</p>
				</div>
			</div>
		);
	}

	// Check role requirements
	if (requiredRole && requiredBranch) {
		const userRole = getUserRoleForBranch(requiredBranch);
		if (!userRole || (requiredRole === "manager" && userRole !== "manager")) {
			return (
				<div className='flex items-center justify-center h-screen bg-[var(--background)]'>
					<div className='text-center'>
						<p className='text-[var(--secondary)]'>
							Access denied. {requiredRole} role required for this branch.
						</p>
					</div>
				</div>
			);
		}
	}

	// User is authenticated and authorized, render the protected content
	return <>{children}</>;
}
