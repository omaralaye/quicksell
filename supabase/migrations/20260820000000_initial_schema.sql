-- Enable PostGIS extension
create extension if not exists postgis schema extensions;
set search_path to public, extensions;

-- Table: profiles
create table if not exists public.profiles (
    id uuid references auth.users on delete cascade not null primary key,
    display_name text,
    avatar_url text,
    region text,
    location extensions.geometry(Point, 4326),
    rating numeric(3, 2) default 0.0,
    total_listings integer default 0,
    total_sales integer default 0,
    response_rate integer default 100,
    created_at timestamp with time zone default timezone('utc'::text, now()) not null,
    updated_at timestamp with time zone default timezone('utc'::text, now()) not null
);

-- Table: listings
create table if not exists public.listings (
    id uuid default gen_random_uuid() primary key,
    seller_id uuid references public.profiles(id) on delete cascade not null,
    title text not null,
    description text,
    price numeric(10, 2) not null,
    category text,
    condition text,
    image_url text,
    region text,
    location extensions.geometry(Point, 4326),
    status text default 'active', -- active, sold, out_of_stock
    created_at timestamp with time zone default timezone('utc'::text, now()) not null,
    updated_at timestamp with time zone default timezone('utc'::text, now()) not null
);

-- Table: orders (for manual escrow/wallet model)
create table if not exists public.orders (
    id uuid default gen_random_uuid() primary key,
    buyer_id uuid references public.profiles(id) on delete cascade not null,
    seller_id uuid references public.profiles(id) on delete cascade not null,
    listing_id uuid references public.listings(id) on delete set null,
    status text default 'pending', -- pending, paid, shipped, completed, cancelled
    amount numeric(10, 2) not null,
    created_at timestamp with time zone default timezone('utc'::text, now()) not null,
    updated_at timestamp with time zone default timezone('utc'::text, now()) not null
);

-- Table: conversations
create table if not exists public.conversations (
    id uuid default gen_random_uuid() primary key,
    listing_id uuid references public.listings(id) on delete set null,
    buyer_id uuid references public.profiles(id) on delete cascade not null,
    seller_id uuid references public.profiles(id) on delete cascade not null,
    last_message text,
    last_message_at timestamp with time zone,
    buyer_unread boolean default false,
    seller_unread boolean default false,
    created_at timestamp with time zone default timezone('utc'::text, now()) not null
);

-- Table: messages
create table if not exists public.messages (
    id uuid default gen_random_uuid() primary key,
    conversation_id uuid references public.conversations(id) on delete cascade not null,
    sender_id uuid references public.profiles(id) on delete cascade not null,
    text text not null,
    created_at timestamp with time zone default timezone('utc'::text, now()) not null
);

-- Table: notifications
create table if not exists public.notifications (
    id uuid default gen_random_uuid() primary key,
    user_id uuid references public.profiles(id) on delete cascade not null,
    type text not null, -- offer, message, price_drop, review, sold, system
    title text not null,
    body text not null,
    read boolean default false,
    related_entity_id uuid, -- could be a conversation, order, or listing
    created_at timestamp with time zone default timezone('utc'::text, now()) not null
);

-- Table: reviews
create table if not exists public.reviews (
    id uuid default gen_random_uuid() primary key,
    reviewer_id uuid references public.profiles(id) on delete cascade not null,
    reviewee_id uuid references public.profiles(id) on delete cascade not null,
    order_id uuid references public.orders(id) on delete set null,
    rating integer not null check (rating >= 1 and rating <= 5),
    comment text,
    created_at timestamp with time zone default timezone('utc'::text, now()) not null
);

-- Enable RLS
alter table public.profiles enable row level security;
alter table public.listings enable row level security;
alter table public.orders enable row level security;
alter table public.conversations enable row level security;
alter table public.messages enable row level security;
alter table public.notifications enable row level security;
alter table public.reviews enable row level security;

-- Profiles Policies
drop policy if exists "Public profiles are viewable by everyone." on public.profiles;
create policy "Public profiles are viewable by everyone." on public.profiles for select using (true);

