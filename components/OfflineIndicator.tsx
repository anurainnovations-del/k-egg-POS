"use client";

import { useNetwork } from "@/contexts/NetworkContext";

export default function OfflineIndicator() {
	const { isOnline, hasPendingWrites } = useNetwork();

	if (!isOnline) {
		return (
			<div className="flex-shrink-0 flex items-center bg-red-50 text-red-700 border border-red-200/50 px-3.5 h-14 rounded-xl text-[12px] lg:text-[14px] font-bold gap-2 shadow-sm transition-all duration-300">
				<span className="w-2.5 h-2.5 rounded-full bg-red-500 animate-pulse flex-shrink-0" />
				<span className="font-bold uppercase tracking-wider text-[11px]">Offline</span>
			</div>
		);
	}

	if (hasPendingWrites) {
		return (
			<div className="flex-shrink-0 flex items-center bg-amber-50 text-amber-700 border border-amber-200/50 px-3.5 h-14 rounded-xl text-[12px] lg:text-[14px] font-bold gap-2 shadow-sm transition-all duration-300">
				<div className="w-3.5 h-3.5 border-2 border-amber-500 border-t-transparent rounded-full animate-spin flex-shrink-0" />
				<span className="font-bold uppercase tracking-wider text-[11px]">Syncing</span>
			</div>
		);
	}

	return (
		<div className="flex-shrink-0 flex items-center bg-green-50/50 text-green-700 border border-green-100/50 px-3.5 h-14 rounded-xl text-[12px] lg:text-[14px] font-bold gap-2 opacity-60 hover:opacity-100 transition-all duration-300">
			<span className="w-2 h-2 rounded-full bg-green-500 flex-shrink-0 animate-pulse" />
			<span className="font-bold uppercase tracking-wider text-[11px] hidden sm:inline">Online</span>
		</div>
	);
}
