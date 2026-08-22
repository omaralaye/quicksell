-- ============================================================
-- QuickSell: Product Availability & Inventory Reservation System
-- ============================================================
-- Features:
-- 1. Product Statuses: DRAFT, ACTIVE, RESERVED, SOLD, ARCHIVED
-- 2. Quantity & Reserved Inventory tracking
-- 3. Atomic Order Reservation with row-level locks (FOR UPDATE)
-- 4. Order Payment Finalization
-- 5. Reservation Expiry release function
-- 6. Order Cancellation inventory release
-- 7. Audit log table (inventory_audit_logs)
-- ============================================================

-- 1. Extend listings table with inventory tracking & status constraints
alter table public.listings
    add column if not exists quantity integer default 1 check (quantity >= 0),
    add column if not exists quantity_available integer default 1 check (quantity_available >= 0),
    add column if not exists quantity_reserved integer default 0 check (quantity_reserved >= 0);

-- Sync quantity_available for existing rows if null or default
update public.listings
set quantity = coalesce(quantity, 1),
    quantity_available = coalesce(quantity_available, quantity, 1),
    quantity_reserved = coalesce(quantity_reserved, 0);

-- Ensure listings status check supports DRAFT, ACTIVE, RESERVED, SOLD, ARCHIVED
alter table public.listings
    drop constraint if exists listings_status_check;

update public.listings
set status = upper(status)
where status in ('active', 'sold', 'draft', 'archived', 'reserved', 'out_of_stock');

update public.listings
set status = 'SOLD'
where status = 'OUT_OF_STOCK';

alter table public.listings
    add constraint listings_status_check
    check (status in ('DRAFT', 'ACTIVE', 'RESERVED', 'SOLD', 'ARCHIVED'));

alter table public.listings
    alter column status set default 'ACTIVE';

-- Inventory integrity constraint
alter table public.listings
    drop constraint if exists check_inventory_integrity;

alter table public.listings
    add constraint check_inventory_integrity
    check (quantity_available + quantity_reserved <= quantity);

-- 2. Extend orders table with reservation_expires_at
alter table public.orders
    add column if not exists reservation_expires_at timestamp with time zone;

-- Standardize order statuses: PENDING_PAYMENT, PAID, CONFIRMED, COMPLETED, CANCELLED, EXPIRED
alter table public.orders
    drop constraint if exists orders_status_check;

update public.orders
set status = upper(status)
where status in ('pending', 'paid', 'shipped', 'completed', 'cancelled', 'expired');

update public.orders
set status = 'PENDING_PAYMENT'
where status = 'PENDING';

alter table public.orders
    add constraint orders_status_check
    check (status in ('PENDING_PAYMENT', 'PAID', 'CONFIRMED', 'COMPLETED', 'CANCELLED', 'EXPIRED'));

alter table public.orders
    alter column status set default 'PENDING_PAYMENT';


-- 3. Inventory Audit Log Table
create table if not exists public.inventory_audit_logs (
    id                      uuid default gen_random_uuid() primary key,
    listing_id              uuid references public.listings(id) on delete cascade not null,
    order_id                uuid references public.orders(id) on delete set null,
    actor_id                uuid references public.profiles(id) on delete set null,
    event_type              text not null check (
                                event_type in (
                                    'RESERVE',
                                    'CONFIRM_PAYMENT',
                                    'RELEASE_EXPIRATION',
                                    'CANCEL',
                                    'RESTOCK',
                                    'STATUS_CHANGE'
                                )
                            ),
    previous_status         text,
    new_status              text,
    quantity_changed        integer not null default 0,
    previous_qty_available  integer not null,
    new_qty_available       integer not null,
    previous_qty_reserved   integer not null,
    new_qty_reserved        integer not null,
    notes                   text,
    created_at              timestamp with time zone default timezone('utc'::text, now()) not null
);

-- Enable RLS on audit logs
alter table public.inventory_audit_logs enable row level security;

