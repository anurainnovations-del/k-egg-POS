"use client";

import { useState, useMemo } from "react";
import { useBranch } from "@/contexts/BranchContext";
import { useAuth } from "@/contexts/AuthContext";
import { useRealtimeData } from "@/contexts/RealtimeDataContext";
import { Order, voidOrder } from "@/services/orderService";
import { formatCurrency } from "@/lib/currency_formatter";
import ManagerOverrideModal from "@/components/ManagerOverrideModal";
import TopBar from "@/components/TopBar";
import MobileTopBar from "@/components/MobileTopBar";
import LoadingSpinner from "@/components/LoadingSpinner";
import SalesIcon from "@/components/icons/SidebarNav/SalesIcon";
import SearchIcon from "@/components/icons/SearchIcon";

export default function WorkerOrdersPage() {
	const { currentBranch } = useBranch();
	const { user } = useAuth();
	
	const { orders: allOrders, loading: realtimeLoading } = useRealtimeData();
	const loading = realtimeLoading.orders;

	const [searchTerm, setSearchTerm] = useState("");
	
	// Voiding state
	const [orderToVoid, setOrderToVoid] = useState<Order | null>(null);
	const [isOverrideModalOpen, setIsOverrideModalOpen] = useState(false);
	const [isVoiding, setIsVoiding] = useState(false);

	// Get today's orders
	const todaysOrders = useMemo(() => {
		const today = new Date();
		today.setHours(0, 0, 0, 0);

		return allOrders.filter(order => {
			if (!order.createdAt) return false;
			const orderDate = (order.createdAt as any).toDate ? (order.createdAt as any).toDate() : new Date(order.createdAt as any);
			return orderDate >= today;
		});
	}, [allOrders]);

	const filteredOrders = useMemo(() => {
		if (!searchTerm) return todaysOrders;
		return todaysOrders.filter(order => 
			(order.id && order.id.toLowerCase().includes(searchTerm.toLowerCase())) ||
			(order.orderType && order.orderType.toLowerCase().includes(searchTerm.toLowerCase())) ||
			(order.items && order.items.some((item) => item.name && item.name.toLowerCase().includes(searchTerm.toLowerCase())))
		);
	}, [todaysOrders, searchTerm]);

	const handleVoidClick = (order: Order) => {
		setOrderToVoid(order);
		setIsOverrideModalOpen(true);
	};

	const executeVoid = async () => {
		if (!currentBranch || !orderToVoid) return;
		
		setIsVoiding(true);
		try {
			const workerName = user?.email?.split('@')[0] || "Unknown";
			await voidOrder(currentBranch.id, orderToVoid.id, workerName);
			
			setOrderToVoid(null);
			setIsOverrideModalOpen(false);
		} catch (error) {
			console.error("Failed to void order:", error);
		} finally {
			setIsVoiding(false);
		}
	};

	if (loading) {
		return (
			<div className='flex h-full overflow-hidden'>
				<div className='flex flex-col flex-1 h-full overflow-hidden'>
					<div className='xl:hidden w-full'>
						<MobileTopBar title='Orders' icon={<SalesIcon className="w-6 h-6" />} showTimeTracking={false} onOrderClick={() => {}} />
					</div>
					<div className='hidden xl:block w-full'>
						<TopBar title='Orders' icon={<SalesIcon className="w-6 h-6" />} showTimeTracking={false} />
					</div>
					<div className='flex-1 flex items-center justify-center'>
						<LoadingSpinner size="lg" />
					</div>
				</div>
			</div>
		);
	}

	return (
		<div className='flex flex-col h-full overflow-hidden'>
			<div className='xl:hidden w-full'>
				<MobileTopBar title='Orders' icon={<SalesIcon className="w-6 h-6" />} showTimeTracking={false} onOrderClick={() => {}} />
			</div>
			<div className='hidden xl:block w-full'>
				<TopBar title='Orders' icon={<SalesIcon className="w-6 h-6" />} showTimeTracking={false} />
			</div>

			<div className='flex-1 overflow-y-auto px-6 py-4 space-y-4'>
				<div className='bg-[var(--primary)] rounded-xl shadow-md border border-[var(--border)] overflow-hidden'>
					<div className='p-6 border-b border-[var(--border)] flex flex-col md:flex-row md:items-center justify-between gap-4'>
						<h3 className='text-lg font-bold text-[var(--secondary)]'>Today's Orders</h3>
						<div className='relative max-w-sm w-full'>
							<input
								type='text'
								value={searchTerm}
								onChange={(e) => setSearchTerm(e.target.value)}
								placeholder='Search orders...'
								className='w-full text-sm px-4 py-2 pl-10 border border-[var(--border)] bg-white rounded-xl focus:outline-none focus:ring-2 focus:ring-[var(--accent)]'
							/>
							<SearchIcon className="absolute left-3 top-1/2 -translate-y-1/2 w-4 h-4 text-gray-400" />
						</div>
					</div>

					<div className='overflow-x-auto'>
						{filteredOrders.length === 0 ? (
							<div className="flex flex-col items-center justify-center py-16 opacity-50">
								<SalesIcon className="w-14 h-14 text-[var(--secondary)]" />
								<p className="mt-3 font-semibold text-[var(--secondary)]">No orders found for today.</p>
							</div>
						) : (
							<table className='w-full text-sm'>
								<thead className='bg-gray-50 border-b border-[var(--border)]'>
									<tr>
										<th className='px-6 py-3 text-left text-[10px] font-bold text-gray-500 uppercase tracking-wider'>ID</th>
										<th className='px-6 py-3 text-left text-[10px] font-bold text-gray-500 uppercase tracking-wider'>Time</th>
										<th className='px-6 py-3 text-left text-[10px] font-bold text-gray-500 uppercase tracking-wider'>Items</th>
										<th className='px-6 py-3 text-left text-[10px] font-bold text-gray-500 uppercase tracking-wider'>Type</th>
										<th className='px-6 py-3 text-left text-[10px] font-bold text-gray-500 uppercase tracking-wider'>Total</th>
										<th className='px-6 py-3 text-center text-[10px] font-bold text-gray-500 uppercase tracking-wider'>Action</th>
									</tr>
								</thead>
								<tbody className='divide-y divide-[var(--border)]'>
									{filteredOrders.map((order) => (
										<tr key={order.id} className={`hover:bg-gray-50 transition-colors ${order.status === 'VOIDED' ? 'opacity-50 grayscale' : ''}`}>
											<td className='px-6 py-4 whitespace-nowrap text-xs font-bold text-[var(--secondary)]'>
												#{order.id?.slice(-6).toUpperCase()}
												{order.status === 'VOIDED' && <span className="ml-2 text-[9px] bg-red-100 text-red-600 px-1.5 py-0.5 rounded uppercase">Voided</span>}
											</td>
											<td className='px-6 py-4 whitespace-nowrap text-xs text-gray-600'>
												{order.createdAt ? ((order.createdAt as any).toDate ? (order.createdAt as any).toDate() : new Date(order.createdAt as any)).toLocaleTimeString([], {hour: '2-digit', minute:'2-digit'}) : "—"}
											</td>
											<td className='px-6 py-4 text-xs text-gray-600 max-w-xs truncate'>
												{order.status === 'VOIDED' ? <span className="line-through">{order.items.map(it => it.name).join(", ")}</span> : order.items.map(it => it.name).join(", ")}
											</td>
											<td className='px-6 py-4 whitespace-nowrap'>
												<span className={`px-2 py-1 rounded-full text-[9px] font-black uppercase ${order.orderType === 'DINE-IN' ? 'bg-blue-100 text-blue-700' : 'bg-orange-100 text-orange-700'}`}>
													{order.orderType}
												</span>
											</td>
											<td className='px-6 py-4 whitespace-nowrap text-xs font-bold text-[var(--secondary)]'>
												{order.status === 'VOIDED' ? <span className="line-through">{formatCurrency(order.total)}</span> : formatCurrency(order.total)}
											</td>
											<td className='px-6 py-4 whitespace-nowrap text-center'>
												{order.status !== 'VOIDED' && (
													<button 
														onClick={() => handleVoidClick(order)}
														className="text-[10px] text-red-500 hover:text-white border border-red-500 hover:bg-red-500 px-3 py-1 rounded-lg font-bold transition-all"
													>
														VOID
													</button>
												)}
											</td>
										</tr>
									))}
								</tbody>
							</table>
						)}
					</div>
				</div>
			</div>

			<ManagerOverrideModal 
				isOpen={isOverrideModalOpen}
				onClose={() => {
					setIsOverrideModalOpen(false);
					setIsVoiding(false);
				}}
				onSuccess={executeVoid}
				actionName={`Void order #${orderToVoid?.id?.slice(-6).toUpperCase()}`}
				description={`Are you sure you want to void order #${orderToVoid?.id?.slice(-6).toUpperCase()}? This will reverse ingredient deductions and exclude it from sales totals.`}
			/>
		</div>
	);
}
