import React, { useState, useEffect } from "react";
import { Branch } from "@/services/branchService";
import { workerService, Worker } from "@/services/workerService";
import DropdownField from "@/components/DropdownField";
import ImageUpload from "@/components/ImageUpload";
import { MEDIA_BUCKETS } from "@/lib/firebaseStorage";

interface EditWorkerModalProps {
	isOpen: boolean;
	worker: Worker | null;
	onClose: () => void;
	onSuccess: () => void;
	branches?: Branch[];
	userAccessibleBranches?: string[];
	isAdmin?: boolean;
	currentUserId?: string;
}

export default function EditWorkerModal({
	isOpen,
	worker,
	onClose,
	onSuccess,
	branches = [],
	userAccessibleBranches = [],
	isAdmin = false,
	currentUserId,
}: EditWorkerModalProps) {
	const [loading, setLoading] = useState(false);
	const [error, setError] = useState<string | null>(null);

	const [formData, setFormData] = useState({
		name: "",
		email: "",
		phoneNumber: "",
		employeeId: "",
		profilePicture: "",
		isAdmin: false,
		branchAssignments: [] as Array<{
			branchId: string;
			role: "manager" | "worker";
		}>,
	});

	// Single branch assignment state
	const [selectedBranchId, setSelectedBranchId] = useState<string>("");
	const [selectedRole, setSelectedRole] = useState<"manager" | "worker">(
		"worker"
	);
	const [originalRole, setOriginalRole] = useState<"manager" | "worker" | null>(null);

	// Get available branches based on user permissions
	const availableBranches = isAdmin
		? branches
		: branches.filter((branch) => userAccessibleBranches.includes(branch.id));

	// Check if the current user can change roles for this worker
	const canDemoteWorker = (worker: Worker | null): boolean => {
		if (!worker || !currentUserId) return false;
		
		// Admins can change any role
		if (isAdmin) return true;
		
		// Managers cannot demote themselves
		if (worker.id === currentUserId) return false;
		
		// Managers cannot demote other managers - check if worker is a manager
		const isWorkerManager = worker.roleAssignments.some(
			assignment => assignment.role === "manager" && assignment.isActive !== false
		);
		
		if (isWorkerManager) return false;
		
		// Managers can only change worker roles (not demote managers)
		return true;
	};

	// Get available role options based on permissions
	const getAvailableRoleOptions = (): string[] => {
		if (!worker) return ["Worker"];
		
		if (!canDemoteWorker(worker)) {
			// If can't demote, only show current role
			const currentRole = worker.roleAssignments.find(
				assignment => assignment.isActive !== false
			)?.role || "worker";
			return [currentRole === "worker" ? "Worker" : "Manager"];
		}
		
		// Full options if can demote
		return ["Worker", "Manager"];
	};

	// Initialize form data when worker changes
	useEffect(() => {
		if (worker && isOpen) {
			const branchAssignments = worker.roleAssignments
				.filter((assignment) => assignment.isActive !== false)
				.map((assignment) => ({
					branchId: assignment.branchId,
					role: assignment.role,
				}));

			console.log("Initializing EditWorkerModal with:", {
				workerName: worker.name,
				roleAssignments: worker.roleAssignments,
				activeBranchAssignments: branchAssignments,
				isAdmin,
				availableBranches: availableBranches.length,
				userAccessibleBranches
			});

			setFormData({
				name: worker.name,
				email: worker.email,
				phoneNumber: worker.phoneNumber || "",
				employeeId: worker.employeeId || "",
				profilePicture: worker.profilePicture || "",
				isAdmin: worker.isAdmin,
				branchAssignments,
			});

			// Get current available branches
			const currentAvailableBranches = isAdmin
				? branches
				: branches.filter((branch) =>
						userAccessibleBranches.includes(branch.id)
				  );

			// Set single branch assignment
			if (branchAssignments.length > 0) {
				const currentAssignment = branchAssignments[0];
				setSelectedBranchId(currentAssignment.branchId);
				setSelectedRole(currentAssignment.role);
				setOriginalRole(currentAssignment.role);
				console.log("✅ Initialized with existing assignment:", { 
					branchId: currentAssignment.branchId, 
					role: currentAssignment.role 
				});
			} else if (currentAvailableBranches.length === 1) {
				// Auto-select the only available branch for managers
				setSelectedBranchId(currentAvailableBranches[0].id);
				setSelectedRole("worker");
				setOriginalRole("worker");
				console.log("✅ Auto-selected branch for manager:", currentAvailableBranches[0].id);
			} else {
				setSelectedBranchId("");
				setSelectedRole("worker");
				setOriginalRole("worker");
				console.log("⚠️ No branch assignments found");
			}

			setError(null);
		}
	}, [worker, isOpen, isAdmin, branches, userAccessibleBranches]);

	// Debug logging for render conditions
	useEffect(() => {
		if (isOpen && worker) {
			console.log("🎯 Modal render state:", {
				workerIsAdmin: formData.isAdmin,
				availableBranches: availableBranches.length,
				selectedRole,
				selectedBranchId,
				shouldShowRoleDropdown: !formData.isAdmin
			});
		}
	}, [isOpen, formData.isAdmin, availableBranches.length, selectedRole, selectedBranchId]);

	const handleInputChange = (
		e: React.ChangeEvent<HTMLInputElement | HTMLSelectElement>
	) => {
		const { name, value, type } = e.target;
		const checked = (e.target as HTMLInputElement).checked;

		setFormData((prev) => ({
			...prev,
			[name]: type === "checkbox" ? checked : value,
		}));
	};

	const handleBranchChange = (branchId: string) => {
		setSelectedBranchId(branchId);
		setFormData((prev) => ({
			...prev,
			branchAssignments: branchId ? [{ branchId, role: selectedRole }] : [],
		}));
	};

	const handleRoleChange = (role: "manager" | "worker") => {
		console.log("🔄 Role change attempted:", { role, selectedBranchId, isAdmin });
		setSelectedRole(role);
		if (selectedBranchId) {
			const updatedAssignments = [{ branchId: selectedBranchId, role }];
			setFormData((prev) => ({
				...prev,
				branchAssignments: updatedAssignments,
			}));
			console.log("✅ Role change updated in form data:", { 
				role, 
				branchId: selectedBranchId,
				branchAssignments: updatedAssignments
			});
		} else {
			console.log("⚠️ No branch selected, cannot update role");
		}
	};

	const handleSubmit = async (e: React.FormEvent) => {
		e.preventDefault();

		if (!worker) return;

		console.log("🚀 Form submission started:", {
			workerId: worker.id,
			currentRole: worker.roleAssignments,
			newRole: selectedRole,
			selectedBranchId,
			isAdmin: formData.isAdmin,
			availableBranches: availableBranches.length
		});

		if (!formData.name.trim() || !formData.email.trim()) {
			setError("Please fill in all required fields");
			return;
		}

		if (!selectedBranchId && !formData.isAdmin) {
			setError("Please select a branch assignment or make them an admin");
			return;
		}

		if (!formData.isAdmin && !selectedRole) {
			setError("Please select a role for the worker");
			return;
		}

		// Additional validation for manager permissions
		if (!isAdmin && !canDemoteWorker(worker)) {
			setError("You do not have permission to change this user's role");
			return;
		}

		setLoading(true);
		setError(null);

		try {
			// Update worker data
			await workerService.updateWorker(worker.id, {
				name: formData.name,
				email: formData.email,
				phoneNumber: formData.phoneNumber,
				employeeId: formData.employeeId,
				profilePicture: formData.profilePicture,
				isAdmin: formData.isAdmin,
			});

			// Handle admin role changes
			if (formData.isAdmin !== worker.isAdmin) {
				if (formData.isAdmin) {
					await workerService.promoteToAdmin(worker.id);
				} else {
					await workerService.demoteFromAdmin(worker.id);
				}
			}

		// Update branch assignments if not admin
		if (!formData.isAdmin) {
			const currentAssignments = worker.roleAssignments.filter(
				(a) => a.isActive !== false
			);

			// Check if role actually changed
			const currentRole = currentAssignments.find(a => a.branchId === selectedBranchId)?.role;
			const roleChanged = currentRole !== selectedRole;

			console.log("🔄 Updating branch assignments:", {
				workerId: worker.id,
				currentAssignments,
				currentRole,
				newRole: selectedRole,
				newBranch: selectedBranchId,
				roleChanged
			});

			// Remove all old assignments first
			for (const currentAssignment of currentAssignments) {
				console.log("🗑️ Removing assignment:", currentAssignment);
				await workerService.removeWorkerFromBranch(
					worker.id,
					currentAssignment.branchId
				);
			}

			// Add the new single assignment if selected
			if (selectedBranchId) {
				console.log("➕ Adding new assignment:", { 
					branchId: selectedBranchId, 
					role: selectedRole,
					changed: roleChanged
				});
				await workerService.assignWorkerToBranch(
					worker.id,
					selectedBranchId,
					selectedRole
				);
			}
		}			
			console.log("✅ Worker updated successfully!");
			
			// Check if role was changed to determine if we need to reload
			const roleChanged = originalRole !== selectedRole;
			console.log("🔄 Role change status:", { originalRole, selectedRole, roleChanged });
			
			if (roleChanged) {
				console.log("🔄 Role was changed, reloading page...");
				// Close modal first
				onSuccess();
				// Small delay to ensure modal closes, then reload
				setTimeout(() => {
					window.location.reload();
				}, 500);
			} else {
				onSuccess();
			}
		} catch (err: unknown) {
			console.error("❌ Error updating worker:", err);
			const errorMessage = err instanceof Error ? err.message : "Failed to update worker";
			setError(`Update failed: ${errorMessage}`);
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

	return (
		<div className='fixed inset-0 bg-black/50 flex items-center justify-center p-4 z-50'>
			<div className='bg-white rounded-2xl p-8 max-w-2xl w-full mx-4 shadow-2xl max-h-[90vh] overflow-y-auto'>
				{loading ? (
					<div className='text-center py-12'>
						<div className='w-12 h-12 rounded-xl mx-auto mb-4 flex items-center justify-center'>
							<div className='animate-spin rounded-full h-10 w-10 border-4 border-dashed border-[var(--accent)]'></div>
						</div>
						<h3 className='text-xl font-bold text-[var(--secondary)] mb-2'>
							Updating Worker...
						</h3>
						<p className='text-[var(--secondary)] opacity-70'>
							Saving changes to worker account
						</p>
					</div>
				) : (
					<>
						{/* Header */}
						<div className='flex items-center justify-between mb-6'>
							<div>
								<h2 className='text-2xl font-bold text-[var(--secondary)]'>
									Edit Worker
								</h2>
								<p className='text-sm text-[var(--secondary)]/70 mt-1'>
									Update worker information and role assignments
								</p>
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

						{/* Form */}
						<form onSubmit={handleSubmit} className='space-y-6'>
							{/* Basic Information */}
							<div className='grid grid-cols-1 md:grid-cols-2 gap-4'>
								<div>
									<label className='block text-sm font-medium text-gray-700 mb-2'>
										Full Name *
									</label>
									<input
										type='text'
										name='name'
										value={formData.name}
										onChange={handleInputChange}
										className='w-full px-3 py-2 border border-gray-300 rounded-lg focus:ring-2 focus:ring-[var(--accent)] focus:border-transparent'
										placeholder='Enter full name'
										required
									/>
								</div>
								<div>
									<label className='block text-sm font-medium text-gray-700 mb-2'>
										Email Address *
									</label>
									<input
										type='email'
										name='email'
										value={formData.email}
										onChange={handleInputChange}
										className='w-full px-3 py-2 border border-gray-300 rounded-lg focus:ring-2 focus:ring-[var(--accent)] focus:border-transparent'
										placeholder='Enter email address'
										required
									/>
								</div>
							</div>

							<div className='grid grid-cols-1 md:grid-cols-2 gap-4'>
								<div>
									<label className='block text-sm font-medium text-gray-700 mb-2'>
										Phone Number
									</label>
									<input
										type='tel'
										name='phoneNumber'
										value={formData.phoneNumber}
										onChange={handleInputChange}
										className='w-full px-3 py-2 border border-gray-300 rounded-lg focus:ring-2 focus:ring-[var(--accent)] focus:border-transparent'
										placeholder='Enter phone number'
									/>
								</div>
								<div>
									<label className='block text-sm font-medium text-gray-700 mb-2'>
										Employee ID
									</label>
									<input
										type='text'
										name='employeeId'
										value={formData.employeeId}
										onChange={handleInputChange}
										className='w-full px-3 py-2 border border-gray-300 rounded-lg focus:ring-2 focus:ring-[var(--accent)] focus:border-transparent'
										placeholder='Enter employee ID (optional)'
									/>
								</div>
							</div>

							<ImageUpload
								currentImageUrl={formData.profilePicture}
								onImageUpload={(imageUrl) =>
									setFormData((prev) => ({ ...prev, profilePicture: imageUrl }))
								}
								onImageRemove={() =>
									setFormData((prev) => ({ ...prev, profilePicture: "" }))
								}
								label='Profile Photo'
								bucket={MEDIA_BUCKETS.WORKERS}
							/>

							{/* Admin Toggle */}
							{isAdmin && (
								<div className='flex items-center'>
									<input
										type='checkbox'
										name='isAdmin'
										checked={formData.isAdmin}
										onChange={handleInputChange}
										className='h-4 w-4 text-[var(--accent)] focus:ring-[var(--accent)] border-gray-300 rounded'
									/>
									<label className='ml-2 block text-sm text-gray-700'>
										Grant admin privileges
									</label>
								</div>
							)}

							{/* Branch Assignment */}
							{!formData.isAdmin && (
								<div className='grid grid-cols-1 md:grid-cols-2 gap-4'>
									<div>
										<label className='block text-sm font-medium text-gray-700 mb-2'>
											Assign to Branch *
										</label>
										{availableBranches.length === 1 ? (
											// For managers - show readonly branch name
											<div className='w-full px-3 py-2 bg-gray-100 border border-gray-300 rounded-lg text-gray-700'>
												{availableBranches[0].name}
											</div>
										) : (
											// For admins - show dropdown
											<DropdownField
												options={[
													"Select a branch",
													...availableBranches.map(
														(branch: Branch) => branch.name
													),
												]}
												defaultValue={
													selectedBranchId
														? availableBranches.find(
																(b: Branch) => b.id === selectedBranchId
														  )?.name
														: "Select a branch"
												}
												onChange={(value) => {
													if (value === "Select a branch") {
														handleBranchChange("");
													} else {
														const branch = availableBranches.find(
															(b: Branch) => b.name === value
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
												maxVisibleOptions={3}
											/>
										)}
									</div>
									<div>
										<label className='block text-sm font-medium text-gray-700 mb-2'>
											Role *
										</label>
										{canDemoteWorker(worker) ? (
											<DropdownField
												options={getAvailableRoleOptions()}
												defaultValue={
													selectedRole === "worker" ? "Worker" : "Manager"
												}
												onChange={(value) => {
													handleRoleChange(
														value.toLowerCase() as "manager" | "worker"
													);
												}}
												roundness='lg'
												height={42}
												valueAlignment='left'
												shadow={false}
												fontSize='14px'
												padding='12px'
											/>
										) : (
											// Show readonly role when cannot demote
											<div className='w-full px-3 py-2 bg-gray-100 border border-gray-300 rounded-lg text-gray-700 flex items-center justify-between'>
												<span>{selectedRole === "worker" ? "Worker" : "Manager"}</span>
												{worker?.id === currentUserId && (
													<span className='text-xs text-gray-500'>(Cannot change own role)</span>
												)}
												{worker?.roleAssignments.some(a => a.role === "manager" && a.isActive !== false) && worker?.id !== currentUserId && (
													<span className='text-xs text-gray-500'>(Cannot demote managers)</span>
												)}
											</div>
										)}
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
									Update Worker
								</button>
							</div>
						</form>
					</>
				)}
			</div>
		</div>
	);
}
