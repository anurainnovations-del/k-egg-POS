import React, { useState, useEffect } from "react";
import { useTimeTracking } from "@/contexts/TimeTrackingContext";
import { useBranch } from "@/contexts/BranchContext";
import ClockIcon from "@/components/icons/ClockIcon";

interface QuickTimeWidgetProps {
	currentBranchId?: string;
	className?: string;
	compact?: boolean;
}

export default function QuickTimeWidget({
	className = "",
	compact = false,
}: QuickTimeWidgetProps) {
	const {
		isWorking,
		workingDuration,
		clockIn,
		clockOut,
		loading,
		worker,
	} = useTimeTracking({ autoRefresh: true });
	const { currentBranch } = useBranch();
	const [time, setTime] = useState(new Date());

	useEffect(() => {
		const timer = setInterval(() => setTime(new Date()), 1000);
		return () => clearInterval(timer);
	}, []);

	const handleAction = async () => {
		if (loading) return;

		try {
			if (isWorking) {
				await clockOut("Clock-out from QuickWidget");
			} else {
				if (currentBranch?.id) {
					await clockIn(currentBranch.id, "Clock-in from QuickWidget");
				} else {
					alert("Please select a branch first");
				}
			}
		} catch (error: unknown) {
			console.error("Time tracking error:", error);
			const message = error instanceof Error ? error.message : "Time tracking failed";
			alert(message);
		}
	};

	const formatDuration = (mins: number) => {
		const hours = Math.floor(mins / 60);
		const m = mins % 60;
		return `${hours}h ${m}m`;
	};

	if (!worker || worker.isAdmin) return null;

	if (compact) {
		return (
			<button
				onClick={handleAction}
				disabled={loading}
				className={`flex items-center gap-3 px-4 py-2 rounded-xl transition-all active:scale-95 disabled:opacity-50 border ${
					isWorking 
						? "bg-green-50 text-green-700 border-green-200 hover:bg-green-100" 
						: "bg-[var(--accent)] text-[var(--secondary)] border-transparent hover:shadow-md"
				} ${className}`}
			>
				{loading ? (
					<div className="w-4 h-4 border-2 border-current border-t-transparent animate-spin rounded-full" />
				) : (
					<>
						<ClockIcon className="w-4 h-4" />
						<div className="flex flex-col items-start leading-tight">
							<span className="text-xs font-black uppercase">
								{isWorking ? "CLOCK OUT" : "CLOCK IN"}
							</span>
							{isWorking && (
								<span className="text-[10px] opacity-70 font-bold">
									{formatDuration(workingDuration)}
								</span>
							)}
						</div>
					</>
				)}
			</button>
		);
	}

	return (
		<div className={`bg-white rounded-2xl shadow-sm border border-gray-100 p-6 mb-6 ${className}`}>
			<div className="flex flex-col md:flex-row items-center justify-between gap-6">
				<div className="flex items-center gap-4">
					<div className={`w-16 h-16 rounded-2xl flex items-center justify-center transition-colors duration-500 ${
						isWorking ? "bg-green-100 text-green-600" : "bg-blue-100 text-blue-600"
					}`}>
						<ClockIcon className="w-8 h-8" />
					</div>
					<div>
						<h3 className="text-xl font-black text-[var(--secondary)]">
							{isWorking ? "On Duty" : "Off Duty"}
						</h3>
						<p className="text-sm text-gray-500 font-medium">
							{currentBranch?.name || "No branch selected"}
						</p>
					</div>
				</div>

				<div className="flex flex-col items-center md:items-end">
					<div className="text-3xl font-black text-[var(--secondary)] tabular-nums">
						{time.toLocaleTimeString([], { hour: '2-digit', minute: '2-digit', second: '2-digit' })}
					</div>
					<div className="text-xs text-gray-400 font-bold uppercase tracking-wider mt-1">
						Current Local Time
					</div>
				</div>

				<div className="flex items-center gap-4 w-full md:w-auto">
					{isWorking && (
						<div className="flex-1 md:flex-none text-center md:text-right px-6 py-2 bg-gray-50 rounded-xl border border-gray-100">
							<div className="text-xs text-gray-400 font-bold uppercase tracking-wider">Session Time</div>
							<div className="text-lg font-black text-[var(--secondary)]">
								{formatDuration(workingDuration)}
							</div>
						</div>
					)}
					
					<button
						onClick={handleAction}
						disabled={loading}
						className={`flex-1 md:flex-none px-8 py-4 rounded-2xl font-black text-sm shadow-md transition-all active:scale-95 disabled:opacity-50 ${
							isWorking 
								? "bg-orange-100 text-orange-600 hover:bg-orange-200" 
								: "bg-[var(--accent)] text-[var(--secondary)] hover:shadow-lg"
						}`}
					>
						{loading ? (
							<div className="w-5 h-5 border-2 border-current border-t-transparent animate-spin rounded-full mx-auto" />
						) : (
							isWorking ? "CLOCK OUT" : "CLOCK IN"
						)}
					</button>
				</div>
			</div>
		</div>
	);
}

