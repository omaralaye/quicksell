export type ListingWithSeller = {
  id: string;
  title: string;
  price: number;
  category: string;
  condition: string;
  description: string | null;
  image_url: string | null;
  region: string;
  status: string | null;
  created_at: string | null;
  seller_id: string | null;
  seller: {
    id: string;
    display_name: string;
    avatar_url: string | null;
    region: string | null;
    rating: number | null;
    total_listings: number | null;
    total_sales: number | null;
    response_rate: number | null;
  } | null;
};

export type ConversationWithDetails = {
  id: string;
  listing_id: string | null;
  order_id?: string | null;
  buyer_request_id?: string | null;
  buyer_id: string | null;
  seller_id: string | null;
  last_message: string | null;
  last_message_at: string | null;
  buyer_unread: boolean | null;
  seller_unread: boolean | null;
  role?: 'buying' | 'selling';
  unread?: boolean;
  listing: {
    id: string;
    title: string;
    image_url: string | null;
    price: number;
  } | null;
  order?: {
    id: string;
    amount: number;
    status: string;
  } | null;
  other_user: {
    id: string;
    display_name: string;
    avatar_url: string | null;
  } | null;
};

export type MessageRow = {
  id: string;
  conversation_id: string | null;
  sender_id: string | null;
  text: string;
  image_url?: string | null;
  order_id?: string | null;
  created_at: string | null;
};
