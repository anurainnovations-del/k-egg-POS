"use client";

import { useState } from "react";
import { branchService, Branch } from "@/services/branchService";

interface DeleteConfirmationModalProps {
	isOpen: boolean;
	branch: Branch | null;
	onClose: () => void;
	onSuccess: () => void;
	onError: (error: string) => void;
}

export default function DeleteConfirmationModal({
	isOpen,
	branch,
	onClose,
	onSuccess,
	onError,
}: DeleteConfirmationModalProps) {
	const [loading, setLoading] = useState(false);
	const [confirmationText, setConfirmationText] = useState("");
	const [deleteOption, setDeleteOption] = useState<"soft" | "hard">("soft");

	if (!isOpen || !branch) return null;

	const isConfirmationValid = confirmationText === branch.name;

	const handleDelete = async () => {
		if (!isConfirmationValid || !branch) return;

		setLoading(true);
		try {
			if (deleteOption === "soft") {
				// Soft delete - just deactivate the branch
				await branchService.deactivateBranch(branch.id);
			} else {
				// Hard delete - completely remove the branch
				await branchService.deleteBranch(branch.id);
			}

			onSuccess();
			onClose();
			setConfirmationText("");
		} catch (error) {
			console.error("Error deleting branch:", error);
			onError(
				`Failed to ${
					deleteOption === "soft" ? "deactivate" : "delete"
				} branch. Please try again.`
			);
		} finally {
			setLoading(false);
		}
	};

	const handleClose = () => {
		if (!loading) {
			setConfirmationText("");
			setDeleteOption("soft");
			onClose();
		}
	};

	return (
		<div
			className='fixed inset-0 bg-[var(--primary)]/80 flex items-center justify-center z-50 p-4 sm:p-6'
			onClick={handleClose}>
			<div
				className='bg-white rounded-2xl p-4 sm:p-6 lg:p-8 max-w-md w-full shadow-2xl max-h-[90vh] overflow-y-auto'
				onClick={(e) => e.stopPropagation()}>
				{loading ? (
					/* Loading Screen */
					<div className='text-center py-12'>
						<div className='w-16 h-16 bg-red-100 rounded-xl mx-auto mb-4 flex items-center justify-center'>
							<div className='animate-spin rounded-full h-8 w-8 border-2 border-dashed border-red-500'></div>
						</div>
						<h3 className='text-xl font-bold text-[var(--secondary)] mb-2'>
							{deleteOption === "soft"
								? "Deactivating Branch..."
								: "Deleting Branch..."}
						</h3>
						<p className='text-[var(--secondary)] opacity-70'>
							{deleteOption === "soft"
								? "Please wait while we deactivate this branch"
								: "Please wait while we permanently delete this branch"}
						</p>
					</div>
				) : (
					<>
						{/* Modal Header */}
						<div className='text-center mb-6'>
							<div className='w-16 h-16 bg-red-100 rounded-xl mx-auto mb-4 flex items-center justify-center'>
								<svg
									className='w-6 h-6 text-red-600'
									fill='none'
									stroke='currentColor'
									viewBox='0 0 24 24'>
									<path
										strokeLinecap='round'
										strokeLinejoin='round'
										strokeWidth={2}
										d='M12 9v2m0 4h.01m-6.938 4h13.856c1.54 0 2.502-1.667 1.732-2.5L13.732 4c-.77-.833-1.732-.833-2.464 0L4.35 16.5c-.77.833.192 2.5 1.732 2.5z'
									/>
								</svg>
							</div>
							<h3 className='text-xl font-bold text-[var(--secondary)] mb-2'>
								{deleteOption === "soft"
									? "Deactivate Branch"
									: "Delete Branch"}
							</h3>
							<p className='text-[var(--secondary)] opacity-70'>
								{deleteOption === "soft"
									? "This action will disable the branch but keep all data"
									: "This action cannot be undone and will permanently remove all branch data"}
							</p>
						</div>

						{/* Branch Info */}
						<div className='bg-red-50 border border-red-200 rounded-xl p-4 mb-6'>
							<div className='flex items-center gap-3'>
								<div className='w-10 h-10 bg-red-100 rounded-lg flex items-center justify-center flex-shrink-0'>
									<svg
										className='w-5 h-5 text-red-600'
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
								<div className='flex-1'>
									<h4 className='font-semibold text-red-900 mb-1'>
										{branch.name}
									</h4>
									<p className='text-sm text-red-700'>{branch.location}</p>
								</div>
								<div
									className={`px-2 py-1 rounded text-xs font-medium ${
										branch.isActive
											? "bg-green-100 text-green-700"
											: "bg-gray-100 text-gray-700"
									}`}>
									{branch.isActive ? "Active" : "Inactive"}
								</div>
							</div>
						</div>

						{/* Delete Options */}
						<div className='space-y-3 sm:space-y-4 mb-4 sm:mb-6'>
							<div className='text-sm font-medium text-[var(--secondary)] mb-2 sm:mb-3'>
								Choose deletion type:
							</div>

							{/* Soft Delete Option */}
							<label className='flex items-start gap-2 sm:gap-3 p-2 sm:p-3 border rounded-lg cursor-pointer hover:bg-gray-50 transition-colors'>
								<input
									type='radio'
									name='deleteOption'
									value='soft'
									checked={deleteOption === "soft"}
									onChange={(e) => setDeleteOption(e.target.value as "soft")}
									className='mt-1'
								/>
								<div className='flex-1'>
									<div className='font-medium text-[var(--secondary)] mb-1 text-sm sm:text-base'>
										Deactivate (Recommended)
									</div>
									<div className='text-xs sm:text-sm text-[var(--secondary)] opacity-70'>
										Hide branch from users but preserve all data. Can be
										reactivated later.
									</div>
								</div>
							</label>

							{/* Hard Delete Option */}
							<label className='flex items-start gap-2 sm:gap-3 p-2 sm:p-3 border rounded-lg cursor-pointer hover:bg-gray-50 transition-colors'>
								<input
									type='radio'
									name='deleteOption'
									value='hard'
									checked={deleteOption === "hard"}
									onChange={(e) => setDeleteOption(e.target.value as "hard")}
									className='mt-1'
								/>
								<div className='flex-1'>
									<div className='font-medium text-red-600 mb-1 text-sm sm:text-base'>
										Permanent Delete
									</div>
									<div className='text-xs sm:text-sm text-red-600'>
										Completely remove branch and all associated data. This
										cannot be undone.
									</div>
								</div>
							</label>
						</div>

						{/* Confirmation Input */}
						<div className='mb-6'>
							<label className='block text-sm font-medium text-[var(--secondary)] mb-2'>
								Type the branch name to confirm:{" "}
								<span className='font-mono bg-gray-100 px-1 rounded'>
									{branch.name}
								</span>
							</label>
							<input
								type='text'
								value={confirmationText}
								onChange={(e) => setConfirmationText(e.target.value)}
								className='w-full px-3 py-2 text-[14px] h-[44px] rounded-lg border-2 border-red-200 focus:border-red-400 focus:outline-none focus:ring-2 focus:ring-red-100'
								placeholder={`Type "${branch.name}" to confirm`}
								autoComplete='off'
							/>
							{confirmationText && !isConfirmationValid && (
								<p className='text-xs text-red-600 mt-1'>
									Branch name doesn&apos;t match. Please type exactly:{" "}
									{branch.name}
								</p>
							)}
						</div>

						{/* Warning Message */}
						<div className='bg-orange-50 border border-orange-200 rounded-lg p-3 mb-6'>
							<div className='flex items-start gap-2'>
								<svg
									className='w-4 h-4 text-orange-600 mt-0.5 flex-shrink-0'
									fill='currentColor'
									viewBox='0 0 20 20'>
									<path
										fillRule='evenodd'
										d='M8.257 3.099c.765-1.36 2.722-1.36 3.486 0l5.58 9.92c.75 1.334-.213 2.98-1.742 2.98H4.42c-1.53 0-2.493-1.646-1.743-2.98l5.58-9.92zM11 13a1 1 0 11-2 0 1 1 0 012 0zm-1-8a1 1 0 00-1 1v3a1 1 0 002 0V6a1 1 0 00-1-1z'
										clipRule='evenodd'
									/>
								</svg>
								<div className='text-sm text-orange-700'>
									{deleteOption === "soft"
										? "Deactivating this branch will hide it from users but preserve all inventory, sales, and transaction data."
										: "Permanently deleting this branch will remove all associated inventory, sales history, and transaction data. This action cannot be undone."}
								</div>
							</div>
						</div>

						{/* Action Buttons */}
						<div className='flex flex-col sm:flex-row gap-3 sm:gap-4'>
							<button
								onClick={handleClose}
								className='w-full sm:flex-1 py-2.5 sm:py-3 bg-gray-200 hover:bg-gray-300 text-[var(--secondary)] rounded-xl font-semibold transition-all hover:scale-105 active:scale-95 text-sm sm:text-base'>
								Cancel
							</button>
							<button
								onClick={handleDelete}
								disabled={!isConfirmationValid}
								className={`w-full sm:flex-1 py-2.5 sm:py-3 rounded-xl font-semibold transition-all text-sm sm:text-base ${
									isConfirmationValid
										? `${
												deleteOption === "soft"
													? "bg-orange-500 hover:bg-orange-600"
													: "bg-red-500 hover:bg-red-600"
										  } text-white hover:scale-105 cursor-pointer`
										: "bg-gray-200 text-gray-400 hover:scale-100 active:scale-100 cursor-not-allowed"
								}`}>
								{deleteOption === "soft"
									? "Deactivate Branch"
									: "Delete Permanently"}
							</button>
						</div>
					</>
				)}
			</div>
		</div>
	);
}
