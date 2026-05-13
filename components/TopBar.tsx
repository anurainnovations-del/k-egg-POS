"use client";

import UserIcon from "@/components/icons/UserIcon";
import CalendarIcon from "@/components/icons/CalendarIcon";
import ClockIcon from "@/components/icons/ClockIcon";
import RefreshIcon from "@/components/icons/RefreshIcon";
import { useDrawer } from "@/components/Drawer";
import { useDateTime } from "@/contexts/DateTimeContext";
import { useAuth } from "@/contexts/AuthContext";
import LoadingSpinner from "@/components/LoadingSpinner";
import { useState } from "react";
import { useTimeTracking } from "@/contexts/TimeTrackingContext";
import { useBranch } from "@/contexts/BranchContext";
import MenuBurgerIcon from "@/components/icons/MenuBurger";


interface TopBarProps {
	title?: string;
	icon?: React.ReactNode;
	showTimeTracking?: boolean;
}

export default function TopBar({
	title,
	icon,
	showTimeTracking = true,
}: TopBarProps) {
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

	// Extract user display name from email
	const userDisplayName = user?.email?.split("@")[0] || "Worker";

	// Handle time tracking actions
	const handleTimeTrackingClick = async () => {
		// Admins are exempt from time tracking since they're not assigned to branches
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
		} catch (error: any) {
			alert(error.message || "Time tracking failed");
		} finally {
			setIsTimeTracking(false);
		}
	};

	return (
		<div className='flex-shrink-0'>
			<div className='flex items-center justify-between h-[90px] w-full'>
				<div className='flex items-center gap-2 sm:gap-4 flex-1 overflow-x-auto'>
					<button
						onClick={toggleDrawer}
						className='ml-6 my-[17px] h-14 w-14 min-w-14 bg-[var(--primary)] rounded-xl flex justify-center items-center hover:scale-105 hover:shadow-md transition-all cursor-pointer flex-shrink-0'>
						<MenuBurgerIcon className="text-[var(--secondary)]" />
					</button>

					{/* User Info*/}
					<div className='relative group'>
						<div className='flex-shrink-0 min-w-[30px] h-14 px-3 py-3 text-center flex bg-[var(--primary)] rounded-xl text-[var(--secondary)] gap-3 items-center font-medium text-[12px] lg:text-[14px]'>
							<span className='my-6 w-8 h-8 bg-[var(--light-accent)] rounded-full flex items-center justify-center text-[var(--secondary)]'>
								<UserIcon />
							</span>
							<span>{userDisplayName}</span>
						</div>
					</div>

					{/* Admin Badge */}
					{isUserAdmin() && (
						<div className='flex-shrink-0'>
							<div className='h-14 px-3 py-3 text-center flex bg-[var(--primary)] rounded-xl text-[var(--secondary)] gap-2 items-center font-medium text-[12px] lg:text-[14px] '>
								<span className='w-8 h-8 bg-[var(--light-accent)] rounded-full flex items-center justify-center text-[var(--secondary)] text-lg font-bold'>
									A
								</span>
								<span className='text-[var(--secondary)] font-medium'>
									Administrator
								</span>
							</div>
						</div>
					)}

					{/* Work Status Badge - Only for workers and managers, not admins */}
					{showTimeTracking &&
						timeTracking.worker &&
						!timeTracking.worker.isAdmin && (
							<div className='flex-shrink-0'>
								<button
									onClick={handleTimeTrackingClick}
									disabled={isTimeTracking}
									className={`relative h-14 px-3 py-3 text-center flex rounded-xl gap-2 items-center font-medium text-[12px] lg:text-[14px] transition-all duration-200 cursor-pointer group ${
										timeTracking.isWorking
											? "bg-green-100 text-green-800 border-2 border-green-300 hover:bg-green-200 hover:border-green-400 hover:shadow-lg"
											: "bg-blue-100 text-blue-800 border-2 border-blue-300 hover:bg-blue-200 hover:border-blue-400 hover:shadow-lg"
									} ${
										isTimeTracking
											? "opacity-50 cursor-not-allowed"
											: "hover:scale-105"
									}`}
									title={
										timeTracking.isWorking
											? "🕐 Click to clock out"
											: "🕐 Click to clock in"
									}>
									{/* Click indicator overlay */}
									{!isTimeTracking && (
										<div
											className={`absolute inset-0 rounded-xl opacity-0 group-hover:opacity-100 transition-opacity duration-200 ${
												timeTracking.isWorking
													? "bg-orange-200/30"
													: "bg-green-200/30"
											}`}
										/>
									)}

									<span
										className={`relative z-10 w-8 h-8 rounded-full flex items-center justify-center text-xs font-bold transition-all duration-200 ${
											timeTracking.isWorking
												? "bg-green-300 text-green-800 group-hover:bg-orange-300 group-hover:text-orange-800"
												: "bg-blue-300 text-blue-800 group-hover:bg-green-300 group-hover:text-green-800"
										}`}>
										{isTimeTracking ? (
											<div className='animate-spin rounded-full h-3 w-3 border-2 border-current border-t-transparent' />
										) : timeTracking.isWorking ? (
											// Clock out icon
											<svg
												className='w-4 h-4'
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
										) : (
											// Clock in icon
											<svg
												className='w-4 h-4'
												fill='none'
												stroke='currentColor'
												viewBox='0 0 24 24'>
												<path
													strokeLinecap='round'
													strokeLinejoin='round'
													strokeWidth={2}
													d='M12 6v6l4 2'
												/>
											</svg>
										)}
									</span>
									<div className='relative z-10 flex flex-col items-start'>
										<span className='font-semibold'>
											{isTimeTracking
												? timeTracking.isWorking
													? "Clocking out..."
													: "Clocking in..."
												: timeTracking.isWorking
												? "Working"
												: "Off Duty"}
										</span>
										{!isTimeTracking && (
											<span
												className={`text-xs transition-colors duration-200 ${
													timeTracking.isWorking
														? "opacity-70 group-hover:text-orange-700"
														: "opacity-70 group-hover:text-green-700"
												}`}>
												{timeTracking.isWorking
													? timeTracking.workingDuration > 0
														? `${Math.floor(
																timeTracking.workingDuration / 60
														  )}h ${
																timeTracking.workingDuration % 60
														  }m • Click to end`
														: "Click to end"
													: "Click to start"}
											</span>
										)}
									</div>
								</button>
							</div>
						)}

					<div className='flex-shrink-0 min-w-[30px] h-14 px-3 py-3 text-center flex bg-[var(--primary)] rounded-xl text-[var(--secondary)] gap-3 items-center font-medium text-[12px] lg:text-[14px]'>
						<span className='w-8 h-8 bg-[var(--light-accent)] rounded-full flex items-center justify-center text-[var(--secondary)]'>
							<CalendarIcon className="text-[var(--secondary)]" />
						</span>
						<div className='flex flex-col items-start'>
							{isLoading && !date ? (
								<LoadingSpinner size='sm' />
							) : (
								<>
									<span>{date}</span>
									{!isInternetTime && date && (
										<span className='text-xs opacity-70'>(Local)</span>
									)}
								</>
							)}
						</div>
					</div>
					<span className='hidden sm:inline'>-</span>
					<div className='flex-shrink-0 min-w-[8rem] h-14 px-3 py-3 text-center flex bg-[var(--primary)] rounded-xl text-[var(--secondary)] gap-3 items-center font-medium text-[12px] lg:text-[14px]'>
						<span className='w-8 h-8 bg-[var(--light-accent)] rounded-full flex items-center justify-center text-[var(--secondary)] font-bold text-sm'>
							<ClockIcon className="text-[var(--secondary)]"/>
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
									<span className='animate-pulse '>{time}</span>
								</>
							)}
						</div>
						<button
							onClick={handleRefresh}
							disabled={isRefreshing}
							className='ml-2 p-1 hover:bg-[var(--light-accent)] rounded-full transition-colors disabled:opacity-50 flex-shrink-0'
							title={`${
								isInternetTime ? "Internet time" : "Local time"
							} - Click to sync`}>
							<RefreshIcon
								className='w-4 h-4 text-[var(--secondary)]'
								isSpinning={isRefreshing}
							/>
						</button>
					</div>
				</div>
			</div>

			{/* Page Title */}
			{title && (
				<div className='flex items-center justify-start ml-6 py-[4px]'>
					{icon}
					<h1 className='text-[var(--secondary)] text-2xl font-bold'>
						{title}
					</h1>
				</div>
			)}
		</div>
	);
}
