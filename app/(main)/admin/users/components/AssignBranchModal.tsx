import React, { useState, useEffect } from "react";
import { workerService, Worker } from "@/services/workerService";
import { Branch } from "@/services/branchService";
import DropdownField from "@/components/DropdownField";

interface AssignBranchModalProps {
	isOpen: boolean;
	worker: Worker | null;
	branches: Branch[];
	userAccessibleBranches: string[];
	isAdmin: boolean;
	onClose: () => void;
	onSuccess: () => void;
}

export default function AssignBranchModal({
	isOpen,
	worker,
	branches,
	userAccessibleBranches,
	isAdmin,
	onClose,
	onSuccess,
}: AssignBranchModalProps) {
	const [loading, setLoading] = useState(false);
	const [error, setError] = useState<string | null>(null);

	// Single branch assignment state
	const [selectedBranchId, setSelectedBranchId] = useState<string>("");
	const [selectedRole, setSelectedRole] = useState<"manager" | "worker">(
		"worker"
	);

	// Get available branches based on user permissions
	const availableBranches = isAdmin
		? branches
		: branches.filter((branch) => userAccessibleBranches.includes(branch.id));

	// Initialize assignments when worker changes
	useEffect(() => {
		if (worker && isOpen) {
			const activeAssignments = worker.roleAssignments.filter(
				(assignment) => assignment.isActive
			);

			if (activeAssignments.length > 0) {
				setSelectedBranchId(activeAssignments[0].branchId);
				setSelectedRole(activeAssignments[0].role);
			} else {
				setSelectedBranchId("");
				setSelectedRole("worker");
			}
			setError(null);
		}
	}, [worker, isOpen]);

	const handleBranchChange = (branchId: string) => {
		setSelectedBranchId(branchId);
	};

	const handleRoleChange = (role: "manager" | "worker") => {
		setSelectedRole(role);
	};

	const handleSubmit = async (e: React.FormEvent) => {
		e.preventDefault();

		if (!worker) return;

		if (!selectedBranchId && !worker.isAdmin) {
			setError("Worker must be assigned to a branch or be an admin");
			return;
		}

		setLoading(true);
		setError(null);

		try {
			const currentAssignments = worker.roleAssignments.filter(
				(a) => a.isActive !== false
			);

			// Remove all old assignments first
			for (const currentAssignment of currentAssignments) {
				await workerService.removeWorkerFromBranch(
					worker.id,
					currentAssignment.branchId
				);
			}

			// Add the new single assignment if selected
			if (selectedBranchId) {
				await workerService.assignWorkerToBranch(
					worker.id,
					selectedBranchId,
					selectedRole
				);
			}

			onSuccess();
			handleClose();
		} catch (err: unknown) {
			console.error("Error updating branch assignments:", err);
			setError(err instanceof Error ? err.message : "Failed to update branch assignments");
		} finally {
			setLoading(false);
		}
	};

	const handleClose = () => {
		if (!loading) {
			setError(null);
			onClose();
		}
	};

	if (!isOpen || !worker) return null;

	// Prevent assigning branches to admins
	if (worker.isAdmin) {
		return (
			<div className='fixed inset-0 bg-black bg-opacity-50 flex items-center justify-center p-4 z-50'>
				<div className='bg-white rounded-2xl p-8 max-w-lg w-full mx-4 shadow-2xl'>
					<div className='text-center py-8'>
						<div className='w-16 h-16 mx-auto mb-4 bg-yellow-100 rounded-full flex items-center justify-center'>
							<svg
								className='w-8 h-8 text-yellow-600'
								fill='none'
								stroke='currentColor'
								viewBox='0 0 24 24'>
								<path
									strokeLinecap='round'
									strokeLinejoin='round'
									strokeWidth={2}
									d='M12 9v2m0 4h.01m-6.938 4h13.856c1.54 0 2.502-1.667 1.732-2.5L13.732 4c-.77-.833-1.732-.833-2.5 0L3.314 16.5c-.77.833.192 2.5 1.732 2.5z'
								/>
							</svg>
						</div>
						<h3 className='text-xl font-bold text-gray-900 mb-2'>
							Cannot Assign Admin
						</h3>
						<p className='text-gray-600 mb-6'>
							Admins have global access and cannot be assigned to specific
							branches. They automatically have access to all branches through
							their admin privileges.
						</p>
						<button
							onClick={onClose}
							className='bg-[var(--accent)] text-[var(--primary)] px-6 py-2 rounded-lg hover:bg-[var(--accent)]/90 font-semibold'>
							Understood
						</button>
					</div>
				</div>
			</div>
		);
	}

	return (
		<div className='fixed inset-0 bg-black/50 flex items-center justify-center p-4 z-50'>
			<div className='bg-white rounded-2xl p-8 max-w-2xl w-full mx-4 shadow-2xl max-h-[90vh] overflow-y-auto'>
				{loading ? (
					<div className='text-center py-12'>
						<div className='w-12 h-12 rounded-xl mx-auto mb-4 flex items-center justify-center'>
							<div className='animate-spin rounded-full h-10 w-10 border-4 border-dashed border-[var(--accent)]'></div>
						</div>
						<h3 className='text-xl font-bold text-[var(--secondary)] mb-2'>
							Updating Assignments...
						</h3>
						<p className='text-[var(--secondary)] opacity-70'>
							Saving branch assignments and roles
						</p>
					</div>
				) : (
					<>
						{/* Header */}
						<div className='flex items-center justify-between mb-6'>
							<div className='flex items-center'>
								<div className='w-12 h-12 bg-purple-100 rounded-full flex items-center justify-center mr-4'>
									<svg
										className='w-6 h-6 text-purple-600'
										fill='none'
										stroke='currentColor'
										viewBox='0 0 24 24'>
										<path
											strokeLinecap='round'
											strokeLinejoin='round'
											strokeWidth={2}
											d='M19 21V5a2 2 0 00-2-2H7a2 2 0 00-2 2v16m14 0h2m-2 0h-5m-9 0H3m2 0h5M9 7h1m-1 4h1m4-4h1m-1 4h1m-5 10v-5a1 1 0 011-1h2a1 1 0 011 1v5m-4 0h4'
										/>
									</svg>
								</div>
								<div>
									<h3 className='text-xl font-bold text-[var(--secondary)]'>
										Manage Branch Assignments
									</h3>
									<p className='text-sm text-[var(--secondary)]/70'>
										Assign worker to branches and set their roles
									</p>
								</div>
							</div>
							<button
								onClick={handleClose}
								className='text-gray-400 hover:text-gray-600 p-2'>
								<svg
									className='w-6 h-6'
									fill='none'
									stroke='currentColor'
									viewBox='0 0 24 24'>
									<path
										strokeLinecap='round'
										strokeLinejoin='round'
										strokeWidth={2}
										d='M6 18L18 6M6 6l12 12'
									/>
								</svg>
							</button>
						</div>

						{/* Worker Info */}
						<div className='bg-gray-50 rounded-lg p-4 mb-6'>
							<div className='flex items-center'>
								{worker.profilePicture ? (
									<img
										src={worker.profilePicture}
										alt={`${worker.name} profile`}
										className='w-12 h-12 rounded-full mr-4'
									/>
								) : (
									<div className='w-12 h-12 bg-gray-300 rounded-full flex items-center justify-center mr-4'>
										<span className='text-lg font-medium text-gray-700'>
											{worker.name.charAt(0).toUpperCase()}
										</span>
									</div>
								)}
								<div>
									<div className='font-medium text-gray-900'>{worker.name}</div>
									<div className='text-sm text-gray-500'>{worker.email}</div>
									{worker.isAdmin && (
										<div className='inline-flex items-center px-2 py-1 rounded-full text-xs font-medium bg-red-100 text-red-800 mt-1'>
											Admin
										</div>
									)}
								</div>
							</div>
						</div>

						{/* Error Display */}
						{error && (
							<div className='mb-6 p-4 bg-red-50 border border-red-200 rounded-lg'>
								<div className='flex items-center'>
									<svg
										className='w-5 h-5 text-red-400 mr-2'
										fill='currentColor'
										viewBox='0 0 20 20'>
										<path
											fillRule='evenodd'
											d='M18 10a8 8 0 11-16 0 8 8 0 0116 0zm-7 4a1 1 0 11-2 0 1 1 0 012 0zm-1-9a1 1 0 00-1 1v4a1 1 0 102 0V6a1 1 0 00-1-1z'
											clipRule='evenodd'
										/>
									</svg>
									<span className='text-red-700 text-sm'>{error}</span>
								</div>
							</div>
						)}

						{/* Branch Assignment */}
						<form onSubmit={handleSubmit} className='space-y-6'>
							<div className='grid grid-cols-1 md:grid-cols-2 gap-4'>
								<div>
									<label className='block text-sm font-medium text-gray-700 mb-2'>
										Assign to Branch
										{!worker.isAdmin && (
											<span className='text-red-500 ml-1'>*</span>
										)}
									</label>
									{availableBranches.length === 0 ? (
										<div className='text-center py-4 text-gray-500 border border-gray-200 rounded-lg'>
											No branches available
										</div>
									) : (
										<DropdownField
											options={[
												"Select a branch",
												...availableBranches.map((branch) => branch.name),
											]}
											defaultValue={
												selectedBranchId
													? availableBranches.find(
															(b) => b.id === selectedBranchId
													  )?.name
													: "Select a branch"
											}
											onChange={(value) => {
												if (value === "Select a branch") {
													handleBranchChange("");
												} else {
													const branch = availableBranches.find(
														(b) => b.name === value
													);
													if (branch) {
														handleBranchChange(branch.id);
													}
												}
											}}
											roundness='lg'
											height={42}
											valueAlignment='left'
											shadow={false}
											fontSize='14px'
											padding='12px'
											maxVisibleOptions={5}
										/>
									)}
								</div>
								<div>
									<label className='block text-sm font-medium text-gray-700 mb-2'>
										Role
										{!worker.isAdmin && (
											<span className='text-red-500 ml-1'>*</span>
										)}
									</label>
									<DropdownField
										options={["Worker", "Manager"]}
										defaultValue={
											selectedRole === "worker" ? "Worker" : "Manager"
										}
										onChange={(value) =>
											handleRoleChange(
												value.toLowerCase() as "manager" | "worker"
											)
										}
										roundness='lg'
										height={42}
										valueAlignment='left'
										shadow={false}
										fontSize='14px'
										padding='12px'
									/>
								</div>
							</div>

							{/* Summary */}
							{selectedBranchId && (
								<div className='bg-blue-50 border border-blue-200 rounded-lg p-4'>
									<h4 className='text-sm font-medium text-blue-800 mb-2'>
										Assignment Summary:
									</h4>
									<div className='text-sm text-blue-700'>
										<span className='font-medium'>
											{
												availableBranches.find((b) => b.id === selectedBranchId)
													?.name
											}
										</span>
										{" - "}
										<span className='capitalize'>{selectedRole}</span>
									</div>
								</div>
							)}

							{/* Form Actions */}
							<div className='flex flex-col sm:flex-row gap-3 pt-6 border-t border-gray-200'>
								<button
									type='button'
									onClick={handleClose}
									className='flex-1 py-3 px-4 border border-gray-300 rounded-lg text-gray-700 font-medium hover:bg-gray-50 transition-colors'>
									Cancel
								</button>
								<button
									type='submit'
									disabled={loading}
									className='flex-1 py-3 px-4 bg-[var(--accent)] text-[var(--primary)] rounded-lg font-medium hover:bg-[var(--accent)]/90 transition-colors disabled:opacity-50'>
									Save Assignments
								</button>
							</div>
						</form>
					</>
				)}
			</div>
		</div>
	);
}
