import React, { useState, useEffect } from "react";
import { Worker } from "@/services/workerService";
import { workSessionService } from "@/services/workSessionService";
import { useAccessibleBranches } from "@/contexts/BranchContext";

interface WorkScheduleTarget {
	workerId: string;
	branchId: string;
	targetHoursPerWeek: number;
	targetHoursPerDay?: number;
	preferredShiftStart?: string; // HH:MM format
	preferredShiftEnd?: string; // HH:MM format
	workDays: number[]; // 0-6 (Sunday-Saturday)
	isActive: boolean;
	createdAt: Date;
	updatedAt: Date;
}

interface WorkScheduleManagementProps {
	workers: Worker[];
}

export default function WorkScheduleManagement({
	workers,
}: WorkScheduleManagementProps) {
	const [scheduleTargets, setScheduleTargets] = useState<WorkScheduleTarget[]>(
		[]
	);
	const [selectedWorker, setSelectedWorker] = useState<Worker | null>(null);
	const [isEditingSchedule, setIsEditingSchedule] = useState(false);
	const [currentTarget, setCurrentTarget] = useState<
		Partial<WorkScheduleTarget>
	>({
		targetHoursPerWeek: 40,
		workDays: [1, 2, 3, 4, 5], // Monday to Friday
		preferredShiftStart: "09:00",
		preferredShiftEnd: "17:00",
		isActive: true,
	});
	const [loading, setLoading] = useState(false);
	const [error, setError] = useState<string | null>(null);

	const { allBranches } = useAccessibleBranches();

	useEffect(() => {
		loadScheduleTargets();
	}, []);

	const loadScheduleTargets = async () => {
		try {
			setLoading(true);
			// In a real implementation, this would fetch from a scheduleTargetService
			// For now, we'll simulate with localStorage or empty array
			const stored = localStorage.getItem("workScheduleTargets");
			if (stored) {
				setScheduleTargets(JSON.parse(stored));
			}
		} catch (err: any) {
			console.error("Error loading schedule targets:", err);
			setError(err.message || "Failed to load schedule targets");
		} finally {
			setLoading(false);
		}
	};

	const saveScheduleTarget = async () => {
		if (!selectedWorker || !currentTarget.branchId) {
			setError("Please select a worker and branch");
			return;
		}

		try {
			setLoading(true);

			const newTarget: WorkScheduleTarget = {
				workerId: selectedWorker.id,
				branchId: currentTarget.branchId!,
				targetHoursPerWeek: currentTarget.targetHoursPerWeek || 40,
				targetHoursPerDay: currentTarget.targetHoursPerDay,
				preferredShiftStart: currentTarget.preferredShiftStart,
				preferredShiftEnd: currentTarget.preferredShiftEnd,
				workDays: currentTarget.workDays || [1, 2, 3, 4, 5],
				isActive: currentTarget.isActive !== false,
				createdAt: new Date(),
				updatedAt: new Date(),
			};

			// Update existing or add new
			const updatedTargets = scheduleTargets.filter(
				(t) =>
					!(
						t.workerId === selectedWorker.id &&
						t.branchId === currentTarget.branchId
					)
			);
			updatedTargets.push(newTarget);

			setScheduleTargets(updatedTargets);
			localStorage.setItem(
				"workScheduleTargets",
				JSON.stringify(updatedTargets)
			);

			// Reset form
			setIsEditingSchedule(false);
			setSelectedWorker(null);
			setCurrentTarget({
				targetHoursPerWeek: 40,
				workDays: [1, 2, 3, 4, 5],
				preferredShiftStart: "09:00",
				preferredShiftEnd: "17:00",
				isActive: true,
			});
		} catch (err: any) {
			console.error("Error saving schedule target:", err);
			setError(err.message || "Failed to save schedule target");
		} finally {
			setLoading(false);
		}
	};

	const deleteScheduleTarget = async (workerId: string, branchId: string) => {
		try {
			const updatedTargets = scheduleTargets.filter(
				(t) => !(t.workerId === workerId && t.branchId === branchId)
			);
			setScheduleTargets(updatedTargets);
			localStorage.setItem(
				"workScheduleTargets",
				JSON.stringify(updatedTargets)
			);
		} catch (err: any) {
			console.error("Error deleting schedule target:", err);
			setError(err.message || "Failed to delete schedule target");
		}
	};

	const editScheduleTarget = (target: WorkScheduleTarget) => {
		const worker = workers.find((w) => w.id === target.workerId);
		if (worker) {
			setSelectedWorker(worker);
			setCurrentTarget(target);
			setIsEditingSchedule(true);
		}
	};

	const calculateScheduleCompliance = async (target: WorkScheduleTarget) => {
		try {
			// Get work sessions for the past week
			const endDate = new Date();
			const startDate = new Date(endDate);
			startDate.setDate(startDate.getDate() - 7);

			const sessions =
				(await workSessionService.listWorkSessions(target.workerId, {
					startDate: startDate as any,
					endDate: endDate as any,
				})) || [];

			// Filter sessions for this branch
			const branchSessions = sessions.filter(
				(s) => s.branchId === target.branchId
			);

			// Calculate total hours worked
			const totalHours = branchSessions.reduce((sum, session) => {
				if (session.duration) {
					return sum + session.duration / 60;
				}
				if (session.timeInAt && session.timeOutAt) {
					const startTime = session.timeInAt.toDate
						? session.timeInAt.toDate()
						: (session.timeInAt as any).toDate
						? (session.timeInAt as any).toDate()
						: session.timeInAt;
					const endTime = session.timeOutAt.toDate
						? session.timeOutAt.toDate()
						: (session.timeOutAt as any).toDate
						? (session.timeOutAt as any).toDate()
						: session.timeOutAt;
					return (
						sum + (endTime.getTime() - startTime.getTime()) / (1000 * 60 * 60)
					);
				}
				return sum;
			}, 0);

			// Calculate compliance percentage
			const compliance =
				target.targetHoursPerWeek > 0
					? Math.round((totalHours / target.targetHoursPerWeek) * 100)
					: 0;

			return {
				actualHours: totalHours,
				targetHours: target.targetHoursPerWeek,
				compliance: Math.min(compliance, 100), // Cap at 100%
				sessionsCount: branchSessions.length,
			};
		} catch (err) {
			console.warn("Error calculating compliance for target:", err);
			return {
				actualHours: 0,
				targetHours: target.targetHoursPerWeek,
				compliance: 0,
				sessionsCount: 0,
			};
		}
	};

	const getDayName = (dayNumber: number): string => {
		const days = ["Sun", "Mon", "Tue", "Wed", "Thu", "Fri", "Sat"];
		return days[dayNumber] || "";
	};

	const getWorkerName = (workerId: string): string => {
		const worker = workers.find((w) => w.id === workerId);
		return worker ? worker.name : workerId;
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

	return (
		<div className='space-y-6'>
			{/* Header */}
			<div className='bg-white rounded-lg shadow p-6'>
				<div className='flex justify-between items-center'>
					<div>
						<h3 className='text-lg font-semibold text-gray-900'>
							Work Schedule Management
						</h3>
						<p className='text-sm text-gray-600 mt-1'>
							Set target hours and preferred schedules for workers
						</p>
					</div>
					<button
						onClick={() => setIsEditingSchedule(true)}
						className='bg-blue-600 text-white px-4 py-2 rounded-lg hover:bg-blue-700 transition-colors'>
						Add Schedule Target
					</button>
				</div>
			</div>

			{/* Schedule Targets List */}
			<div className='bg-white rounded-lg shadow'>
				<div className='p-6 border-b border-gray-200'>
					<h4 className='text-lg font-semibold text-gray-900'>
						Current Schedule Targets
					</h4>
				</div>

				{loading ? (
					<div className='p-8 text-center'>
						<div className='animate-spin rounded-full h-8 w-8 border-b-2 border-blue-600 mx-auto'></div>
						<p className='text-gray-600 text-sm mt-2'>
							Loading schedule targets...
						</p>
					</div>
				) : scheduleTargets.length === 0 ? (
					<div className='p-8 text-center'>
						<div className='w-12 h-12 bg-gray-100 rounded-full flex items-center justify-center mx-auto mb-4'>
							<svg
								className='w-6 h-6 text-gray-400'
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
						<h3 className='text-lg font-medium text-gray-900 mb-2'>
							No Schedule Targets
						</h3>
						<p className='text-gray-600 mb-4'>
							Create schedule targets to track worker performance against
							expected hours.
						</p>
						<button
							onClick={() => setIsEditingSchedule(true)}
							className='bg-blue-600 text-white px-4 py-2 rounded-lg hover:bg-blue-700 transition-colors'>
							Create First Target
						</button>
					</div>
				) : (
					<div className='divide-y divide-gray-200'>
						{scheduleTargets.map((target, index) => {
							// TODO: Extract to separate component to fix React hooks rule
							const [compliance, setCompliance] = useState<{
								compliance: number;
								actualHours: number;
								targetHours: number;
								sessionsCount: number;
							} | null>(null);

							React.useEffect(() => {
								calculateScheduleCompliance(target).then(setCompliance);
							}, [target]);

							return (
								<div key={index} className='p-6'>
									<div className='flex items-start justify-between'>
										<div className='flex-1'>
											<div className='flex items-center gap-3 mb-2'>
												<h5 className='font-semibold text-gray-900'>
													{getWorkerName(target.workerId)}
												</h5>
												<span className='text-sm bg-gray-100 text-gray-700 px-2 py-1 rounded'>
													{getBranchName(target.branchId)}
												</span>
												{!target.isActive && (
													<span className='text-sm bg-red-100 text-red-700 px-2 py-1 rounded'>
														Inactive
													</span>
												)}
											</div>

											<div className='grid grid-cols-1 md:grid-cols-3 gap-4 mb-3'>
												<div>
													<div className='text-sm text-gray-600'>
														Target Hours/Week
													</div>
													<div className='font-medium'>
														{target.targetHoursPerWeek}h
													</div>
												</div>

												{target.preferredShiftStart &&
													target.preferredShiftEnd && (
														<div>
															<div className='text-sm text-gray-600'>
																Preferred Hours
															</div>
															<div className='font-medium'>
																{target.preferredShiftStart} -{" "}
																{target.preferredShiftEnd}
															</div>
														</div>
													)}

												<div>
													<div className='text-sm text-gray-600'>Work Days</div>
													<div className='font-medium'>
														{target.workDays
															.map((day) => getDayName(day))
															.join(", ")}
													</div>
												</div>
											</div>

											{/* Compliance Status */}
											{compliance && (
												<div className='bg-gray-50 rounded-lg p-3'>
													<div className='flex items-center justify-between mb-2'>
														<span className='text-sm font-medium text-gray-700'>
															Weekly Compliance
														</span>
														<span
															className={`text-sm font-semibold ${
																compliance.compliance >= 90
																	? "text-green-600"
																	: compliance.compliance >= 70
																	? "text-yellow-600"
																	: "text-red-600"
															}`}>
															{compliance.compliance}%
														</span>
													</div>
													<div className='w-full bg-gray-200 rounded-full h-2 mb-2'>
														<div
															className={`h-2 rounded-full ${
																compliance.compliance >= 90
																	? "bg-green-500"
																	: compliance.compliance >= 70
																	? "bg-yellow-500"
																	: "bg-red-500"
															}`}
															style={{
																width: `${Math.min(
																	compliance.compliance,
																	100
																)}%`,
															}}></div>
													</div>
													<div className='text-xs text-gray-600'>
														{formatHours(compliance.actualHours)} of{" "}
														{formatHours(compliance.targetHours)} •{" "}
														{compliance.sessionsCount} sessions
													</div>
												</div>
											)}
										</div>

										<div className='flex items-center gap-2 ml-4'>
											<button
												onClick={() => editScheduleTarget(target)}
												className='text-blue-600 hover:text-blue-800 p-2 rounded-lg hover:bg-blue-50'
												title='Edit Schedule'>
												<svg
													className='w-4 h-4'
													fill='none'
													stroke='currentColor'
													viewBox='0 0 24 24'>
													<path
														strokeLinecap='round'
														strokeLinejoin='round'
														strokeWidth={2}
														d='M11 5H6a2 2 0 00-2 2v11a2 2 0 002 2h11a2 2 0 002-2v-5m-1.414-9.414a2 2 0 112.828 2.828L11.828 15H9v-2.828l8.586-8.586z'
													/>
												</svg>
											</button>
											<button
												onClick={() =>
													deleteScheduleTarget(target.workerId, target.branchId)
												}
												className='text-red-600 hover:text-red-800 p-2 rounded-lg hover:bg-red-50'
												title='Delete Schedule'>
												<svg
													className='w-4 h-4'
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
											</button>
										</div>
									</div>
								</div>
							);
						})}
					</div>
				)}
			</div>

			{/* Edit Schedule Modal */}
			{isEditingSchedule && (
				<div className='fixed inset-0 bg-black bg-opacity-50 flex items-center justify-center p-4 z-50'>
					<div className='bg-white rounded-lg max-w-md w-full max-h-[90vh] overflow-y-auto'>
						<div className='p-6 border-b border-gray-200'>
							<div className='flex justify-between items-center'>
								<h3 className='text-lg font-semibold text-gray-900'>
									{selectedWorker ? "Edit" : "Add"} Schedule Target
								</h3>
								<button
									onClick={() => {
										setIsEditingSchedule(false);
										setSelectedWorker(null);
										setError(null);
									}}
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

						<form
							onSubmit={(e) => {
								e.preventDefault();
								saveScheduleTarget();
							}}
							className='p-6 space-y-4'>
							{error && (
								<div className='bg-red-50 border border-red-200 rounded-md p-3'>
									<div className='text-sm text-red-800'>{error}</div>
								</div>
							)}

							{/* Worker Selection */}
							<div>
								<label className='block text-sm font-medium text-gray-700 mb-1'>
									Worker
								</label>
								<select
									value={selectedWorker?.id || ""}
									onChange={(e) => {
										const worker = workers.find((w) => w.id === e.target.value);
										setSelectedWorker(worker || null);
									}}
									className='w-full px-3 py-2 border border-gray-300 rounded-lg focus:outline-none focus:ring-2 focus:ring-blue-500'
									required>
									<option value=''>Select a worker</option>
									{workers.map((worker) => (
										<option key={worker.id} value={worker.id}>
											{worker.name} ({worker.email})
										</option>
									))}
								</select>
							</div>

							{/* Branch Selection */}
							{selectedWorker && (
								<div>
									<label className='block text-sm font-medium text-gray-700 mb-1'>
										Branch
									</label>
									<select
										value={currentTarget.branchId || ""}
										onChange={(e) =>
											setCurrentTarget({
												...currentTarget,
												branchId: e.target.value,
											})
										}
										className='w-full px-3 py-2 border border-gray-300 rounded-lg focus:outline-none focus:ring-2 focus:ring-blue-500'
										required>
										<option value=''>Select a branch</option>
										{selectedWorker.roleAssignments?.map((assignment) => {
											const branch = allBranches.find(
												(b) => b.id === assignment.branchId
											);
											return branch && assignment.isActive ? (
												<option key={branch.id} value={branch.id}>
													{branch.name}
												</option>
											) : null;
										})}
									</select>
								</div>
							)}

							{/* Target Hours */}
							<div>
								<label className='block text-sm font-medium text-gray-700 mb-1'>
									Target Hours per Week
								</label>
								<input
									type='number'
									min='1'
									max='80'
									value={currentTarget.targetHoursPerWeek || ""}
									onChange={(e) =>
										setCurrentTarget({
											...currentTarget,
											targetHoursPerWeek: parseInt(e.target.value) || 0,
										})
									}
									className='w-full px-3 py-2 border border-gray-300 rounded-lg focus:outline-none focus:ring-2 focus:ring-blue-500'
									required
								/>
							</div>

							{/* Preferred Shift Times */}
							<div className='grid grid-cols-2 gap-3'>
								<div>
									<label className='block text-sm font-medium text-gray-700 mb-1'>
										Shift Start
									</label>
									<input
										type='time'
										value={currentTarget.preferredShiftStart || ""}
										onChange={(e) =>
											setCurrentTarget({
												...currentTarget,
												preferredShiftStart: e.target.value,
											})
										}
										className='w-full px-3 py-2 border border-gray-300 rounded-lg focus:outline-none focus:ring-2 focus:ring-blue-500'
									/>
								</div>
								<div>
									<label className='block text-sm font-medium text-gray-700 mb-1'>
										Shift End
									</label>
									<input
										type='time'
										value={currentTarget.preferredShiftEnd || ""}
										onChange={(e) =>
											setCurrentTarget({
												...currentTarget,
												preferredShiftEnd: e.target.value,
											})
										}
										className='w-full px-3 py-2 border border-gray-300 rounded-lg focus:outline-none focus:ring-2 focus:ring-blue-500'
									/>
								</div>
							</div>

							{/* Work Days */}
							<div>
								<label className='block text-sm font-medium text-gray-700 mb-2'>
									Work Days
								</label>
								<div className='grid grid-cols-7 gap-1'>
									{["Sun", "Mon", "Tue", "Wed", "Thu", "Fri", "Sat"].map(
										(day, index) => (
											<label
												key={index}
												className='flex items-center justify-center p-2 border rounded cursor-pointer hover:bg-gray-50'>
												<input
													type='checkbox'
													checked={
														currentTarget.workDays?.includes(index) || false
													}
													onChange={(e) => {
														const workDays = currentTarget.workDays || [];
														if (e.target.checked) {
															setCurrentTarget({
																...currentTarget,
																workDays: [...workDays, index],
															});
														} else {
															setCurrentTarget({
																...currentTarget,
																workDays: workDays.filter((d) => d !== index),
															});
														}
													}}
													className='sr-only'
												/>
												<span
													className={`text-xs font-medium ${
														currentTarget.workDays?.includes(index)
															? "text-blue-600"
															: "text-gray-600"
													}`}>
													{day}
												</span>
											</label>
										)
									)}
								</div>
							</div>

							{/* Active Status */}
							<div className='flex items-center'>
								<input
									type='checkbox'
									id='isActive'
									checked={currentTarget.isActive !== false}
									onChange={(e) =>
										setCurrentTarget({
											...currentTarget,
											isActive: e.target.checked,
										})
									}
									className='rounded border-gray-300 text-blue-600 focus:ring-blue-500'
								/>
								<label
									htmlFor='isActive'
									className='ml-2 text-sm text-gray-700'>
									Active schedule target
								</label>
							</div>

							{/* Actions */}
							<div className='flex justify-end gap-3 pt-4'>
								<button
									type='button'
									onClick={() => {
										setIsEditingSchedule(false);
										setSelectedWorker(null);
										setError(null);
									}}
									className='px-4 py-2 text-gray-700 border border-gray-300 rounded-lg hover:bg-gray-50'>
									Cancel
								</button>
								<button
									type='submit'
									disabled={loading}
									className='px-4 py-2 bg-blue-600 text-white rounded-lg hover:bg-blue-700 disabled:opacity-50 disabled:cursor-not-allowed'>
									{loading ? "Saving..." : "Save Target"}
								</button>
							</div>
						</form>
					</div>
				</div>
			)}
		</div>
	);
}
