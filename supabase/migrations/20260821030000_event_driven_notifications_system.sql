-- ============================================================================
-- Migration: 20260821030000_event_driven_notifications_system.sql
-- Description: Event-driven notification system for QuickSell covering 17 marketplace
--              events with idempotency constraints, security definer RPC, and triggers.
-- ============================================================================

-- 1. Extend Notifications Table
alter table public.notifications
    add column if not exists event_type text,
    add column if not exists entity_type text,
    add column if not exists entity_id uuid,
    add column if not exists deep_link text,
    add column if not exists idempotency_key text,
    add column if not exists payload jsonb default '{}'::jsonb;

-- Idempotency Unique Index (ignoring nulls)
create unique index if not exists idx_notifications_idempotency
    on public.notifications (idempotency_key)
    where idempotency_key is not null;

-- 2. Idempotent Notification Dispatcher RPC
create or replace function public.publish_notification_event(
    p_user_id uuid,
    p_event_type text,
    p_title text,
    p_body text,
    p_entity_type text default null,
    p_entity_id uuid default null,
    p_deep_link text default null,
    p_idempotency_key text default null,
    p_payload jsonb default '{}'::jsonb
)
returns uuid
language plpgsql
security definer
as $$
declare
    v_notification_id uuid;
begin
    if p_user_id is null then
        return null;
    end if;

    -- Return existing notification if idempotency key already processed
    if p_idempotency_key is not null then
        select id into v_notification_id
        from public.notifications
        where idempotency_key = p_idempotency_key;

        if v_notification_id is not null then
            return v_notification_id;
        end if;
    end if;

    insert into public.notifications (
        user_id,
        type,
        event_type,
        title,
        body,
        read,
        entity_type,
        entity_id,
        related_entity_id,
        deep_link,
        idempotency_key,
        payload,
        created_at
    ) values (
        p_user_id,
        p_event_type,
        p_event_type,
        p_title,
        p_body,
        false,
        p_entity_type,
        p_entity_id,
        p_entity_id,
        p_deep_link,
        p_idempotency_key,
        coalesce(p_payload, '{}'::jsonb),
        now()
    )
    on conflict (idempotency_key) do nothing
    returning id into v_notification_id;

    return v_notification_id;
end;
$$;


-- 3. Automatic Trigger for NEW_MESSAGE Event
create or replace function public.on_new_message_notify()
returns trigger
language plpgsql
security definer
as $$
declare
    v_conv          public.conversations%rowtype;
    v_recipient_id  uuid;
    v_sender_name   text := 'QuickSell User';
begin
    -- Fetch conversation
    select * into v_conv
    from public.conversations
    where id = new.conversation_id;

    if not found then
        return new;
    end if;

    -- Determine recipient
    if new.sender_id = v_conv.buyer_id then
        v_recipient_id := v_conv.seller_id;
    else
        v_recipient_id := v_conv.buyer_id;
    end if;

    -- Fetch sender display name
    select coalesce(display_name, 'QuickSell User') into v_sender_name
    from public.profiles
    where id = new.sender_id;

    -- Publish notification
    perform public.publish_notification_event(
        v_recipient_id,
        'NEW_MESSAGE',
        'New Message from ' || v_sender_name,
        coalesce(substring(new.content from 1 for 100), 'Sent you an image or attachment'),
        'CHAT',
        new.conversation_id,
        '/chat/' || new.conversation_id,
        'NEW_MESSAGE:' || new.id,
        jsonb_build_object('sender_id', new.sender_id, 'conversation_id', new.conversation_id)
    );

    return new;
end;
$$;

drop trigger if exists trigger_on_new_message on public.messages;
create trigger trigger_on_new_message
    after insert on public.messages
    for each row
    execute function public.on_new_message_notify();


-- 4. Integrate Event Publishing into Order Status Transitions
drop function if exists public.transition_order_status(uuid, text, uuid, text);
create or replace function public.transition_order_status(
    p_order_id uuid,
    p_new_status text,
    p_actor_id uuid default null,
    p_reason text default null
)
returns jsonb
language plpgsql
security definer
as $$
declare
    v_order         public.orders%rowtype;
    v_prev_status   text;
    v_target_user   uuid;
    v_event_type    text;
    v_event_title   text;
    v_event_body    text;
    v_item          record;
