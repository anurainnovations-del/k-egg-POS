import React, { useState, useEffect, useCallback } from "react";
import { Worker } from "@/services/workerService";
import { workSessionService, WorkSession } from "@/services/workSessionService";
import { useAccessibleBranches } from "@/contexts/BranchContext";
import WorkerPerformanceAnalytics from "./WorkerPerformanceAnalytics";
import { Timestamp } from "firebase/firestore";

interface ReportFilters {
	dateRange: {
		startDate: Date;
		endDate: Date;
	};
	branchIds: string[];
	workerIds: string[];
	reportType: "summary" | "detailed" | "trends" | "comparative";
}

interface SummaryMetrics {
	totalWorkers: number;
	totalHours: number;
	averageHoursPerWorker: number;
	activeWorkers: number;
	branchCoverage: Array<{
		branchId: string;
		branchName: string;
		workerCount: number;
		totalHours: number;
		averageHours: number;
	}>;
	topPerformers: Array<{
		workerId: string;
		workerName: string;
		totalHours: number;
		sessionsCount: number;
		punctualityScore: number;
	}>;
	timeDistribution: Array<{
		hour: number;
		clockInsCount: number;
		clockOutsCount: number;
	}>;
}

interface AdvancedReportingProps {
	workers: Worker[];
}

