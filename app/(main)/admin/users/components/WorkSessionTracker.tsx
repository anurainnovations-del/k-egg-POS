import React, { useState, useEffect } from "react";
import { workSessionService, WorkSession } from "@/services/workSessionService";
import { workerService, Worker } from "@/services/workerService";
import { branchService, Branch } from "@/services/branchService";

interface WorkSessionTrackerProps {
	branchId?: string;
	refreshTrigger?: number;
}

export default function WorkSessionTracker({
	branchId,
	refreshTrigger = 0,
}: WorkSessionTrackerProps) {
	const [activeSessions, setActiveSessions] = useState<
		Array<WorkSession & { worker: Worker; branch: Branch }>
	>([]);
	const [loading, setLoading] = useState(true);
	const [error, setError] = useState<string | null>(null);

	useEffect(() => {
		loadActiveSessions();
	}, [branchId, refreshTrigger]);

	const loadActiveSessions = async () => {
		try {
			setLoading(true);
			setError(null);

			// Get active sessions
			const sessions = branchId
				? await workSessionService.getBranchWorkSessions(branchId)
				: [];

			// Filter only active sessions (no timeOutAt)
			const activeOnly = sessions.filter((session) => !session.timeOutAt);

			// Get worker and branch details for each session
			const enrichedSessions = await Promise.all(
				activeOnly.map(async (session) => {
					const [worker, branch] = await Promise.all([
						workerService.getWorker(session.userId),
						branchService.getBranchById(session.branchId),
					]);
					return {
						...session,
						worker: worker!,
						branch: branch!,
					};
				})
			);

			setActiveSessions(enrichedSessions);
		} catch (err: any) {
			console.error("Error loading active sessions:", err);
			setError(err.message || "Failed to load active sessions");
		} finally {
			setLoading(false);
		}
	};

	const calculateCurrentDuration = (timeInAt: any): string => {
		const now = new Date();
		const timeInDate = timeInAt.toDate ? timeInAt.toDate() : timeInAt;
		const diffMs = now.getTime() - timeInDate.getTime();
		const diffMins = Math.floor(diffMs / (1000 * 60));
		const hours = Math.floor(diffMins / 60);
		const minutes = diffMins % 60;

		if (hours > 0) {
			return `${hours}h ${minutes}m`;
		}
		return `${minutes}m`;
	};

	const formatTime = (date: any): string => {
		const dateObj = date.toDate ? date.toDate() : date;
		return new Intl.DateTimeFormat("en-US", {
			hour: "2-digit",
			minute: "2-digit",
			hour12: true,
		}).format(dateObj);
	};

	const getSessionTypeColor = (type: string) => {
		switch (type) {
			case "emergency":
				return "bg-red-100 text-red-800";
			case "overtime":
				return "bg-orange-100 text-orange-800";
			default:
				return "bg-green-100 text-green-800";
		}
	};

	if (loading) {
		return (
			<div className='bg-white rounded-lg shadow p-6'>
				<div className='flex items-center justify-between mb-4'>
					<h3 className='text-lg font-semibold text-gray-900'>
						Active Work Sessions
					</h3>
					<div className='animate-spin rounded-full h-6 w-6 border-2 border-dashed border-blue-500'></div>
				</div>
				<div className='space-y-3'>
					{[...Array(3)].map((_, i) => (
						<div key={i} className='animate-pulse'>
							<div className='flex items-center space-x-4 p-3 bg-gray-50 rounded-lg'>
								<div className='w-10 h-10 bg-gray-300 rounded-full'></div>
								<div className='flex-1'>
									<div className='h-4 bg-gray-300 rounded w-3/4 mb-2'></div>
									<div className='h-3 bg-gray-300 rounded w-1/2'></div>
								</div>
								<div className='h-6 bg-gray-300 rounded w-16'></div>
							</div>
						</div>
					))}
				</div>
			</div>
		);
	}

	if (error) {
		return (
			<div className='bg-white rounded-lg shadow p-6'>
				<div className='flex items-center justify-between mb-4'>
					<h3 className='text-lg font-semibold text-gray-900'>
						Active Work Sessions
					</h3>
					<button
						onClick={loadActiveSessions}
						className='text-blue-600 hover:text-blue-800 text-sm font-medium'>
						Retry
					</button>
				</div>
				<div className='text-center py-8'>
					<div className='w-12 h-12 bg-red-100 rounded-full flex items-center justify-center mx-auto mb-4'>
						<svg
							className='w-6 h-6 text-red-600'
							fill='none'
							stroke='currentColor'
							viewBox='0 0 24 24'>
							<path
								strokeLinecap='round'
								strokeLinejoin='round'
								strokeWidth={2}
								d='M12 8v4m0 4h.01M21 12a9 9 0 11-18 0 9 9 0 0118 0z'
							/>
						</svg>
					</div>
					<p className='text-gray-600 text-sm'>{error}</p>
				</div>
			</div>
		);
	}

	return (
		<div className='bg-white rounded-lg shadow'>
			<div className='flex items-center justify-between p-6 border-b border-gray-200'>
				<div>
					<h3 className='text-lg font-semibold text-gray-900'>
						Active Work Sessions
					</h3>
					<p className='text-sm text-gray-600 mt-1'>
						{activeSessions.length} worker
						{activeSessions.length !== 1 ? "s" : ""} currently clocked in
					</p>
				</div>
				<button
					onClick={loadActiveSessions}
					className='p-2 text-gray-400 hover:text-gray-600 rounded-lg hover:bg-gray-50'
					title='Refresh'>
					<svg
						className='w-5 h-5'
						fill='none'
						stroke='currentColor'
						viewBox='0 0 24 24'>
						<path
							strokeLinecap='round'
							strokeLinejoin='round'
							strokeWidth={2}
							d='M4 4v5h.582m15.356 2A8.001 8.001 0 004.582 9m0 0H9m11 11v-5h-.581m0 0a8.003 8.003 0 01-15.357-2m15.357 2H15'
						/>
					</svg>
				</button>
			</div>

			<div className='p-6'>
				{activeSessions.length === 0 ? (
					<div className='text-center py-8'>
						<div className='w-16 h-16 bg-gray-100 rounded-full flex items-center justify-center mx-auto mb-4'>
							<svg
								className='w-8 h-8 text-gray-400'
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
						<h4 className='text-gray-900 font-medium mb-2'>
							No Active Sessions
						</h4>
						<p className='text-gray-600 text-sm'>
							No workers are currently clocked in
							{branchId ? " at this branch" : ""}.
						</p>
					</div>
				) : (
					<div className='space-y-3'>
						{activeSessions.map((session) => (
							<div
								key={`${session.userId}-${session.timeInAt}`}
								className='flex items-center justify-between p-4 bg-green-50 border border-green-200 rounded-lg'>
								<div className='flex items-center space-x-4'>
									{/* Worker Avatar */}
									{session.worker.profilePicture ? (
										<img
											src={session.worker.profilePicture}
											alt=''
											className='w-10 h-10 rounded-full'
										/>
									) : (
										<div className='w-10 h-10 bg-gray-300 rounded-full flex items-center justify-center'>
											<span className='text-sm font-medium text-gray-700'>
												{session.worker.name.charAt(0).toUpperCase()}
											</span>
										</div>
									)}

									{/* Worker Info */}
									<div>
										<div className='font-medium text-gray-900'>
											{session.worker.name}
										</div>
										<div className='flex items-center space-x-2 text-sm text-gray-600'>
											<span>Clocked in at {formatTime(session.timeInAt)}</span>
											{!branchId && (
												<>
													<span>•</span>
													<span>{session.branch.name}</span>
												</>
											)}
										</div>
									</div>
								</div>

								<div className='flex items-center space-x-3'>
									{/* Session Type */}
									<span
										className={`inline-flex items-center px-2 py-1 rounded-full text-xs font-medium ${getSessionTypeColor(
											session.sessionType
										)}`}>
										{session.sessionType}
									</span>

									{/* Duration */}
									<div className='text-right'>
										<div className='font-semibold text-gray-900'>
											{calculateCurrentDuration(session.timeInAt)}
										</div>
										<div className='text-xs text-gray-500'>Duration</div>
									</div>

									{/* Status Indicator */}
									<div className='w-3 h-3 bg-green-400 rounded-full animate-pulse'></div>
								</div>
							</div>
						))}
					</div>
				)}
			</div>

			{/* Summary Footer */}
			{activeSessions.length > 0 && (
				<div className='px-6 py-4 bg-gray-50 border-t border-gray-200 rounded-b-lg'>
					<div className='flex items-center justify-between text-sm'>
						<div className='flex items-center space-x-4'>
							<span className='text-gray-600'>
								Total active workers: <strong>{activeSessions.length}</strong>
							</span>
							<span className='text-gray-600'>
								Avg. session:{" "}
								<strong>
									{activeSessions.length > 0
										? Math.round(
												activeSessions.reduce((acc, session) => {
													const now = new Date();
													const timeInDate = (session.timeInAt as any).toDate
														? (session.timeInAt as any).toDate()
														: session.timeInAt;
													const diffMs = now.getTime() - timeInDate.getTime();
													return acc + diffMs / (1000 * 60);
												}, 0) / activeSessions.length
										  )
										: 0}
									m
								</strong>
							</span>
						</div>
						<div className='flex items-center space-x-1'>
							<div className='w-2 h-2 bg-green-400 rounded-full'></div>
							<span className='text-gray-600'>Live tracking</span>
						</div>
					</div>
				</div>
			)}
		</div>
	);
}
