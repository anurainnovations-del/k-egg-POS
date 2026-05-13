"use client";

import MenuBurger from "@/components/icons/MenuBurger";
import UserIcon from "@/components/icons/UserIcon";
import CalendarIcon from "@/components/icons/CalendarIcon";
import ClockIcon from "@/components/icons/ClockIcon";
import RefreshIcon from "@/components/icons/RefreshIcon";
import OrderCartIcon from "@/app/(main)/[branchId]/(worker)/store/icons/OrderCartIcon";
import TextLogo from "@/components/icons/TextLogo";
import { useDrawer } from "@/components/Drawer";
import { useDateTime } from "@/contexts/DateTimeContext";
import { useAuth } from "@/contexts/AuthContext";
import LoadingSpinner from "@/components/LoadingSpinner";
import { useState } from "react";
import { useTimeTracking } from "@/contexts/TimeTrackingContext";
import { useBranch } from "@/contexts/BranchContext";

interface MobileTopBarProps {
	title?: string;
	icon?: React.ReactNode;
	showTimeTracking?: boolean;
	onOrderClick?: () => void;
}

export default function MobileTopBar({
	title,
	icon,
	showTimeTracking = true,
	onOrderClick,
}: MobileTopBarProps) {
	const { toggle: toggleDrawer } = useDrawer();
	const { date, time, isInternetTime, isLoading, forceSync } = useDateTime();
	const { user, isUserAdmin } = useAuth();
	const { currentBranch } = useBranch();
	const [isRefreshing, setIsRefreshing] = useState(false);
	const [isTimeTracking, setIsTimeTracking] = useState(false);
	const timeTracking = useTimeTracking({ autoRefresh: showTimeTracking });

	const handleRefresh = async () => {
		if (isRefreshing) return;

		setIsRefreshing(true);
		try {
			await forceSync();
		} catch (error) {
			console.error("Failed to refresh time:", error);
		} finally {
			setIsRefreshing(false);
		}
	};

	const userDisplayName = user?.email?.split("@")[0] || "Worker";

	const handleTimeTrackingClick = async () => {
		const isExemptAdmin = timeTracking.worker?.isAdmin;

		if (!timeTracking.worker || isExemptAdmin || isTimeTracking) return;

		setIsTimeTracking(true);
		try {
			if (timeTracking.isWorking) {
				await timeTracking.clockOut("Clock-out from TopBar");
			} else {
				const branchId =
					currentBranch?.id || timeTracking.worker.roleAssignments[0]?.branchId;
				if (!branchId) {
					alert("No branch selected for time tracking");
					return;
				}
				await timeTracking.clockIn(branchId, "Clock-in from TopBar");
			}
		} catch (error: unknown) {
			const message =
				error instanceof Error ? error.message : "Time tracking failed";
			alert(message);
		} finally {
			setIsTimeTracking(false);
		}
	};

	return (
		<div className='flex-shrink-0 w-full'>
			<div className='flex items-center justify-between h-[70px] px-4 '>
				<button
					onClick={toggleDrawer}
					className='h-12 w-12 bg-[var(--accent)] xl:bg-[var(--primary)] rounded-xl flex justify-center items-center opacity-100 hover:opacity-50 transition-all cursor-pointer'>
					<MenuBurger className="text-[var(--primary)]"/>
				</button>
				<div className='flex-1 flex justify-center'>
					<div className='items-center justify-center rounded-[100px] bg-[var(--accent)] pt-3 pb-2 '>
						<TextLogo className='h-5 items-center' />
					</div>
				</div>{" "}
				{onOrderClick ? (
					<button
						onClick={onOrderClick}
						className='h-12 w-12 bg-[var(--accent)] xl:bg-[var(--primary)] rounded-xl flex justify-center items-center opacity-100 hover:opacity-50 transition-all cursor-pointer'>
						<OrderCartIcon className="h-6 w-6 text-[var(--primary)]" />
					</button>
				) :
					<div className='h-12 w-12' />
				}
			</div>
			<div className='flex items-center gap-3 px-4 py-2 overflow-x-auto'>
				<div className='flex-1 h-12 px-3 py-2 flex bg-[var(--primary)] rounded-xl text-[var(--secondary)] gap-2 items-center font-medium text-xs'>
					<span className='w-7 h-7 bg-[var(--light-accent)] rounded-full flex items-center justify-center text-[var(--secondary)]'>
						<UserIcon />
					</span>
					<span>{userDisplayName}</span>
				</div>

				{isUserAdmin() && (
					<div className='flex-1 h-12 px-3 py-2 flex bg-[var(--primary)] rounded-xl text-[var(--secondary)] gap-2 items-center font-medium text-xs'>
						<span className='w-7 h-7 bg-[var(--light-accent)] rounded-full flex items-center justify-center text-[var(--secondary)] text-xs font-bold'>
							A
						</span>
						<span>Admin</span>
					</div>
				)}

				{showTimeTracking &&
					timeTracking.worker &&
					!timeTracking.worker.isAdmin && (
						<button
							onClick={handleTimeTrackingClick}
							disabled={isTimeTracking}
							className={`flex-1 h-12 px-3 py-2 flex rounded-xl gap-2 items-center font-medium text-xs transition-all duration-200 cursor-pointer group ${
								timeTracking.isWorking
									? "bg-green-100 text-green-800 border-2 border-green-300"
									: "bg-blue-100 text-blue-800 border-2 border-blue-300"
							} ${isTimeTracking ? "opacity-50" : "hover:scale-105"}`}>
							<span
								className={`w-7 h-7 rounded-full flex items-center justify-center text-xs font-bold ${
									timeTracking.isWorking
										? "bg-green-300 text-green-800"
										: "bg-blue-300 text-blue-800"
								}`}>
								{isTimeTracking ? (
									<div className='animate-spin rounded-full h-3 w-3 border-2 border-current border-t-transparent' />
								) : timeTracking.isWorking ? (
									""
								) : (
									""
								)}
							</span>
							<span className='font-semibold'>
								{timeTracking.isWorking ? "Working" : "Off"}
							</span>
						</button>
					)}

				<div className='flex-1 h-12 px-3 py-2 flex bg-[var(--primary)] rounded-xl text-[var(--secondary)] gap-2 items-center font-medium text-xs'>
					<span className='w-7 h-7 bg-[var(--light-accent)] rounded-full flex items-center justify-center'>
						<CalendarIcon />
					</span>
					<div className='flex flex-col items-start'>
						{isLoading && !date ? (
							<LoadingSpinner size='sm' />
						) : (
							<>
								<span className="truncate">{date}</span>
								{!isInternetTime && date && (
									<span className='text-[10px] opacity-70'>(Local)</span>
								)}
							</>
						)}
					</div>
				</div>

				<div className='flex-1 h-12 px-3 py-2 flex bg-[var(--primary)] rounded-xl text-[var(--secondary)] gap-3 items-center font-medium text-xs'>
					<span className='w-7 h-7 bg-[var(--light-accent)] rounded-full flex items-center justify-center flex-shrink-0'>
						<ClockIcon />
					</span>
					<div className='flex flex-row items-center gap-2'>
						{isLoading && !time ? (
							<LoadingSpinner size='sm' />
						) : (
							<>
								{!isInternetTime && time ? (
									<span className='bg-[var(--error)]/20 size-3 border-2 border-[var(--error)] border-dashed rounded-full shadow-sm animate-spin' />
								) : (
									<span className='bg-[var(--success)]/20 size-3 border-2 border-[var(--success)] border-dashed rounded-full shadow-sm animate-spin' />
								)}
								<span className='truncate animate-pulse'>{time}</span>
							</>
						)}
					</div>
					<button
						onClick={handleRefresh}
						disabled={isRefreshing}
						className='ml-auto p-1 hover:bg-[var(--light-accent)] rounded-full transition-colors disabled:opacity-50 flex-shrink-0'>
						<RefreshIcon
							className='w-3 h-3 text-[var(--secondary)]'
							isSpinning={isRefreshing}
						/>
					</button>
				</div>
			</div>{" "}
			{title && (
				<div className='flex items-center justify-start px-4 py-2'>
					{icon && <div className='mr-2'>{icon}</div>}
					<h1 className='text-[var(--secondary)] text-xl font-bold'>{title}</h1>
				</div>
			)}
		</div>
	);
}
