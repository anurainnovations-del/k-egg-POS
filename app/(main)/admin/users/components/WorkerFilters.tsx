import React, { useState } from "react";
import { Branch } from "@/services/branchService";
import {
	WorkerFilters as WorkerFiltersType,
	UserRole,
} from "@/types/WorkerTypes";

interface WorkerFiltersProps {
	filters: WorkerFiltersType;
	branches: Branch[];
	userAccessibleBranches: string[];
	isAdmin: boolean;
	onFiltersChange: (filters: WorkerFiltersType) => void;
	hideBranchFilter?: boolean; // Hide branch filter for managers
	hideAdminRole?: boolean; // Hide admin role option for managers
}

export default function WorkerFilters({
	filters,
	branches,
	userAccessibleBranches,
	isAdmin,
	onFiltersChange,
	hideBranchFilter = false,
	hideAdminRole = false,
}: WorkerFiltersProps) {
	const [localFilters, setLocalFilters] = useState<WorkerFiltersType>(filters);

	// Filter branches based on user access
	const availableBranches = isAdmin
		? branches
		: branches.filter((branch) => userAccessibleBranches.includes(branch.id));

	const handleFilterChange = (key: keyof WorkerFiltersType, value: WorkerFiltersType[keyof WorkerFiltersType]) => {
		const newFilters = { ...localFilters, [key]: value };
		setLocalFilters(newFilters);
		onFiltersChange(newFilters);
	};

	const clearFilters = () => {
		const clearedFilters: WorkerFiltersType = {};

		// Preserve branchId and excludeAdmins if they were set initially
		if (filters.branchId) {
			clearedFilters.branchId = filters.branchId;
		}
		if (filters.excludeAdmins) {
			clearedFilters.excludeAdmins = filters.excludeAdmins;
		}

		setLocalFilters(clearedFilters);
		onFiltersChange(clearedFilters);
	};

	const hasActiveFilters = Object.keys(localFilters).some(
		(key) =>
			localFilters[key as keyof WorkerFiltersType] !== undefined &&
			localFilters[key as keyof WorkerFiltersType] !== ""
	);

	return (
		<div className='flex flex-wrap items-center gap-4'>
			{/* Search */}
			<div className='flex-1 min-w-64'>
				<div className='relative'>
					<input
						type='text'
						placeholder='Search workers by name, email, or ID...'
						value={localFilters.searchQuery || ""}
						onChange={(e) => handleFilterChange("searchQuery", e.target.value)}
						className='w-full pl-10 pr-4 py-2 border border-gray-300 rounded-lg focus:ring-2 focus:ring-[var(--accent)] focus:border-transparent'
					/>
					<div className='absolute inset-y-0 left-0 pl-3 flex items-center pointer-events-none'>
						<svg
							className='h-4 w-4 text-gray-400'
							fill='none'
							stroke='currentColor'
							viewBox='0 0 24 24'>
							<path
								strokeLinecap='round'
								strokeLinejoin='round'
								strokeWidth={2}
								d='M21 21l-6-6m2-5a7 7 0 11-14 0 7 7 0 0114 0z'
							/>
						</svg>
					</div>
				</div>
			</div>

			{/* Branch Filter */}
			{!hideBranchFilter && availableBranches.length > 0 && (
				<div className='min-w-48'>
					<select
						value={localFilters.branchId || ""}
						onChange={(e) =>
							handleFilterChange("branchId", e.target.value || undefined)
						}
						className='w-full px-3 py-2 border border-gray-300 rounded-lg focus:ring-2 focus:ring-[var(--accent)] focus:border-transparent'>
						<option value=''>All Branches</option>
						{availableBranches.map((branch) => (
							<option key={branch.id} value={branch.id}>
								{branch.name}
							</option>
						))}
					</select>
				</div>
			)}

			{/* Role Filter */}
			<div className='min-w-36'>
				<select
					value={localFilters.role || ""}
					onChange={(e) =>
						handleFilterChange(
							"role",
							(e.target.value as UserRole) || undefined
						)
					}
					className='w-full px-3 py-2 border border-gray-300 rounded-lg focus:ring-2 focus:ring-[var(--accent)] focus:border-transparent'>
					<option value=''>All Roles</option>
					{!hideAdminRole && <option value='admin'>Admin</option>}
					<option value='manager'>Manager</option>
					<option value='worker'>Worker</option>
				</select>
			</div>

			{/* Status Filter */}
			<div className='min-w-36'>
				<select
					value={localFilters.status || ""}
					onChange={(e) =>
						handleFilterChange("status", e.target.value || undefined)
					}
					className='w-full px-3 py-2 border border-gray-300 rounded-lg focus:ring-2 focus:ring-[var(--accent)] focus:border-transparent'>
					<option value=''>All Status</option>
					<option value='clocked_in'>Clocked In</option>
					<option value='clocked_out'>Clocked Out</option>
				</select>
			</div>

			{/* Clear Filters */}
			{hasActiveFilters && (
				<button
					onClick={clearFilters}
					className='px-3 py-2 text-sm text-gray-600 hover:text-gray-800 bg-gray-100 hover:bg-gray-200 rounded-lg transition-colors'>
					Clear
				</button>
			)}
		</div>
	);
}
