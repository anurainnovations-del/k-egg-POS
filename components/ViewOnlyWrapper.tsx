"use client";

import React from "react";
import { usePOSAccessControl } from "@/contexts/TimeTrackingContext";
import QuickTimeWidget from "@/components/QuickTimeWidget";

interface ViewOnlyWrapperProps {
	branchId?: string;
	children: React.ReactNode;
	showTimeWidget?: boolean;
	pageName?: string;
}

export default function ViewOnlyWrapper({
	branchId,
	children,
	showTimeWidget = true,
	pageName = "this page",
}: ViewOnlyWrapperProps) {
	const { canAccessPOS, accessMessage, timeTracking } =
		usePOSAccessControl(branchId);

	// If user has full access, render children normally
	if (canAccessPOS) {
		return <>{children}</>;
	}

	// If user is not clocked in, render view-only version with overlay
	return (
		<div className='relative min-h-screen'>
			{/* View-only overlay */}
			<div className='absolute inset-0 z-50 bg-gray-900/20 backdrop-blur-[1px] min-h-screen'>
				<div className='sticky top-4 mx-4'>
					<div className='bg-white rounded-lg shadow-lg border border-yellow-300 p-4'>
						<div className='flex items-start space-x-3'>
							<div className='flex-shrink-0'>
								<svg
									className='w-5 h-5 text-yellow-500 mt-0.5'
									fill='currentColor'
									viewBox='0 0 20 20'>
									<path
										fillRule='evenodd'
										d='M8.257 3.099c.765-1.36 2.722-1.36 3.486 0l5.58 9.92c.75 1.334-.213 2.98-1.742 2.98H4.42c-1.53 0-2.493-1.646-1.743-2.98l5.58-9.92zM11 13a1 1 0 11-2 0 1 1 0 012 0zm-1-8a1 1 0 00-1 1v3a1 1 0 002 0V6a1 1 0 00-1-1z'
										clipRule='evenodd'
									/>
								</svg>
							</div>
							<div className='flex-1'>
								<h3 className='text-sm font-medium text-gray-900'>
									View-Only Mode
								</h3>
								<p className='mt-1 text-xs text-gray-600'>
									You can view {pageName} but cannot make changes.{" "}
									{accessMessage}
								</p>

								{/* Current Status - Only show for non-admins */}
								{timeTracking.worker && !timeTracking.worker.isAdmin && (
									<div className='mt-3 p-2 bg-gray-50 rounded-md'>
										<div className='flex items-center justify-between text-xs'>
											<span className='text-gray-500'>Status:</span>
											<span
												className={`font-medium ${
													timeTracking.isWorking
														? "text-green-600"
														: "text-gray-900"
												}`}>
												{timeTracking.isWorking ? "Clocked In" : "Clocked Out"}
											</span>
										</div>
									</div>
								)}

								{/* Admin Status */}
								{timeTracking.worker && timeTracking.worker.isAdmin && (
									<div className='mt-3 p-2 bg-blue-50 rounded-md'>
										<div className='flex items-center justify-between text-xs'>
											<span className='text-gray-500'>Role:</span>
											<span className='font-medium text-blue-600'>
												Admin (Global Access)
											</span>
										</div>
									</div>
								)}
							</div>

							{/* Time Widget */}
							{showTimeWidget &&
								timeTracking.worker &&
								!timeTracking.worker.isAdmin && (
									<div className='flex-shrink-0'>
										<QuickTimeWidget currentBranchId={branchId} compact />
									</div>
								)}
						</div>
					</div>
				</div>
			</div>

			{/* Content rendered with disabled interactions */}
			<div className='pointer-events-none select-none'>{children}</div>
		</div>
	);
}
