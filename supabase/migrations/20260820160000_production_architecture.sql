-- Up Migration for QuickSell Production Architecture

-- 1. Profiles Modifications
alter table public.profiles 
add column if not exists is_verified boolean default false,
add column if not exists stripe_account_id text,
add column if not exists stripe_customer_id text;

-- 2. Verification Records
create table if not exists public.verification_records (
    id uuid default gen_random_uuid() primary key,
    user_id uuid references public.profiles(id) on delete cascade not null,
    document_type text not null,
    status text default 'pending', -- pending, approved, rejected
    verified_at timestamp with time zone,
    created_at timestamp with time zone default timezone('utc'::text, now()) not null
);
create index if not exists idx_verification_records_user on public.verification_records(user_id);

-- 3. Categories
create table if not exists public.categories (
    id uuid default gen_random_uuid() primary key,
    name text not null unique,
    slug text not null unique,
    parent_id uuid references public.categories(id) on delete set null,
    created_at timestamp with time zone default timezone('utc'::text, now()) not null
);

-- Note: Data Migration for categories
alter table public.listings
add column if not exists category_id uuid references public.categories(id) on delete set null,
add column if not exists quantity integer default 1 check (quantity >= 0),
add column if not exists pickup_preferences jsonb default '[]'::jsonb,
add column if not exists delivery_options jsonb default '[]'::jsonb,
add column if not exists reserved_until timestamp with time zone;

do $$
begin
    if exists (
        select 1 from information_schema.columns 
        where table_schema = 'public' and table_name = 'listings' and column_name = 'category'
    ) then
        insert into public.categories (name, slug)
        select distinct category, lower(regexp_replace(category, '[^a-zA-Z0-9]+', '-', 'g'))
        from public.listings
        where category is not null
        on conflict (name) do nothing;

        update public.listings l
        set category_id = c.id
        from public.categories c
        where l.category = c.name;

        alter table public.listings drop column if exists category;
    end if;
end $$;

-- 4. Listing Images
create table if not exists public.listing_images (
    id uuid default gen_random_uuid() primary key,
    listing_id uuid references public.listings(id) on delete cascade not null,
    image_url text not null,
    display_order integer default 0,
    created_at timestamp with time zone default timezone('utc'::text, now()) not null
);
create index if not exists idx_listing_images_listing on public.listing_images(listing_id);

do $$
begin
    if exists (
        select 1 from information_schema.columns 
        where table_schema = 'public' and table_name = 'listings' and column_name = 'image_url'
    ) then
        insert into public.listing_images (listing_id, image_url, display_order)
        select id, image_url, 0
        from public.listings
        where image_url is not null
        on conflict do nothing;
    end if;
end $$;

-- 5. Favorites
create table if not exists public.favorites (
    id uuid default gen_random_uuid() primary key,
    user_id uuid references public.profiles(id) on delete cascade not null,
    listing_id uuid references public.listings(id) on delete cascade not null,
    created_at timestamp with time zone default timezone('utc'::text, now()) not null,
    unique(user_id, listing_id)
);

-- 6. Listing Interactions
create table if not exists public.listing_interactions (
    id uuid default gen_random_uuid() primary key,
    listing_id uuid references public.listings(id) on delete cascade not null,
    user_id uuid references public.profiles(id) on delete set null,
    interaction_type text not null, -- view, share
    created_at timestamp with time zone default timezone('utc'::text, now()) not null
);

set search_path to public, extensions;

-- 7. Buyer Requests
create table if not exists public.buyer_requests (
    id uuid default gen_random_uuid() primary key,
    buyer_id uuid references public.profiles(id) on delete cascade not null,
    title text not null,
    description text,
    budget numeric(10, 2),
    location extensions.geometry(Point, 4326),
    status text default 'active', -- active, fulfilled, cancelled
    created_at timestamp with time zone default timezone('utc'::text, now()) not null
);

-- 8. Order modifications and new tables
alter table public.orders
add column if not exists pickup_time timestamp with time zone,
add column if not exists delivery_tracking text,
add column if not exists payment_status text default 'pending';

create table if not exists public.order_items (
    id uuid default gen_random_uuid() primary key,
    order_id uuid references public.orders(id) on delete cascade not null,
    listing_id uuid references public.listings(id) on delete set null,
    quantity integer not null check (quantity > 0),
    price_at_purchase numeric(10, 2) not null,
    created_at timestamp with time zone default timezone('utc'::text, now()) not null
);

do $$
begin
    if exists (
        select 1 from information_schema.columns 
        where table_schema = 'public' and table_name = 'orders' and column_name = 'listing_id'
    ) then
        insert into public.order_items (order_id, listing_id, quantity, price_at_purchase)
        select id, listing_id, 1, coalesce(amount, 0)
        from public.orders
        where listing_id is not null
        on conflict do nothing;

        alter table public.orders drop column if exists listing_id;
    end if;
end $$;

create table if not exists public.order_status_history (
    id uuid default gen_random_uuid() primary key,
    order_id uuid references public.orders(id) on delete cascade not null,
    status text not null,
    changed_by uuid references public.profiles(id) on delete set null,
    notes text,
    created_at timestamp with time zone default timezone('utc'::text, now()) not null
);

