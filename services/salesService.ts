import { Order } from './orderService';

export interface HourlyOrderData {
  hour: string; // "00:00", "01:00", etc.
  orderCount: number;
  revenue: number;
  profit: number;
  items: Array<{
    name: string;
    quantity: number;
    revenue: number;
  }>;
}

export interface DailySalesStats {
  date: string; // YYYY-MM-DD
  totalOrders: number;
  totalRevenue: number;
  totalProfit: number;
  totalItems: number;
  averageOrderValue: number;
  profitMargin: number;
  hourlyData: HourlyOrderData[];
  topItems: Array<{
    name: string;
    quantity: number;
    revenue: number;
    orders: number;
  }>;
  orderTypeBreakdown: {
    'DINE-IN': number;
    'TAKE OUT': number;
    'DELIVERY': number;
  };
}

export interface WeeklySalesStats {
  weekStart: string;
  weekEnd: string;
  dailyStats: DailySalesStats[];
  totalRevenue: number;
  totalOrders: number;
  bestDay: string;
  worstDay: string;
}

// Generate hourly order data for a specific day
export const generateHourlyData = (orders: Order[]): HourlyOrderData[] => {
  const hourlyMap = new Map<string, HourlyOrderData>();
  
  // Initialize all 24 hours
  for (let hour = 0; hour < 24; hour++) {
    const hourKey = hour.toString().padStart(2, '0') + ':00';
    hourlyMap.set(hourKey, {
      hour: hourKey,
      orderCount: 0,
      revenue: 0,
      profit: 0,
      items: []
    });
  }
  
  // Process orders
  orders.forEach(order => {
    const orderDate = new Date(order.createdAt.toDate());
    const hourKey = orderDate.getHours().toString().padStart(2, '0') + ':00';
    const hourData = hourlyMap.get(hourKey)!;
    
    // Update hourly stats
    hourData.orderCount += 1;
    hourData.revenue += order.total;
    hourData.profit += order.totalProfit;
    
    // Process items in this order
    order.items.forEach(item => {
      const existingItem = hourData.items.find(i => i.name === item.name);
      if (existingItem) {
        existingItem.quantity += item.quantity;
        existingItem.revenue += item.subtotal;
      } else {
        hourData.items.push({
          name: item.name,
          quantity: item.quantity,
          revenue: item.subtotal
        });
      }
    });
  });
  
  return Array.from(hourlyMap.values()).sort((a, b) => a.hour.localeCompare(b.hour));
};

// Generate daily sales statistics
export const generateDailyStats = (orders: Order[], date: string): DailySalesStats => {
  const totalOrders = orders.length;
  const totalRevenue = orders.reduce((sum, order) => sum + order.total, 0);
  const totalProfit = orders.reduce((sum, order) => sum + order.totalProfit, 0);
  const totalItems = orders.reduce((sum, order) => sum + order.itemCount, 0);
  const averageOrderValue = totalOrders > 0 ? totalRevenue / totalOrders : 0;
  const profitMargin = totalRevenue > 0 ? (totalProfit / totalRevenue) * 100 : 0;
  
  // Generate hourly data
  const hourlyData = generateHourlyData(orders);
  
  // Calculate top items
  const itemMap = new Map<string, { quantity: number; revenue: number; orders: Set<string> }>();
  orders.forEach(order => {
    order.items.forEach(item => {
      const existing = itemMap.get(item.name);
      if (existing) {
        existing.quantity += item.quantity;
        existing.revenue += item.subtotal;
        existing.orders.add(order.id);
      } else {
        itemMap.set(item.name, {
          quantity: item.quantity,
          revenue: item.subtotal,
          orders: new Set([order.id])
        });
      }
    });
  });
  
  const topItems = Array.from(itemMap.entries())
    .map(([name, data]) => ({
      name,
      quantity: data.quantity,
      revenue: data.revenue,
      orders: data.orders.size
    }))
    .sort((a, b) => b.revenue - a.revenue)
    .slice(0, 10);
  
  // Order type breakdown
  const orderTypeBreakdown = orders.reduce((breakdown, order) => {
    breakdown[order.orderType] = (breakdown[order.orderType] || 0) + 1;
    return breakdown;
  }, {} as Record<string, number>);
  
  return {
    date,
    totalOrders,
    totalRevenue,
    totalProfit,
    totalItems,
    averageOrderValue,
    profitMargin,
    hourlyData,
    topItems,
    orderTypeBreakdown: {
      'DINE-IN': orderTypeBreakdown['DINE-IN'] || 0,
      'TAKE OUT': orderTypeBreakdown['TAKE OUT'] || 0,
      'DELIVERY': orderTypeBreakdown['DELIVERY'] || 0,
    }
  };
};

// Generate weekly sales statistics
export const generateWeeklyStats = (orders: Order[], weekStart: Date): WeeklySalesStats => {
  const weekEnd = new Date(weekStart);
  weekEnd.setDate(weekStart.getDate() + 6);
  
  const dailyStats: DailySalesStats[] = [];
  let bestDay = '';
  let worstDay = '';
  let bestRevenue = 0;
  let worstRevenue = Infinity;
  
  // Generate stats for each day of the week
  for (let i = 0; i < 7; i++) {
    const currentDate = new Date(weekStart);
    currentDate.setDate(weekStart.getDate() + i);
    const dateString = currentDate.toISOString().split('T')[0];
    
    // Filter orders for this day
    const dayOrders = orders.filter(order => {
      const orderDate = new Date(order.createdAt.toDate());
      return orderDate.toISOString().split('T')[0] === dateString;
    });
    
    const dayStats = generateDailyStats(dayOrders, dateString);
    dailyStats.push(dayStats);
    
    // Track best and worst days
    if (dayStats.totalRevenue > bestRevenue) {
      bestRevenue = dayStats.totalRevenue;
      bestDay = dateString;
    }
    if (dayStats.totalRevenue < worstRevenue && dayStats.totalRevenue > 0) {
      worstRevenue = dayStats.totalRevenue;
      worstDay = dateString;
    }
  }
  
  const totalRevenue = dailyStats.reduce((sum, day) => sum + day.totalRevenue, 0);
  const totalOrders = dailyStats.reduce((sum, day) => sum + day.totalOrders, 0);
  
  return {
    weekStart: weekStart.toISOString().split('T')[0],
    weekEnd: weekEnd.toISOString().split('T')[0],
    dailyStats,
    totalRevenue,
    totalOrders,
    bestDay: bestDay || 'No sales',
    worstDay: worstDay || 'No sales'
  };
};

// Utility functions for date handling
export const getToday = (): string => {
  return new Date().toISOString().split('T')[0];
};

export const getYesterday = (): string => {
  const yesterday = new Date();
  yesterday.setDate(yesterday.getDate() - 1);
  return yesterday.toISOString().split('T')[0];
};

export const getWeekStart = (date: Date = new Date()): Date => {
  const start = new Date(date);
  const day = start.getDay();
  const diff = start.getDate() - day; // Adjust to get Sunday as start of week
  start.setDate(diff);
  start.setHours(0, 0, 0, 0);
  return start;
};

// Re-export currency formatting utilities
export { formatCurrency, formatPercentage, formatNumber } from '../lib/currency_formatter';
export const salesService = {
  generateHourlyData,
  generateDailyStats,
  generateWeeklyStats,
  getToday,
  getYesterday,
  getWeekStart,
};
