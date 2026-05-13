import React, { useState, useEffect } from "react";
import { useAuth } from "@/contexts/AuthContext";
import { useTimeTracking } from "@/contexts/TimeTrackingContext";
import { branchService, Branch } from "@/services/branchService";

interface POSTimeTrackingProps {
	currentBranchId: string;
	onStatusChange?: (isWorking: boolean) => void;
}

export default function POSTimeTracking({
	currentBranchId,
	onStatusChange,
}: POSTimeTrackingProps) {
	const { user } = useAuth();
	const timeTracking = useTimeTracking({ autoRefresh: true });
	const [loading, setLoading] = useState(false);
	const [currentBranch, setCurrentBranch] = useState<Branch | null>(null);

	useEffect(() => {
		loadBranchData();
	}, [currentBranchId]);

	useEffect(() => {
		// Notify parent component when status changes
		if (onStatusChange) {
			onStatusChange(timeTracking.isWorking);
		}
	}, [timeTracking.isWorking, onStatusChange]);

	const loadBranchData = async () => {
		try {
			const branch = await branchService.getBranchById(currentBranchId);
			setCurrentBranch(branch);
		} catch (err: any) {
			console.error("Error loading branch data:", err);
		}
	};

	const handleTimeIn = async () => {
		if (!user || !timeTracking.worker) return;

		setLoading(true);

		try {
			await timeTracking.clockIn(
				currentBranchId,
				`Self time-in at POS - ${currentBranch?.name || "Unknown Branch"}`
			);
		} catch (err: any) {
			console.error("Error timing in:", err);
			// Error is already handled by the timeTracking hook
		} finally {
			setLoading(false);
		}
	};

	const handleTimeOut = async () => {
		if (!user || !timeTracking.worker || !timeTracking.currentSession) return;

		setLoading(true);

		try {
			await timeTracking.clockOut(
				`Self time-out at POS - ${currentBranch?.name || "Unknown Branch"}`
			);
		} catch (err: any) {
			console.error("Error timing out:", err);
			// Error is already handled by the timeTracking hook
		} finally {
			setLoading(false);
		}
	};



	// Don't show for users without time tracking access
	// (admins without manager role assignments are exempt)
	const isExemptAdmin =
		timeTracking.worker?.isAdmin &&
		!timeTracking.worker.roleAssignments.some(
			(assignment) => assignment.role === "manager"
		);

	if (!user || !timeTracking.worker || isExemptAdmin) {
		return null;
	}

	// Check if worker has access to this branch
	const hasAccessToBranch = timeTracking.worker.roleAssignments.some(
		(assignment: any) =>
			assignment.branchId === currentBranchId && assignment.isActive
	);

	if (!hasAccessToBranch) {
		return (
			<div className='bg-yellow-50 border border-yellow-200 rounded-lg p-4'>
				<div className='flex items-center'>
					<svg
						className='w-5 h-5 text-yellow-400 mr-3'
						fill='currentColor'
						viewBox='0 0 20 20'>
						<path
							fillRule='evenodd'
							d='M8.257 3.099c.765-1.36 2.722-1.36 3.486 0l5.58 9.92c.75 1.334-.213 2.98-1.742 2.98H4.42c-1.53 0-2.493-1.646-1.743-2.98l5.58-9.92zM11 13a1 1 0 11-2 0 1 1 0 012 0zm-1-8a1 1 0 00-1 1v3a1 1 0 002 0V6a1 1 0 00-1-1z'
							clipRule='evenodd'
						/>
					</svg>
					<p className='text-yellow-800 text-sm'>
						You don&apos;t have access to clock in/out at this branch location.
					</p>
				</div>
			</div>
		);
	}

	const isWorking = timeTracking.isWorking;

	return (
		<div className='bg-white border border-gray-200 rounded-lg shadow-sm'>
			{/* Header */}
			<div className='px-4 py-3 border-b border-gray-200 bg-gray-50'>
				<div className='flex items-center justify-between'>
					<div>
						<h3 className='text-sm font-semibold text-gray-900'>
							Time Tracking
						</h3>
						<p className='text-xs text-gray-600'>
							{currentBranch?.name || "Unknown Branch"}
						</p>
					</div>
					<div
						className={`w-3 h-3 rounded-full ${
							isWorking ? "bg-green-400 animate-pulse" : "bg-gray-300"
						}`}></div>
				</div>
			</div>

			{/* Content */}
			<div className='p-4'>
				{timeTracking.error && (
					<div className='mb-4 p-3 bg-red-50 border border-red-200 rounded-lg'>
						<p className='text-red-700 text-sm'>{timeTracking.error}</p>
					</div>
				)}

				{/* Current Status Display */}
				<div className='mb-4'>
					<div className='flex items-center justify-between'>
						<div>
							<span className='text-sm text-gray-600'>Current Status:</span>
							<div
								className={`inline-flex items-center mt-1 px-2 py-1 rounded-full text-xs font-medium ${
									isWorking
										? "bg-green-100 text-green-800"
										: "bg-gray-100 text-gray-800"
								}`}>
								<div
									className={`w-1.5 h-1.5 rounded-full mr-1.5 ${
										isWorking ? "bg-green-400" : "bg-gray-400"
									}`}
								/>
								{isWorking ? "Clocked In" : "Clocked Out"}
							</div>
						</div>

						{/* Duration if working */}
						{isWorking && timeTracking.currentSession && (
							<div className='text-right'>
								<span className='text-sm text-gray-600'>Working for:</span>
								<div className='text-lg font-semibold text-gray-900'>
									{Math.floor(timeTracking.workingDuration / 60)}h{" "}
									{timeTracking.workingDuration % 60}m
								</div>
							</div>
						)}
					</div>
				</div>

				{/* Session Details */}
				{isWorking && timeTracking.currentSession && (
					<div className='mb-4 p-3 bg-blue-50 border border-blue-200 rounded-lg'>
						<div className='text-sm'>
							<div className='flex justify-between items-center mb-1'>
								<span className='text-blue-700 font-medium'>Started at:</span>
								<span className='text-blue-900'>
									{new Date(
										timeTracking.currentSession.timeInAt.toDate
											? timeTracking.currentSession.timeInAt.toDate()
											: timeTracking.currentSession.timeInAt
									).toLocaleTimeString()}
								</span>
							</div>
							{timeTracking.currentSession.notes && (
								<div className='text-blue-700 text-xs mt-2'>
									Note: {timeTracking.currentSession.notes}
								</div>
							)}
						</div>
					</div>
				)}

				{/* Action Button */}
				<div className='flex flex-col space-y-2'>
					{!isWorking ? (
						<button
							onClick={handleTimeIn}
							disabled={loading || timeTracking.loading}
							className='w-full flex items-center justify-center px-4 py-3 bg-green-600 hover:bg-green-700 disabled:opacity-50 disabled:cursor-not-allowed text-white rounded-lg font-medium transition-colors'>
							{loading || timeTracking.loading ? (
								<div className='flex items-center'>
									<div className='animate-spin rounded-full h-4 w-4 border-2 border-white border-t-transparent mr-2'></div>
									Clocking In...
								</div>
							) : (
								<div className='flex items-center'>
									<svg
										className='w-4 h-4 mr-2'
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
									Clock In
								</div>
							)}
						</button>
					) : (
						<button
							onClick={handleTimeOut}
							disabled={loading || timeTracking.loading}
							className='w-full flex items-center justify-center px-4 py-3 bg-orange-600 hover:bg-orange-700 disabled:opacity-50 disabled:cursor-not-allowed text-white rounded-lg font-medium transition-colors'>
							{loading || timeTracking.loading ? (
								<div className='flex items-center'>
									<div className='animate-spin rounded-full h-4 w-4 border-2 border-white border-t-transparent mr-2'></div>
									Clocking Out...
								</div>
							) : (
								<div className='flex items-center'>
									<svg
										className='w-4 h-4 mr-2'
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
									Clock Out
								</div>
							)}
						</button>
					)}

					{/* Quick Actions */}
					<div className='flex space-x-2 pt-2 border-t border-gray-200'>
						<button className='flex-1 text-xs text-gray-600 hover:text-gray-800 py-2'>
							View My Sessions
						</button>
						<button className='flex-1 text-xs text-gray-600 hover:text-gray-800 py-2'>
							Report Issue
						</button>
					</div>
				</div>
			</div>

			{/* Current Time Display */}
			<div className='px-4 py-2 bg-gray-50 border-t border-gray-200 rounded-b-lg'>
				<div className='flex items-center justify-between'>
					<span className='text-xs text-gray-600'>Current time:</span>
					<span className='text-xs font-mono text-gray-900'>
						{new Date().toLocaleTimeString()}
					</span>
				</div>
			</div>
		</div>
	);
}
