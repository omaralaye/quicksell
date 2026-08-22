-- ============================================================
-- Migration: 20260821040000_secure_payment_architecture.sql
-- Description: Zero-trust payment lifecycle, idempotency key,
-- RLS policies, and handle_payment_callback RPC.
-- ============================================================

-- 1. Ensure public.payments schema completeness
alter table public.payments
  add column if not exists buyer_id uuid references public.profiles(id) on delete set null,
  add column if not exists seller_id uuid references public.profiles(id) on delete set null,
  add column if not exists currency text default 'USD',
  add column if not exists provider text default 'stripe',
  add column if not exists provider_reference text,
  add column if not exists idempotency_key text,
  add column if not exists updated_at timestamp with time zone default timezone('utc'::text, now());

-- Add unique constraint on idempotency_key if not exists
do $$
begin
  if not exists (
    select 1 from pg_constraint where conname = 'payments_idempotency_key_key'
  ) then
    alter table public.payments add constraint payments_idempotency_key_key unique (idempotency_key);
  end if;
end $$;

-- Create index on provider_reference for fast webhook lookups
create index if not exists idx_payments_provider_ref on public.payments(provider_reference);
create index if not exists idx_payments_order_id on public.payments(order_id);

-- 2. RLS Security Configuration
alter table public.payments enable row level security;

-- Drop old policies if existing
drop policy if exists "Payments viewable by participants" on public.payments;
drop policy if exists "payments_select_participant" on public.payments;

-- Select policy: Payer, Payee, Buyer, Seller
create policy "payments_select_participant"
  on public.payments for select
  using (
    auth.uid() = buyer_id or 
    auth.uid() = seller_id or 
    auth.uid() = payer_id or 
    auth.uid() = payee_id
  );

-- Direct client INSERT / UPDATE / DELETE policies are NOT created.
-- Payments can ONLY be modified via Edge Functions or Security Definer RPCs.

-- 3. Security Definer RPC for Server-Side Idempotent Callback Processing
create or replace function public.handle_payment_callback(
  p_idempotency_key text,
  p_provider_reference text,
  p_status text, -- 'SUCCESSFUL' or 'FAILED'
  p_webhook_secret text default null
)
returns jsonb
language plpgsql
security definer
set search_path = public
as $$
declare
  v_payment record;
  v_order record;
  v_listing_id uuid;
  v_item_qty integer;
  v_already_processed boolean := false;
  v_result jsonb;
begin
  -- Normalize status input
  p_status := upper(trim(p_status));
  if p_status not in ('SUCCESSFUL', 'FAILED') then
    raise exception 'Invalid payment status: %. Must be SUCCESSFUL or FAILED.', p_status;
  end if;

  -- Locate payment record by idempotency_key or provider_reference
  select * into v_payment
  from public.payments
  where idempotency_key = p_idempotency_key
     or (p_provider_reference is not null and provider_reference = p_provider_reference)
  for update;

  if v_payment.id is null then
    raise exception 'Payment record not found for idempotency key % or reference %', p_idempotency_key, p_provider_reference;
  end if;

  -- IDEMPOTENCY CHECK: If already final, return early with current status without duplicating actions!
  if v_payment.status in ('SUCCESSFUL', 'FAILED') then
    return jsonb_build_object(
      'success', true,
      'idempotent', true,
      'payment_id', v_payment.id,
      'status', v_payment.status,
      'message', 'Payment callback already processed'
    );
  end if;

  -- Locate associated order
  select * into v_order
  from public.orders
  where id = v_payment.order_id;

  -- Process SUCCESSFUL payment
  if p_status = 'SUCCESSFUL' then
    -- 1. Update payment record
    update public.payments
    set status = 'SUCCESSFUL',
        provider_reference = coalesce(p_provider_reference, provider_reference),
        updated_at = timezone('utc'::text, now())
    where id = v_payment.id;

    -- 2. Update order status to PAID using order transition engine
    perform public.transition_order_status(
      v_payment.order_id,
      'PAID',
      v_payment.buyer_id,
      'Payment confirmed via provider callback'
    );

    -- 3. Update listing availability status if reserved
    select listing_id, quantity into v_listing_id, v_item_qty
    from public.order_items
    where order_id = v_payment.order_id
    limit 1;

    if v_listing_id is not null then
      update public.listings
      set status = case when quantity <= 0 then 'sold' else status end,
          reserved_until = null
      where id = v_listing_id;
    end if;

    -- 4. Create ledger transaction entry
    insert into public.transactions (
      payment_id,
      type,
      status,
      amount,
      created_at
    ) values (
      v_payment.id,
      'PAYMENT',
      'COMPLETED',
      v_payment.amount,
      timezone('utc'::text, now())
    );

    -- 5. Publish PAYMENT_SUCCESSFUL notifications to seller & buyer
    perform public.publish_notification_event(
      p_user_id         := v_payment.seller_id,
      p_event_type      := 'PAYMENT_SUCCESSFUL',
      p_title           := 'Payment Received!',
      p_body            := 'Payment of $' || v_payment.amount || ' for order #' || substring(v_payment.order_id::text from 1 for 8) || ' has been confirmed.',
      p_entity_type     := 'ORDER',
      p_entity_id       := v_payment.order_id,
      p_deep_link       := '/orders/' || v_payment.order_id,
      p_idempotency_key := 'payment_success_seller_' || v_payment.id
    );

    perform public.publish_notification_event(
      p_user_id         := v_payment.buyer_id,
      p_event_type      := 'PAYMENT_SUCCESSFUL',
      p_title           := 'Payment Successful!',
      p_body            := 'Your payment of $' || v_payment.amount || ' was processed successfully.',
      p_entity_type     := 'ORDER',
      p_entity_id       := v_payment.order_id,
      p_deep_link       := '/orders/' || v_payment.order_id,
      p_idempotency_key := 'payment_success_buyer_' || v_payment.id
    );

    v_result := jsonb_build_object(
      'success', true,
      'idempotent', false,
      'payment_id', v_payment.id,
      'order_id', v_payment.order_id,
      'status', 'SUCCESSFUL'
    );

  -- Process FAILED payment
  elsif p_status = 'FAILED' then
    -- 1. Update payment status to FAILED
    update public.payments
    set status = 'FAILED',
        provider_reference = coalesce(p_provider_reference, provider_reference),
        updated_at = timezone('utc'::text, now())
    where id = v_payment.id;

    -- 2. Release inventory reservation if order is cancelled/failed
    select listing_id, quantity into v_listing_id, v_item_qty
    from public.order_items
    where order_id = v_payment.order_id
    limit 1;

    if v_listing_id is not null then
      -- Restore quantity and re-activate listing
      update public.listings
      set quantity = quantity + coalesce(v_item_qty, 1),
          status = 'active',
          reserved_until = null
      where id = v_listing_id;
    end if;

    -- 3. Notify buyer of payment failure
    perform public.publish_notification_event(
      p_user_id         := v_payment.buyer_id,
      p_event_type      := 'ORDER_CANCELLED',
      p_title           := 'Payment Failed',
      p_body            := 'Your payment of $' || v_payment.amount || ' failed. The item reservation has been released.',
      p_entity_type     := 'ORDER',
      p_entity_id       := v_payment.order_id,
      p_deep_link       := '/orders/' || v_payment.order_id,
      p_idempotency_key := 'payment_failed_buyer_' || v_payment.id
    );

    v_result := jsonb_build_object(
      'success', true,
      'idempotent', false,
      'payment_id', v_payment.id,
      'order_id', v_payment.order_id,
      'status', 'FAILED'
    );
  end if;

  return v_result;
end;
$$;
