"use client";

import MenuBurger from "@/components/icons/MenuBurger";
import UserIcon from "@/components/icons/UserIcon";
import CalendarIcon from "@/components/icons/CalendarIcon";
import ClockIcon from "@/components/icons/ClockIcon";
import RefreshIcon from "@/components/icons/RefreshIcon";
import { useAdminDrawer } from "./AdminDrawerProvider";
import { useDateTime } from "@/contexts/DateTimeContext";
import { useAuth } from "@/contexts/AuthContext";
import LoadingSpinner from "@/components/LoadingSpinner";
import { useState } from "react";

interface TopBarProps {
	title?: string;
	icon?: React.ReactNode;
}

export default function TopBar({ title, icon }: TopBarProps) {
	const { toggle: toggleDrawer } = useAdminDrawer();
	const { date, time, isInternetTime, isLoading, forceSync } = useDateTime();
	const { user } = useAuth();
	const [isRefreshing, setIsRefreshing] = useState(false);

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
	const userDisplayName = user?.email?.split("@")[0] || "Admin";

	return (
		<div className='flex-shrink-0'>
			<div className='flex items-center justify-between h-[90px] w-full'>
				<div className='flex items-center gap-2 sm:gap-4 flex-1 overflow-x-auto'>
					<button
						onClick={toggleDrawer}
						className='ml-6 my-[17px] h-14 w-14 min-w-14 bg-[var(--primary)] rounded-xl flex justify-center items-center hover:scale-110 hover:shadow-sm transition-all cursor-pointer flex-shrink-0'>
						<MenuBurger />
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
					<div className='flex-shrink-0'>
						<div className='h-14 px-3 py-3 text-center flex bg-[var(--primary)] rounded-xl text-[var(--secondary)] gap-2 items-center font-medium text-[12px] lg:text-[14px] '>
							<span className='w-8 h-8 bg-[var(--light-accent)] rounded-full flex items-center justify-center text-[var(--secondary)] text-xs font-bold'>
								A
							</span>
							<span className='text-[var(--secondary)] font-medium'>
								Admin
							</span>
						</div>
					</div>

					<div className='flex-shrink-0 min-w-[30px] h-14 px-3 py-3 text-center flex bg-[var(--primary)] rounded-xl text-[var(--secondary)] gap-3 items-center font-medium text-[12px] lg:text-[14px]'>
						<span className='w-8 h-8 bg-[var(--light-accent)] rounded-full flex items-center justify-center text-[var(--secondary)]'>
							<CalendarIcon />
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
						<span className='w-8 h-8 pl-[2px] bg-[var(--light-accent)] rounded-full flex items-center justify-center text-[var(--secondary)] font-bold text-sm'>
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
				<div className='flex items-center justify-start ml-6 mt-[8px] py-[4px]'>
					{icon}
					<h1 className='text-[var(--secondary)] text-2xl font-bold'>
						{title}
					</h1>
				</div>
			)}
		</div>
	);
}