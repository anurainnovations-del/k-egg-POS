import React, { useState } from "react";
import Image from "next/image";
import { Worker } from "@/services/workerService";
import { Branch } from "@/services/branchService";
import { workSessionService } from "@/services/workSessionService";

interface TimeInOutModalProps {
	isOpen: boolean;
	worker: Worker | null;
	action: "time_in" | "time_out";
	branches: Branch[];
	onClose: () => void;
	onSuccess: () => void;
}

export default function TimeInOutModal({
	isOpen,
	worker,
	action,
	branches,
	onClose,
	onSuccess,
}: TimeInOutModalProps) {
	const [loading, setLoading] = useState(false);
	const [error, setError] = useState<string | null>(null);
	const [selectedBranchId, setSelectedBranchId] = useState("");
	const [notes, setNotes] = useState("");

	React.useEffect(() => {
		if (isOpen && worker) {
			if (action === "time_in") {
				// For time in, pre-select first available branch if any
				const workerBranches = worker.roleAssignments
					.filter((assignment) => assignment.isActive)
					.map((assignment) => assignment.branchId);

				if (workerBranches.length > 0) {
					setSelectedBranchId(workerBranches[0]);
				}
			} else if (action === "time_out") {
				// For time out, use current branch
				setSelectedBranchId(worker.currentBranchId || "");
			}
			setNotes("");
			setError(null);
		}
	}, [isOpen, worker, action]);

	const handleSubmit = async (e: React.FormEvent) => {
		e.preventDefault();

		if (!worker) return;

		// Admins don't have time tracking
		if (worker.isAdmin) {
			setError("Admins are exempt from time tracking");
			return;
		}

		if (action === "time_in" && !selectedBranchId) {
			setError("Please select a branch to clock in");
			return;
		}

		setLoading(true);
		setError(null);

		try {
			if (action === "time_in") {
				await workSessionService.timeInWorker(
					worker.id,
					selectedBranchId,
					notes
				);
			} else {
				const activeSession = await workSessionService.getActiveWorkSession(
					worker.id
				);
				if (activeSession) {
					await workSessionService.timeOutWorker(
						worker.id,
						activeSession.id,
						notes
					);
				} else {
					throw new Error("No active session found");
				}
			}

			onSuccess();
			handleClose();
		} catch (err: unknown) {
			console.error(
				`Error ${action === "time_in" ? "timing in" : "timing out"} worker:`,
				err
			);
			setError(
				err instanceof Error ? err.message :
					`Failed to ${action === "time_in" ? "time in" : "time out"} worker`
			);
		} finally {
			setLoading(false);
		}
	};

	const handleClose = () => {
		if (!loading) {
			setSelectedBranchId("");
			setNotes("");
			setError(null);
			onClose();
		}
	};

	if (!isOpen || !worker) return null;

	const isTimeIn = action === "time_in";
	const title = isTimeIn ? "Time In Worker" : "Time Out Worker";
	const actionText = isTimeIn ? "Clock In" : "Clock Out";
	const iconColor = isTimeIn ? "text-green-600" : "text-orange-600";
	const bgColor = isTimeIn ? "bg-green-100" : "bg-orange-100";

	// Get worker's assigned branches for time in
	const workerBranches = isTimeIn
		? branches.filter((branch) =>
				worker.roleAssignments.some(
					(assignment) =>
						assignment.branchId === branch.id && assignment.isActive
				)
		  )
		: [];

	return (
		<div className='fixed inset-0 bg-black/50 flex items-center justify-center p-4 z-50'>
			<div className='bg-white rounded-2xl p-8 max-w-md w-full mx-4 shadow-2xl'>
				{loading ? (
					<div className='text-center py-8'>
						<div className='w-12 h-12 rounded-xl mx-auto mb-4 flex items-center justify-center'>
							<div
								className={`animate-spin rounded-full h-10 w-10 border-4 border-dashed ${
									isTimeIn ? "border-green-500" : "border-orange-500"
								}`}></div>
						</div>
						<h3 className='text-xl font-bold text-[var(--secondary)] mb-2'>
							{isTimeIn ? "Clocking In..." : "Clocking Out..."}
						</h3>
						<p className='text-[var(--secondary)] opacity-70'>
							{isTimeIn ? "Recording time in" : "Recording time out"}
						</p>
					</div>
				) : (
					<>
						{/* Header */}
						<div className='flex items-center justify-between mb-6'>
							<div className='flex items-center'>
								<div
									className={`w-12 h-12 ${bgColor} rounded-full flex items-center justify-center mr-4`}>
									<svg
										className={`w-6 h-6 ${iconColor}`}
										fill='none'
										stroke='currentColor'
										viewBox='0 0 24 24'>
										<path
											strokeLinecap='round'
											strokeLinejoin='round'
											strokeWidth={2}
											d='M12 8v4l3 3m6-3a9 9 0 11-18 0 9 9 0 0118 0z'
										/>
									</svg>
								</div>
								<div>
									<h3 className='text-xl font-bold text-[var(--secondary)]'>
										{title}
									</h3>
									<p className='text-sm text-[var(--secondary)]/70'>
										{isTimeIn
											? "Start work session"
											: "End current work session"}
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
									<Image
										src={worker.profilePicture}
										alt={`${worker.name} profile`}
										width={40}
										height={40}
										className='w-10 h-10 rounded-full mr-3'
									/>
								) : (
									<div className='w-10 h-10 bg-gray-300 rounded-full flex items-center justify-center mr-3'>
										<span className='text-sm font-medium text-gray-700'>
											{worker.name.charAt(0).toUpperCase()}
										</span>
									</div>
								)}
								<div>
									<div className='font-medium text-gray-900'>{worker.name}</div>
									<div className='text-sm text-gray-500'>
										{isTimeIn
											? "Ready to clock in"
											: `Currently at: ${
													branches.find((b) => b.id === worker.currentBranchId)
														?.name || "Unknown"
											  }`}
									</div>
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

						{/* Form */}
						<form onSubmit={handleSubmit} className='space-y-4'>
							{/* Branch Selection (for time in only) */}
							{isTimeIn && (
								<div>
									<label className='block text-sm font-medium text-gray-700 mb-2'>
										Select Branch *
									</label>
									<select
										value={selectedBranchId}
										onChange={(e) => setSelectedBranchId(e.target.value)}
										className='w-full px-3 py-2 border border-gray-300 rounded-lg focus:ring-2 focus:ring-[var(--accent)] focus:border-transparent'
										required>
										<option value=''>Choose a branch...</option>
										{workerBranches.map((branch) => (
											<option key={branch.id} value={branch.id}>
												{branch.name} - {branch.location}
											</option>
										))}
									</select>
								</div>
							)}

							{/* Notes */}
							<div>
								<label className='block text-sm font-medium text-gray-700 mb-2'>
									Notes (Optional)
								</label>
								<textarea
									value={notes}
									onChange={(e) => setNotes(e.target.value)}
									className='w-full px-3 py-2 border border-gray-300 rounded-lg focus:ring-2 focus:ring-[var(--accent)] focus:border-transparent'
									rows={3}
									placeholder={`Add any notes for this ${
										isTimeIn ? "clock in" : "clock out"
									}...`}
								/>
							</div>

							{/* Current Time Display */}
							<div className='bg-blue-50 border border-blue-200 rounded-lg p-3'>
								<div className='text-sm text-blue-800'>
									<strong>Current Time:</strong> {new Date().toLocaleString()}
								</div>
							</div>

							{/* Form Actions */}
							<div className='flex flex-col sm:flex-row gap-3 pt-4'>
								<button
									type='button'
									onClick={handleClose}
									className='flex-1 py-3 px-4 border border-gray-300 rounded-lg text-gray-700 font-medium hover:bg-gray-50 transition-colors'>
									Cancel
								</button>
								<button
									type='submit'
									disabled={loading}
									className={`flex-1 py-3 px-4 ${
										isTimeIn
											? "bg-green-600 hover:bg-green-700"
											: "bg-orange-600 hover:bg-orange-700"
									} text-white rounded-lg font-medium transition-colors disabled:opacity-50`}>
									{actionText}
								</button>
							</div>
						</form>
					</>
				)}
			</div>
		</div>
	);
}