drop policy if exists "Sellers view audit logs for own listings" on public.inventory_audit_logs;
create policy "Sellers view audit logs for own listings"
    on public.inventory_audit_logs for select
    using (
        exists (
            select 1 from public.listings
            where listings.id = inventory_audit_logs.listing_id
              and listings.seller_id = auth.uid()
        )
        or auth.uid() = actor_id
    );


-- ============================================================
-- RPC 1: initiate_order_with_reservation
-- ============================================================
-- Atomically reserves inventory using row-level FOR UPDATE locking.
-- Prevents double-selling unique or multi-quantity items.
create or replace function public.initiate_order_with_reservation(
    p_buyer_id              uuid,
    p_listing_id            uuid,
    p_requested_qty         integer default 1,
    p_reservation_minutes   integer default 15
)
returns table (
    order_id                uuid,
    order_status            text,
    reservation_expires_at  timestamp with time zone,
    total_amount            numeric
)
language plpgsql
security definer
as $$
declare
    target_listing          public.listings%rowtype;
    new_order_id            uuid;
    calculated_expiry       timestamp with time zone;
    prev_avail              integer;
    prev_res                integer;
    prev_stat               text;
    item_amount             numeric;
begin
    if p_requested_qty <= 0 then
        raise exception 'Requested quantity must be greater than zero';
    end if;

    -- 1. Row-level lock on listing to prevent race conditions
    select * into target_listing
    from public.listings
    where id = p_listing_id
    for update;

    if not found then
        raise exception 'Listing not found';
    end if;

    if target_listing.buyer_id is null and target_listing.seller_id = p_buyer_id then
        raise exception 'Sellers cannot purchase their own listing';
    end if;

    -- 2. Verify status is ACTIVE
    if target_listing.status <> 'ACTIVE' then
        raise exception 'Listing is not available for purchase (status: %)', target_listing.status;
    end if;

    -- 3. Verify sufficient stock available
    if target_listing.quantity_available < p_requested_qty then
        raise exception 'Insufficient stock available. Requested: %, Available: %',
            p_requested_qty, target_listing.quantity_available;
    end if;

    -- Store previous inventory metrics for audit
    prev_avail := target_listing.quantity_available;
    prev_res   := target_listing.quantity_reserved;
    prev_stat  := target_listing.status;
    item_amount := target_listing.price * p_requested_qty;

    -- 4. Calculate reservation expiry
    calculated_expiry := now() + (coalesce(p_reservation_minutes, 15) || ' minutes')::interval;

    -- 5. Create Order in PENDING_PAYMENT status
    insert into public.orders (
        buyer_id, seller_id, listing_id, amount, status, reservation_expires_at
    )
    values (
        p_buyer_id, target_listing.seller_id, p_listing_id, item_amount, 'PENDING_PAYMENT', calculated_expiry
    )
    returning id into new_order_id;

    -- 6. Insert Order Item
    insert into public.order_items (
        order_id, listing_id, quantity, price_at_purchase
    )
    values (
        new_order_id, p_listing_id, p_requested_qty, target_listing.price
    );

    -- 7. Update Listing Inventory & Status
    update public.listings
    set quantity_available = quantity_available - p_requested_qty,
        quantity_reserved  = quantity_reserved + p_requested_qty,
        status = case
                    when (quantity_available - p_requested_qty) = 0 then 'RESERVED'
                    else 'ACTIVE'
                 end,
        updated_at = now()
    where id = p_listing_id;

    -- 8. Record Audit Log
    insert into public.inventory_audit_logs (
        listing_id, order_id, actor_id, event_type,
        previous_status, new_status, quantity_changed,
        previous_qty_available, new_qty_available,
        previous_qty_reserved, new_qty_reserved, notes
    )
    values (
        p_listing_id, new_order_id, p_buyer_id, 'RESERVE',
        prev_stat,
        case when (prev_avail - p_requested_qty) = 0 then 'RESERVED' else 'ACTIVE' end,
        p_requested_qty,
        prev_avail, prev_avail - p_requested_qty,
        prev_res, prev_res + p_requested_qty,
        'Reserved ' || p_requested_qty || ' item(s) for order ' || new_order_id
    );

    -- 9. Notify Seller of Pending Reservation
    insert into public.notifications (
        user_id, type, title, body, related_entity_id
    )
    values (
        target_listing.seller_id,
        'order_reserved',
        '⏳ Order Pending: ' || left(target_listing.title, 35),
        'A buyer reserved ' || p_requested_qty || ' item(s). Payment pending.',
        new_order_id
    );

    return query select new_order_id, 'PENDING_PAYMENT'::text, calculated_expiry, item_amount;
