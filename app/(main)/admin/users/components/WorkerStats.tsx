import React, { useState, useEffect } from "react";
import { WorkerStats } from "@/types/WorkerTypes";
import { workSessionService, WorkSession } from "@/services/workSessionService";
import { Worker } from "@/services/workerService";
import { useAccessibleBranches } from "@/contexts/BranchContext";
import { Timestamp } from "firebase/firestore";

interface WorkerStatsProps {
	worker: Worker;
	dateRange?: {
		startDate: Date;
		endDate: Date;
	};
}

export default function WorkerStatsComponent({
	worker,
	dateRange,
}: WorkerStatsProps) {
	const [stats, setStats] = useState<WorkerStats | null>(null);
	const [loading, setLoading] = useState(true);
	const [error, setError] = useState<string | null>(null);
	const { allBranches } = useAccessibleBranches();

	useEffect(() => {
		loadWorkerStats();
	}, [worker.id, dateRange]);

	const loadWorkerStats = async () => {
		try {
			setLoading(true);
			setError(null);

			// Get all work sessions for the worker
			const allSessions = await workSessionService.listWorkSessions(worker.id);

			// Filter sessions by date range if provided
			const filteredSessions = dateRange
				? allSessions.filter((session) => {
						const sessionDate = session.timeInAt.toDate();
						return (
							sessionDate >= dateRange.startDate &&
							sessionDate <= dateRange.endDate
						);
				  })
				: allSessions;

			// Calculate stats from sessions
			const calculatedStats = calculateWorkerStats(worker.id, filteredSessions);
			setStats(calculatedStats);
		} catch (err: unknown) {
			console.error("Error loading worker stats:", err);
			setError(err instanceof Error ? err.message : "Failed to load worker statistics");
		} finally {
			setLoading(false);
		}
	};

	const calculateWorkerStats = (
		userId: string,
		sessions: WorkSession[]
	): WorkerStats => {
		// Initialize stats
		const stats: WorkerStats = {
			userId,
			totalHoursWorked: 0,
			totalSessions: sessions.length,
			averageSessionDuration: 0,
			currentStreak: 0,
			longestStreak: 0,
			thisWeek: {
				hoursWorked: 0,
				sessionsCount: 0,
				daysWorked: 0,
			},
			thisMonth: {
				hoursWorked: 0,
				sessionsCount: 0,
				daysWorked: 0,
			},
			branchStats: [],
			overtime: {
				thisWeek: 0,
				thisMonth: 0,
				total: 0,
			},
			attendance: {
				punctualityScore: 0,
				averageClockInDelay: 0,
				missedShifts: 0,
			},
		};

		if (sessions.length === 0) {
			return stats;
		}

		// Calculate date boundaries
		const now = new Date();
		const weekStart = new Date(now);
		weekStart.setDate(now.getDate() - now.getDay()); // Start of current week
		weekStart.setHours(0, 0, 0, 0);

		const monthStart = new Date(now.getFullYear(), now.getMonth(), 1);

		// Track totals and branch performance
		const branchMap = new Map();
		let totalMinutes = 0;
		let onTimeCount = 0;
		let totalDelayMinutes = 0;

		// Track days worked for streaks
		const workedDates = new Set();
		const thisWeekDates = new Set();
		const thisMonthDates = new Set();

		sessions.forEach((session) => {
			const sessionDate = session.timeInAt.toDate();
			const dayKey = sessionDate.toDateString();
			workedDates.add(dayKey);

			// Calculate session duration
			let duration = 0;
			if (session.duration) {
				duration = session.duration;
			} else if (session.timeInAt && session.timeOutAt) {
				const startTime = session.timeInAt.toDate();
				const endTime = session.timeOutAt.toDate();
				duration = (endTime.getTime() - startTime.getTime()) / (1000 * 60); // minutes
			}

			totalMinutes += duration;
			stats.totalHoursWorked += duration / 60;

			// Track branch stats
			if (!branchMap.has(session.branchId)) {
				branchMap.set(session.branchId, {
					branchId: session.branchId,
					hoursWorked: 0,
					sessionsCount: 0,
					lastWorked: session.timeInAt,
				});
			}

			const branchStat = branchMap.get(session.branchId);
			branchStat.hoursWorked += duration / 60;
			branchStat.sessionsCount++;

			if (session.timeInAt.toDate() > branchStat.lastWorked.toDate()) {
				branchStat.lastWorked = session.timeInAt;
			}

			// This week stats
			if (sessionDate >= weekStart) {
				stats.thisWeek.hoursWorked += duration / 60;
				stats.thisWeek.sessionsCount++;
				thisWeekDates.add(dayKey);
			}

			// This month stats
			if (sessionDate >= monthStart) {
				stats.thisMonth.hoursWorked += duration / 60;
				stats.thisMonth.sessionsCount++;
				thisMonthDates.add(dayKey);
			}

			// Punctuality calculation (on-time if within 15 minutes of hour)
			const minutes = sessionDate.getMinutes();
			if (minutes <= 15 || minutes >= 45) {
				onTimeCount++;
			} else {
				// Calculate delay
				const delay = minutes <= 30 ? minutes : 60 - minutes;
				totalDelayMinutes += delay;
			}
		});

		// Set calculated values
		stats.thisWeek.daysWorked = thisWeekDates.size;
		stats.thisMonth.daysWorked = thisMonthDates.size;
		stats.branchStats = Array.from(branchMap.values());

		// Average session duration
		stats.averageSessionDuration =
			sessions.length > 0 ? totalMinutes / sessions.length : 0;

		// Punctuality score
		stats.attendance.punctualityScore =
			sessions.length > 0
				? Math.round((onTimeCount / sessions.length) * 100)
				: 0;

		// Average delay
		const lateSessionsCount = sessions.length - onTimeCount;
		stats.attendance.averageClockInDelay =
			lateSessionsCount > 0
				? Math.round(totalDelayMinutes / lateSessionsCount)
				: 0;

		// Calculate streaks
		const { currentStreak, longestStreak } = calculateStreaks(
			Array.from(workedDates).sort() as string[]
		);
		stats.currentStreak = currentStreak;
		stats.longestStreak = longestStreak;

		// Set last session
		if (sessions.length > 0) {
			const lastSession = sessions[0]; // Sessions are ordered by timeInAt desc
			stats.lastSession = {
				timeInAt: lastSession.timeInAt,
				timeOutAt: lastSession.timeOutAt,
				branchId: lastSession.branchId,
				duration: lastSession.duration,
			};
		}

		// Simple overtime calculation (anything over 8 hours per day)
		const dailyHours = new Map();
		sessions.forEach((session) => {
			const dayKey = session.timeInAt.toDate().toDateString();
			const duration = session.duration || 0;
			dailyHours.set(dayKey, (dailyHours.get(dayKey) || 0) + duration);
		});

		let totalOvertime = 0;
		let weekOvertime = 0;
		let monthOvertime = 0;

		dailyHours.forEach((minutes, dayKey) => {
			const hours = minutes / 60;
			const overtime = Math.max(0, hours - 8); // Overtime after 8 hours

			totalOvertime += overtime;

			const date = new Date(dayKey);
			if (date >= weekStart) {
				weekOvertime += overtime;
			}
			if (date >= monthStart) {
				monthOvertime += overtime;
			}
		});

		stats.overtime = {
			thisWeek: weekOvertime,
			thisMonth: monthOvertime,
			total: totalOvertime,
		};

		return stats;
	};

	const calculateStreaks = (
		sortedDateStrings: string[]
	): { currentStreak: number; longestStreak: number } => {
		if (sortedDateStrings.length === 0) {
			return { currentStreak: 0, longestStreak: 0 };
		}

		let currentStreak = 0;
		let longestStreak = 0;
		let tempStreak = 1;

		const today = new Date().toDateString();
		const yesterday = new Date(Date.now() - 24 * 60 * 60 * 1000).toDateString();

		// Calculate longest streak
		for (let i = 1; i < sortedDateStrings.length; i++) {
			const prevDate = new Date(sortedDateStrings[i - 1]);
			const currDate = new Date(sortedDateStrings[i]);
			const dayDiff = Math.abs(
				(currDate.getTime() - prevDate.getTime()) / (1000 * 60 * 60 * 24)
			);

			if (dayDiff === 1) {
				tempStreak++;
			} else {
				longestStreak = Math.max(longestStreak, tempStreak);
				tempStreak = 1;
			}
		}
		longestStreak = Math.max(longestStreak, tempStreak);

		// Calculate current streak (must include today or yesterday)
		const latestWorkDay = sortedDateStrings[sortedDateStrings.length - 1];
		if (latestWorkDay === today || latestWorkDay === yesterday) {
			let i = sortedDateStrings.length - 1;
			currentStreak = 1;

			while (i > 0) {
				const prevDate = new Date(sortedDateStrings[i - 1]);
				const currDate = new Date(sortedDateStrings[i]);
				const dayDiff = Math.abs(
					(currDate.getTime() - prevDate.getTime()) / (1000 * 60 * 60 * 24)
				);

				if (dayDiff === 1) {
					currentStreak++;
					i--;
				} else {
					break;
				}
			}
		}

		return { currentStreak, longestStreak };
	};

	const getBranchName = (branchId: string): string => {
		const branch = allBranches.find((b) => b.id === branchId);
		return branch ? branch.name : `Branch ${branchId}`;
	};

	const formatHours = (hours: number): string => {
		const wholeHours = Math.floor(hours);
		const minutes = Math.round((hours - wholeHours) * 60);
		if (wholeHours === 0) {
			return `${minutes}m`;
		}
		return minutes > 0 ? `${wholeHours}h ${minutes}m` : `${wholeHours}h`;
	};

	const getEfficiencyColor = (score: number): string => {
		if (score >= 90) return "text-green-600";
		if (score >= 70) return "text-yellow-600";
		return "text-red-600";
	};

	const getEfficiencyBg = (score: number): string => {
		if (score >= 90) return "bg-green-100";
		if (score >= 70) return "bg-yellow-100";
		return "bg-red-100";
	};

	if (loading) {
		return (
			<div className='bg-white rounded-lg shadow p-6'>
				<div className='flex items-center justify-between mb-6'>
					<h3 className='text-lg font-semibold text-gray-900'>
						Worker Statistics
					</h3>
					<div className='animate-spin rounded-full h-6 w-6 border-2 border-dashed border-blue-500'></div>
				</div>
				<div className='grid grid-cols-1 md:grid-cols-2 lg:grid-cols-4 gap-4'>
					{[...Array(8)].map((_, i) => (
						<div key={i} className='animate-pulse'>
							<div className='bg-gray-100 rounded-lg p-4'>
								<div className='h-4 bg-gray-300 rounded mb-2'></div>
								<div className='h-8 bg-gray-300 rounded'></div>
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
				<div className='flex items-center justify-between mb-6'>
					<h3 className='text-lg font-semibold text-gray-900'>
						Worker Statistics
					</h3>
					<button
						onClick={loadWorkerStats}
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

	if (!stats) {
		return null;
	}

	return (
		<div className='bg-white rounded-lg shadow'>
			{/* Header */}
			<div className='flex items-center justify-between p-6 border-b border-gray-200'>
				<div>
					<h3 className='text-lg font-semibold text-gray-900'>
						Worker Statistics
					</h3>
					<p className='text-sm text-gray-600 mt-1'>
						Performance metrics for {worker.name}
					</p>
				</div>
				<button
					onClick={loadWorkerStats}
					className='p-2 text-gray-400 hover:text-gray-600 rounded-lg hover:bg-gray-50'
					title='Refresh statistics'>
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

			{/* Overview Stats */}
			<div className='p-6'>
				<div className='grid grid-cols-1 md:grid-cols-2 lg:grid-cols-4 gap-4 mb-8'>
					{/* Total Hours */}
					<div className='bg-blue-50 border border-blue-200 rounded-lg p-4'>
						<div className='flex items-center justify-between'>
							<div>
								<p className='text-sm font-medium text-blue-800'>Total Hours</p>
								<p className='text-2xl font-bold text-blue-900'>
									{formatHours(stats.totalHoursWorked)}
								</p>
							</div>
							<div className='w-10 h-10 bg-blue-100 rounded-full flex items-center justify-center'>
								<svg
									className='w-5 h-5 text-blue-600'
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
						</div>
					</div>

					{/* Total Sessions */}
					<div className='bg-green-50 border border-green-200 rounded-lg p-4'>
						<div className='flex items-center justify-between'>
							<div>
								<p className='text-sm font-medium text-green-800'>
									Total Sessions
								</p>
								<p className='text-2xl font-bold text-green-900'>
									{stats.totalSessions}
								</p>
							</div>
							<div className='w-10 h-10 bg-green-100 rounded-full flex items-center justify-center'>
								<svg
									className='w-5 h-5 text-green-600'
									fill='none'
									stroke='currentColor'
									viewBox='0 0 24 24'>
									<path
										strokeLinecap='round'
										strokeLinejoin='round'
										strokeWidth={2}
										d='M9 5H7a2 2 0 00-2 2v10a2 2 0 002 2h8a2 2 0 002-2V7a2 2 0 00-2-2h-2M9 5a2 2 0 002 2h2a2 2 0 002-2M9 5a2 2 0 012-2h2a2 2 0 012 2'
									/>
								</svg>
							</div>
						</div>
					</div>

					{/* Average Session */}
					<div className='bg-purple-50 border border-purple-200 rounded-lg p-4'>
						<div className='flex items-center justify-between'>
							<div>
								<p className='text-sm font-medium text-purple-800'>
									Avg. Session
								</p>
								<p className='text-2xl font-bold text-purple-900'>
									{Math.round(stats.averageSessionDuration)}m
								</p>
							</div>
							<div className='w-10 h-10 bg-purple-100 rounded-full flex items-center justify-center'>
								<svg
									className='w-5 h-5 text-purple-600'
									fill='none'
									stroke='currentColor'
									viewBox='0 0 24 24'>
									<path
										strokeLinecap='round'
										strokeLinejoin='round'
										strokeWidth={2}
										d='M9 19v-6a2 2 0 00-2-2H5a2 2 0 00-2 2v6a2 2 0 002 2h2a2 2 0 002-2zm0 0V9a2 2 0 012-2h2a2 2 0 012 2v10m-6 0a2 2 0 002 2h2a2 2 0 002-2m0 0V5a2 2 0 012-2h2a2 2 0 012 2v14a2 2 0 01-2 2h-2a2 2 0 01-2-2z'
									/>
								</svg>
							</div>
						</div>
					</div>

					{/* Punctuality Score */}
					<div
						className={`${getEfficiencyBg(
							stats.attendance.punctualityScore
						)} border rounded-lg p-4`}>
						<div className='flex items-center justify-between'>
							<div>
								<p
									className={`text-sm font-medium ${getEfficiencyColor(
										stats.attendance.punctualityScore
									)}`}>
									Punctuality
								</p>
								<p
									className={`text-2xl font-bold ${getEfficiencyColor(
										stats.attendance.punctualityScore
									)}`}>
									{stats.attendance.punctualityScore}%
								</p>
							</div>
							<div
								className={`w-10 h-10 ${getEfficiencyBg(
									stats.attendance.punctualityScore
								)} rounded-full flex items-center justify-center`}>
								<svg
									className={`w-5 h-5 ${getEfficiencyColor(
										stats.attendance.punctualityScore
									)}`}
									fill='none'
									stroke='currentColor'
									viewBox='0 0 24 24'>
									<path
										strokeLinecap='round'
										strokeLinejoin='round'
										strokeWidth={2}
										d='M5 13l4 4L19 7'
									/>
								</svg>
							</div>
						</div>
					</div>
				</div>

				{/* Period Breakdown */}
				<div className='grid grid-cols-1 lg:grid-cols-2 gap-6 mb-8'>
					{/* This Week */}
					<div className='bg-gray-50 border border-gray-200 rounded-lg p-4'>
						<h4 className='font-semibold text-gray-900 mb-3'>This Week</h4>
						<div className='space-y-2'>
							<div className='flex justify-between'>
								<span className='text-gray-600'>Hours Worked:</span>
								<span className='font-semibold'>
									{formatHours(stats.thisWeek.hoursWorked)}
								</span>
							</div>
							<div className='flex justify-between'>
								<span className='text-gray-600'>Sessions:</span>
								<span className='font-semibold'>
									{stats.thisWeek.sessionsCount}
								</span>
							</div>
							<div className='flex justify-between'>
								<span className='text-gray-600'>Days Worked:</span>
								<span className='font-semibold'>
									{stats.thisWeek.daysWorked}
								</span>
							</div>
							{stats.overtime.thisWeek > 0 && (
								<div className='flex justify-between text-orange-600'>
									<span>Overtime:</span>
									<span className='font-semibold'>
										{formatHours(stats.overtime.thisWeek)}
									</span>
								</div>
							)}
						</div>
					</div>

					{/* This Month */}
					<div className='bg-gray-50 border border-gray-200 rounded-lg p-4'>
						<h4 className='font-semibold text-gray-900 mb-3'>This Month</h4>
						<div className='space-y-2'>
							<div className='flex justify-between'>
								<span className='text-gray-600'>Hours Worked:</span>
								<span className='font-semibold'>
									{formatHours(stats.thisMonth.hoursWorked)}
								</span>
							</div>
							<div className='flex justify-between'>
								<span className='text-gray-600'>Sessions:</span>
								<span className='font-semibold'>
									{stats.thisMonth.sessionsCount}
								</span>
							</div>
							<div className='flex justify-between'>
								<span className='text-gray-600'>Days Worked:</span>
								<span className='font-semibold'>
									{stats.thisMonth.daysWorked}
								</span>
							</div>
							{stats.overtime.thisMonth > 0 && (
								<div className='flex justify-between text-orange-600'>
									<span>Overtime:</span>
									<span className='font-semibold'>
										{formatHours(stats.overtime.thisMonth)}
									</span>
								</div>
							)}
						</div>
					</div>
				</div>

				{/* Branch Performance */}
				{stats.branchStats.length > 0 && (
					<div className='mb-6'>
						<h4 className='font-semibold text-gray-900 mb-4'>
							Performance by Branch
						</h4>
						<div className='space-y-3'>
							{stats.branchStats.map((branchStat) => (
								<div
									key={branchStat.branchId}
									className='flex items-center justify-between p-3 bg-gray-50 rounded-lg'>
									<div>
										<div className='font-medium text-gray-900'>
											{getBranchName(branchStat.branchId)}
										</div>
										<div className='text-sm text-gray-600'>
											Last worked:{" "}
											{branchStat.lastWorked
												? branchStat.lastWorked.toDate().toLocaleDateString()
												: "Never"}
										</div>
									</div>
									<div className='text-right'>
										<div className='font-semibold text-gray-900'>
											{formatHours(branchStat.hoursWorked)}
										</div>
										<div className='text-sm text-gray-600'>
											{branchStat.sessionsCount} sessions
										</div>
									</div>
								</div>
							))}
						</div>
					</div>
				)}

				{/* Last Session */}
				{stats.lastSession && (
					<div className='bg-blue-50 border border-blue-200 rounded-lg p-4'>
						<h4 className='font-semibold text-gray-900 mb-3'>Last Session</h4>
						<div className='grid grid-cols-2 gap-4 text-sm'>
							<div>
								<span className='text-gray-600'>Time In:</span>
								<div className='font-semibold'>
									{stats.lastSession.timeInAt.toDate().toLocaleString()}
								</div>
							</div>
							{stats.lastSession.timeOutAt && (
								<div>
									<span className='text-gray-600'>Time Out:</span>
									<div className='font-semibold'>
										{stats.lastSession.timeOutAt.toDate().toLocaleString()}
									</div>
								</div>
							)}
							<div>
								<span className='text-gray-600'>Branch:</span>
								<div className='font-semibold'>
									{getBranchName(stats.lastSession.branchId)}
								</div>
							</div>
							{stats.lastSession.duration && (
								<div>
									<span className='text-gray-600'>Duration:</span>
									<div className='font-semibold'>
										{Math.round(stats.lastSession.duration / 60)}h{" "}
										{stats.lastSession.duration % 60}m
									</div>
								</div>
							)}
						</div>
					</div>
				)}
			</div>
		</div>
	);
}
