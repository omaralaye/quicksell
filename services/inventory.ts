// ============================================================
// QuickSell Inventory & Availability Service
// Server-side transaction safety via Supabase RPCs.
// ============================================================

import { supabase } from '@/integrations/supabase/client';
import type {
  ReservationResult,
  InventoryAuditLog,
  ConcurrencyTestResult,
} from './inventory.types';

/**
 * Atomically reserves inventory and creates a PENDING_PAYMENT order.
 * Uses PostgreSQL `FOR UPDATE` row-level locks on the listing to prevent
 * double-selling unique or limited inventory items.
 */
export async function initiateOrderWithReservation(params: {
  buyerId: string;
  listingId: string;
  requestedQty?: number;
  reservationMinutes?: number;
}): Promise<ReservationResult> {
  const { data, error } = await supabase.rpc('initiate_order_with_reservation', {
    p_buyer_id:            params.buyerId,
    p_listing_id:          params.listingId,
    p_requested_qty:       params.requestedQty ?? 1,
    p_reservation_minutes: params.reservationMinutes ?? 15,
  });

  if (error) {
    console.error('[inventory] initiateOrderWithReservation error:', error.message);
    throw new Error(error.message);
  }

  const row = Array.isArray(data) ? data[0] : data;
  return {
    order_id:               row.order_id,
    order_status:           row.order_status,
    reservation_expires_at: row.reservation_expires_at,
    total_amount:           Number(row.total_amount),
  };
}

/**
 * Finalizes payment for a reserved order, updates listing to SOLD or ACTIVE,
 * and logs payment transaction.
 */
export async function finalizeOrderPayment(
  orderId: string,
  stripePaymentIntentId?: string,
): Promise<boolean> {
  const { data, error } = await supabase.rpc('finalize_order_payment', {
    p_order_id:                 orderId,
    p_stripe_payment_intent_id: stripePaymentIntentId ?? null,
  });

  if (error) {
    console.error('[inventory] finalizeOrderPayment error:', error.message);
    throw new Error(error.message);
  }

  return !!data;
}

/**
 * Sweeps and releases expired reservations back into available inventory.
 * Can be called periodically or before displaying listing details.
 */
export async function releaseExpiredReservations(): Promise<number> {
  const { data, error } = await supabase.rpc('release_expired_reservations');

  if (error) {
    console.error('[inventory] releaseExpiredReservations error:', error.message);
    throw new Error(error.message);
  }

  return (data as number) ?? 0;
}

/**
 * Cancels an order and restores reserved or paid inventory.
 */
export async function cancelOrderReservation(
  orderId: string,
  cancelledBy: string,
  reason: string = 'User requested cancellation',
): Promise<boolean> {
  const { data, error } = await supabase.rpc('cancel_order_reservation', {
    p_order_id:     orderId,
    p_cancelled_by: cancelledBy,
    p_reason:       reason,
  });

  if (error) {
    console.error('[inventory] cancelOrderReservation error:', error.message);
    throw new Error(error.message);
  }

  return !!data;
}

/**
 * Runs a server-side concurrency test simulating two simultaneous buyers
 * attempting to reserve the same single-quantity listing.
 * Proves that exactly one succeeds and one is rejected.
 */
export async function testSimultaneousReservations(
  buyer1Id: string,
  buyer2Id: string,
  listingId: string,
): Promise<ConcurrencyTestResult> {
  const { data, error } = await supabase.rpc('test_simultaneous_reservations', {
    p_buyer1_id:  buyer1Id,
    p_buyer2_id:  buyer2Id,
    p_listing_id: listingId,
  });

  if (error) {
    console.error('[inventory] testSimultaneousReservations error:', error.message);
    throw new Error(error.message);
  }

  const row = Array.isArray(data) ? data[0] : data;
  return {
    buyer1_success: row.buyer1_success,
    buyer1_error:   row.buyer1_error,
    buyer2_success: row.buyer2_success,
    buyer2_error:   row.buyer2_error,
  };
}

/**
 * Fetches inventory audit logs for a seller's listing.
 */
export async function fetchInventoryAuditLogs(listingId: string): Promise<InventoryAuditLog[]> {
  const { data, error } = await supabase
    .from('inventory_audit_logs')
    .select('*')
    .eq('listing_id', listingId)
    .order('created_at', { ascending: false });

  if (error) throw error;
  return (data ?? []) as InventoryAuditLog[];
}