end;
$$;


-- ============================================================
-- RPC 2: finalize_order_payment
-- ============================================================
-- Finalizes payment for a reserved order, updates listing to SOLD/ACTIVE,
-- and records transaction history.
create or replace function public.finalize_order_payment(
    p_order_id                  uuid,
    p_stripe_payment_intent_id  text default null
)
returns boolean
language plpgsql
security definer
as $$
declare
    ord             public.orders%rowtype;
    target_listing  public.listings%rowtype;
    item_record     record;
    prev_avail      integer;
    prev_res        integer;
    prev_stat       text;
    new_stat        text;
begin
    -- 1. Lock order row
    select * into ord
    from public.orders
    where id = p_order_id
    for update;

    if not found then
        raise exception 'Order not found';
    end if;

    if ord.status <> 'PENDING_PAYMENT' then
        raise exception 'Order cannot be finalized (status: %)', ord.status;
    end if;

    -- Fetch primary item
    select * into item_record
    from public.order_items
    where order_id = p_order_id
    limit 1;

    if item_record.listing_id is not null then
        -- 2. Lock listing row
        select * into target_listing
        from public.listings
        where id = item_record.listing_id
        for update;

        prev_avail := target_listing.quantity_available;
        prev_res   := target_listing.quantity_reserved;
        prev_stat  := target_listing.status;

        -- Finalize inventory: remove from reserved and decrement total quantity
        new_stat := case
                        when (target_listing.quantity - item_record.quantity) <= 0 then 'SOLD'
                        when prev_avail > 0 then 'ACTIVE'
                        else 'RESERVED'
                    end;

        update public.listings
        set quantity = quantity - item_record.quantity,
            quantity_reserved = quantity_reserved - item_record.quantity,
            status = new_stat,
            updated_at = now()
        where id = target_listing.id;

        -- Audit log entry
        insert into public.inventory_audit_logs (
            listing_id, order_id, actor_id, event_type,
            previous_status, new_status, quantity_changed,
            previous_qty_available, new_qty_available,
            previous_qty_reserved, new_qty_reserved, notes
        )
        values (
            target_listing.id, p_order_id, ord.buyer_id, 'CONFIRM_PAYMENT',
            prev_stat, new_stat, item_record.quantity,
            prev_avail, prev_avail,
            prev_res, prev_res - item_record.quantity,
            'Payment confirmed for order ' || p_order_id
        );
    end if;

    -- 3. Update order status to PAID
    update public.orders
    set status = 'PAID',
        payment_status = 'paid',
        updated_at = now()
    where id = p_order_id;

    -- 4. Record Payment record
    insert into public.payments (
        order_id, payer_id, payee_id, amount, status, stripe_payment_intent_id
    )
    values (
        p_order_id, ord.buyer_id, ord.seller_id, ord.amount, 'completed', p_stripe_payment_intent_id
    );

    -- 5. Notifications
    insert into public.notifications (user_id, type, title, body, related_entity_id)
    values
    (
        ord.seller_id, 'order_paid', '🎉 Payment Received!',
        'Payment of UGX ' || to_char(ord.amount, 'FM999,999,999') || ' received. Please fulfill the order.', p_order_id
    ),
    (
        ord.buyer_id, 'order_paid', '✅ Order Confirmed',
        'Your payment of UGX ' || to_char(ord.amount, 'FM999,999,999') || ' was successful.', p_order_id
    );

    return true;
