export interface Listing {
  id: string;
  title: string;
  price: number;
  category: string;
  condition: string;
  description: string;
  image: string;
  sellerId: string;
  sellerName: string;
  sellerRegion: string;
  sellerRating: number;
  sellerAvatar: string;
  createdAt: string;
  status: 'active' | 'sold';
}

export interface Conversation {
  id: string;
  listingId: string;
  listingTitle: string;
  listingImage: string;
  otherUserId: string;
  otherUserName: string;
  otherUserAvatar: string;
  lastMessage: string;
  lastMessageTime: string;
  unread: boolean;
}

export interface Message {
  id: string;
  senderId: string;
  text: string;
  time: string;
}

export const MOCK_LISTINGS: Listing[] = [
  { id: '1', title: 'Vintage Leather Sofa', price: 280, category: 'Furniture', condition: 'Good', description: 'Beautiful 3-seater leather sofa in cognac brown. Minor wear on armrests. Smoke-free home.', image: 'https://images.unsplash.com/photo-1555041469-a586c61ea9bc?w=600', sellerId: 'u1', sellerName: 'Maria K.', sellerRegion: 'Brooklyn, NY', sellerRating: 4.8, sellerAvatar: 'https://i.pravatar.cc/150?img=47', createdAt: '2025-01-10T10:00:00Z', status: 'active' },
  { id: '2', title: 'Trek Mountain Bike', price: 450, category: 'Sports', condition: 'Like New', description: 'Trek Marlin 5, 2022 model. Only used 3 times. Comes with helmet and lock.', image: 'https://images.unsplash.com/photo-1558618666-fcd25c85cd64?w=600', sellerId: 'u2', sellerName: 'James R.', sellerRegion: 'Brooklyn, NY', sellerRating: 4.9, sellerAvatar: 'https://i.pravatar.cc/150?img=12', createdAt: '2025-01-09T14:00:00Z', status: 'active' },
  { id: '3', title: 'iPhone 14 Pro — 256GB', price: 720, category: 'Electronics', condition: 'Excellent', description: 'Deep Purple, no scratches. Includes original box, charger, and two cases.', image: 'https://images.unsplash.com/photo-1678685888221-cda773a3dcdb?w=600', sellerId: 'u3', sellerName: 'Priya S.', sellerRegion: 'Manhattan, NY', sellerRating: 5.0, sellerAvatar: 'https://i.pravatar.cc/150?img=32', createdAt: '2025-01-08T09:00:00Z', status: 'active' },
  { id: '4', title: 'Wooden Dining Table', price: 190, category: 'Furniture', condition: 'Fair', description: 'Solid oak dining table, seats 6. Some surface scratches but very sturdy.', image: 'https://images.unsplash.com/photo-1555041469-a586c61ea9bc?w=600', sellerId: 'u4', sellerName: 'Tom B.', sellerRegion: 'Queens, NY', sellerRating: 4.6, sellerAvatar: 'https://i.pravatar.cc/150?img=65', createdAt: '2025-01-07T16:00:00Z', status: 'active' },
  { id: '5', title: 'Sony WH-1000XM5 Headphones', price: 195, category: 'Electronics', condition: 'Like New', description: 'Barely used. All accessories included. Amazing noise cancellation.', image: 'https://images.unsplash.com/photo-1505740420928-5e560c06d30e?w=600', sellerId: 'u1', sellerName: 'Maria K.', sellerRegion: 'Brooklyn, NY', sellerRating: 4.8, sellerAvatar: 'https://i.pravatar.cc/150?img=47', createdAt: '2025-01-06T11:00:00Z', status: 'active' },
  { id: '6', title: 'Yoga Mat + Blocks Set', price: 35, category: 'Sports', condition: 'Good', description: 'Lululemon mat with 2 cork blocks. Lightly used, clean.', image: 'https://images.unsplash.com/photo-1544367567-0f2fcb009e0b?w=600', sellerId: 'u5', sellerName: 'Aisha M.', sellerRegion: 'Brooklyn, NY', sellerRating: 4.7, sellerAvatar: 'https://i.pravatar.cc/150?img=23', createdAt: '2025-01-05T08:00:00Z', status: 'active' },
  { id: '7', title: 'Canon EOS R50 Camera', price: 580, category: 'Electronics', condition: 'Excellent', description: 'Mirrorless camera, 24.2MP. Includes 18-45mm kit lens and extra battery.', image: 'https://images.unsplash.com/photo-1516035069371-29a1b244cc32?w=600', sellerId: 'u2', sellerName: 'James R.', sellerRegion: 'Brooklyn, NY', sellerRating: 4.9, sellerAvatar: 'https://i.pravatar.cc/150?img=12', createdAt: '2025-01-04T13:00:00Z', status: 'sold' },
  { id: '8', title: 'Potted Monstera Plant', price: 45, category: 'Home & Garden', condition: 'Good', description: 'Large monstera deliciosa, about 3 feet tall. Healthy and thriving.', image: 'https://images.unsplash.com/photo-1614594975525-e45190c55d0b?w=600', sellerId: 'u3', sellerName: 'Priya S.', sellerRegion: 'Manhattan, NY', sellerRating: 5.0, sellerAvatar: 'https://i.pravatar.cc/150?img=32', createdAt: '2025-01-03T10:00:00Z', status: 'active' },
];

