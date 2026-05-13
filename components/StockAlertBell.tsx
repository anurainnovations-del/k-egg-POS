"use client";

import { useState } from "react";
import { useStockAlerts } from "@/contexts/StockAlertContext";
import StockAlertPanel from "./StockAlertPanel";

export default function StockAlertBell() {
	const alerts = useStockAlerts();
	const [isPanelOpen, setIsPanelOpen] = useState(false);

	if (!alerts) return null;
	const { alertCount } = alerts;

	return (
		<>
			<button
				onClick={() => setIsPanelOpen(true)}
				className={`relative p-2 rounded-xl transition-all flex items-center justify-center group ${
					alertCount > 0 
						? "bg-orange-50 text-orange-500 hover:bg-orange-100 shadow-sm" 
						: "text-gray-400 hover:text-[var(--secondary)] hover:bg-[var(--light-accent)]"
				}`}
				aria-label="Stock Alerts"
			>
				<svg 
					className={`w-6 h-6 ${alertCount > 0 ? "animate-[ring_2s_ease-in-out_infinite]" : ""}`} 
					fill="none" 
					stroke="currentColor" 
					viewBox="0 0 24 24"
				>
					<path strokeLinecap="round" strokeLinejoin="round" strokeWidth={1.5} d="M15 17h5l-1.405-1.405A2.032 2.032 0 0118 14.158V11a6.002 6.002 0 00-4-5.659V5a2 2 0 10-4 0v.341C7.67 6.165 6 8.388 6 11v3.159c0 .538-.214 1.055-.595 1.436L4 17h5m6 0v1a3 3 0 11-6 0v-1m6 0H9" />
				</svg>
				
				{alertCount > 0 && (
					<span className="absolute -top-1 -right-1 flex h-5 min-w-[20px] px-1 items-center justify-center rounded-full bg-red-500 text-[10px] font-black text-white border-2 border-white shadow-sm transition-transform group-hover:scale-110">
						{alertCount}
					</span>
				)}
			</button>
			
			<StockAlertPanel isOpen={isPanelOpen} onClose={() => setIsPanelOpen(false)} />
		</>
	);
}
