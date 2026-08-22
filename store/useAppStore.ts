import { create } from 'zustand';

export interface NotificationItem {
  id: string;
  type: string;
  eventType?: string;
  title: string;
  body: string;
  time?: string;
  read: boolean;
  related_entity_id?: string;
  entityType?: string;
  entityId?: string;
  deepLink?: string;
  idempotencyKey?: string;
  payload?: Record<string, any>;
  created_at?: string;
}

interface AppState {
  // Global Real-time State
  unreadMessageCount: number;
  setUnreadMessageCount: (count: number) => void;
  incrementUnreadMessageCount: () => void;
  
  notifications: NotificationItem[];
  setNotifications: (notifications: NotificationItem[]) => void;
  addNotification: (notification: NotificationItem) => void;
  markNotificationRead: (id: string) => void;
  markAllNotificationsRead: () => void;
  deleteNotification: (id: string) => void;
  clearAllNotifications: () => void;
  
  // Real-time connection status
  isConnected: boolean;
  setIsConnected: (status: boolean) => void;
  
  // Presence
  onlineUsers: Record<string, boolean>;
  setOnlineUsers: (users: Record<string, boolean>) => void;
  updateOnlineUser: (userId: string, isOnline: boolean) => void;
}

export const useAppStore = create<AppState>((set) => ({
  unreadMessageCount: 0,
  setUnreadMessageCount: (count) => set({ unreadMessageCount: count }),
  incrementUnreadMessageCount: () => set((state) => ({ unreadMessageCount: state.unreadMessageCount + 1 })),
  
  notifications: [],
  setNotifications: (notifications) => set({ notifications }),
  addNotification: (notification) => set((state) => ({ 
    // Idempotent insertion check in store
    notifications: state.notifications.some(n => n.id === notification.id) 
      ? state.notifications 
      : [notification, ...state.notifications] 
  })),
  markNotificationRead: (id) => set((state) => ({
    notifications: state.notifications.map(n => n.id === id ? { ...n, read: true } : n)
  })),
  markAllNotificationsRead: () => set((state) => ({
    notifications: state.notifications.map(n => ({ ...n, read: true }))
  })),
  deleteNotification: (id) => set((state) => ({
    notifications: state.notifications.filter(n => n.id !== id)
  })),
  clearAllNotifications: () => set({ notifications: [] }),
  
  isConnected: false,
  setIsConnected: (status) => set({ isConnected: status }),

  onlineUsers: {},
  setOnlineUsers: (users) => set({ onlineUsers: users }),
  updateOnlineUser: (userId, isOnline) => set((state) => {
    const next = { ...state.onlineUsers };
    if (isOnline) {
      next[userId] = true;
    } else {
      delete next[userId];
    }
    return { onlineUsers: next };
  }),
}));