drop policy if exists "Users can insert their own profile." on public.profiles;
create policy "Users can insert their own profile." on public.profiles for insert with check (auth.uid() = id);

drop policy if exists "Users can update own profile." on public.profiles;
create policy "Users can update own profile." on public.profiles for update using (auth.uid() = id);

-- Listings Policies
drop policy if exists "Listings are viewable by everyone." on public.listings;
create policy "Listings are viewable by everyone." on public.listings for select using (true);

drop policy if exists "Users can insert their own listings." on public.listings;
create policy "Users can insert their own listings." on public.listings for insert with check (auth.uid() = seller_id);

drop policy if exists "Users can update their own listings." on public.listings;
create policy "Users can update their own listings." on public.listings for update using (auth.uid() = seller_id);

drop policy if exists "Users can delete their own listings." on public.listings;
create policy "Users can delete their own listings." on public.listings for delete using (auth.uid() = seller_id);

-- Orders Policies
drop policy if exists "Users can view their own orders." on public.orders;
create policy "Users can view their own orders." on public.orders for select using (auth.uid() = buyer_id or auth.uid() = seller_id);

drop policy if exists "Buyers can create orders." on public.orders;
create policy "Buyers can create orders." on public.orders for insert with check (auth.uid() = buyer_id);

drop policy if exists "Participants can update orders." on public.orders;
create policy "Participants can update orders." on public.orders for update using (auth.uid() = buyer_id or auth.uid() = seller_id);

-- Conversations Policies
drop policy if exists "Users can view their own conversations." on public.conversations;
create policy "Users can view their own conversations." on public.conversations for select using (auth.uid() = buyer_id or auth.uid() = seller_id);

drop policy if exists "Users can create conversations." on public.conversations;
create policy "Users can create conversations." on public.conversations for insert with check (auth.uid() = buyer_id or auth.uid() = seller_id);

drop policy if exists "Participants can update conversations." on public.conversations;
create policy "Participants can update conversations." on public.conversations for update using (auth.uid() = buyer_id or auth.uid() = seller_id);

drop policy if exists "Participants can delete conversations." on public.conversations;
create policy "Participants can delete conversations." on public.conversations for delete using (auth.uid() = buyer_id or auth.uid() = seller_id);

-- Messages Policies
drop policy if exists "Users can view messages in their conversations." on public.messages;
create policy "Users can view messages in their conversations." on public.messages for select using (
    exists (
        select 1 from public.conversations
        where id = messages.conversation_id
        and (buyer_id = auth.uid() or seller_id = auth.uid())
    )
);

drop policy if exists "Users can insert messages in their conversations." on public.messages;
create policy "Users can insert messages in their conversations." on public.messages for insert with check (
    auth.uid() = sender_id and
    exists (
        select 1 from public.conversations
        where id = messages.conversation_id
        and (buyer_id = auth.uid() or seller_id = auth.uid())
    )
);

-- Notifications Policies
drop policy if exists "Users can view their own notifications." on public.notifications;
create policy "Users can view their own notifications." on public.notifications for select using (auth.uid() = user_id);

drop policy if exists "System can insert notifications." on public.notifications;
create policy "System can insert notifications." on public.notifications for insert with check (true);

drop policy if exists "Users can update their own notifications." on public.notifications;
create policy "Users can update their own notifications." on public.notifications for update using (auth.uid() = user_id);

drop policy if exists "Users can delete their own notifications." on public.notifications;
create policy "Users can delete their own notifications." on public.notifications for delete using (auth.uid() = user_id);

-- Reviews Policies
drop policy if exists "Reviews are viewable by everyone." on public.reviews;
create policy "Reviews are viewable by everyone." on public.reviews for select using (true);

drop policy if exists "Users can create reviews." on public.reviews;
create policy "Users can create reviews." on public.reviews for insert with check (auth.uid() = reviewer_id);

drop policy if exists "Users can update their own reviews." on public.reviews;
create policy "Users can update their own reviews." on public.reviews for update using (auth.uid() = reviewer_id);
