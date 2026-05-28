"use client";

import { useEffect, useState } from "react";
import { useNetwork } from "@/contexts/NetworkContext";

export default function OfflineIndicator() {
	const { isOnline, hasPendingWrites } = useNetwork();
	const [isVisible, setIsVisible] = useState(false);
	const [syncSuccessVisible, setSyncSuccessVisible] = useState(false);

	useEffect(() => {
		if (!isOnline) {
			// Show indicator immediately when offline
			setIsVisible(true);
			setSyncSuccessVisible(false);
		} else if (hasPendingWrites) {
			// Show indicator if we are online but still syncing
			setIsVisible(true);
			setSyncSuccessVisible(false);
		} else {
			// Online and no pending writes!
			// If we were showing offline/syncing, show a temporary success indicator
			if (isVisible) {
				setSyncSuccessVisible(true);
				const timer = setTimeout(() => {
					setSyncSuccessVisible(false);
					setIsVisible(false);
				}, 4000); // Show "Synced" for 4 seconds then hide
				return () => clearTimeout(timer);
			} else {
				setIsVisible(false);
			}
		}
	}, [isOnline, hasPendingWrites, isVisible]);

	if (!isVisible) return null;

	let statusBg = "bg-red-500/90 backdrop-blur-md border border-red-600/50 shadow-red-500/10";
	let statusText = "text-white";
	let statusLabel = "Offline Mode";
	let statusDescription = "Orders are saved locally and will sync when reconnected.";
	let statusIcon = (
		<svg className="w-5 h-5 animate-pulse text-red-100" fill="none" viewBox="0 0 24 24" stroke="currentColor">
			<path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M18.364 5.636a9 9 0 010 12.728m0 0l-2.829-2.829m2.829 2.829L21 21M15.536 8.464a5 5 0 010 7.072m0 0l-2.829-2.829m-4.243 2.829a4.978 4.978 0 01-1.414-3.536 4.978 4.978 0 011.414-3.536m0 0L8.464 11.29m-4.243 4.243L1.5 18m2.828-12.728A9 9 0 015.636 18.364m0 0L8.464 15.536" />
		</svg>
	);

	if (syncSuccessVisible) {
		statusBg = "bg-green-600/90 backdrop-blur-md border border-green-700/50 shadow-green-500/10";
		statusText = "text-white";
		statusLabel = "Synced & Online";
		statusDescription = "All changes successfully uploaded to the server.";
		statusIcon = (
			<svg className="w-5 h-5 text-green-100 animate-bounce" fill="none" viewBox="0 0 24 24" stroke="currentColor">
				<path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M5 13l4 4L19 7" />
			</svg>
		);
	} else if (isOnline && hasPendingWrites) {
		statusBg = "bg-amber-500/90 backdrop-blur-md border border-amber-600/50 shadow-amber-500/10";
		statusText = "text-white";
		statusLabel = "Syncing Changes...";
		statusDescription = "Connected online. Syncing local orders to the server...";
		statusIcon = (
			<svg className="w-5 h-5 animate-spin text-amber-100" fill="none" viewBox="0 0 24 24" stroke="currentColor">
				<path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M4 4v5h.582m15.356 2A8.001 8.001 0 1121.253 8H18" />
			</svg>
		);
	}

	return (
		<div className="fixed bottom-6 right-6 z-50 max-w-sm w-full sm:w-80 transition-all duration-500 ease-out transform translate-y-0 scale-100">
			<div className={`p-4 rounded-2xl shadow-xl flex gap-3 items-start transition-all duration-300 ${statusBg} ${statusText}`}>
				<div className="flex-shrink-0 mt-0.5 p-1.5 rounded-xl bg-white/10">
					{statusIcon}
				</div>
				<div className="flex-1">
					<h3 className="font-bold text-[14px] leading-tight tracking-wide uppercase opacity-95">
						{statusLabel}
					</h3>
					<p className="mt-1 text-[12px] opacity-85 leading-snug">
						{statusDescription}
					</p>
				</div>
				<button 
					onClick={() => setIsVisible(false)} 
					className="flex-shrink-0 text-white/50 hover:text-white/90 p-1 hover:bg-white/10 rounded-lg transition-colors cursor-pointer"
					aria-label="Dismiss"
				>
					<svg className="w-4 h-4" fill="none" viewBox="0 0 24 24" stroke="currentColor">
						<path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M6 18L18 6M6 6l12 12" />
					</svg>
				</button>
			</div>
		</div>
	);
}