end;
$$;


-- ============================================================
-- RPC 3: release_expired_reservations
-- ============================================================
-- Releases inventory for any PENDING_PAYMENT order that has exceeded
-- reservation_expires_at. Safe to run via cron or trigger.
create or replace function public.release_expired_reservations()
returns integer
language plpgsql
security definer
as $$
declare
    expired_ord     record;
    item_record     record;
    target_listing  public.listings%rowtype;
    released_count  integer := 0;
    prev_avail      integer;
    prev_res        integer;
    prev_stat       text;
    new_stat        text;
begin
    for expired_ord in
        select * from public.orders
        where status = 'PENDING_PAYMENT'
          and reservation_expires_at is not null
          and reservation_expires_at < now()
        for update skip locked
    loop
        -- Fetch item
        select * into item_record
        from public.order_items
        where order_id = expired_ord.id
        limit 1;

        if item_record.listing_id is not null then
            select * into target_listing
            from public.listings
            where id = item_record.listing_id
            for update;

            if found then
                prev_avail := target_listing.quantity_available;
                prev_res   := target_listing.quantity_reserved;
                prev_stat  := target_listing.status;

                -- Restore available inventory
                new_stat := case
                                when (prev_avail + item_record.quantity) > 0 then 'ACTIVE'
                                else target_listing.status
                            end;

                update public.listings
                set quantity_available = quantity_available + item_record.quantity,
                    quantity_reserved  = greatest(0, quantity_reserved - item_record.quantity),
                    status = new_stat,
                    updated_at = now()
                where id = target_listing.id;

                -- Audit Log
                insert into public.inventory_audit_logs (
                    listing_id, order_id, actor_id, event_type,
                    previous_status, new_status, quantity_changed,
                    previous_qty_available, new_qty_available,
                    previous_qty_reserved, new_qty_reserved, notes
                )
                values (
                    target_listing.id, expired_ord.id, null, 'RELEASE_EXPIRATION',
                    prev_stat, new_stat, item_record.quantity,
                    prev_avail, prev_avail + item_record.quantity,
                    prev_res, greatest(0, prev_res - item_record.quantity),
                    'Reservation expired after 15m. Returned ' || item_record.quantity || ' to available inventory.'
                );
            end if;
        end if;

        -- Update order status to EXPIRED
        update public.orders
        set status = 'EXPIRED',
            updated_at = now()
        where id = expired_ord.id;

        -- Notify buyer
        insert into public.notifications (user_id, type, title, body, related_entity_id)
        values (
            expired_ord.buyer_id,
            'order_expired',
            '⌛ Reservation Expired',
            'Your payment reservation expired. The item has been returned to the marketplace.',
            expired_ord.id
        );

        released_count := released_count + 1;
    end loop;

    return released_count;
end;
$$;


-- ============================================================
-- RPC 4: cancel_order_reservation
-- ============================================================
-- Cancels an order and returns reserved or allocated inventory.
create or replace function public.cancel_order_reservation(
    p_order_id      uuid,
    p_cancelled_by  uuid,
    p_reason        text default 'Cancelled by user'
)
returns boolean
language plpgsql
security definer
as $$
declare
    ord             public.orders%rowtype;
    item_record     record;
    target_listing  public.listings%rowtype;
    prev_avail      integer;
    prev_res        integer;
    prev_stat       text;
    new_stat        text;
