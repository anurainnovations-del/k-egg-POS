"use client";

import { useState, useEffect, useCallback } from "react";
import {
	LineChart,
	Line,
	XAxis,
	YAxis,
	CartesianGrid,
	Tooltip,
	ResponsiveContainer,
} from "recharts";
import TopBar from "@/components/TopBar";
import MobileTopBar from "@/components/MobileTopBar";
import LoadingSpinner from "@/components/LoadingSpinner";
import { subscribeToOrders } from "@/stores/dataStore";
import { Order } from "@/services/orderService";
import { formatCurrency } from "@/services/salesService";
import { useBranch } from "@/contexts/BranchContext";
import SearchIcon from "@/components/icons/SearchIcon";
import SalesIcon from "@/components/icons/SidebarNav/SalesIcon";
import ViewOnlyWrapper from "@/components/ViewOnlyWrapper";

interface TimeSeriesData {
	label: string;
	date: string;
	orders: number;
	revenue: number;
	profit: number;
}

type ViewPeriod = "day" | "week" | "month";

export default function SalesScreen() {
	const { currentBranch } = useBranch();
	const [viewPeriod, setViewPeriod] = useState<ViewPeriod>("day");
	const [timeSeriesData, setTimeSeriesData] = useState<TimeSeriesData[]>([]);
	const [allOrders, setAllOrders] = useState<Order[]>([]);
	const [loading, setLoading] = useState(true);
	const [currentPeriodStats, setCurrentPeriodStats] = useState({
		totalRevenue: 0,
		totalOrders: 0,
		totalProfit: 0,
		profitMargin: 0,
	});

	const [currentPage, setCurrentPage] = useState(1);
	const [ordersPerPage] = useState(10);
	const [searchTerm, setSearchTerm] = useState("");

	useEffect(() => {
		if (!currentBranch) return;

		const unsubscribe = subscribeToOrders(
			currentBranch.id,
			(orders: Order[]) => {
				setAllOrders(orders);
				setLoading(false);
			}
		);

		return () => unsubscribe();
	}, [currentBranch]);

	const getDateRange = (period: ViewPeriod) => {
		const now = new Date();
		const endDate = new Date(now);
		endDate.setHours(23, 59, 59, 999);
		let startDate = new Date();

		switch (period) {
			case "day":
				startDate = new Date(now);
				startDate.setHours(0, 0, 0, 0);
				break;
			case "week":
				startDate = new Date(now);
				startDate.setDate(now.getDate() - 6);
				startDate.setHours(0, 0, 0, 0);
				break;
			case "month":
				startDate = new Date(now);
				startDate.setDate(now.getDate() - 29);
				startDate.setHours(0, 0, 0, 0);
				break;
		}
		return { startDate, endDate };
	};

	const getFilteredOrders = useCallback(
		(period: ViewPeriod): Order[] => {
			const { startDate, endDate } = getDateRange(period);
			return allOrders.filter((order) => {
				if (!order.createdAt) return false;
				const orderDate = (order.createdAt as any).toDate ? (order.createdAt as any).toDate() : new Date(order.createdAt as any);
				return orderDate >= startDate && orderDate <= endDate;
			});
		},
		[allOrders]
	);

	const generateTimeSeriesData = useCallback(
		(orders: Order[], period: ViewPeriod): TimeSeriesData[] => {
			const { startDate } = getDateRange(period);
			const data: TimeSeriesData[] = [];

			if (period === "day") {
				for (let hour = 0; hour < 24; hour++) {
					const hourStart = new Date(startDate);
					hourStart.setHours(hour, 0, 0, 0);
					const hourEnd = new Date(startDate);
					hourEnd.setHours(hour, 59, 59, 999);

					const hourOrders = orders.filter((order) => {
						if (!order.createdAt) return false;
						const orderDate = (order.createdAt as any).toDate ? (order.createdAt as any).toDate() : new Date(order.createdAt as any);
						return orderDate >= hourStart && orderDate <= hourEnd;
					});

					const revenue = hourOrders.reduce((sum, order) => sum + order.total, 0);
					const profit = hourOrders.reduce((sum, order) => sum + (order.totalProfit || 0), 0);

					data.push({
						label: `${hour.toString().padStart(2, "0")}:00`,
						date: hourStart.toISOString(),
						orders: hourOrders.length,
						revenue,
						profit,
					});
				}
			} else {
				const days = period === "week" ? 7 : 30;
				for (let i = 0; i < days; i++) {
					const dayStart = new Date(startDate);
					dayStart.setDate(startDate.getDate() + i);
					dayStart.setHours(0, 0, 0, 0);
					const dayEnd = new Date(dayStart);
					dayEnd.setHours(23, 59, 59, 999);

					const dayOrders = orders.filter((order) => {
						if (!order.createdAt) return false;
						const orderDate = (order.createdAt as any).toDate ? (order.createdAt as any).toDate() : new Date(order.createdAt as any);
						return orderDate >= dayStart && orderDate <= dayEnd;
					});

					const revenue = dayOrders.reduce((sum, order) => sum + order.total, 0);
					const profit = dayOrders.reduce((sum, order) => sum + (order.totalProfit || 0), 0);

					data.push({
						label: period === "week"
							? dayStart.toLocaleDateString("en-US", { weekday: "short", month: "short", day: "numeric" })
							: dayStart.toLocaleDateString("en-US", { month: "short", day: "numeric" }),
						date: dayStart.toISOString(),
						orders: dayOrders.length,
						revenue,
						profit,
					});
				}
			}
			return data;
		},
		[]
	);

	useEffect(() => {
		if (allOrders.length === 0) {
			setTimeSeriesData([]);
			setCurrentPeriodStats({ totalRevenue: 0, totalOrders: 0, totalProfit: 0, profitMargin: 0 });
			return;
		}

		const filteredOrders = getFilteredOrders(viewPeriod);
		const seriesData = generateTimeSeriesData(filteredOrders, viewPeriod);
		setTimeSeriesData(seriesData);

		const totalRevenue = filteredOrders.reduce((sum, order) => sum + order.total, 0);
		const totalOrders = filteredOrders.length;
		const totalProfit = filteredOrders.reduce((sum, order) => sum + (order.totalProfit || 0), 0);
		const profitMargin = totalRevenue > 0 ? (totalProfit / totalRevenue) * 100 : 0;

		setCurrentPeriodStats({ totalRevenue, totalOrders, totalProfit, profitMargin });
	}, [allOrders, viewPeriod, getFilteredOrders, generateTimeSeriesData]);

	const formatTooltipValue = (value: number, name: string) => {
		if (name === "revenue" || name === "profit") {
			return [formatCurrency(value), name === "revenue" ? "Revenue" : "Profit"];
		}
		return [value, name === "orders" ? "Orders" : name];
	};

	const filteredOrdersForTable = allOrders.filter((order) => {
		if (!searchTerm) return true;
		return (
			(order.id && order.id.toLowerCase().includes(searchTerm.toLowerCase())) ||
			(order.orderType && order.orderType.toLowerCase().includes(searchTerm.toLowerCase())) ||
			(order.items && order.items.some((item) => item.name && item.name.toLowerCase().includes(searchTerm.toLowerCase())))
		);
	});

	const indexOfLastOrder = currentPage * ordersPerPage;
	const indexOfFirstOrder = indexOfLastOrder - ordersPerPage;
	const currentOrders = filteredOrdersForTable.slice(indexOfFirstOrder, indexOfLastOrder);
	const totalPages = Math.ceil(filteredOrdersForTable.length / ordersPerPage);

	const paginate = (pageNumber: number) => setCurrentPage(pageNumber);

	if (loading) {
		return (
			<div className='flex h-full overflow-hidden'>
				<div className='flex flex-col flex-1 h-full overflow-hidden'>
					<div className='xl:hidden w-full'>
						<MobileTopBar title='Sales' icon={<SalesIcon className="w-6 h-6" />} />
					</div>
					<div className='hidden xl:block w-full'>
						<TopBar title='Sales' icon={<SalesIcon className="w-6 h-6" />} />
					</div>
					<div className='flex-1 flex items-center justify-center'>
						<LoadingSpinner />
					</div>
				</div>
			</div>
		);
	}

	return (
		<ViewOnlyWrapper branchId={currentBranch?.id} pageName='sales'>
			<div className='flex h-full overflow-hidden'>
				<div className='flex flex-col flex-1 h-full overflow-hidden'>
					<div className='xl:hidden w-full'>
						<MobileTopBar title='Sales' icon={<SalesIcon className="w-6 h-6" />} />
					</div>
					<div className='hidden xl:block w-full'>
						<TopBar title='Sales' icon={<SalesIcon className="w-6 h-6" />} />
					</div>

					<div className='flex-1 overflow-y-auto pt-4 pb-10'>
						<div className='space-y-6'>
							{/* Summary Stats */}
							<div className='grid grid-cols-1 md:grid-cols-3 gap-4 mx-6'>
								<div className='bg-[var(--primary)] p-6 rounded-xl shadow-md border border-[var(--border)]'>
									<div className='flex items-center justify-between'>
										<div>
											<p className='text-sm font-medium text-gray-400'>
												{viewPeriod === "day" ? "Today" : viewPeriod === "week" ? "7 Days" : "30 Days"} Revenue
											</p>
											<p className='text-2xl font-bold text-[var(--secondary)]'>
												{formatCurrency(currentPeriodStats.totalRevenue)}
											</p>
										</div>
										<div className='w-12 h-12 bg-[var(--light-accent)] rounded-lg flex items-center justify-center'>
											<SalesIcon className="w-6 h-6 text-[var(--accent)]" />
										</div>
									</div>
									<p className='text-xs text-gray-500 mt-2'>
										Profit: {formatCurrency(currentPeriodStats.totalProfit)} ({currentPeriodStats.profitMargin.toFixed(1)}%)
									</p>
								</div>

								<div className='bg-[var(--primary)] p-6 rounded-xl shadow-md border border-[var(--border)]'>
									<div className='flex items-center justify-between'>
										<div>
											<p className='text-sm font-medium text-gray-400'>Total Orders</p>
											<p className='text-2xl font-bold text-[var(--secondary)]'>{currentPeriodStats.totalOrders}</p>
										</div>
										<div className='w-12 h-12 bg-[var(--light-accent)] rounded-lg flex items-center justify-center'>
											<div className="text-[var(--accent)] font-black">#</div>
										</div>
									</div>
									<p className='text-xs text-gray-500 mt-2'>
										Avg: {formatCurrency(currentPeriodStats.totalOrders > 0 ? currentPeriodStats.totalRevenue / currentPeriodStats.totalOrders : 0)}
									</p>
								</div>

								<div className='bg-[var(--primary)] p-6 rounded-xl shadow-md border border-[var(--border)]'>
									<div className='flex items-center justify-between'>
										<div>
											<p className='text-sm font-medium text-gray-400'>Peak {viewPeriod === "day" ? "Hour" : "Day"}</p>
											<p className='text-2xl font-bold text-[var(--secondary)]'>
												{timeSeriesData.length > 0 ? timeSeriesData.reduce((peak, cur) => cur.orders > peak.orders ? cur : peak, timeSeriesData[0]).label : "--"}
											</p>
										</div>
										<div className='w-12 h-12 bg-[var(--light-accent)] rounded-lg flex items-center justify-center'>
											<div className="text-[var(--accent)] font-black">📈</div>
										</div>
									</div>
									<p className='text-xs text-gray-500 mt-2'>
										{timeSeriesData.length > 0 ? `${timeSeriesData.reduce((p, c) => c.orders > p.orders ? c : p, timeSeriesData[0]).orders} orders` : "0 orders"}
									</p>
								</div>
							</div>

							{/* Chart */}
							<div className='bg-[var(--primary)] p-6 rounded-xl shadow-md border border-[var(--border)] mx-6'>
								<div className='flex items-center justify-between mb-6'>
									<div>
										<h3 className='text-lg font-semibold text-[var(--secondary)]'>Performance Trends</h3>
										<div className='flex bg-gray-100 rounded-lg p-1 mt-2 space-x-1'>
											{(["day", "week", "month"] as ViewPeriod[]).map((p) => (
												<button
													key={p}
													onClick={() => setViewPeriod(p)}
													className={`px-4 py-1.5 text-xs rounded-md transition-all ${viewPeriod === p ? "bg-white text-[var(--secondary)] font-bold shadow-sm" : "text-gray-500 hover:text-gray-700"}`}
												>
													{p === "day" ? "24h" : p === "week" ? "7d" : "30d"}
												</button>
											))}
										</div>
									</div>
								</div>
								<div className='h-72'>
									<ResponsiveContainer width='100%' height='100%'>
										<LineChart data={timeSeriesData}>
											<CartesianGrid strokeDasharray='3 3' stroke='#f0f0f0' />
											<XAxis dataKey='label' stroke='#9ca3af' fontSize={10} tickLine={false} axisLine={false} />
											<YAxis stroke='#9ca3af' fontSize={10} tickLine={false} axisLine={false} />
											<Tooltip
												contentStyle={{ backgroundColor: "#fff", borderRadius: "12px", border: "none", boxShadow: "0 10px 15px -3px rgb(0 0 0 / 0.1)" }}
												formatter={formatTooltipValue}
											/>
											<Line type='monotone' dataKey='revenue' stroke='var(--accent)' strokeWidth={3} dot={false} animationDuration={1000} />
											<Line type='monotone' dataKey='profit' stroke='#10b981' strokeWidth={2} dot={false} strokeDasharray="5 5" />
										</LineChart>
									</ResponsiveContainer>
								</div>
							</div>

							{/* Orders Table */}
							<div className='bg-[var(--primary)] rounded-xl shadow-md border border-[var(--border)] mx-6 overflow-hidden'>
								<div className='p-6 border-b border-[var(--border)] flex flex-col md:flex-row md:items-center justify-between gap-4'>
									<h3 className='text-lg font-bold text-[var(--secondary)]'>Recent Orders</h3>
									<div className='relative max-w-sm w-full'>
										<input
											type='text'
											value={searchTerm}
											onChange={(e) => { setSearchTerm(e.target.value); setCurrentPage(1); }}
											placeholder='Search orders...'
											className='w-full text-sm px-4 py-2 pl-10 border border-[var(--border)] bg-white rounded-xl focus:outline-none focus:ring-2 focus:ring-[var(--accent)]'
										/>
										<SearchIcon className="absolute left-3 top-1/2 -translate-y-1/2 w-4 h-4 text-gray-400" />
									</div>
								</div>

								<div className='overflow-x-auto'>
									<table className='w-full'>
										<thead className='bg-gray-50 border-b border-[var(--border)]'>
											<tr>
												<th className='px-6 py-3 text-left text-[10px] font-bold text-gray-500 uppercase tracking-wider'>ID</th>
												<th className='px-6 py-3 text-left text-[10px] font-bold text-gray-500 uppercase tracking-wider'>Date</th>
												<th className='px-6 py-3 text-left text-[10px] font-bold text-gray-500 uppercase tracking-wider'>Items</th>
												<th className='px-6 py-3 text-left text-[10px] font-bold text-gray-500 uppercase tracking-wider'>Type</th>
												<th className='px-6 py-3 text-left text-[10px] font-bold text-gray-500 uppercase tracking-wider'>Total</th>
												<th className='px-6 py-3 text-left text-[10px] font-bold text-gray-500 uppercase tracking-wider'>Profit</th>
											</tr>
										</thead>
										<tbody className='divide-y divide-[var(--border)]'>
											{currentOrders.map((order) => (
												<tr key={order.id} className='hover:bg-gray-50 transition-colors'>
													<td className='px-6 py-4 whitespace-nowrap text-xs font-bold text-[var(--secondary)]'>#{order.id?.slice(-6).toUpperCase()}</td>
													<td className='px-6 py-4 whitespace-nowrap text-xs text-gray-600'>
														{order.createdAt ? ((order.createdAt as any).toDate ? (order.createdAt as any).toDate() : new Date(order.createdAt as any)).toLocaleString() : "—"}
													</td>
													<td className='px-6 py-4 text-xs text-gray-600 max-w-xs truncate'>
														{order.items.map(it => it.name).join(", ")}
													</td>
													<td className='px-6 py-4 whitespace-nowrap'>
														<span className={`px-2 py-1 rounded-full text-[9px] font-black uppercase ${order.orderType === 'DINE-IN' ? 'bg-blue-100 text-blue-700' : 'bg-orange-100 text-orange-700'}`}>
															{order.orderType}
														</span>
													</td>
													<td className='px-6 py-4 whitespace-nowrap text-xs font-bold text-[var(--secondary)]'>{formatCurrency(order.total)}</td>
													<td className='px-6 py-4 whitespace-nowrap text-xs font-bold text-green-600'>{formatCurrency(order.totalProfit || 0)}</td>
												</tr>
											))}
										</tbody>
									</table>
								</div>

								{/* Pagination */}
								{totalPages > 1 && (
									<div className='px-6 py-4 border-t border-[var(--border)] flex items-center justify-between bg-gray-50'>
										<span className='text-[10px] text-gray-500'>Page {currentPage} of {totalPages}</span>
										<div className='flex gap-2'>
											<button disabled={currentPage === 1} onClick={() => paginate(currentPage - 1)} className='px-3 py-1 text-xs bg-white border border-[var(--border)] rounded-lg disabled:opacity-50'>Prev</button>
											<button disabled={currentPage === totalPages} onClick={() => paginate(currentPage + 1)} className='px-3 py-1 text-xs bg-white border border-[var(--border)] rounded-lg disabled:opacity-50'>Next</button>
										</div>
									</div>
								)}
							</div>
						</div>
					</div>
				</div>
			</div>
		</ViewOnlyWrapper>
	);
}
