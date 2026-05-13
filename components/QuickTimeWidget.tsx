import React, { useState, useEffect } from "react";
import { useAuth } from "@/contexts/AuthContext";
import { useTimeTracking } from "@/contexts/TimeTrackingContext";

interface QuickTimeWidgetProps {
	currentBranchId?: string;
	className?: string;
	compact?: boolean; // For TopBar usage
}

export default function QuickTimeWidget({
	currentBranchId,
	className = "",
	compact = false,
}: QuickTimeWidgetProps) {
	const { user } = useAuth();
	const timeTracking = useTimeTracking({ autoRefresh: true });
	const [loading, setLoading] = useState(false);
	const [currentTime, setCurrentTime] = useState(new Date());

	useEffect(() => {
		// Update current time every second
		const timer = setInterval(() => {
			setCurrentTime(new Date());
		}, 1000);

		return () => clearInterval(timer);
	}, []);

	const handleQuickToggle = async () => {
		if (!user || !timeTracking.worker || loading) return;

		setLoading(true);

		try {
			const branchId =
				currentBranchId || timeTracking.worker.roleAssignments[0]?.branchId;

			if (!branchId) {
				throw new Error("No branch selected for time tracking");
			}

			if (!timeTracking.isWorking) {
				await timeTracking.clockIn(branchId, "Quick clock-in from POS");
			} else {
				await timeTracking.clockOut("Quick clock-out from POS");
			}
		} catch (err: any) {
			console.error("Error toggling time status:", err);
		} finally {
			setLoading(false);
		}
	};

	const formatWorkingTime = (): string => {
		if (!timeTracking.currentSession || timeTracking.workingDuration === 0)
			return "0m";

		const hours = Math.floor(timeTracking.workingDuration / 60);
		const minutes = timeTracking.workingDuration % 60;

		if (hours > 0) {
			return `${hours}h ${minutes}m`;
		}
		return `${minutes}m`;
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

	const isWorking = timeTracking.isWorking;

	// Compact version for TopBar
	if (compact) {
		return (
			<div className={`flex items-center space-x-2 ${className}`}>
				{/* Status Indicator with Time */}
				<div className='flex items-center space-x-1.5 bg-white/10 backdrop-blur-sm rounded-lg px-2 py-1'>
					<div
						className={`w-2 h-2 rounded-full ${
							isWorking ? "bg-[var(--success)] animate-pulse" : "bg-gray-300"
						}`}></div>
					<span className='text-xs font-medium -text[var(--secondary)]'>
						{isWorking ? formatWorkingTime() : "Off"}
					</span>
				</div>

				{/* Compact Toggle Button */}
				<button
					onClick={handleQuickToggle}
					disabled={loading || timeTracking.loading}
					className={`flex items-center space-x-1 px-2 py-1 rounded-lg -text[var(--secondary)] transition-colors text-xs font-medium ${
						isWorking
							? "bg-orange-500/20 hover:bg-orange-500/30"
							: "bg-green-500/20 hover:bg-green-500/30"
					} ${
						loading || timeTracking.loading
							? "opacity-50 cursor-not-allowed"
							: ""
					}`}
					title={isWorking ? "Clock Out" : "Clock In"}>
					{loading || timeTracking.loading ? (
						<>
							<div className='animate-spin rounded-full h-3 w-3 border-2 border-white border-t-transparent'></div>
							<span>{isWorking ? "Clocking Out..." : "Clocking In..."}</span>
						</>
					) : (
						<>
							<svg
								className='w-3 h-3'
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
							<span>{isWorking ? "Clock Out" : "Clock In"}</span>
						</>
					)}
				</button>
			</div>
		);
	}

	// Regular version for other contexts
	return (
		<div
			className={`bg-white border border-gray-200 rounded-lg shadow-sm ${className}`}>
			<div className='p-3'>
				{/* Status Indicator */}
				<div className='flex items-center justify-between mb-3'>
					<div className='flex items-center space-x-2'>
						<div
							className={`w-2 h-2 rounded-full ${
								isWorking ? "bg-green-400 animate-pulse" : "bg-gray-300"
							}`}></div>
						<span className='text-sm font-medium text-gray-700'>
							{isWorking ? "Working" : "Not Working"}
						</span>
					</div>
					<div className='text-xs text-gray-500 font-mono'>
						{currentTime.toLocaleTimeString([], {
							hour: "2-digit",
							minute: "2-digit",
						})}
					</div>
				</div>

				{/* Working Time Display */}
				{isWorking && (
					<div className='mb-3'>
						<div className='text-xs text-gray-500 mb-1'>Working for:</div>
						<div className='text-lg font-semibold text-blue-600'>
							{formatWorkingTime()}
						</div>
					</div>
				)}

				{/* Quick Toggle Button */}
				<button
					onClick={handleQuickToggle}
					disabled={loading || timeTracking.loading}
					className={`w-full flex items-center justify-center px-3 py-2 rounded-md text-sm font-medium transition-colors ${
						isWorking
							? "bg-orange-100 hover:bg-orange-200 text-orange-700"
							: "bg-green-100 hover:bg-green-200 text-green-700"
					} ${
						loading || timeTracking.loading
							? "opacity-50 cursor-not-allowed"
							: ""
					}`}>
					{loading || timeTracking.loading ? (
						<div className='flex items-center'>
							<div className='animate-spin rounded-full h-3 w-3 border-2 border-current border-t-transparent mr-2'></div>
							{isWorking ? "Clocking out..." : "Clocking in..."}
						</div>
					) : (
						<>
							{isWorking ? (
								<>
									<svg
										className='w-4 h-4 mr-1.5'
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
								</>
							) : (
								<>
									<svg
										className='w-4 h-4 mr-1.5'
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
								</>
							)}
						</>
					)}
				</button>
			</div>
		</div>
	);
}