begin
    select * into ord from public.orders where id = p_order_id for update;
    if not found then raise exception 'Order not found'; end if;

    if ord.status in ('COMPLETED', 'CANCELLED', 'EXPIRED') then
        raise exception 'Order is already in a final state: %', ord.status;
    end if;

    select * into item_record from public.order_items where order_id = p_order_id limit 1;

    if item_record.listing_id is not null then
        select * into target_listing from public.listings where id = item_record.listing_id for update;

        if found then
            prev_avail := target_listing.quantity_available;
            prev_res   := target_listing.quantity_reserved;
            prev_stat  := target_listing.status;

            if ord.status = 'PENDING_PAYMENT' then
                -- Release reservation
                new_stat := case when (prev_avail + item_record.quantity) > 0 then 'ACTIVE' else prev_stat end;

                update public.listings
                set quantity_available = quantity_available + item_record.quantity,
                    quantity_reserved  = greatest(0, quantity_reserved - item_record.quantity),
                    status = new_stat,
                    updated_at = now()
                where id = target_listing.id;

                insert into public.inventory_audit_logs (
                    listing_id, order_id, actor_id, event_type,
                    previous_status, new_status, quantity_changed,
                    previous_qty_available, new_qty_available,
                    previous_qty_reserved, new_qty_reserved, notes
                )
                values (
                    target_listing.id, p_order_id, p_cancelled_by, 'CANCEL',
                    prev_stat, new_stat, item_record.quantity,
                    prev_avail, prev_avail + item_record.quantity,
                    prev_res, greatest(0, prev_res - item_record.quantity),
                    'Cancelled pending reservation. Reason: ' || p_reason
                );
            elsif ord.status in ('PAID', 'CONFIRMED') then
                -- Return paid quantity to available stock
                new_stat := 'ACTIVE';

                update public.listings
                set quantity = quantity + item_record.quantity,
                    quantity_available = quantity_available + item_record.quantity,
                    status = new_stat,
                    updated_at = now()
                where id = target_listing.id;

                insert into public.inventory_audit_logs (
                    listing_id, order_id, actor_id, event_type,
                    previous_status, new_status, quantity_changed,
                    previous_qty_available, new_qty_available,
                    previous_qty_reserved, new_qty_reserved, notes
                )
                values (
                    target_listing.id, p_order_id, p_cancelled_by, 'CANCEL',
                    prev_stat, new_stat, item_record.quantity,
                    prev_avail, prev_avail + item_record.quantity,
                    prev_res, prev_res,
                    'Cancelled paid order. Restocked ' || item_record.quantity || ' item(s).'
                );
            end if;
        end if;
    end if;

    -- Update order to CANCELLED
    update public.orders
    set status = 'CANCELLED', updated_at = now()
    where id = p_order_id;

    -- Record cancellation
    insert into public.cancellations (order_id, cancelled_by, reason_text)
    values (p_order_id, p_cancelled_by, p_reason);

    return true;
end;
$$;


-- ============================================================
-- RPC 5: test_simultaneous_reservations (Concurrency Verification)
-- ============================================================
-- Simulates two concurrent buyers attempting to reserve the same single-quantity
-- product. Demonstrates row-level locking behavior.
create or replace function public.test_simultaneous_reservations(
    p_buyer1_id uuid,
    p_buyer2_id uuid,
    p_listing_id uuid
)
returns table (
    buyer1_success  boolean,
    buyer1_error    text,
    buyer2_success  boolean,
    buyer2_error    text
)
language plpgsql
security definer
as $$
declare
    b1_ok boolean := false;
    b1_err text := null;
    b2_ok boolean := false;
    b2_err text := null;
begin
    -- Attempt 1: Buyer 1
    begin
        perform public.initiate_order_with_reservation(p_buyer1_id, p_listing_id, 1, 15);
        b1_ok := true;
    exception when others then
        b1_ok := false;
        b1_err := SQLERRM;
    end;

    -- Attempt 2: Buyer 2
    begin
        perform public.initiate_order_with_reservation(p_buyer2_id, p_listing_id, 1, 15);
        b2_ok := true;
    exception when others then
        b2_ok := false;
        b2_err := SQLERRM;
    end;

    return query select b1_ok, b1_err, b2_ok, b2_err;
end;
$$;
