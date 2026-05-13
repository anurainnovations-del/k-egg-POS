"use client";

import React, { useState, useEffect } from "react";
import BranchCard from "./components/BranchCard";
import AddBranchModal from "./components/AddBranchModal";
import EditBranchModal from "./components/EditBranchModal";
import ViewBranchModal from "./components/ViewBranchModal";
import DeleteConfirmationModal from "./components/DeleteConfirmationModal";
import { useAuth } from "@/contexts/AuthContext";
import { branchService, Branch } from "@/services/branchService";
import { useRouter } from "next/navigation";
import PlusIcon from "@/components/icons/PlusIcon";
import { subscribeToBranches } from "@/stores/dataStore";
import TopBar from "@/components/TopBar";

function formatDate(date: Date) {
	return (
		date.toLocaleDateString() +
		" " +
		date.toLocaleTimeString([], { hour: "2-digit", minute: "2-digit" })
	);
}

export default function BranchesPage() {
	const { user, isUserAdmin } = useAuth();
	const router = useRouter();
	const [branches, setBranches] = useState<Branch[]>([]);
	const [loading, setLoading] = useState(true);
	const [error, setError] = useState<string | null>(null);
	const [isAddModalOpen, setIsAddModalOpen] = useState(false);
	const [isEditModalOpen, setIsEditModalOpen] = useState(false);
	const [isViewModalOpen, setIsViewModalOpen] = useState(false);
	const [isDeleteModalOpen, setIsDeleteModalOpen] = useState(false);
	const [selectedBranch, setSelectedBranch] = useState<Branch | null>(null);
	const [modalError, setModalError] = useState<string | null>(null);

	// Redirect non-admin users
	useEffect(() => {
		if (user && !isUserAdmin()) {
			// Redirect to user's first assigned branch
			const assignedBranches = user.roleAssignments;
			if (assignedBranches.length > 0) {
				router.push(`/${assignedBranches[0].branchId}/store`);
			} else {
				router.push("/login");
			}
		}
	}, [user, isUserAdmin, router]);

	// Load branches data
	useEffect(() => {
		const loadBranches = async () => {
			if (!user || !isUserAdmin()) return;

			try {
				setLoading(true);
				setError(null);
				const branchesData = await branchService.getAllBranches();
				setBranches(branchesData);
			} catch (err) {
				console.error("Error loading branches:", err);
				setError("Failed to load branches");
			} finally {
				setLoading(false);
			}
		};

		loadBranches();
	}, [user, isUserAdmin]);

	useEffect(() => {
		const unsubscribe = subscribeToBranches((branches) => {
			setBranches(branches);
		});

		return unsubscribe; // Cleanup on unmount
	}, []);

	// Don't render for non-admin users (will redirect)
	if (!user || !isUserAdmin()) {
		return (
			<div className='flex items-center justify-center h-full'>
				<div className='animate-spin rounded-full h-8 w-8 border-b-2 border-[var(--accent)]'></div>
				<span className='ml-3 text-[var(--secondary)]'>Redirecting...</span>
			</div>
		);
	}

	const handleBranchClick = (branchId: string) => {
		// Navigate to the branch's store page
		router.push(`/${branchId}/store`);
	};

	const handleAddBranch = () => {
		setModalError(null);
		setIsAddModalOpen(true);
	};

	const handleBranchCreated = async () => {
		// Refresh the branches list
		try {
			setLoading(true);
			const branchesData = await branchService.getAllBranches();
			setBranches(branchesData);
		} catch (err) {
			console.error("Error refreshing branches:", err);
			setError("Failed to refresh branches");
		} finally {
			setLoading(false);
		}
	};

	const handleModalError = (errorMessage: string) => {
		setModalError(errorMessage);
	};

	const handleViewBranch = (branchId: string) => {
		const branch = branches.find((b) => b.id === branchId);
		if (branch) {
			setSelectedBranch(branch);
			setModalError(null);
			setIsViewModalOpen(true);
		}
	};

	const handleEditBranch = (branchId: string) => {
		const branch = branches.find((b) => b.id === branchId);
		if (branch) {
			setSelectedBranch(branch);
			setModalError(null);
			setIsEditModalOpen(true);
		}
	};

	const handleDeleteBranch = (branchId: string) => {
		const branch = branches.find((b) => b.id === branchId);
		if (branch) {
			setSelectedBranch(branch);
			setModalError(null);
			setIsDeleteModalOpen(true);
		}
	};

	const handleCloseAllModals = () => {
		setIsAddModalOpen(false);
		setIsEditModalOpen(false);
		setIsViewModalOpen(false);
		setIsDeleteModalOpen(false);
		setSelectedBranch(null);
		setModalError(null);
	};

	const handleViewToEdit = () => {
		setIsViewModalOpen(false);
		setIsEditModalOpen(true);
	};

	const handleViewToDelete = () => {
		setIsViewModalOpen(false);
		setIsDeleteModalOpen(true);
	};

	return (
		<div className='flex flex-col h-full'>
			<TopBar />

			{/* <div className="flex items-center justify-start ml-6 mt-[8px] py-[4px]">
        {icon} 
        <h1 className="text-[var(--secondary)] text-2xl font-bold">Branches</h1>
      </div> */}

			<div className='px-6 py-4 border-b border-gray-200'>
				<div className='flex items-center justify-between'>
					<div>
						<h2 className='text-2xl font-bold text-[var(--secondary)] mb-1'>
							Branch Management
						</h2>
						<p className='text-sm text-[var(--secondary)]/70'>
							Manage all branches and navigate to branch-specific views
						</p>
					</div>
					{/* <BranchSelector
            showLabel={true}
            redirectOnChange={true}
            className="ml-4"
          /> */}
					<button
						onClick={handleAddBranch}
						className='bg-[var(--accent)] text-[var(--secondary)] text-[12px] px-4 py-2 rounded-lg hover:bg-[var(--accent)]/90 shadow-sm transition-all font-semibold hover:scale-105 active:scale-95'>
						<div className='flex flex-row items-center gap-2 text-[var(--primary)] text-shadow-md font-black text-[14px]'>
							<div className='size-4'>
								<PlusIcon className='drop-shadow-lg' />
							</div>
							<span className='mt-[2px]'>ADD BRANCH</span>
						</div>
					</button>
				</div>
			</div>

			<div className='p-6'>
				{loading && (
					<div className='flex items-center justify-center py-8'>
						<div className='animate-spin rounded-full h-8 w-8 border-b-2 border-[var(--accent)]'></div>
						<span className='ml-3 text-[var(--secondary)]'>
							Loading branches...
						</span>
					</div>
				)}

				{error && (
					<div className='bg-[var(--error)]/10 border border-[var(--error)]/40 rounded-lg p-4 mb-4'>
						<div className='flex items-center gap-3'>
							<svg
								className='w-5 h-5 text-[var(--error)]'
								fill='currentColor'
								viewBox='0 0 20 20'>
								<path
									fillRule='evenodd'
									d='M10 18a8 8 0 100-16 8 8 0 000 16zM8.707 7.293a1 1 0 00-1.414 1.414L8.586 10l-1.293 1.293a1 1 0 101.414 1.414L10 11.414l1.293 1.293a1 1 0 001.414-1.414L11.414 10l1.293-1.293a1 1 0 00-1.414-1.414L10 8.586 8.707 7.293z'
									clipRule='evenodd'
								/>
							</svg>
							<span className='text-[var(--error)] font-medium'>{error}</span>
						</div>
					</div>
				)}

				{modalError && (
					<div className='bg-[var(--error)]/10 border border-[var(--error)]/40 rounded-lg p-4 mb-4'>
						<div className='flex items-center gap-3'>
							<svg
								className='w-5 h-5 text-[var(--error)]'
								fill='currentColor'
								viewBox='0 0 20 20'>
								<path
									fillRule='evenodd'
									d='M10 18a8 8 0 100-16 8 8 0 000 16zM8.707 7.293a1 1 0 00-1.414 1.414L8.586 10l-1.293 1.293a1 1 0 101.414 1.414L10 11.414l1.293 1.293a1 1 0 001.414-1.414L11.414 10l1.293-1.293a1 1 0 00-1.414-1.414L10 8.586 8.707 7.293z'
									clipRule='evenodd'
								/>
							</svg>
							<span className='text-[var(--error)] font-medium'>
								{modalError}
							</span>
						</div>
					</div>
				)}

				{!loading && !error && branches.length === 0 && (
					<div className='text-center py-12'>
						<div className='w-16 h-16 bg-gray-200 rounded-full flex items-center justify-center mx-auto mb-4'>
							<svg
								className='w-8 h-8 text-gray-400'
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
						<h3 className='text-lg font-medium text-[var(--secondary)] mb-2'>
							No Branches Found
						</h3>
						<p className='text-[var(--secondary)]/70'>
							No branches have been created yet.
						</p>
					</div>
				)}

				{!loading && !error && branches.length > 0 && (
					<>
						<div className='mb-4 flex items-center justify-between'>
							<div>
								<h3 className='text-lg font-semibold text-[var(--secondary)]'>
									All Branches ({branches.length})
								</h3>
								<p className='text-sm text-[var(--secondary)]/70'>
									Click on a branch to navigate to its management interface
								</p>
							</div>
						</div>

						<div className='grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-3 gap-6'>
							{branches.map((branch) => (
								<BranchCard
									key={branch.id}
									branch={{
										branchId: branch.id,
										name: branch.name,
										location: branch.location,
										createdAt: branch.createdAt.toDate(),
										updatedAt: branch.updatedAt.toDate(),
										isActive: branch.isActive,
										imgUrl: branch.imgUrl, // Default image
									}}
									formatDate={formatDate}
									onClick={handleBranchClick}
									onView={handleViewBranch}
									onEdit={handleEditBranch}
									onDelete={handleDeleteBranch}
								/>
							))}
						</div>
					</>
				)}
			</div>

			{/* Add Branch Modal */}
			<AddBranchModal
				isOpen={isAddModalOpen}
				onClose={handleCloseAllModals}
				onSuccess={handleBranchCreated}
				onError={handleModalError}
			/>

			{/* Edit Branch Modal */}
			<EditBranchModal
				isOpen={isEditModalOpen}
				branch={selectedBranch}
				onClose={handleCloseAllModals}
				onSuccess={handleBranchCreated}
				onError={handleModalError}
			/>

			{/* View Branch Modal */}
			<ViewBranchModal
				isOpen={isViewModalOpen}
				branch={selectedBranch}
				onClose={handleCloseAllModals}
				onEdit={handleViewToEdit}
				onDelete={handleViewToDelete}
			/>

			{/* Delete Confirmation Modal */}
			<DeleteConfirmationModal
				isOpen={isDeleteModalOpen}
				branch={selectedBranch}
				onClose={handleCloseAllModals}
				onSuccess={handleBranchCreated}
				onError={handleModalError}
			/>
		</div>
	);
}
