"use client";

import { useStockAlerts } from "@/contexts/StockAlertContext";
import { AnimatePresence, motion } from "motion/react";
import Link from "next/link";
import { useBranch } from "@/contexts/BranchContext";

interface Props {
	isOpen: boolean;
	onClose: () => void;
}

export default function StockAlertPanel({ isOpen, onClose }: Props) {
	const alerts = useStockAlerts();
	const { currentBranch } = useBranch();
	
	if (!alerts) return null;

	const { lowStockItems, criticalItems, dismissAlert, dismissedIds, notificationPermission, requestPermission } = alerts;
	
	const allItems = [...criticalItems, ...lowStockItems];
	const hasAlerts = allItems.length > 0;
	const activeAlerts = allItems.filter(item => !dismissedIds.has(item.id || ""));

	const handleDismissAll = () => {
		activeAlerts.forEach(item => dismissAlert(item.id || ""));
	};

	return (
		<AnimatePresence>
			{isOpen && (
				<>
					<motion.div
						initial={{ opacity: 0 }}
						animate={{ opacity: 1 }}
						exit={{ opacity: 0 }}
						transition={{ duration: 0.2 }}
						className="fixed inset-0 bg-black/30 backdrop-blur-[2px] z-50"
						onClick={onClose}
					/>
					<motion.div
						initial={{ x: "100%", opacity: 0.5 }}
						animate={{ x: 0, opacity: 1 }}
						exit={{ x: "100%", opacity: 0.5 }}
						transition={{ type: "spring", damping: 30, stiffness: 300 }}
						className="fixed top-0 right-0 h-full w-full max-w-sm bg-white shadow-2xl z-50 flex flex-col"
					>
						{/* Header */}
						<div className="px-6 py-5 border-b border-gray-100 flex items-center justify-between bg-white">
							<div>
								<h2 className="text-xl font-bold text-[var(--secondary)]">Stock Alerts</h2>
								<p className="text-sm text-gray-500 mt-1">
									{activeAlerts.length} item{activeAlerts.length !== 1 ? 's' : ''} require attention
								</p>
							</div>
							<button
								onClick={onClose}
								className="w-10 h-10 rounded-full bg-gray-50 flex items-center justify-center text-gray-500 hover:bg-gray-100 transition-colors"
							>
								<svg className="w-5 h-5" fill="none" stroke="currentColor" viewBox="0 0 24 24">
									<path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M6 18L18 6M6 6l12 12" />
								</svg>
							</button>
						</div>

						{/* Content */}
						<div className="flex-1 overflow-y-auto p-6 bg-gray-50 space-y-6">
							{/* Notification Settings */}
							<div className="bg-white rounded-2xl p-4 shadow-sm border border-gray-100">
								<div className="flex items-center justify-between">
									<div className="flex items-center gap-3">
										<div className={`w-10 h-10 rounded-full flex items-center justify-center ${notificationPermission === 'granted' ? 'bg-green-100 text-green-600' : 'bg-blue-100 text-blue-600'}`}>
											<svg className="w-5 h-5" fill="none" stroke="currentColor" viewBox="0 0 24 24">
												<path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M15 17h5l-1.405-1.405A2.032 2.032 0 0118 14.158V11a6.002 6.002 0 00-4-5.659V5a2 2 0 10-4 0v.341C7.67 6.165 6 8.388 6 11v3.159c0 .538-.214 1.055-.595 1.436L4 17h5m6 0v1a3 3 0 11-6 0v-1m6 0H9" />
											</svg>
										</div>
										<div>
											<p className="text-sm font-bold text-[var(--secondary)]">System Notifications</p>
											<p className="text-[10px] text-gray-500">
												{notificationPermission === 'granted' ? 'Enabled on this device' : notificationPermission === 'denied' ? 'Blocked by browser' : 'Get alerts while in background'}
											</p>
										</div>
									</div>
									{notificationPermission === 'default' && (
										<button 
											onClick={requestPermission}
											className="px-3 py-1.5 bg-[var(--accent)] text-[var(--secondary)] text-[10px] font-bold rounded-lg hover:brightness-110 transition-all shadow-sm"
										>
											Enable
										</button>
									)}
									{notificationPermission === 'granted' && (
										<div className="text-[10px] font-bold text-green-600 bg-green-50 px-2 py-1 rounded-md">
											Active
										</div>
									)}
								</div>
							</div>
							{!hasAlerts ? (
								<div className="h-full flex flex-col items-center justify-center opacity-50 space-y-4">
									<div className="w-20 h-20 bg-gray-100 rounded-full flex items-center justify-center">
										<svg className="w-10 h-10 text-gray-400" fill="none" stroke="currentColor" viewBox="0 0 24 24">
											<path strokeLinecap="round" strokeLinejoin="round" strokeWidth={1.5} d="M5 13l4 4L19 7" />
										</svg>
									</div>
									<p className="font-medium text-gray-500">All stock levels are healthy</p>
								</div>
							) : (
								<div className="space-y-4">
									{activeAlerts.length > 0 && (
										<div className="flex justify-end mb-2">
											<button 
												onClick={handleDismissAll}
												className="text-xs font-semibold text-gray-500 hover:text-gray-700 transition-colors"
											>
												Dismiss All
											</button>
										</div>
									)}

									{allItems.map((item) => {
										const isCritical = item.stock === 0;
										const isDismissed = dismissedIds.has(item.id || "");
										
										return (
											<div 
												key={item.id} 
												className={`bg-white rounded-xl p-4 shadow-sm border-l-4 transition-all ${
													isCritical ? 'border-red-500' : 'border-orange-400'
												} ${isDismissed ? 'opacity-50 grayscale' : ''}`}
											>
												<div className="flex justify-between items-start mb-2">
													<h3 className="font-bold text-[var(--secondary)]">{item.name}</h3>
													{!isDismissed && (
														<button 
															onClick={() => dismissAlert(item.id || "")}
															className="text-gray-400 hover:text-gray-600"
														>
															<svg className="w-4 h-4" fill="none" stroke="currentColor" viewBox="0 0 24 24">
																<path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M6 18L18 6M6 6l12 12" />
															</svg>
														</button>
													)}
												</div>
												
												<div className="flex justify-between items-end">
													<div>
														<p className="text-xs text-gray-500 mb-1">
															Current: <span className={`font-bold ${isCritical ? 'text-red-500' : 'text-orange-500'}`}>{item.stock} {item.unit}</span>
														</p>
														<p className="text-xs text-gray-400">
															Threshold: {item.lowStockThreshold} {item.unit}
														</p>
													</div>
													
													{currentBranch && (
														<Link 
															href={`/${currentBranch.id}/manage/ingredients`}
															onClick={onClose}
															className="px-3 py-1.5 bg-gray-100 hover:bg-gray-200 text-[var(--secondary)] text-xs font-bold rounded-lg transition-colors"
														>
															Restock
														</Link>
													)}
												</div>
											</div>
										);
									})}
								</div>
							)}
						</div>
					</motion.div>
				</>
			)}
		</AnimatePresence>
	);
}
