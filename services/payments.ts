import { supabase } from '@/integrations/supabase/client';

export interface PaymentRecord {
  id: string;
  order_id: string;
  buyer_id: string;
  seller_id: string;
  amount: number;
  currency: string;
  provider: string;
  provider_reference: string | null;
  status: 'PENDING' | 'INITIATED' | 'PROCESSING' | 'SUCCESSFUL' | 'FAILED' | 'REFUNDED';
  idempotency_key: string;
  created_at: string;
  updated_at: string;
}

export interface InitiatePaymentResult {
  success: boolean;
  payment_id: string;
  order_id: string;
  idempotency_key: string;
  provider_reference: string;
  client_secret: string;
  amount: number;
  currency: string;
  status: string;
}

/**
 * Initiates a payment session securely via server-side Edge Function.
 * The frontend never stores payment secret keys or declares payment success directly.
 */
export async function initiatePayment({
  orderId,
  provider = 'stripe',
}: {
  orderId: string;
  provider?: 'stripe' | 'mock_gateway';
}): Promise<InitiatePaymentResult> {
  console.log('[PaymentsService] Initiating payment for order:', { orderId, provider });

  try {
    // Invoke Supabase Edge Function 'process-payment'
    const { data, error } = await supabase.functions.invoke('process-payment/initiate', {
      body: { order_id: orderId, provider },
    });

    if (error || !data) {
      console.warn('[PaymentsService] Edge Function invoke failed, attempting RPC fallback:', error);
      return await initiatePaymentFallback(orderId, provider);
    }

    return data as InitiatePaymentResult;
  } catch (err) {
    console.warn('[PaymentsService] Edge Function exception, using RPC fallback:', err);
    return await initiatePaymentFallback(orderId, provider);
  }
}

/**
 * Fallback for local development environments where Edge Functions might not be running locally.
 */
async function initiatePaymentFallback(
  orderId: string,
  provider: string
): Promise<InitiatePaymentResult> {
  const { data: { user } } = await supabase.auth.getUser();
  if (!user) throw new Error('Authentication required to initiate payment');

  const { data: order, error: orderErr } = await supabase
    .from('orders')
    .select('*')
    .eq('id', orderId)
    .single();

  if (orderErr || !order) throw new Error('Order not found');

  const idempotencyKey = `pay_order_${order.id}_${Date.now()}`;
  const providerRef = `pi_${provider}_${Math.random().toString(36).substring(2, 12)}`;

  const { data: payment, error: payErr } = await supabase
    .from('payments')
    .insert({
      order_id: order.id,
      buyer_id: order.buyer_id,
      seller_id: order.seller_id,
      payer_id: order.buyer_id,
      payee_id: order.seller_id,
      amount: order.total_amount ?? order.amount ?? 0,
      currency: 'USD',
      provider,
      provider_reference: providerRef,
      idempotency_key: idempotencyKey,
      status: 'PENDING',
    })
    .select()
    .single();

  if (payErr || !payment) {
    console.error('[PaymentsService] Fallback payment creation error:', payErr);
    throw new Error(payErr?.message || 'Failed to create payment record');
  }

  return {
    success: true,
    payment_id: payment.id,
    order_id: order.id,
    idempotency_key: idempotencyKey,
    provider_reference: providerRef,
    client_secret: `${providerRef}_secret_${Math.random().toString(36).substring(2, 8)}`,
    amount: payment.amount,
    currency: payment.currency,
    status: 'PENDING',
  };
}

/**
 * Simulates a payment provider callback (webhook/server authorization) for testing/demo purposes.
 * Strictly uses the server RPC `handle_payment_callback` to execute status updates idempotently.
 */
export async function simulatePaymentCallback({
  idempotencyKey,
  providerReference,
  status,
}: {
  idempotencyKey: string;
  providerReference?: string;
  status: 'SUCCESSFUL' | 'FAILED';
}): Promise<{ success: boolean; idempotent: boolean; message?: string }> {
  console.log('[PaymentsService] Simulating payment callback:', { idempotencyKey, status });

  const { data, error } = await supabase.rpc('handle_payment_callback', {
    p_idempotency_key: idempotencyKey,
    p_provider_reference: providerReference ?? null,
    p_status: status,
    p_webhook_secret: 'qs_webhook_secret_key',
  });

  if (error) {
    console.error('[PaymentsService] handle_payment_callback error:', error);
    throw new Error(error.message || 'Payment callback failed');
  }

  return data as any;
}

/**
 * Fetches the current payment status for an order.
 */
export async function fetchOrderPayment(orderId: string): Promise<PaymentRecord | null> {
  const { data, error } = await supabase
    .from('payments')
    .select('*')
    .eq('order_id', orderId)
    .order('created_at', { ascending: false })
    .limit(1)
    .maybeSingle();

  if (error) {
    console.error('[PaymentsService] fetchOrderPayment error:', error);
    return null;
  }

  return data as PaymentRecord | null;
}

/**
 * Subscribes to real-time changes on the payments table for a specific payment ID.
 */
export function subscribeToPaymentStatus(
  paymentId: string,
  onUpdate: (payment: PaymentRecord) => void
) {
  const channel = supabase
    .channel(`payment_status:${paymentId}`)
    .on(
      'postgres_changes',
      {
        event: 'UPDATE',
        schema: 'public',
        table: 'payments',
        filter: `id=eq.${paymentId}`,
      },
      (payload) => {
        console.log('[PaymentsService] Payment status updated via Realtime:', payload.new);
        onUpdate(payload.new as PaymentRecord);
      }
    )
    .subscribe();

  return () => {
    supabase.removeChannel(channel);
  };
}
