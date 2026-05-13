import React from "react";
import { usePOSAccessControl } from "@/contexts/TimeTrackingContext";
import QuickTimeWidget from "@/components/QuickTimeWidget";

interface POSAccessGuardProps {
	branchId?: string;
	children: React.ReactNode;
	showTimeWidget?: boolean;
	fallbackComponent?: React.ReactNode;
}

export default function POSAccessGuard({
	branchId,
	children,
	showTimeWidget = true,
	fallbackComponent,
}: POSAccessGuardProps) {
	const { canAccessPOS, accessMessage, timeTracking } =
		usePOSAccessControl(branchId);

	// If user has access, render children normally
	if (canAccessPOS) {
		return <>{children}</>;
	}

	// If custom fallback provided, use it
	if (fallbackComponent) {
		return <>{fallbackComponent}</>;
	}

	// Default access denied UI
	return (
		<div className='min-h-screen bg-gray-50 flex items-center justify-center p-4'>
			<div className='max-w-md w-full space-y-6'>
				{/* Access Denied Card */}
				<div className='bg-white rounded-lg shadow-sm border border-gray-200 p-6'>
					<div className='text-center'>
						<div className='w-16 h-16 bg-yellow-100 rounded-full flex items-center justify-center mx-auto mb-4'>
							<svg
								className='w-8 h-8 text-yellow-600'
								fill='none'
								stroke='currentColor'
								viewBox='0 0 24 24'>
								<path
									strokeLinecap='round'
									strokeLinejoin='round'
									strokeWidth={2}
									d='M12 9v2m0 4h.01m-6.938 4h13.856c1.54 0 2.502-1.667 1.732-2.5L13.732 4c-.77-.833-1.964-.833-2.732 0L4.082 15.5c-.77.833.192 2.5 1.732 2.5z'
								/>
							</svg>
						</div>
						<h3 className='text-lg font-semibold text-gray-900 mb-2'>
							POS Access Required
						</h3>
						<p className='text-gray-600 text-sm mb-4'>{accessMessage}</p>
					</div>

					{/* Current Status */}
					{timeTracking.worker && !timeTracking.worker.isAdmin && (
						<div className='mb-4 p-3 bg-gray-50 rounded-lg'>
							<div className='flex items-center justify-between text-sm'>
								<span className='text-gray-600'>Current Status:</span>
								<span
									className={`font-medium ${
										timeTracking.isWorking ? "text-green-600" : "text-gray-900"
									}`}>
									{timeTracking.isWorking ? "Clocked In" : "Clocked Out"}
								</span>
							</div>
							{timeTracking.isWorking && timeTracking.workingDuration > 0 && (
								<div className='flex items-center justify-between text-sm mt-1'>
									<span className='text-gray-600'>Working for:</span>
									<span className='font-medium text-blue-600'>
										{Math.floor(timeTracking.workingDuration / 60)}h{" "}
										{timeTracking.workingDuration % 60}m
									</span>
								</div>
							)}
						</div>
					)}
				</div>

				{/* Time Widget */}
				{showTimeWidget &&
					timeTracking.worker &&
					!timeTracking.worker.isAdmin && (
						<QuickTimeWidget currentBranchId={branchId} className='w-full' />
					)}

				{/* Additional Info */}
				<div className='text-center'>
					<p className='text-xs text-gray-500'>
						Contact your manager if you&apos;re having trouble accessing the
						system
					</p>
				</div>
			</div>
		</div>
	);
}
