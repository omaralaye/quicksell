-- ============================================================================
-- Migration: 20260821010000_order_lifecycle_system.sql
-- Description: Implement controlled 13-state machine, status transition enforcement
--              RPC, order_status_history audit logging, and inventory hooks.
-- ============================================================================

-- 1. Update Order Status Constraint
alter table public.orders
    drop constraint if exists orders_status_check;

-- Map legacy statuses to standardized lifecycle state names
update public.orders
set status = 'PAYMENT_PENDING'
where status in ('PENDING_PAYMENT', 'pending_payment');

update public.orders
set status = 'ACCEPTED'
where status in ('CONFIRMED', 'confirmed');

update public.orders
set status = 'CANCELLED'
where status in ('EXPIRED', 'expired');

update public.orders
set status = upper(status)
where status in ('pending', 'paid', 'completed', 'cancelled');

alter table public.orders
    add constraint orders_status_check
    check (status in (
        'PENDING',
        'ACCEPTED',
        'PAYMENT_PENDING',
        'PAID',
        'PREPARING',
        'READY_FOR_PICKUP',
        'OUT_FOR_DELIVERY',
        'DELIVERED',
        'COMPLETED',
        'CANCELLED',
        'REFUND_PENDING',
        'REFUNDED',
        'DISPUTED'
    ));

alter table public.orders
    alter column status set default 'PENDING';

-- 2. Create Order Status History Table
create table if not exists public.order_status_history (
    id              uuid default gen_random_uuid() primary key,
    order_id        uuid references public.orders(id) on delete cascade not null,
    previous_status text,
    new_status      text not null,
    actor_id        uuid references public.profiles(id) on delete set null,
    reason          text,
    created_at      timestamp with time zone default now() not null
);

alter table public.order_status_history enable row level security;

drop policy if exists "order_status_history_select_participant" on public.order_status_history;
create policy "order_status_history_select_participant"
    on public.order_status_history for select
    using (
        exists (
            select 1 from public.orders o
            where o.id = order_status_history.order_id
              and (o.buyer_id = auth.uid() or o.seller_id = auth.uid())
        )
    );

drop policy if exists "order_status_history_insert_authenticated" on public.order_status_history;
create policy "order_status_history_insert_authenticated"
    on public.order_status_history for insert
    with check (
        exists (
            select 1 from public.orders o
            where o.id = order_status_history.order_id
              and (o.buyer_id = auth.uid() or o.seller_id = auth.uid())
        )
    );

-- 3. Controlled State Transition Function
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
    ord             public.orders%rowtype;
    v_actor         uuid;
    v_is_valid      boolean := false;
    v_item          record;
begin
    v_actor := coalesce(p_actor_id, auth.uid());
    
    -- Lock order row for update
    select * into ord
    from public.orders
    where id = p_order_id
    for update;

    if not found then
        raise exception 'Order with ID % not found.', p_order_id;
    end if;

    -- Verify actor authorization
    if v_actor is not null and v_actor <> ord.buyer_id and v_actor <> ord.seller_id then
        raise exception 'Unauthorized: User % is neither buyer nor seller of order %', v_actor, p_order_id;
    end if;

    -- Normalize status string
    p_new_status := upper(trim(p_new_status));

    -- Validate transition matrix rules
    case ord.status
        when 'PENDING' then
            if p_new_status in ('ACCEPTED', 'CANCELLED') then v_is_valid := true; end if;
        when 'ACCEPTED' then
            if p_new_status in ('PAYMENT_PENDING', 'CANCELLED') then v_is_valid := true; end if;
        when 'PAYMENT_PENDING' then
            if p_new_status in ('PAID', 'CANCELLED') then v_is_valid := true; end if;
        when 'PAID' then
            if p_new_status in ('PREPARING', 'REFUND_PENDING', 'CANCELLED') then v_is_valid := true; end if;
        when 'PREPARING' then
            if p_new_status in ('READY_FOR_PICKUP', 'DISPUTED', 'CANCELLED') then v_is_valid := true; end if;
        when 'READY_FOR_PICKUP' then
            if p_new_status in ('OUT_FOR_DELIVERY', 'DELIVERED', 'DISPUTED') then v_is_valid := true; end if;
        when 'OUT_FOR_DELIVERY' then
            if p_new_status in ('DELIVERED', 'DISPUTED') then v_is_valid := true; end if;
        when 'DELIVERED' then
            if p_new_status in ('COMPLETED', 'DISPUTED') then v_is_valid := true; end if;
        when 'DISPUTED' then
            if p_new_status in ('REFUND_PENDING', 'COMPLETED') then v_is_valid := true; end if;
        when 'REFUND_PENDING' then
            if p_new_status in ('REFUNDED') then v_is_valid := true; end if;
        else
            v_is_valid := false;
    end case;

    if not v_is_valid then
        raise exception 'Invalid status transition from % to % for order %', ord.status, p_new_status, p_order_id;
    end if;

    -- Inventory restoration hooks on CANCELLED / REFUNDED
    if p_new_status in ('CANCELLED', 'REFUNDED') and ord.status not in ('CANCELLED', 'REFUNDED') then
        for v_item in
            select listing_id, quantity
            from public.order_items
            where order_id = p_order_id
        loop
            update public.listings
            set
                quantity_reserved = greatest(0, quantity_reserved - v_item.quantity),
                quantity_available = quantity_available + v_item.quantity,
                status = case when status = 'RESERVED' then 'ACTIVE' else status end,
                updated_at = now()
            where id = v_item.listing_id;
        end loop;
    end if;

    -- Update order status
    update public.orders
    set
        status = p_new_status,
        updated_at = now()
    where id = p_order_id;

    -- Record audit log
    insert into public.order_status_history (
        order_id,
        previous_status,
        new_status,
        actor_id,
        reason
    ) values (
        p_order_id,
        ord.status,
        p_new_status,
        v_actor,
        p_reason
    );

    -- Send notification to opposite party if notification system exists
    insert into public.notifications (
        user_id,
        title,
        message,
        type,
        data
    ) values (
        case when v_actor = ord.buyer_id then ord.seller_id else ord.buyer_id end,
        'Order Status Updated',
        'Order #' || substring(p_order_id::text, 1, 8) || ' updated to ' || p_new_status,
        'order_status',
        jsonb_build_object('order_id', p_order_id, 'new_status', p_new_status)
    );

    return jsonb_build_object(
        'success', true,
        'order_id', p_order_id,
        'previous_status', ord.status,
        'new_status', p_new_status
    );
end;
$$;

-- 4. Enable Realtime Publications
alter publication supabase_realtime add table public.order_status_history;
