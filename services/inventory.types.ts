// ============================================================
// QuickSell Inventory & Availability Types
// ============================================================

export type ProductStatus = 'DRAFT' | 'ACTIVE' | 'RESERVED' | 'SOLD' | 'ARCHIVED';

export type OrderStatus =
  | 'PENDING_PAYMENT'
  | 'PAID'
  | 'CONFIRMED'
  | 'COMPLETED'
  | 'CANCELLED'
  | 'EXPIRED';

export type InventoryEventType =
  | 'RESERVE'
  | 'CONFIRM_PAYMENT'
  | 'RELEASE_EXPIRATION'
  | 'CANCEL'
  | 'RESTOCK'
  | 'STATUS_CHANGE';

export type InventoryAuditLog = {
  id:                     string;
  listing_id:             string;
  order_id:               string | null;
  actor_id:               string | null;
  event_type:             InventoryEventType;
  previous_status:        ProductStatus | null;
  new_status:             ProductStatus | null;
  quantity_changed:       number;
  previous_qty_available: number;
  new_qty_available:      number;
  previous_qty_reserved:  number;
  new_qty_reserved:       number;
  notes:                  string | null;
  created_at:             string;
};

export type ReservationResult = {
  order_id:               string;
  order_status:           OrderStatus;
  reservation_expires_at: string;
  total_amount:           number;
};

export type ConcurrencyTestResult = {
  buyer1_success: boolean;
  buyer1_error:   string | null;
  buyer2_success: boolean;
  buyer2_error:   string | null;
};
