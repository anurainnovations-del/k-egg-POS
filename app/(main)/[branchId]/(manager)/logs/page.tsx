"use client";

import LogsIcon from "@/components/icons/SidebarNav/LogsIcon";
import TopBar from "@/components/TopBar";
import MobileTopBar from "@/components/MobileTopBar";
import ViewOnlyWrapper from "@/components/ViewOnlyWrapper";
import { useBranch } from "@/contexts/BranchContext";

export default function LogsScreen() {
	const { currentBranch } = useBranch();

	return (
		<ViewOnlyWrapper branchId={currentBranch?.id} pageName='logs'>
			<div className='flex h-full overflow-hidden'>
				<div className='flex flex-col flex-1 h-full overflow-hidden'>
					<div className='xl:hidden w-full'>
						<MobileTopBar title='Logs' icon={<LogsIcon className="w-6 h-6" />} />
					</div>
					<div className='hidden xl:block w-full'>
						<TopBar title='Logs' icon={<LogsIcon className="w-6 h-6" />} />
					</div>

					<div className='flex-1 overflow-y-auto px-6 pb-6'>
						<div className='flex items-center justify-center h-full'>
							<div className='text-center max-w-md w-full'>
								<div className='w-24 h-24 bg-[var(--light-accent)] rounded-full mx-auto mb-4 flex items-center justify-center'>
									<LogsIcon className="w-12 h-12 text-[var(--accent)]" />
								</div>
								<h2 className='text-xl font-bold text-[var(--secondary)] mb-2'>Activity Logs</h2>
								<p className='text-sm text-gray-500 mb-8'>This section will display branch activities and transaction logs.</p>
							</div>
						</div>
					</div>
				</div>
			</div>
		</ViewOnlyWrapper>
	);
}