-- 9. Payments, Transactions, Cancellations
create table if not exists public.payments (
    id uuid default gen_random_uuid() primary key,
    order_id uuid references public.orders(id) on delete set null,
    payer_id uuid references public.profiles(id) on delete set null,
    payee_id uuid references public.profiles(id) on delete set null,
    amount numeric(10, 2) not null,
    status text default 'pending',
    stripe_payment_intent_id text,
    created_at timestamp with time zone default timezone('utc'::text, now()) not null
);

create table if not exists public.transactions (
    id uuid default gen_random_uuid() primary key,
    payment_id uuid references public.payments(id) on delete set null,
    type text not null,
    status text default 'pending',
    amount numeric(10, 2) not null,
    created_at timestamp with time zone default timezone('utc'::text, now()) not null
);

create table if not exists public.cancellations (
    id uuid default gen_random_uuid() primary key,
    order_id uuid references public.orders(id) on delete cascade not null,
    cancelled_by uuid references public.profiles(id) on delete set null,
    reason_text text not null,
    refund_status text default 'none',
    created_at timestamp with time zone default timezone('utc'::text, now()) not null
);

-- 10. RPC for Transaction-Safe Purchasing
create or replace function public.reserve_listing_quantity(
    target_listing_id uuid,
    requested_qty integer
)
returns boolean
language plpgsql
as $$
declare
    rows_affected integer;
begin
    update public.listings
    set quantity = quantity - requested_qty
    where id = target_listing_id and quantity >= requested_qty;
    
    get diagnostics rows_affected = row_count;
    
    return rows_affected > 0;
end;
$$;

-- 11. Enable RLS and add policies
alter table public.verification_records enable row level security;
drop policy if exists "Users view own verification records" on public.verification_records;
create policy "Users view own verification records" on public.verification_records for select using (auth.uid() = user_id);

drop policy if exists "Users create own verification records" on public.verification_records;
create policy "Users create own verification records" on public.verification_records for insert with check (auth.uid() = user_id);

alter table public.categories enable row level security;
drop policy if exists "Categories are viewable by everyone" on public.categories;
create policy "Categories are viewable by everyone" on public.categories for select using (true);

alter table public.listing_images enable row level security;
drop policy if exists "Images viewable by everyone" on public.listing_images;
create policy "Images viewable by everyone" on public.listing_images for select using (true);

drop policy if exists "Users manage own images" on public.listing_images;
create policy "Users manage own images" on public.listing_images for all using (
    exists (select 1 from public.listings where id = listing_id and seller_id = auth.uid())
);

alter table public.favorites enable row level security;
drop policy if exists "Users view own favorites" on public.favorites;
create policy "Users view own favorites" on public.favorites for select using (auth.uid() = user_id);

drop policy if exists "Users manage own favorites" on public.favorites;
create policy "Users manage own favorites" on public.favorites for all using (auth.uid() = user_id);

alter table public.listing_interactions enable row level security;
drop policy if exists "Interactions viewable by seller" on public.listing_interactions;
create policy "Interactions viewable by seller" on public.listing_interactions for select using (
    exists (select 1 from public.listings where id = listing_id and seller_id = auth.uid())
);

drop policy if exists "Anyone inserts interactions" on public.listing_interactions;
create policy "Anyone inserts interactions" on public.listing_interactions for insert with check (true);

alter table public.buyer_requests enable row level security;
drop policy if exists "Requests viewable by everyone" on public.buyer_requests;
create policy "Requests viewable by everyone" on public.buyer_requests for select using (true);

drop policy if exists "Users manage own requests" on public.buyer_requests;
create policy "Users manage own requests" on public.buyer_requests for all using (auth.uid() = buyer_id);

alter table public.order_items enable row level security;
drop policy if exists "Items viewable by participants" on public.order_items;
create policy "Items viewable by participants" on public.order_items for select using (
    exists (select 1 from public.orders where id = order_id and (buyer_id = auth.uid() or seller_id = auth.uid()))
);

drop policy if exists "Buyers insert order items" on public.order_items;
create policy "Buyers insert order items" on public.order_items for insert with check (
    exists (select 1 from public.orders where id = order_id and buyer_id = auth.uid())
);

alter table public.order_status_history enable row level security;
drop policy if exists "History viewable by participants" on public.order_status_history;
create policy "History viewable by participants" on public.order_status_history for select using (
    exists (select 1 from public.orders where id = order_id and (buyer_id = auth.uid() or seller_id = auth.uid()))
);

drop policy if exists "Participants insert history" on public.order_status_history;
create policy "Participants insert history" on public.order_status_history for insert with check (
    exists (select 1 from public.orders where id = order_id and (buyer_id = auth.uid() or seller_id = auth.uid()))
);

alter table public.payments enable row level security;
drop policy if exists "Payments viewable by participants" on public.payments;
create policy "Payments viewable by participants" on public.payments for select using (auth.uid() = payer_id or auth.uid() = payee_id);

alter table public.transactions enable row level security;

alter table public.cancellations enable row level security;
drop policy if exists "Cancellations viewable by participants" on public.cancellations;
create policy "Cancellations viewable by participants" on public.cancellations for select using (
    exists (select 1 from public.orders where id = order_id and (buyer_id = auth.uid() or seller_id = auth.uid()))
);

drop policy if exists "Participants insert cancellations" on public.cancellations;
create policy "Participants insert cancellations" on public.cancellations for insert with check (auth.uid() = cancelled_by);
