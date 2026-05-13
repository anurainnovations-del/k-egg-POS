import React, { useState } from "react";
import { workerService, Worker } from "@/services/workerService";

interface DeleteWorkerModalProps {
	isOpen: boolean;
	worker: Worker | null;
	onClose: () => void;
	onSuccess: () => void;
}

export default function DeleteWorkerModal({
	isOpen,
	worker,
	onClose,
	onSuccess,
}: DeleteWorkerModalProps) {
	const [loading, setLoading] = useState(false);
	const [error, setError] = useState<string | null>(null);
	const [confirmText, setConfirmText] = useState("");

	const handleDelete = async () => {
		if (!worker) return;

		if (confirmText !== worker.name) {
			setError("Please type the worker's name exactly to confirm deletion");
			return;
		}

		setLoading(true);
		setError(null);

		try {
			await workerService.deleteWorker(worker.id);
			onSuccess();
			handleClose();
		} catch (err: unknown) {
			console.error("Error deleting worker:", err);
			setError(err instanceof Error ? err.message : "Failed to delete worker");
		} finally {
			setLoading(false);
		}
	};

	const handleClose = () => {
		if (!loading) {
			setConfirmText("");
			setError(null);
			onClose();
		}
	};

	if (!isOpen || !worker) return null;

	const isConfirmValid = confirmText === worker.name;

	return (
		<div className='fixed inset-0 bg-black/50 flex items-center justify-center p-4 z-50'>
			<div className='bg-white rounded-2xl p-8 max-w-md w-full mx-4 shadow-2xl'>
				{loading ? (
					<div className='text-center py-8'>
						<div className='w-12 h-12 rounded-xl mx-auto mb-4 flex items-center justify-center'>
							<div className='animate-spin rounded-full h-10 w-10 border-4 border-dashed border-red-500'></div>
						</div>
						<h3 className='text-xl font-bold text-[var(--secondary)] mb-2'>
							Deleting Worker...
						</h3>
						<p className='text-[var(--secondary)] opacity-70'>
							Removing worker account and all associated data
						</p>
					</div>
				) : (
					<>
						{/* Header */}
						<div className='flex items-center justify-center mb-6'>
							<div className='w-16 h-16 bg-red-100 rounded-full flex items-center justify-center'>
								<svg
									className='w-8 h-8 text-red-600'
									fill='none'
									stroke='currentColor'
									viewBox='0 0 24 24'>
									<path
										strokeLinecap='round'
										strokeLinejoin='round'
										strokeWidth={2}
										d='M19 7l-.867 12.142A2 2 0 0116.138 21H7.862a2 2 0 01-1.995-1.858L5 7m5 4v6m4-6v6m1-10V4a1 1 0 00-1-1h-4a1 1 0 00-1 1v3M4 7h16'
									/>
								</svg>
							</div>
						</div>

						<div className='text-center mb-6'>
							<h3 className='text-xl font-bold text-[var(--secondary)] mb-2'>
								Delete Worker Account
							</h3>
							<p className='text-[var(--secondary)] opacity-70'>
								This action cannot be undone. All worker data and work history
								will be permanently deleted.
							</p>
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
									{worker.employeeId && (
										<div className='text-sm text-gray-500'>
											ID: {worker.employeeId}
										</div>
									)}
								</div>
							</div>
						</div>

						{/* Confirmation Input */}
						<div className='mb-6'>
							<label className='block text-sm font-medium text-gray-700 mb-2'>
								Type{" "}
								<span className='font-mono bg-gray-100 px-1 rounded'>
									{worker.name}
								</span>{" "}
								to confirm deletion:
							</label>
							<input
								type='text'
								value={confirmText}
								onChange={(e) => setConfirmText(e.target.value)}
								className='w-full px-3 py-2 border border-gray-300 rounded-lg focus:ring-2 focus:ring-red-500 focus:border-transparent'
								placeholder={`Type "${worker.name}" here`}
							/>
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

						{/* Form Actions */}
						<div className='flex flex-col sm:flex-row gap-3'>
							<button
								type='button'
								onClick={handleClose}
								className='flex-1 py-3 px-4 border border-gray-300 rounded-lg text-gray-700 font-medium hover:bg-gray-50 transition-colors'>
								Cancel
							</button>
							<button
								onClick={handleDelete}
								disabled={loading || !isConfirmValid}
								className='flex-1 py-3 px-4 bg-red-600 text-white rounded-lg font-medium hover:bg-red-700 transition-colors disabled:opacity-50 disabled:cursor-not-allowed'>
								Delete Worker
							</button>
						</div>
					</>
				)}
			</div>
		</div>
	);
}