export const CATEGORIES = ['All', 'Electronics', 'Furniture', 'Sports', 'Clothing', 'Home & Garden', 'Books', 'Toys', 'Other'];

export const CONDITIONS = ['New', 'Like New', 'Excellent', 'Good', 'Fair'];

export const MOCK_CONVERSATIONS: Conversation[] = [
  { id: 'c1', listingId: '2', listingTitle: 'Trek Mountain Bike', listingImage: 'https://images.unsplash.com/photo-1558618666-fcd25c85cd64?w=200', otherUserId: 'u2', otherUserName: 'James R.', otherUserAvatar: 'https://i.pravatar.cc/150?img=12', lastMessage: 'Is the bike still available?', lastMessageTime: '2025-01-10T15:30:00Z', unread: true },
  { id: 'c2', listingId: '3', listingTitle: 'iPhone 14 Pro', listingImage: 'https://images.unsplash.com/photo-1678685888221-cda773a3dcdb?w=200', otherUserId: 'u3', otherUserName: 'Priya S.', otherUserAvatar: 'https://i.pravatar.cc/150?img=32', lastMessage: 'Would you take $680?', lastMessageTime: '2025-01-09T11:00:00Z', unread: false },
];

export const MOCK_MESSAGES: Record<string, Message[]> = {
  'c1': [
    { id: 'm1', senderId: 'me', text: 'Hi! Is the bike still available?', time: '2025-01-10T15:28:00Z' },
    { id: 'm2', senderId: 'u2', text: 'Yes it is! Are you interested?', time: '2025-01-10T15:30:00Z' },
  ],
  'c2': [
    { id: 'm3', senderId: 'me', text: 'Would you take $680?', time: '2025-01-09T11:00:00Z' },
  ],
};

export const MY_LISTINGS = MOCK_LISTINGS.filter(l => l.sellerId === 'u1');

export function getRelativeTime(dateString: string): string {
  const date = new Date(dateString);
  const now = new Date();
  const diffMs = now.getTime() - date.getTime();
  const diffDays = Math.floor(diffMs / (1000 * 60 * 60 * 24));
  const diffHours = Math.floor(diffMs / (1000 * 60 * 60));
  const diffMins = Math.floor(diffMs / (1000 * 60));

  if (diffMins < 60) return `${diffMins}m ago`;
  if (diffHours < 24) return `${diffHours}h ago`;
  if (diffDays === 1) return 'Yesterday';
  if (diffDays < 7) return `${diffDays} days ago`;
  return date.toLocaleDateString('en-US', { month: 'short', day: 'numeric' });
}
