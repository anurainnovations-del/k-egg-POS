"use client";

import { useState, useEffect, useCallback, useMemo } from "react";
import {
	LineChart,
	Line,
	BarChart,
	Bar,
	Cell,
	XAxis,
	YAxis,
	CartesianGrid,
	Tooltip,
	ResponsiveContainer,
} from "recharts";
import { Timestamp } from "firebase/firestore";
import TopBar from "@/components/TopBar";
import { useRealtimeData } from "@/contexts/RealtimeDataContext";
import { calculateDeductions } from "@/services/ingredientDeductionService";
import { Order, voidOrder } from "@/services/orderService";
import { formatCurrency, formatNumber } from "@/services/salesService";
import { useBranch } from "@/contexts/BranchContext";
import { useAuth } from "@/contexts/AuthContext";
import SearchIcon from "@/components/icons/SearchIcon";
import SalesIcon from "@/components/icons/SidebarNav/SalesIcon";
import ViewOnlyWrapper from "@/components/ViewOnlyWrapper";
import { AnimatePresence, motion } from "motion/react";
import LoadingSpinner from "@/components/LoadingSpinner";
import MobileTopBar from "@/components/MobileTopBar";

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
	const { user } = useAuth();
	const [viewPeriod, setViewPeriod] = useState<ViewPeriod>("day");
	const [timeSeriesData, setTimeSeriesData] = useState<TimeSeriesData[]>([]);
	const { orders: allOrders, menuItems, ingredients, categories, loading: realtimeLoading } = useRealtimeData();
	const loading = realtimeLoading.orders || realtimeLoading.menu || realtimeLoading.ingredients || realtimeLoading.categories;
	const [currentPeriodStats, setCurrentPeriodStats] = useState({
		totalRevenue: 0,
		totalOrders: 0,
		totalProfit: 0,
		profitMargin: 0,
	});

	const [currentPage, setCurrentPage] = useState(1);
	const [ordersPerPage] = useState(10);
	const [searchTerm, setSearchTerm] = useState("");
	const [productSort, setProductSort] = useState<"quantity" | "revenue" | "profit">("quantity");

	const [voidModalOpen, setVoidModalOpen] = useState(false);
	const [orderToVoid, setOrderToVoid] = useState<Order | null>(null);
	const [pinInput, setPinInput] = useState("");
	const [voidingError, setVoidingError] = useState("");
	const [isVoiding, setIsVoiding] = useState(false);
	
	const toDate = (date: Timestamp | Date | string | null | undefined): Date => {
		if (!date) return new Date(0);
		if (date instanceof Timestamp) return date.toDate();
		if (typeof date === "object" && "toDate" in date && typeof (date as { toDate: unknown }).toDate === "function") {
			return (date as { toDate: () => Date }).toDate();
		}
		return new Date(date as string | Date);
	};



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
				if (!order.createdAt || order.status === 'VOIDED') return false;
				const orderDate = toDate(order.createdAt);
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
						if (!order.createdAt || order.status === 'VOIDED') return false;
						const orderDate = toDate(order.createdAt);
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
						if (!order.createdAt || order.status === 'VOIDED') return false;
						const orderDate = toDate(order.createdAt);
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

	// Calculate ingredient consumption for the filtered period
	const ingredientConsumption = useMemo(() => {
		if (!menuItems || !ingredients || allOrders.length === 0) return [];
		
		const filteredOrders = getFilteredOrders(viewPeriod);
		
		// Flatten all order items into CartItem format
		const allOrderItems = filteredOrders.flatMap((order) =>
			(order.items || []).map((item) => ({
				id: item.menuItemId || "",
				quantity: item.quantity || 0,
			}))
		);
		
		const menuItemsMap = new Map(menuItems.map((m) => [m.id!, m]));
		const deductions = calculateDeductions(allOrderItems, menuItemsMap);
		
		// Map current ingredient stock and details to the deductions
		return deductions.map((d) => {
			const ing = ingredients.find((i) => i.id === d.ingredientId);
			return {
				...d,
				currentStock: ing?.stock ?? 0,
				lowStockThreshold: ing?.lowStockThreshold ?? 10,
				categoryName: ing ? categories.find((c) => c.id === ing.categoryId)?.name ?? "Uncategorised" : "Uncategorised",
			};
		}).sort((a, b) => b.quantityUsed - a.quantityUsed); // Sort by most consumed first
	}, [allOrders, menuItems, ingredients, viewPeriod, getFilteredOrders, categories]);

	// Per-product sales statistics for the selected period (excludes voided orders)
	const productStats = useMemo(() => {
		const filteredOrders = getFilteredOrders(viewPeriod);

		const map = new Map<string, {
			menuItemId: string;
			name: string;
			categoryId: string;
			quantity: number;
			revenue: number;
			profit: number;
			orderIds: Set<string>;
		}>();

		filteredOrders.forEach((order) => {
			(order.items || []).forEach((item) => {
				const key = item.menuItemId || item.name;
				const entry = map.get(key) ?? {
					menuItemId: item.menuItemId,
					name: item.name,
					categoryId: item.categoryId,
					quantity: 0,
					revenue: 0,
					profit: 0,
					orderIds: new Set<string>(),
				};
				entry.quantity += item.quantity || 0;
				entry.revenue += item.subtotal || 0;
				entry.profit += item.profit || 0;
				entry.orderIds.add(order.id);
				map.set(key, entry);
			});
		});

		const totalRevenue = Array.from(map.values()).reduce((s, e) => s + e.revenue, 0);
		const totalUnits = Array.from(map.values()).reduce((s, e) => s + e.quantity, 0);

		const products = Array.from(map.values())
			.map((e) => ({
				menuItemId: e.menuItemId,
				name: e.name,
				categoryName: categories.find((c) => String(c.id) === String(e.categoryId))?.name ?? "Uncategorised",
				quantity: e.quantity,
				revenue: e.revenue,
				profit: e.profit,
				orderCount: e.orderIds.size,
				revenueShare: totalRevenue > 0 ? (e.revenue / totalRevenue) * 100 : 0,
			}))
			.sort((a, b) => b[productSort] - a[productSort]);

		return { products, totalRevenue, totalUnits };
	}, [getFilteredOrders, viewPeriod, categories, productSort]);

	const topProducts = useMemo(
		() => productStats.products.slice(0, 8).map((p) => ({
			...p,
			shortName: p.name.length > 16 ? p.name.slice(0, 15) + "…" : p.name,
		})),
		[productStats]
	);

	const formatTooltipValue = (value: number | string, name: string): [string | number, string] => {
		if (name === "revenue" || name === "profit") {
			return [formatCurrency(Number(value)), name === "revenue" ? "Revenue" : "Profit"];
		}
		return [value, name === "orders" ? "Orders" : name];
	};

	const formatProductTooltipValue = (value: number | string): [string, string] => {
		const num = Number(value);
		if (productSort === "quantity") return [formatNumber(num), "Units"];
		return [formatCurrency(num), productSort === "revenue" ? "Revenue" : "Profit"];
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

	const handleVoidClick = (order: Order) => {
		setOrderToVoid(order);
		setVoidModalOpen(true);
		setPinInput("");
		setVoidingError("");
	};

	const executeVoid = async () => {
		if (!currentBranch || !orderToVoid) return;

		setIsVoiding(true);
		setVoidingError("");

		try {
			// Check PIN if the branch has one
			if (currentBranch.managerPin) {
				const encoder = new TextEncoder();
				const data = encoder.encode(pinInput + currentBranch.id);
				const hashBuffer = await crypto.subtle.digest('SHA-256', data);
				const hashArray = Array.from(new Uint8Array(hashBuffer));
				const hashedInput = hashArray.map(b => b.toString(16).padStart(2, '0')).join('');

				if (hashedInput !== currentBranch.managerPin) {
					throw new Error("Invalid Manager PIN");
				}
			}

			const workerName = user?.email?.split('@')[0] || "Unknown";
			await voidOrder(currentBranch.id, orderToVoid.id, workerName, orderToVoid);

			setVoidModalOpen(false);
			setOrderToVoid(null);
		} catch (err: unknown) {
			setVoidingError(err instanceof Error ? err.message : "Failed to void order");
		} finally {
			setIsVoiding(false);
		}
	};

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
												// eslint-disable-next-line @typescript-eslint/no-explicit-any
												formatter={formatTooltipValue as any}
											/>
											<Line type='monotone' dataKey='revenue' stroke='var(--accent)' strokeWidth={3} dot={false} animationDuration={1000} />
											<Line type='monotone' dataKey='profit' stroke='#10b981' strokeWidth={2} dot={false} strokeDasharray="5 5" />
										</LineChart>
									</ResponsiveContainer>
								</div>
							</div>

							{/* Ingredient Consumption Analytics */}
							<div className='bg-[var(--primary)] p-6 rounded-xl shadow-md border border-[var(--border)] mx-6'>
								<div className='flex items-center justify-between mb-4'>
									<div>
										<h3 className='text-lg font-semibold text-[var(--secondary)]'>Ingredient Consumption</h3>
										<p className='text-xs text-gray-400 mt-1'>
											Total ingredients used in orders during this period ({viewPeriod === "day" ? "Today" : viewPeriod === "week" ? "7 Days" : "30 Days"})
										</p>
									</div>
								</div>

								{ingredientConsumption.length === 0 ? (
									<div className='py-8 text-center text-sm text-gray-500 italic'>
										No ingredients consumed in this period.
									</div>
								) : (
									<div className='overflow-x-auto'>
										<table className='w-full text-sm text-[var(--secondary)]'>
											<thead className='bg-gray-50 border-b border-[var(--border)]'>
												<tr>
													<th className='px-4 py-2 text-left text-[10px] font-bold text-gray-500 uppercase tracking-wider'>Ingredient</th>
													<th className='px-4 py-2 text-left text-[10px] font-bold text-gray-500 uppercase tracking-wider'>Category</th>
													<th className='px-4 py-2 text-right text-[10px] font-bold text-gray-500 uppercase tracking-wider'>Quantity Consumed</th>
													<th className='px-4 py-2 text-right text-[10px] font-bold text-gray-500 uppercase tracking-wider'>Current Stock</th>
													<th className='px-4 py-2 text-center text-[10px] font-bold text-gray-500 uppercase tracking-wider'>Stock Status</th>
												</tr>
											</thead>
											<tbody className='divide-y divide-[var(--border)]'>
												{ingredientConsumption.map((item) => {
													const isOut = item.currentStock === 0;
													const isLow = item.currentStock <= item.lowStockThreshold;
													return (
														<tr key={item.ingredientId} className='hover:bg-gray-50/50 transition-colors'>
															<td className='px-4 py-3 font-semibold'>{item.ingredientName}</td>
															<td className='px-4 py-3 text-xs text-gray-500'>{item.categoryName}</td>
															<td className='px-4 py-3 text-right font-black text-[var(--secondary)]'>
																{item.quantityUsed} <span className='text-[10px] text-gray-400 font-normal'>{item.unit}</span>
															</td>
															<td className='px-4 py-3 text-right font-bold'>
																{item.currentStock} <span className='text-[10px] text-gray-400 font-normal'>{item.unit}</span>
															</td>
															<td className='px-4 py-3 text-center'>
																{isOut ? (
																	<span className='px-2 py-0.5 rounded-full text-[10px] font-bold bg-red-100 text-red-700 uppercase'>Out</span>
																) : isLow ? (
																	<span className='px-2 py-0.5 rounded-full text-[10px] font-bold bg-amber-100 text-amber-700 uppercase'>Low</span>
																) : (
																	<span className='px-2 py-0.5 rounded-full text-[10px] font-bold bg-green-100 text-green-700 uppercase'>OK</span>
																)}
															</td>
														</tr>
													);
												})}
											</tbody>
										</table>
									</div>
								)}
							</div>

							{/* Product Sales Performance */}
							<div className='bg-[var(--primary)] p-6 rounded-xl shadow-md border border-[var(--border)] mx-6'>
								<div className='flex flex-col md:flex-row md:items-center md:justify-between gap-4 mb-4'>
									<div>
										<h3 className='text-lg font-semibold text-[var(--secondary)]'>Product Performance</h3>
										<p className='text-xs text-gray-400 mt-1'>
											Best-selling products during this period ({viewPeriod === "day" ? "Today" : viewPeriod === "week" ? "7 Days" : "30 Days"})
										</p>
									</div>
									<div className='flex bg-gray-100 rounded-lg p-1 space-x-1 self-start'>
										{([["quantity", "Units"], ["revenue", "Revenue"], ["profit", "Profit"]] as const).map(([key, label]) => (
											<button
												key={key}
												onClick={() => setProductSort(key)}
												className={`px-4 py-1.5 text-xs rounded-md transition-all ${productSort === key ? "bg-white text-[var(--secondary)] font-bold shadow-sm" : "text-gray-500 hover:text-gray-700"}`}
											>
												{label}
											</button>
										))}
									</div>
								</div>

								{productStats.products.length === 0 ? (
									<div className='py-8 text-center text-sm text-gray-500 italic'>
										No products sold in this period.
									</div>
								) : (
									<>
										{/* Summary chips */}
										<div className='grid grid-cols-2 md:grid-cols-3 gap-3 mb-6'>
											<div className='bg-gray-50 rounded-xl p-4 border border-[var(--border)]'>
												<p className='text-[10px] font-bold text-gray-500 uppercase tracking-wider'>Top Product</p>
												<p className='text-sm font-bold text-[var(--secondary)] mt-1 truncate'>{productStats.products[0]?.name ?? "—"}</p>
												<p className='text-xs text-gray-500 mt-0.5'>{formatNumber(productStats.products[0]?.quantity ?? 0)} units · {formatCurrency(productStats.products[0]?.revenue ?? 0)}</p>
											</div>
											<div className='bg-gray-50 rounded-xl p-4 border border-[var(--border)]'>
												<p className='text-[10px] font-bold text-gray-500 uppercase tracking-wider'>Products Sold</p>
												<p className='text-2xl font-black text-[var(--secondary)] mt-1'>{formatNumber(productStats.products.length)}</p>
												<p className='text-xs text-gray-500 mt-0.5'>unique items</p>
											</div>
											<div className='bg-gray-50 rounded-xl p-4 border border-[var(--border)] col-span-2 md:col-span-1'>
												<p className='text-[10px] font-bold text-gray-500 uppercase tracking-wider'>Units Sold</p>
												<p className='text-2xl font-black text-[var(--secondary)] mt-1'>{formatNumber(productStats.totalUnits)}</p>
												<p className='text-xs text-gray-500 mt-0.5'>total items sold</p>
											</div>
										</div>

										{/* Top products chart */}
										<div className='h-72 mb-6'>
											<ResponsiveContainer width='100%' height='100%'>
												<BarChart data={topProducts} layout='vertical' margin={{ top: 0, right: 20, left: 10, bottom: 0 }}>
													<CartesianGrid strokeDasharray='3 3' horizontal={false} stroke='#f0f0f0' />
													<XAxis type='number' stroke='#9ca3af' fontSize={10} tickLine={false} axisLine={false} />
													<YAxis type='category' dataKey='shortName' stroke='#9ca3af' fontSize={10} tickLine={false} axisLine={false} width={110} />
													<Tooltip
														cursor={{ fill: "rgba(0,0,0,0.03)" }}
														contentStyle={{ backgroundColor: "#fff", borderRadius: "12px", border: "none", boxShadow: "0 10px 15px -3px rgb(0 0 0 / 0.1)" }}
														// eslint-disable-next-line @typescript-eslint/no-explicit-any
														formatter={formatProductTooltipValue as any}
													/>
													<Bar dataKey={productSort} radius={[0, 6, 6, 0]} animationDuration={800}>
														{topProducts.map((_, i) => (
															<Cell key={i} fill='var(--accent)' />
														))}
													</Bar>
												</BarChart>
											</ResponsiveContainer>
										</div>

										{/* Ranked table */}
										<div className='overflow-x-auto'>
											<table className='w-full text-sm text-[var(--secondary)]'>
												<thead className='bg-gray-50 border-b border-[var(--border)]'>
													<tr>
														<th className='px-4 py-2 text-left text-[10px] font-bold text-gray-500 uppercase tracking-wider'>#</th>
														<th className='px-4 py-2 text-left text-[10px] font-bold text-gray-500 uppercase tracking-wider'>Product</th>
														<th className='px-4 py-2 text-left text-[10px] font-bold text-gray-500 uppercase tracking-wider'>Category</th>
														<th className='px-4 py-2 text-right text-[10px] font-bold text-gray-500 uppercase tracking-wider'>Units</th>
														<th className='px-4 py-2 text-right text-[10px] font-bold text-gray-500 uppercase tracking-wider'>Orders</th>
														<th className='px-4 py-2 text-right text-[10px] font-bold text-gray-500 uppercase tracking-wider'>Revenue</th>
														<th className='px-4 py-2 text-right text-[10px] font-bold text-gray-500 uppercase tracking-wider'>Profit</th>
														<th className='px-4 py-2 text-right text-[10px] font-bold text-gray-500 uppercase tracking-wider'>% of Sales</th>
													</tr>
												</thead>
												<tbody className='divide-y divide-[var(--border)]'>
													{productStats.products.map((p, i) => (
														<tr key={p.menuItemId || p.name} className='hover:bg-gray-50/50 transition-colors'>
															<td className='px-4 py-3 font-black text-gray-400'>{i + 1}</td>
															<td className='px-4 py-3 font-semibold'>{p.name}</td>
															<td className='px-4 py-3 text-xs text-gray-500'>{p.categoryName}</td>
															<td className='px-4 py-3 text-right font-black'>{formatNumber(p.quantity)}</td>
															<td className='px-4 py-3 text-right text-gray-600'>{formatNumber(p.orderCount)}</td>
															<td className='px-4 py-3 text-right font-bold'>{formatCurrency(p.revenue)}</td>
															<td className='px-4 py-3 text-right font-bold text-green-600'>{formatCurrency(p.profit)}</td>
															<td className='px-4 py-3 text-right text-xs text-gray-500'>{p.revenueShare.toFixed(1)}%</td>
														</tr>
													))}
												</tbody>
											</table>
										</div>
									</>
								)}
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
												<th className='px-6 py-3 text-center text-[10px] font-bold text-gray-500 uppercase tracking-wider'>Action</th>
											</tr>
										</thead>
										<tbody className='divide-y divide-[var(--border)]'>
											{currentOrders.map((order) => (
												<tr key={order.id} className={`hover:bg-gray-50 transition-colors ${order.status === 'VOIDED' ? 'opacity-50 grayscale' : ''}`}>
													<td className='px-6 py-4 whitespace-nowrap text-xs font-bold text-[var(--secondary)]'>
														#{order.id?.slice(-6).toUpperCase()}
														{order.status === 'VOIDED' && <span className="ml-2 text-[9px] bg-red-100 text-red-600 px-1.5 py-0.5 rounded uppercase">Voided</span>}
													</td>
													<td className='px-6 py-4 whitespace-nowrap text-xs text-gray-600'>
														{order.createdAt ? toDate(order.createdAt).toLocaleString() : "—"}
													</td>
													<td className='px-6 py-4 text-xs text-gray-600 max-w-xs truncate'>
														{order.status === 'VOIDED' ? <span className="line-through">{order.items.map(it => it.name).join(", ")}</span> : order.items.map(it => it.name).join(", ")}
													</td>
													<td className='px-6 py-4 whitespace-nowrap'>
														<span className={`px-2 py-1 rounded-full text-[9px] font-black uppercase ${order.orderType === 'DINE-IN' ? 'bg-blue-100 text-blue-700' : 'bg-orange-100 text-orange-700'}`}>
															{order.orderType}
														</span>
													</td>
													<td className='px-6 py-4 whitespace-nowrap text-xs font-bold text-[var(--secondary)]'>{order.status === 'VOIDED' ? <span className="line-through">{formatCurrency(order.total)}</span> : formatCurrency(order.total)}</td>
													<td className='px-6 py-4 whitespace-nowrap text-xs font-bold text-green-600'>{order.status === 'VOIDED' ? <span className="line-through">{formatCurrency(order.totalProfit || 0)}</span> : formatCurrency(order.totalProfit || 0)}</td>
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

			{/* Void Modal */}
			<AnimatePresence>
				{voidModalOpen && (
					<motion.div
						initial={{ opacity: 0 }}
						animate={{ opacity: 1 }}
						exit={{ opacity: 0 }}
						className="fixed inset-0 z-50 flex items-center justify-center bg-black/40 backdrop-blur-sm px-4"
						onClick={() => !isVoiding && setVoidModalOpen(false)}
					>
						<motion.div
							initial={{ opacity: 0, y: 14, scale: 0.98 }}
							animate={{ opacity: 1, y: 0, scale: 1 }}
							exit={{ opacity: 0, y: 10, scale: 0.98 }}
							className="bg-white rounded-2xl shadow-2xl p-6 w-full max-w-sm"
							onClick={(e) => e.stopPropagation()}
						>
							<h3 className="text-xl font-bold text-[var(--secondary)] mb-2">Void Order?</h3>
							<p className="text-sm text-gray-500 mb-6">
								Are you sure you want to void order <span className="font-bold text-[var(--secondary)]">#{orderToVoid?.id?.slice(-6).toUpperCase()}</span>? This will reverse ingredient deductions and exclude it from sales totals.
							</p>

							{currentBranch?.managerPin && (
								<div className="mb-6">
									<label className="block text-xs font-bold text-[var(--secondary)]/60 uppercase mb-2">Manager PIN Required</label>
									<input
										type="password"
										maxLength={6}
										placeholder="Enter PIN"
										value={pinInput}
										onChange={(e) => setPinInput(e.target.value.replace(/\D/g, ''))}
										className="w-full px-4 py-3 text-center tracking-[0.5em] text-lg font-bold rounded-xl border-2 border-[var(--border)] focus:border-[var(--accent)] outline-none"
									/>
									{voidingError && <p className="text-xs text-red-500 font-bold mt-2 text-center">{voidingError}</p>}
								</div>
							)}

							<div className="flex gap-3">
								<button
									onClick={() => setVoidModalOpen(false)}
									disabled={isVoiding}
									className="flex-1 py-3 rounded-xl border border-[var(--border)] font-bold text-gray-600 hover:bg-gray-50 transition-colors disabled:opacity-50"
								>
									Cancel
								</button>
								<button
									onClick={executeVoid}
									disabled={isVoiding || (!!currentBranch?.managerPin && pinInput.length < 4)}
									className="flex-1 py-3 rounded-xl bg-red-500 text-white font-bold hover:bg-red-600 transition-colors disabled:opacity-50"
								>
									{isVoiding ? "Voiding..." : "Confirm Void"}
								</button>
							</div>
						</motion.div>
					</motion.div>
				)}
			</AnimatePresence>
		</ViewOnlyWrapper>
	);
}
