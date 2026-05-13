"use client";

import React, { useState } from "react";
import { useAuth } from "@/contexts/AuthContext";
import { useBranch } from "@/contexts/BranchContext";
import { useRouter } from "next/navigation";
import DropdownField from "./DropdownField";

interface BranchSelectorProps {
	className?: string;
	showLabel?: boolean;
	redirectOnChange?: boolean; // If true, navigate to new branch URL
}

export default function BranchSelector({
	className = "",
	showLabel = true,
	redirectOnChange = false,
}: BranchSelectorProps) {
	const { user } = useAuth();
	const { currentBranch, availableBranches, loading, setCurrentBranchId } =
		useBranch();
	const router = useRouter();
	const [isOpen, setIsOpen] = useState(false);

	// Don't render if no user or no branches
	if (!user || loading) {
		return (
			<div className={`flex items-center gap-2 ${className}`}>
				{showLabel && (
					<span className='text-sm text-[var(--secondary)]/70'>Branch:</span>
				)}
				<div className='animate-pulse bg-gray-200 h-[42px] w-full rounded'></div>
			</div>
		);
	}

	if (availableBranches.length === 0) {
		return (
			<div className={`flex items-center gap-2 ${className}`}>
				{showLabel && (
					<span className='text-sm text-[var(--secondary)]/70'>Branch:</span>
				)}
				<span className='text-sm text-[var(--error)]'>
					No branches available
				</span>
			</div>
		);
	}

	const handleBranchChange = (branchId: string) => {
		setCurrentBranchId(branchId);
		setIsOpen(false);

		if (redirectOnChange) {
			// Navigate to the new branch URL
			const currentPath = window.location.pathname;
			const pathParts = currentPath.split("/");

			// Replace the branchId part in the URL
			if (pathParts.length >= 2) {
				pathParts[1] = branchId; // Assuming format is /[branchId]/page
				const newPath = pathParts.join("/");
				router.push(newPath);
			}
		}
	};

	return (
		<div className={`flex items-center gap-2 ${className}`}>
			{showLabel && (
				<span className='text-sm text-[var(--secondary)]/70'>Branch:</span>
			)}

			<DropdownField
				options={availableBranches.map((branch) => branch.name)}
				defaultValue={currentBranch?.name || "Select Branch"}
				onChange={(selectedName) => {
					const selectedBranch = availableBranches.find(
						(branch) => branch.name === selectedName
					);
					if (selectedBranch) {
						handleBranchChange(selectedBranch.id);
					}
				}}
			/>
		</div>
	);
}