export default function AdvancedReporting({ workers }: AdvancedReportingProps) {
	const [filters, setFilters] = useState<ReportFilters>({
		dateRange: {
			startDate: new Date(Date.now() - 30 * 24 * 60 * 60 * 1000), // 30 days ago
			endDate: new Date(),
		},
		branchIds: [],
		workerIds: [],
		reportType: "summary",
	});

	const [summaryMetrics, setSummaryMetrics] = useState<SummaryMetrics | null>(
		null
	);
	const [selectedWorker, setSelectedWorker] = useState<Worker | null>(null);
	const [loading, setLoading] = useState(false);
	const [error, setError] = useState<string | null>(null);
	const { allBranches } = useAccessibleBranches();

	const generateSummaryReport = useCallback(async () => {
		try {
			setLoading(true);
			setError(null);

			// Filter workers based on selected filters
			const filteredWorkers = workers.filter((worker) => {
				if (
					filters.workerIds.length > 0 &&
					!filters.workerIds.includes(worker.id)
				) {
					return false;
				}
				if (filters.branchIds.length > 0) {
					const hasAccessToBranch = filters.branchIds.some((branchId) =>
						worker.roleAssignments?.some((ra) => ra.branchId === branchId)
					);
					if (!hasAccessToBranch) return false;
				}
				return true;
			});

			// Collect all work sessions for filtered workers
			const allSessions = [];
			for (const worker of filteredWorkers) {
				try {
					const sessions =
						(await workSessionService.listWorkSessions(worker.id, {
							startDate: Timestamp.fromDate(filters.dateRange.startDate),
							endDate: Timestamp.fromDate(filters.dateRange.endDate),
						})) || [];

					allSessions.push(
						...sessions.map((session) => ({
							...session,
							workerId: worker.id,
							workerName: worker.name,
						}))
					);
				} catch (err) {
					console.warn(`Failed to load sessions for worker ${worker.id}:`, err);
				}
			}

			// Calculate summary metrics
			const metrics = calculateSummaryMetrics(filteredWorkers, allSessions);
			setSummaryMetrics(metrics);
		} catch (err: unknown) {
			console.error("Error generating summary report:", err);
			setError(err instanceof Error ? err.message : "Failed to generate report");
		} finally {
			setLoading(false);
		}
	}, [filters, workers, allBranches]);

	useEffect(() => {
		if (filters.reportType === "summary") {
			generateSummaryReport();
		}
	}, [filters, generateSummaryReport]);

	const calculateSummaryMetrics = useCallback((
		workers: Worker[],
		sessions: (WorkSession & { workerId: string; workerName: string })[]
	): SummaryMetrics => {
		const totalWorkers = workers.length;

		// Calculate total hours
		const totalHours = sessions.reduce((sum, session) => {
			if (session.duration) {
				return sum + session.duration / 60; // Convert minutes to hours
			}
			if (session.timeInAt && session.timeOutAt) {
				const startTime = session.timeInAt instanceof Timestamp 
					? session.timeInAt.toDate()
					: session.timeInAt;
				const endTime = session.timeOutAt instanceof Timestamp
					? session.timeOutAt.toDate()
					: session.timeOutAt;
				return (
					sum + (endTime.getTime() - startTime.getTime()) / (1000 * 60 * 60)
				);
			}
			return sum;
		}, 0);

		// Active workers (workers with sessions in date range)
		const activeWorkerIds = new Set(sessions.map((s) => s.workerId));
		const activeWorkers = activeWorkerIds.size;

		// Average hours per worker
		const averageHoursPerWorker =
			totalWorkers > 0 ? totalHours / totalWorkers : 0;

		// Branch coverage
		const branchCoverage = calculateBranchCoverage(sessions);

		// Top performers
		const topPerformers = calculateTopPerformers(workers, sessions);

		// Time distribution (hourly clock-ins/outs)
		const timeDistribution = calculateTimeDistribution(sessions);

		return {
			totalWorkers,
			totalHours,
			averageHoursPerWorker,
			activeWorkers,
			branchCoverage,
			topPerformers,
			timeDistribution,
		};
	}, [allBranches]);

	const calculateBranchCoverage = (sessions: (WorkSession & { workerId: string; workerName: string })[]) => {
		const branchMap = new Map();

		sessions.forEach((session) => {
			if (!branchMap.has(session.branchId)) {
				branchMap.set(session.branchId, {
					branchId: session.branchId,
					branchName: getBranchName(session.branchId),
					workerIds: new Set(),
					totalHours: 0,
					sessionsCount: 0,
				});
			}

			const branch = branchMap.get(session.branchId);
			branch.workerIds.add(session.workerId);
			branch.sessionsCount++;

			if (session.duration) {
				branch.totalHours += session.duration / 60;
			}
		});

		return Array.from(branchMap.values()).map((branch) => ({
			branchId: branch.branchId,
			branchName: branch.branchName,
			workerCount: branch.workerIds.size,
			totalHours: branch.totalHours,
			averageHours:
				branch.workerIds.size > 0
					? branch.totalHours / branch.workerIds.size
					: 0,
		}));
	};

	const calculateTopPerformers = (workers: Worker[], sessions: (WorkSession & { workerId: string; workerName: string })[]) => {
		const workerMap = new Map();

		// Initialize worker data
		workers.forEach((worker) => {
			workerMap.set(worker.id, {
				workerId: worker.id,
				workerName: worker.name,
				totalHours: 0,
				sessionsCount: 0,
				onTimeSessions: 0,
			});
		});

		// Aggregate session data
		sessions.forEach((session) => {
			const workerData = workerMap.get(session.workerId);
			if (workerData) {
				workerData.sessionsCount++;

				if (session.duration) {
					workerData.totalHours += session.duration / 60;
				}

				// Simple punctuality check (on-time if clocked in within 15 minutes of hour)
				if (session.timeInAt) {
					const startTime = session.timeInAt instanceof Timestamp
						? session.timeInAt.toDate()
						: session.timeInAt;
					const minutes = startTime.getMinutes();
					if (minutes <= 15 || minutes >= 45) {
						workerData.onTimeSessions++;
					}
				}
			}
		});

		return Array.from(workerMap.values())
			.map((worker) => ({
				...worker,
				punctualityScore:
					worker.sessionsCount > 0
						? Math.round((worker.onTimeSessions / worker.sessionsCount) * 100)
						: 0,
			}))
			.filter((worker) => worker.sessionsCount > 0)
			.sort((a, b) => b.totalHours - a.totalHours)
			.slice(0, 5);
	};

	const calculateTimeDistribution = (sessions: (WorkSession & { workerId: string; workerName: string })[]) => {
		const hourlyData = Array.from({ length: 24 }, (_, hour) => ({
			hour,
			clockInsCount: 0,
			clockOutsCount: 0,
		}));

		sessions.forEach((session) => {
			if (session.timeInAt) {
				const startTime = session.timeInAt instanceof Timestamp
					? session.timeInAt.toDate()
					: session.timeInAt;
				hourlyData[startTime.getHours()].clockInsCount++;
			}

			if (session.timeOutAt) {
				const endTime = session.timeOutAt instanceof Timestamp
					? session.timeOutAt.toDate()
					: session.timeOutAt;
				hourlyData[endTime.getHours()].clockOutsCount++;
			}
		});

		return hourlyData;
	};

	const getBranchName = (branchId: string): string => {
		const branch = allBranches.find((b) => b.id === branchId);
		return branch ? branch.name : branchId;
	};

	const formatHours = (hours: number): string => {
		const wholeHours = Math.floor(hours);
		const minutes = Math.round((hours - wholeHours) * 60);
		return wholeHours > 0 ? `${wholeHours}h ${minutes}m` : `${minutes}m`;
	};

	const formatTime = (hour: number): string => {
		const period = hour >= 12 ? "PM" : "AM";
		const displayHour = hour === 0 ? 12 : hour > 12 ? hour - 12 : hour;
		return `${displayHour} ${period}`;
	};

	const handleDateRangeChange = (
		field: "startDate" | "endDate",
		value: string
	) => {
		setFilters((prev) => ({
			...prev,
			dateRange: {
				...prev.dateRange,
				[field]: new Date(value),
			},
		}));
	};

	const handleBranchFilterChange = (branchId: string) => {
		setFilters((prev) => ({
			...prev,
			branchIds: prev.branchIds.includes(branchId)
				? prev.branchIds.filter((id) => id !== branchId)
				: [...prev.branchIds, branchId],
		}));
	};



	const exportReport = () => {
		if (!summaryMetrics) return;

		const csvData = [
			["Report Generated:", new Date().toLocaleString()],
			[
				"Date Range:",
				`${filters.dateRange.startDate.toLocaleDateString()} - ${filters.dateRange.endDate.toLocaleDateString()}`,
			],
			[""],
			["Summary Metrics"],
			["Total Workers", summaryMetrics.totalWorkers],
			["Active Workers", summaryMetrics.activeWorkers],
			["Total Hours", formatHours(summaryMetrics.totalHours)],
			[
				"Average Hours per Worker",
				formatHours(summaryMetrics.averageHoursPerWorker),
			],
			[""],
			["Top Performers"],
			["Name", "Hours", "Sessions", "Punctuality"],
			...summaryMetrics.topPerformers.map((p) => [
				p.workerName,
				formatHours(p.totalHours),
				p.sessionsCount,
				`${p.punctualityScore}%`,
			]),
		];

		const csvContent = csvData.map((row) => row.join(",")).join("\n");
		const blob = new Blob([csvContent], { type: "text/csv" });
		const url = URL.createObjectURL(blob);
		const link = document.createElement("a");
		link.href = url;
		link.download = `worker-report-${
			new Date().toISOString().split("T")[0]
		}.csv`;
		document.body.appendChild(link);
		link.click();
		document.body.removeChild(link);
		URL.revokeObjectURL(url);
	};

	return (
		<div className='space-y-6'>
			{/* Filter Panel */}
			<div className='bg-white rounded-lg shadow p-6'>
				<h3 className='text-lg font-semibold text-gray-900 mb-4'>
					Report Filters
				</h3>

				<div className='grid grid-cols-1 md:grid-cols-2 lg:grid-cols-4 gap-4'>
					{/* Date Range */}
					<div>
						<label className='block text-sm font-medium text-gray-700 mb-1'>
							Start Date
						</label>
						<input
							type='date'
							value={filters.dateRange.startDate.toISOString().split("T")[0]}
							onChange={(e) =>
								handleDateRangeChange("startDate", e.target.value)
							}
							className='w-full px-3 py-2 border border-gray-300 rounded-lg focus:outline-none focus:ring-2 focus:ring-blue-500'
						/>
					</div>

					<div>
						<label className='block text-sm font-medium text-gray-700 mb-1'>
							End Date
						</label>
						<input
							type='date'
							value={filters.dateRange.endDate.toISOString().split("T")[0]}
							onChange={(e) => handleDateRangeChange("endDate", e.target.value)}
							className='w-full px-3 py-2 border border-gray-300 rounded-lg focus:outline-none focus:ring-2 focus:ring-blue-500'
						/>
					</div>

					{/* Report Type */}
					<div>
						<label className='block text-sm font-medium text-gray-700 mb-1'>
							Report Type
						</label>
						<select
							value={filters.reportType}
							onChange={(e) =>
								setFilters((prev) => ({
									...prev,
									reportType: e.target.value as ReportFilters["reportType"],
								}))
							}
							className='w-full px-3 py-2 border border-gray-300 rounded-lg focus:outline-none focus:ring-2 focus:ring-blue-500'>
							<option value='summary'>Summary</option>
							<option value='detailed'>Detailed</option>
							<option value='trends'>Trends</option>
							<option value='comparative'>Comparative</option>
						</select>
					</div>

					{/* Actions */}
					<div className='flex items-end'>
						<button
							onClick={exportReport}
							disabled={!summaryMetrics}
							className='w-full px-4 py-2 bg-green-600 text-white rounded-lg hover:bg-green-700 disabled:opacity-50 disabled:cursor-not-allowed'>
							Export CSV
						</button>
					</div>
				</div>

				{/* Branch Filters */}
				{allBranches.length > 0 && (
					<div className='mt-4'>
						<label className='block text-sm font-medium text-gray-700 mb-2'>
							Filter by Branches
						</label>
						<div className='flex flex-wrap gap-2'>
							{allBranches.map((branch) => (
								<label key={branch.id} className='inline-flex items-center'>
									<input
										type='checkbox'
										checked={filters.branchIds.includes(branch.id)}
										onChange={() => handleBranchFilterChange(branch.id)}
										className='rounded border-gray-300 text-blue-600 focus:ring-blue-500'
									/>
									<span className='ml-2 text-sm text-gray-700'>
										{branch.name}
									</span>
								</label>
							))}
						</div>
					</div>
				)}
			</div>

			{/* Report Content */}
			{filters.reportType === "summary" && (
				<div className='space-y-6'>
					{loading ? (
						<div className='bg-white rounded-lg shadow p-6'>
							<div className='text-center py-8'>
								<div className='animate-spin rounded-full h-8 w-8 border-b-2 border-blue-600 mx-auto'></div>
								<p className='text-gray-600 text-sm mt-2'>
									Generating report...
								</p>
							</div>
						</div>
					) : error ? (
						<div className='bg-white rounded-lg shadow p-6'>
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
								<button
									onClick={generateSummaryReport}
									className='mt-3 text-blue-600 hover:text-blue-800 text-sm font-medium'>
									Retry
								</button>
							</div>
						</div>
					) : (
						summaryMetrics && (
							<>
								{/* Summary Cards */}
								<div className='grid grid-cols-1 md:grid-cols-4 gap-4'>
									<div className='bg-white rounded-lg shadow p-6'>
										<h4 className='text-sm font-medium text-gray-600'>
											Total Workers
										</h4>
										<p className='text-3xl font-bold text-gray-900'>
											{summaryMetrics.totalWorkers}
										</p>
										<p className='text-sm text-green-600'>
											{summaryMetrics.activeWorkers} active
										</p>
									</div>
									<div className='bg-white rounded-lg shadow p-6'>
										<h4 className='text-sm font-medium text-gray-600'>
											Total Hours
										</h4>
										<p className='text-3xl font-bold text-gray-900'>
											{formatHours(summaryMetrics.totalHours)}
										</p>
									</div>
									<div className='bg-white rounded-lg shadow p-6'>
										<h4 className='text-sm font-medium text-gray-600'>
											Average Hours
										</h4>
										<p className='text-3xl font-bold text-gray-900'>
											{formatHours(summaryMetrics.averageHoursPerWorker)}
										</p>
										<p className='text-sm text-gray-600'>per worker</p>
									</div>
									<div className='bg-white rounded-lg shadow p-6'>
										<h4 className='text-sm font-medium text-gray-600'>
											Branch Coverage
										</h4>
										<p className='text-3xl font-bold text-gray-900'>
											{summaryMetrics.branchCoverage.length}
										</p>
										<p className='text-sm text-gray-600'>branches active</p>
									</div>
								</div>

								{/* Top Performers */}
								{summaryMetrics.topPerformers.length > 0 && (
									<div className='bg-white rounded-lg shadow'>
										<div className='p-6 border-b border-gray-200'>
											<h4 className='text-lg font-semibold text-gray-900'>
												Top Performers
											</h4>
										</div>
										<div className='p-6'>
											<div className='space-y-4'>
												{summaryMetrics.topPerformers.map(
													(performer, index) => (
														<div
															key={performer.workerId}
															className='flex items-center justify-between p-4 bg-gray-50 rounded-lg'>
															<div className='flex items-center'>
																<div className='w-8 h-8 bg-blue-100 rounded-full flex items-center justify-center mr-3'>
																	<span className='text-sm font-bold text-blue-600'>
																		#{index + 1}
																	</span>
																</div>
																<div>
																	<div className='font-medium text-gray-900'>
																		{performer.workerName}
																	</div>
																	<div className='text-sm text-gray-600'>
																		{performer.sessionsCount} sessions •{" "}
																		{performer.punctualityScore}% punctuality
																	</div>
																</div>
															</div>
															<div className='text-right'>
																<div className='font-semibold text-gray-900'>
																	{formatHours(performer.totalHours)}
																</div>
																<button
																	onClick={() => {
																		const worker = workers.find(
																			(w) => w.id === performer.workerId
																		);
																		if (worker) setSelectedWorker(worker);
																	}}
																	className='text-sm text-blue-600 hover:text-blue-800'>
																	View Details
																</button>
															</div>
														</div>
													)
												)}
											</div>
										</div>
									</div>
								)}

								{/* Branch Performance */}
								{summaryMetrics.branchCoverage.length > 0 && (
									<div className='bg-white rounded-lg shadow'>
										<div className='p-6 border-b border-gray-200'>
											<h4 className='text-lg font-semibold text-gray-900'>
												Branch Performance
											</h4>
										</div>
										<div className='p-6'>
											<div className='space-y-4'>
												{summaryMetrics.branchCoverage.map((branch) => (
													<div
														key={branch.branchId}
														className='flex items-center justify-between p-4 bg-gray-50 rounded-lg'>
														<div>
															<div className='font-medium text-gray-900'>
																{branch.branchName}
															</div>
															<div className='text-sm text-gray-600'>
																{branch.workerCount} workers •{" "}
																{formatHours(branch.averageHours)} avg per
																worker
															</div>
														</div>
														<div className='text-right'>
															<div className='font-semibold text-gray-900'>
																{formatHours(branch.totalHours)}
															</div>
														</div>
													</div>
												))}
											</div>
										</div>
									</div>
								)}

								{/* Time Distribution Chart */}
								<div className='bg-white rounded-lg shadow'>
									<div className='p-6 border-b border-gray-200'>
										<h4 className='text-lg font-semibold text-gray-900'>
											Hourly Activity Distribution
										</h4>
									</div>
									<div className='p-6'>
										<div className='grid grid-cols-12 gap-2'>
											{summaryMetrics.timeDistribution.map((hourData) => {
												const maxActivity = Math.max(
													...summaryMetrics.timeDistribution.map(
														(h) => h.clockInsCount + h.clockOutsCount
													)
												);
												const activityHeight =
													maxActivity > 0
														? ((hourData.clockInsCount +
																hourData.clockOutsCount) /
																maxActivity) *
														  100
														: 0;

												return (
													<div key={hourData.hour} className='text-center'>
														<div className='h-20 flex items-end justify-center mb-2'>
															<div
																className='w-full bg-blue-200 rounded-t'
																style={{
																	height: `${Math.max(activityHeight, 2)}%`,
																}}
																title={`${formatTime(hourData.hour)}: ${
																	hourData.clockInsCount
																} clock-ins, ${
																	hourData.clockOutsCount
																} clock-outs`}></div>
														</div>
														<div className='text-xs text-gray-600'>
															{formatTime(hourData.hour)}
														</div>
														<div className='text-xs text-gray-500'>
															{hourData.clockInsCount + hourData.clockOutsCount}
														</div>
													</div>
												);
											})}
										</div>
									</div>
								</div>
							</>
						)
					)}
				</div>
			)}

			{/* Worker Detail Modal */}
			{selectedWorker && (
				<div className='fixed inset-0 bg-black bg-opacity-50 flex items-center justify-center p-4 z-50'>
					<div className='bg-white rounded-lg max-w-4xl w-full max-h-[90vh] overflow-y-auto'>
						<div className='p-6 border-b border-gray-200'>
							<div className='flex justify-between items-center'>
								<h3 className='text-lg font-semibold text-gray-900'>
									Performance Details: {selectedWorker.name}
								</h3>
								<button
									onClick={() => setSelectedWorker(null)}
									className='text-gray-400 hover:text-gray-600'>
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
						</div>
						<div className='p-6'>
							<WorkerPerformanceAnalytics
								worker={selectedWorker}
								dateRange={filters.dateRange}
							/>
						</div>
					</div>
				</div>
			)}
		</div>
	);
}
