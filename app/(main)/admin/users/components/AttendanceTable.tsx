import React, { useState, useEffect } from "react";
import { workSessionService, WorkSession } from "@/services/workSessionService";
import { Worker } from "@/services/workerService";
import { Branch } from "@/services/branchService";
import TableHeader from "./TableHeader";
import { Timestamp } from "firebase/firestore";

interface AttendanceTableProps {
	branchId: string;
	workers: Worker[];
	branches: Branch[];
	loading?: boolean;
}

export default function AttendanceTable({
	branchId,
	workers,
	branches,
	loading: parentLoading = false,
}: AttendanceTableProps) {
	const [sessions, setSessions] = useState<(WorkSession & { id: string })[]>([]);
	const [loading, setLoading] = useState(true);
	const [dateRange, setDateRange] = useState({
		start: new Date(new Date().setHours(0, 0, 0, 0)),
		end: new Date(new Date().setHours(23, 59, 59, 999)),
	});
	const loadSessions = React.useCallback(async () => {
		try {
			setLoading(true);

			const range = {
				startDate: Timestamp.fromDate(dateRange.start),
				endDate: Timestamp.fromDate(dateRange.end),
			};

			const sessionsData = branchId 
				? await workSessionService.getBranchWorkSessions(branchId, range)
				: await workSessionService.getAllWorkSessions(range);
			
			setSessions(sessionsData as (WorkSession & { id: string })[]);
		} catch (err: unknown) {
			console.error("Error loading attendance sessions:", err);
		} finally {
			setLoading(false);
		}
	}, [branchId, dateRange]);

	useEffect(() => {
		loadSessions();
	}, [loadSessions]);

	const getWorkerName = (userId: string) => {
		const worker = workers.find((w) => w.id === userId);
		return worker?.name || "Unknown Worker";
	};

	const formatTime = (timestamp?: Timestamp) => {
		if (!timestamp) return "-";
		const date = timestamp.toDate();
		return date.toLocaleTimeString([], { hour: '2-digit', minute: '2-digit' });
	};

	const formatDate = (timestamp: Timestamp) => {
		const date = timestamp.toDate();
		return date.toLocaleDateString([], { month: 'short', day: 'numeric', year: 'numeric' });
	};

	const calculateDuration = (minutes?: number) => {
		if (minutes === undefined) return "-";
		const hours = Math.floor(minutes / 60);
		const mins = minutes % 60;
		if (hours > 0) return `${hours}h ${mins}m`;
		return `${mins}m`;
	};

	const getBranchName = (branchId: string) => {
		const branch = branches.find((b) => b.id === branchId);
		return branch?.name || branchId;
	};

	if (loading || parentLoading) {
		return (
			<div className='bg-white rounded-xl shadow-sm border border-gray-200 overflow-hidden'>
				<div className='p-6 border-b border-gray-100 flex justify-between items-center'>
					<div className="h-6 w-32 bg-gray-100 animate-pulse rounded"></div>
					<div className="h-10 w-48 bg-gray-100 animate-pulse rounded-lg"></div>
				</div>
				<div className='animate-pulse'>
					{[1, 2, 3, 4, 5].map((i) => (
						<div key={i} className='px-6 py-4 border-b border-gray-200 flex space-x-4'>
							{[1, 2, 3, 4, 5].map((j) => (
								<div key={j} className='h-4 bg-gray-200 rounded flex-1'></div>
							))}
						</div>
					))}
				</div>
			</div>
		);
	}

	return (
		<div className='bg-white rounded-xl shadow-sm border border-gray-200 overflow-hidden'>
			<div className='p-6 border-b border-gray-100 flex flex-col sm:flex-row justify-between items-start sm:items-center gap-4'>
				<div>
					<h3 className="text-lg font-bold text-[var(--secondary)]">Attendance Logs</h3>
					<p className="text-sm text-gray-500">View and track worker shift history</p>
				</div>
				
				<div className="flex gap-2">
					<input 
						type="date" 
						value={dateRange.start.toISOString().split('T')[0]}
						onChange={(e) => setDateRange(prev => ({ ...prev, start: new Date(e.target.value) }))}
						className="px-3 py-2 border border-gray-200 rounded-lg text-sm focus:ring-2 focus:ring-[var(--accent)] outline-none"
					/>
					<span className="self-center text-gray-400">to</span>
					<input 
						type="date" 
						value={dateRange.end.toISOString().split('T')[0]}
						onChange={(e) => setDateRange(prev => ({ ...prev, end: new Date(e.target.value) }))}
						className="px-3 py-2 border border-gray-200 rounded-lg text-sm focus:ring-2 focus:ring-[var(--accent)] outline-none"
					/>
				</div>
			</div>

			<div className='overflow-x-auto'>
				<table className='min-w-full divide-y divide-gray-200'>
					<TableHeader
						columns={[
							{ key: "worker", label: "Worker", sortable: false },
							{ key: "date", label: "Date", sortable: false },
							{ key: "timeIn", label: "Clock In", sortable: false },
							{ key: "timeOut", label: "Clock Out", sortable: false },
							{ key: "duration", label: "Duration", sortable: false },
							!branchId ? { key: "branch", label: "Branch", sortable: false } : null,
							{ key: "type", label: "Type", sortable: false },
						].filter((c): c is { key: string; label: string; sortable: boolean } => c !== null)}
					/>
					<tbody className='bg-white divide-y divide-gray-200'>
						{sessions.length === 0 ? (
							<tr>
								<td colSpan={6} className="px-6 py-12 text-center text-gray-500">
									<div className="text-4xl mb-2">📅</div>
									No attendance logs found for this period.
								</td>
							</tr>
						) : (
							sessions.map((session, index) => (
								<tr key={index} className="hover:bg-gray-50 transition-colors">
									<td className='px-6 py-4 whitespace-nowrap'>
										<div className="flex items-center">
											<div className="w-8 h-8 rounded-full bg-[var(--accent)] text-[var(--secondary)] flex items-center justify-center font-bold text-xs mr-3">
												{getWorkerName(session.userId).charAt(0)}
											</div>
											<span className="font-medium text-gray-900">{getWorkerName(session.userId)}</span>
										</div>
									</td>
									<td className='px-6 py-4 whitespace-nowrap text-sm text-gray-600'>
										{formatDate(session.timeInAt)}
									</td>
									<td className='px-6 py-4 whitespace-nowrap text-sm'>
										<span className="px-2 py-1 bg-green-50 text-green-700 rounded-md font-medium">
											{formatTime(session.timeInAt)}
										</span>
									</td>
									<td className='px-6 py-4 whitespace-nowrap text-sm'>
										{session.timeOutAt ? (
											<span className="px-2 py-1 bg-orange-50 text-orange-700 rounded-md font-medium">
												{formatTime(session.timeOutAt)}
											</span>
										) : (
											<span className="px-2 py-1 bg-blue-50 text-blue-700 rounded-md font-medium animate-pulse">
												Active Now
											</span>
										)}
									</td>
									<td className='px-6 py-4 whitespace-nowrap text-sm font-bold text-gray-900'>
										{calculateDuration(session.duration)}
									</td>
									{!branchId && (
										<td className='px-6 py-4 whitespace-nowrap text-sm text-gray-600'>
											{getBranchName(session.branchId)}
										</td>
									)}
									<td className='px-6 py-4 whitespace-nowrap'>
										<span className={`px-2 py-1 rounded-full text-[10px] font-bold uppercase ${
											session.sessionType === 'overtime' ? 'bg-purple-100 text-purple-700' :
											session.sessionType === 'emergency' ? 'bg-red-100 text-red-700' :
											'bg-gray-100 text-gray-600'
										}`}>
											{session.sessionType}
										</span>
									</td>
								</tr>
							))
						)}
					</tbody>
				</table>
			</div>
		</div>
	);
}
