export type OrderStatus =
  | 'PENDING'
  | 'ACCEPTED'
  | 'PAYMENT_PENDING'
  | 'PAID'
  | 'PREPARING'
  | 'READY_FOR_PICKUP'
  | 'OUT_FOR_DELIVERY'
  | 'DELIVERED'
  | 'COMPLETED'
  | 'CANCELLED'
  | 'REFUND_PENDING'
  | 'REFUNDED'
  | 'DISPUTED';

export type OrderItemWithListing = {
  id: string;
  order_id: string;
  listing_id: string;
  quantity: number;
  unit_price: number;
  total_price: number;
  listing?: {
    id: string;
    title: string;
    image_url?: string | null;
    images?: string[] | null;
    price: number;
    currency?: string | null;
  } | null;
};

export type OrderStatusHistoryRow = {
  id: string;
  order_id: string;
  previous_status: OrderStatus | string | null;
  new_status: OrderStatus | string;
  actor_id: string | null;
  reason: string | null;
  created_at: string;
  actor?: {
    id: string;
    display_name?: string | null;
  } | null;
};

export type OrderWithDetails = {
  id: string;
  buyer_id: string;
  seller_id: string;
  status: OrderStatus;
  total_amount: number;
  currency?: string | null;
  payment_method?: string | null;
  shipping_address?: string | null;
  notes?: string | null;
  reservation_expires_at?: string | null;
  created_at: string;
  updated_at: string;
  buyer?: {
    id: string;
    display_name: string;
    avatar_url?: string | null;
    email?: string | null;
    phone?: string | null;
  } | null;
  seller?: {
    id: string;
    display_name: string;
    avatar_url?: string | null;
    email?: string | null;
    phone?: string | null;
  } | null;
  items?: OrderItemWithListing[];
  history?: OrderStatusHistoryRow[];
};
