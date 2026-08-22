import { supabase } from '@/integrations/supabase/client';
import type { OrderWithDetails } from './orders.types';
import type { ListingWithSeller } from './types';

import type { CurrencyCode } from '@/utils/currency';

// Re-export currency utilities so existing imports from seller.ts continue to work
export type { CurrencyCode };
export { formatPrice, formatPriceCard, formatPriceShort } from '@/utils/currency';

export type SellerDashboardStats = {
  activeListings: number;
  pendingOrders: number;
  unreadMessages: number;
  openBuyerRequests: number;
  completedSales: number;
  totalRevenue: number;
  currency: CurrencyCode;
  lowStockListings: { id: string; title: string; stock: number }[];
};

export type SellerEarnings = {
  grossEarnings: number;
  pendingAmount: number;
  thisMonthEarnings: number;
  currency: CurrencyCode;
  recentOrders: OrderWithDetails[];
};

export type DailyRevenue = {
  date: string;         // ISO date string YYYY-MM-DD
  revenue: number;
  orderCount: number;
};

export type SellerAnalyticsData = {
  totalRevenue: number;
  totalSales: number;
  activeListings: number;
  avgOrderValue: number;
  responseRate: number | null;
  conversionRate: number | null;
  dailyRevenue: DailyRevenue[];
  currency: CurrencyCode;
};

// ─── Dashboard Stats ──────────────────────────────────────────────────────────

export async function fetchSellerDashboardStats(
  userId: string,
  currency: CurrencyCode = 'UGX',
): Promise<SellerDashboardStats> {
  // Run all queries in parallel
  const [listingsResult, ordersResult, conversationsResult, buyerRequestsResult] = await Promise.allSettled([
    supabase
      .from('listings')
      .select('id, title, status, stock_quantity' as any)
      .eq('seller_id', userId)
      .order('created_at', { ascending: false }),

    supabase
      .from('orders')
      .select('id, status, total_amount')
      .eq('seller_id', userId),

    supabase
      .from('conversations')
      .select('id, seller_unread')
      .eq('seller_id', userId)
      .eq('seller_unread', true),

    supabase
      .from('buyer_requests' as any)
      .select('id, status')
      .eq('status', 'active')
      .limit(100),
  ]);

  // Process listings
  let activeListings = 0;
  let completedSales = 0;
  let totalRevenue = 0;
  const lowStockListings: { id: string; title: string; stock: number }[] = [];

  if (listingsResult.status === 'fulfilled' && listingsResult.value.data) {
    const listings = listingsResult.value.data as any[];
    activeListings = listings.filter((l) => l.status === 'ACTIVE').length;
  }

  // Process orders
  let pendingOrders = 0;
  if (ordersResult.status === 'fulfilled' && ordersResult.value.data) {
    const orders = ordersResult.value.data as any[];
    pendingOrders = orders.filter((o) =>
      ['PENDING', 'ACCEPTED', 'PAYMENT_PENDING', 'PAID', 'PREPARING', 'READY_FOR_PICKUP'].includes(o.status)
    ).length;
    completedSales = orders.filter((o) => o.status === 'COMPLETED').length;
    totalRevenue = orders
      .filter((o) => o.status === 'COMPLETED')
      .reduce((sum, o) => sum + (Number(o.total_amount) || 0), 0);
  }

  // Process unread messages
  const unreadMessages =
    conversationsResult.status === 'fulfilled'
      ? (conversationsResult.value.data?.length ?? 0)
      : 0;

  // Process buyer requests count
  const openBuyerRequests =
    buyerRequestsResult.status === 'fulfilled'
      ? (buyerRequestsResult.value.data?.length ?? 0)
      : 0;

  return {
    activeListings,
    pendingOrders,
    unreadMessages,
    openBuyerRequests,
    completedSales,
    totalRevenue,
    currency,
    lowStockListings,
  };
}

// ─── Earnings ────────────────────────────────────────────────────────────────