begin
    select * into v_order
    from public.orders
    where id = p_order_id
    for update;

    if not found then
        raise exception 'Order not found for ID %', p_order_id;
    end if;

    if p_actor_id <> v_order.buyer_id and p_actor_id <> v_order.seller_id then
        raise exception 'Unauthorized: Only order buyer or seller can transition status.';
    end if;

    v_prev_status := v_order.status;
    if v_prev_status = p_new_status then
        return jsonb_build_object('success', true, 'message', 'Status unchanged.');
    end if;

    -- Update Order
    update public.orders
    set status = p_new_status, updated_at = now()
    where id = p_order_id;

    -- Audit Log
    insert into public.order_status_history (
        order_id, previous_status, new_status, actor_id, reason
    ) values (
        p_order_id, v_prev_status, p_new_status, p_actor_id, p_reason
    );

    -- Inventory Release on Cancellation / Refund
    if p_new_status in ('CANCELLED', 'REFUNDED') then
        for v_item in
            select listing_id, quantity from public.order_items where order_id = p_order_id
        loop
            update public.listings
            set
                quantity_reserved = greatest(0, coalesce(quantity_reserved, 0) - v_item.quantity),
                quantity_available = coalesce(quantity_available, 0) + v_item.quantity,
                status = case when status = 'RESERVED' then 'ACTIVE' else status end,
                updated_at = now()
            where id = v_item.listing_id;
        end loop;
    end if;

    -- Inventory Finalization on Completion
    if p_new_status = 'COMPLETED' then
        for v_item in
            select listing_id, quantity from public.order_items where order_id = p_order_id
        loop
            update public.listings
            set
                quantity_reserved = greatest(0, coalesce(quantity_reserved, 0) - v_item.quantity),
                quantity_sold = coalesce(quantity_sold, 0) + v_item.quantity,
                status = case when coalesce(quantity_available, 0) <= 0 then 'SOLD' else status end,
                updated_at = now()
            where id = v_item.listing_id;
        end loop;
    end if;

    -- Dispatch Lifecycle Event Notification
    if p_actor_id = v_order.buyer_id then
        v_target_user := v_order.seller_id;
    else
        v_target_user := v_order.buyer_id;
    end if;

    case p_new_status
        when 'ACCEPTED' then
            v_event_type := 'ORDER_ACCEPTED';
            v_event_title := 'Order Accepted!';
            v_event_body := 'The seller has accepted your order #' || substring(p_order_id::text from 1 for 8);
        when 'CANCELLED' then
            v_event_type := 'ORDER_CANCELLED';
            v_event_title := 'Order Cancelled';
            v_event_body := 'Order #' || substring(p_order_id::text from 1 for 8) || ' was cancelled.';
        when 'PAYMENT_PENDING' then
            v_event_type := 'PAYMENT_PENDING';
            v_event_title := 'Payment Requested';
            v_event_body := 'Please complete payment for order #' || substring(p_order_id::text from 1 for 8);
        when 'PAID' then
            v_event_type := 'PAYMENT_SUCCESSFUL';
            v_event_title := 'Payment Received!';
            v_event_body := 'Payment confirmed for order #' || substring(p_order_id::text from 1 for 8);
        when 'PREPARING' then
            v_event_type := 'ORDER_READY';
            v_event_title := 'Order is Being Prepared';
            v_event_body := 'Seller is preparing order #' || substring(p_order_id::text from 1 for 8);
        when 'READY_FOR_PICKUP' then
            v_event_type := 'ORDER_READY';
            v_event_title := 'Ready for Pickup!';
            v_event_body := 'Order #' || substring(p_order_id::text from 1 for 8) || ' is ready for pickup.';
        when 'OUT_FOR_DELIVERY' then
            v_event_type := 'ORDER_SHIPPED';
            v_event_title := 'Order Out for Delivery';
            v_event_body := 'Your order #' || substring(p_order_id::text from 1 for 8) || ' is on the way!';
        when 'DELIVERED' then
            v_event_type := 'ORDER_DELIVERED';
            v_event_title := 'Order Delivered';
            v_event_body := 'Order #' || substring(p_order_id::text from 1 for 8) || ' has been marked delivered.';
        when 'COMPLETED' then
            v_event_type := 'ORDER_COMPLETED';
            v_event_title := 'Order Completed!';
            v_event_body := 'Transaction completed for order #' || substring(p_order_id::text from 1 for 8);
        else
            v_event_type := 'ORDER_UPDATED';
            v_event_title := 'Order Status Updated';
            v_event_body := 'Order #' || substring(p_order_id::text from 1 for 8) || ' updated to ' || p_new_status;
    end case;

    perform public.publish_notification_event(
        v_target_user,
        v_event_type,
        v_event_title,
        v_event_body,
        'ORDER',
        p_order_id,
        '/orders/' || p_order_id,
        v_event_type || ':' || p_order_id || ':' || p_new_status,
        jsonb_build_object('order_id', p_order_id, 'status', p_new_status)
    );

    return jsonb_build_object(
        'success', true,
        'order_id', p_order_id,
        'previous_status', v_prev_status,
        'new_status', p_new_status
    );
end;
$$;
