"use client";

import { useEffect } from "react";
import { useRouter } from "next/navigation";
import { useAuth } from "@/contexts/AuthContext";
import LoadingSpinner from "@/components/LoadingSpinner";

export default function RootPage() {
	const router = useRouter();
	const { user, loading, isAuthenticated, isUserAdmin } = useAuth();

	useEffect(() => {
		if (!loading) {
			if (isAuthenticated && user) {
				// Check if user is admin
				if (isUserAdmin()) {
					console.log("🚀 [RootPage] Redirecting to /admin/branches (Admin)");
					router.push("/admin/branches");
					return;
				}

				console.log("🔑 [RootPage] Checking role assignments:", {
					roleAssignmentsCount: user?.roleAssignments?.length,
					roleAssignments: user?.roleAssignments
				});

				// Check if user has branch assignments
				const branchId = user?.roleAssignments?.[0]?.branchId;
				if (branchId) {
					router.push(`/${branchId}/store`);
				} else {
					// User has no branch assignments - redirect to login
					console.log("User has no branch assignments. Redirecting to login.");
					router.push("/login");
				}
			} else {
				// User is not authenticated, redirect to login
				router.push("/login");
			}
		}
	}, [loading, isAuthenticated, user, isUserAdmin, router]);

	return (
		<div className='flex flex-col items-center justify-center h-screen bg-[var(--background)]'>
			<LoadingSpinner />
			<p className='text-[var(--secondary)] mt-4'>Loading...</p>
		</div>
	);
}