export async function fetchSellerEarnings(
  userId: string,
  currency: CurrencyCode = 'UGX',
): Promise<SellerEarnings> {
  const { data: orders, error } = await supabase
    .from('orders')
    .select(`
      *,
      buyer:profiles!orders_buyer_id_fkey(id, display_name, avatar_url),
      items:order_items(
        *,
        listing:listings(id, title, image_url, price)
      )
    `)
    .eq('seller_id', userId)
    .order('created_at', { ascending: false });

  if (error) {
    console.error('[seller] fetchSellerEarnings error:', error);
    throw error;
  }

  const allOrders = (orders ?? []) as unknown as OrderWithDetails[];

  const now = new Date();
  const startOfMonth = new Date(now.getFullYear(), now.getMonth(), 1);

  const completedOrders = allOrders.filter((o) => o.status === 'COMPLETED');
  const pendingOrders = allOrders.filter((o) =>
    ['PENDING', 'ACCEPTED', 'PAID', 'PREPARING', 'READY_FOR_PICKUP'].includes(o.status)
  );

  const grossEarnings = completedOrders.reduce((sum, o) => sum + Number(o.total_amount || 0), 0);
  const pendingAmount = pendingOrders.reduce((sum, o) => sum + Number(o.total_amount || 0), 0);
  const thisMonthEarnings = completedOrders
    .filter((o) => new Date(o.created_at) >= startOfMonth)
    .reduce((sum, o) => sum + Number(o.total_amount || 0), 0);

  return {
    grossEarnings,
    pendingAmount,
    thisMonthEarnings,
    currency,
    recentOrders: allOrders.slice(0, 20),
  };
}

// ─── Analytics ───────────────────────────────────────────────────────────────

export async function fetchSellerAnalytics(
  userId: string,
  days: 7 | 30 | 90 | 365 = 30,
  currency: CurrencyCode = 'UGX',
): Promise<SellerAnalyticsData> {
  const since = new Date(Date.now() - days * 24 * 60 * 60 * 1000).toISOString();

  const [ordersResult, listingsResult, profileResult] = await Promise.allSettled([
    supabase
      .from('orders')
      .select('id, status, total_amount, created_at')
      .eq('seller_id', userId)
      .gte('created_at', since),

    supabase
      .from('listings')
      .select('id, status')
      .eq('seller_id', userId)
      .eq('status', 'ACTIVE'),

    supabase
      .from('profiles')
      .select('total_sales, response_rate')
      .eq('id', userId)
      .maybeSingle(),
  ]);

  const orders =
    ordersResult.status === 'fulfilled' ? ((ordersResult.value.data ?? []) as any[]) : [];
  const activeListings =
    listingsResult.status === 'fulfilled' ? (listingsResult.value.data?.length ?? 0) : 0;
  const profile =
    profileResult.status === 'fulfilled' ? (profileResult.value.data as any) : null;

  const completedOrders = orders.filter((o: any) => o.status === 'COMPLETED');
  const totalRevenue = completedOrders.reduce(
    (sum: number, o: any) => sum + Number(o.total_amount || 0),
    0,
  );
  const totalSales = completedOrders.length;
  const avgOrderValue = totalSales > 0 ? totalRevenue / totalSales : 0;

  const responseRate = profile?.response_rate ? Number(profile.response_rate) : null;

  // Conversion rate: completed / all orders with payment intent
  const conversionRate =
    orders.length > 0 ? Math.round((completedOrders.length / orders.length) * 100) : null;

  // Build daily revenue for the last N days
  const dailyMap: Record<string, DailyRevenue> = {};
  for (let i = days - 1; i >= 0; i--) {
    const d = new Date(Date.now() - i * 24 * 60 * 60 * 1000);
    const key = d.toISOString().slice(0, 10);
    dailyMap[key] = { date: key, revenue: 0, orderCount: 0 };
  }
  completedOrders.forEach((o: any) => {
    const key = (o.created_at as string).slice(0, 10);
    if (dailyMap[key]) {
      dailyMap[key].revenue += Number(o.total_amount || 0);
      dailyMap[key].orderCount += 1;
    }
  });

  return {
    totalRevenue,
    totalSales,
    activeListings,
    avgOrderValue,
    responseRate,
    conversionRate,
    dailyRevenue: Object.values(dailyMap),
    currency,
  };
}
