-- ============================================================
-- QuickSell: Quick Match Feature
-- ============================================================
-- Extends the existing buyer_requests table with the full set
-- of fields required for Quick Match, adds a responses table,
-- seller eligibility rules, and targeted notification logic.
-- ============================================================


-- ============================================================
-- SECTION 1: Extend buyer_requests
-- ============================================================
-- The table already exists with: id, buyer_id, title, description,
-- budget, location (geometry), status, created_at.
-- We add all fields required for Quick Match.

alter table public.buyer_requests
    add column if not exists category_id    uuid references public.categories(id) on delete set null,
    add column if not exists keywords       text[],                       -- extracted search terms
    add column if not exists min_price      numeric(10,2),
    add column if not exists max_price      numeric(10,2),                -- same as budget for compatibility
    add column if not exists condition_pref text,                         -- new, like_new, good, any
    add column if not exists max_distance_km integer default 25,
    add column if not exists location_label text,                         -- "Ntinda, Kampala"
    add column if not exists city           text,
    add column if not exists district       text,
    add column if not exists country        text,
    add column if not exists expires_at     timestamp with time zone,     -- null = never
    add column if not exists matched_count  integer default 0,            -- denorm: # of instant matches
    add column if not exists response_count integer default 0,            -- denorm: # of seller responses
    add column if not exists updated_at     timestamp with time zone default now();

-- Index for location-aware queries on requests
create index if not exists idx_buyer_requests_location
    on public.buyer_requests using gist (location);

create index if not exists idx_buyer_requests_status
    on public.buyer_requests (status);

create index if not exists idx_buyer_requests_city
    on public.buyer_requests (city);

create index if not exists idx_buyer_requests_category
    on public.buyer_requests (category_id);

create index if not exists idx_buyer_requests_buyer
    on public.buyer_requests (buyer_id);

-- Full-text index for reverse matching (sellers searching requests)
alter table public.buyer_requests
    add column if not exists search_vector tsvector;

update public.buyer_requests
set search_vector = to_tsvector('english',
    coalesce(title, '') || ' ' || coalesce(description, ''));

create index if not exists idx_buyer_requests_fts
    on public.buyer_requests using gin (search_vector);

create or replace function public.trg_buyer_request_search_vector()
returns trigger language plpgsql as $$
begin
    new.search_vector := to_tsvector('english',
        coalesce(new.title, '') || ' ' || coalesce(new.description, ''));
    new.updated_at := now();
    return new;
end;
$$;

drop trigger if exists trg_buyer_request_fts on public.buyer_requests;
create trigger trg_buyer_request_fts
    before insert or update of title, description
    on public.buyer_requests
    for each row execute function public.trg_buyer_request_search_vector();


-- ============================================================
-- SECTION 2: buyer_request_responses
-- ============================================================
-- A seller responds "I HAVE THIS" to a buyer request.
-- This creates a conversation thread automatically.

create table if not exists public.buyer_request_responses (
    id              uuid    default gen_random_uuid() primary key,
    request_id      uuid    references public.buyer_requests(id) on delete cascade not null,
    seller_id       uuid    references public.profiles(id) on delete cascade not null,
    listing_id      uuid    references public.listings(id) on delete set null, -- optional: their specific listing
    message         text,                                                       -- optional intro message
    conversation_id uuid    references public.conversations(id) on delete set null,
    status          text    default 'pending',                                  -- pending, accepted, declined
    created_at      timestamp with time zone default now() not null,
    updated_at      timestamp with time zone default now() not null,

    -- One seller can respond once per request
    unique(request_id, seller_id)
);

create index if not exists idx_brr_request   on public.buyer_request_responses(request_id);
create index if not exists idx_brr_seller    on public.buyer_request_responses(seller_id);
create index if not exists idx_brr_listing   on public.buyer_request_responses(listing_id);


-- ============================================================
-- SECTION 3: Seller eligibility rules (preferences)
-- ============================================================
-- Sellers opt in to receiving Quick Match notifications.
-- When absent, they get notifications for all categories they list in.

create table if not exists public.seller_notification_prefs (
    id              uuid    default gen_random_uuid() primary key,
    seller_id       uuid    references public.profiles(id) on delete cascade not null unique,
    receive_match_notifications boolean default true,
    notify_categories uuid[],       -- null = all; list = specific category UUIDs
    max_request_distance_km integer default 50,
    updated_at      timestamp with time zone default now() not null
);

create index if not exists idx_seller_notif_prefs
    on public.seller_notification_prefs(seller_id);


-- ============================================================
-- SECTION 4: find_eligible_sellers_for_request RPC
-- ============================================================
-- Returns sellers who are eligible to be notified about a buyer request.
-- Eligibility rules:
--   1. Seller has at least one active listing
--   2. Seller has listed in the request's category (or no category filter)
--   3. Seller is within the buyer's max_distance_km (if location set)
--   4. Seller has opted in to notifications (or no pref row = default opt-in)
--   5. Seller has not already responded to this request
--   6. Seller is not the buyer themselves
-- Returns at most 100 sellers to prevent spam.

create or replace function public.find_eligible_sellers_for_request(
    p_request_id uuid
)
returns table (
    seller_id           uuid,
    display_name        text,
    seller_trust_score  numeric,
    distance_km         float,
    matching_listing_id uuid     -- most relevant listing they have, if any
)
language plpgsql
security definer
set search_path = public, extensions
stable
as $$
declare
    req         public.buyer_requests%rowtype;
    req_geo     extensions.geography;
begin
    -- Load request
    select * into req from public.buyer_requests where id = p_request_id;
    if not found then return; end if;

    -- Resolve geography
    if req.location is not null then
        req_geo := req.location::extensions.geography;
    end if;

    return query
    with
    -- Active sellers who have relevant listings
    relevant_sellers as (
        select
            p.id                                        as seller_id,
            p.display_name,
            p.seller_trust_score,
            p.public_location,
            -- Best matching listing (most recent active in the category)
            (
                select l.id
                from public.listings l
                where l.seller_id = p.id
                  and l.status = 'ACTIVE'
                  and (req.category_id is null or l.category_id = req.category_id)
                  -- Keyword relevance: match any keyword in title if keywords set
                  and (
                      req.keywords is null or array_length(req.keywords, 1) is null
                      or l.search_vector @@ to_tsquery('english',
                            array_to_string(req.keywords, ' | '))
                  )
                  -- Price filter
                  and (req.min_price is null or l.price >= req.min_price)
                  and (req.max_price is null or l.price <= req.max_price)
                  -- Condition filter
                  and (req.condition_pref is null
                       or req.condition_pref = 'any'
                       or l.condition ilike req.condition_pref)
                order by l.created_at desc
                limit 1
            )                                           as matching_listing_id
        from public.profiles p
        where
            -- Must have active listings
            p.total_listings > 0
            -- Not the buyer
            and p.id <> req.buyer_id
            -- Has opted in (or no pref row)
            and not exists (
                select 1 from public.seller_notification_prefs snp
                where snp.seller_id = p.id
                  and snp.receive_match_notifications = false
            )
            -- Category preference check
            and not exists (
                select 1 from public.seller_notification_prefs snp
                where snp.seller_id = p.id
                  and snp.notify_categories is not null
                  and req.category_id is not null
                  and not (req.category_id = any(snp.notify_categories))
            )
            -- Has not already responded
            and not exists (
                select 1 from public.buyer_request_responses brr
                where brr.request_id = p_request_id
                  and brr.seller_id = p.id
            )
    )
    select
        rs.seller_id,
        rs.display_name,
        rs.seller_trust_score,
        case
            when req_geo is not null and rs.public_location is not null
            then st_distance(rs.public_location::extensions.geography, req_geo) / 1000.0
            else null
        end::float                                      as distance_km,
        rs.matching_listing_id
    from relevant_sellers rs
    where
        -- Distance filter: within buyer's max distance (if location known)
        (
            req_geo is null
            or rs.public_location is null
            or st_dwithin(
                rs.public_location::extensions.geography,
                req_geo,
                coalesce(req.max_distance_km, 25) * 1000.0
            )
        )
        -- Must have at least one matching listing OR category is null (broad request)
        and (req.category_id is null or rs.matching_listing_id is not null)
    order by
        rs.seller_trust_score desc nulls last
    limit 100;
end;
$$;


-- ============================================================
-- SECTION 5: create_buyer_request_with_notifications RPC
-- ============================================================
-- Atomically:
--   1. Inserts the buyer request
--   2. Immediately runs rank_listings for instant matches
--   3. Finds eligible sellers and inserts a notification for each
-- Returns the new request id + count of notified sellers.

set search_path to public, extensions;

create or replace function public.create_buyer_request_with_notifications(
    p_buyer_id      uuid,
    p_title         text,
    p_description   text    default null,
    p_category_id   uuid    default null,
    p_keywords      text[]  default null,
    p_min_price     numeric default null,
    p_max_price     numeric default null,
    p_condition     text    default null,
    p_location      extensions.geometry default null,
    p_location_label text   default null,
    p_city          text    default null,
    p_district      text    default null,
    p_country       text    default null,
    p_max_distance_km integer default 25,
    p_expires_at    timestamp with time zone default null
)
returns table (
    request_id          uuid,
    notified_sellers    integer
)
language plpgsql
security definer
as $$
declare
    new_request_id  uuid;
    seller_count    integer := 0;
    sel             record;
    category_name   text;
begin
    -- 1. Insert request
    insert into public.buyer_requests (
        buyer_id, title, description, category_id, keywords,
        min_price, max_price, budget, condition_pref,
        location, location_label, city, district, country,
        max_distance_km, expires_at, status
    )
    values (
        p_buyer_id, p_title, p_description, p_category_id, p_keywords,
        p_min_price, p_max_price, p_max_price, p_condition,
        p_location, p_location_label, p_city, p_district, p_country,
        p_max_distance_km, p_expires_at, 'ACTIVE'
    )
    returning id into new_request_id;

    -- 2. Resolve category name for notifications
    select name into category_name from public.categories where id = p_category_id;

    -- 3. Notify eligible sellers
    for sel in
        select * from public.find_eligible_sellers_for_request(new_request_id)
    loop
        insert into public.notifications (
            user_id, type, title, body, related_entity_id
        )
        values (
            sel.seller_id,
            'buyer_request',
            '🔍 New buyer looking for: ' || left(p_title, 50),
            case
                when p_max_price is not null
                then 'Budget: UGX ' || to_char(p_max_price, 'FM999,999,999') ||
                     case when p_city is not null then ' · ' || p_city else '' end
                else coalesce(p_city, 'Nearby')
            end,
            new_request_id
        );
        seller_count := seller_count + 1;
    end loop;

    return query select new_request_id, seller_count;
end;
$$;


-- ============================================================
-- SECTION 6: respond_to_buyer_request RPC
-- ============================================================
-- Seller taps "I HAVE THIS". This:
--   1. Inserts a buyer_request_response row
--   2. Creates (or fetches) a conversation between buyer and seller
--   3. Sends the seller's intro message into that conversation
--   4. Sends a notification to the buyer
--   5. Increments response_count on the request

create or replace function public.respond_to_buyer_request(
    p_seller_id     uuid,
    p_request_id    uuid,
    p_listing_id    uuid    default null,
    p_message       text    default null
)
returns table (
    response_id     uuid,
    conversation_id uuid
)
language plpgsql
security definer
as $$
declare
    req             public.buyer_requests%rowtype;
    conv_id         uuid;
    resp_id         uuid;
    existing_conv   uuid;
    intro_msg       text;
begin
    -- Load request
    select * into req from public.buyer_requests where id = p_request_id;
    if not found then raise exception 'Request not found'; end if;
    if req.status <> 'ACTIVE' then raise exception 'Request is no longer active'; end if;

    -- Prevent seller from responding to their own requests
    if req.buyer_id = p_seller_id then raise exception 'Cannot respond to your own request'; end if;

    -- Check for existing conversation between this buyer-seller pair on this listing
    select id into existing_conv
    from public.conversations
    where buyer_id = req.buyer_id
      and seller_id = p_seller_id
      and (p_listing_id is null or listing_id = p_listing_id)
    limit 1;

    if existing_conv is not null then
        conv_id := existing_conv;
    else
        -- Create new conversation
        insert into public.conversations (
            listing_id, buyer_id, seller_id,
            last_message, last_message_at
        )
        values (
            p_listing_id, req.buyer_id, p_seller_id,
            coalesce(p_message, 'Hi, I have what you''re looking for!'),
            now()
        )
        returning id into conv_id;
    end if;

    -- Build intro message
    intro_msg := coalesce(p_message,
        'Hi! I saw your request for "' || left(req.title, 60) || '" — I have this available. Let''s talk!');

    -- Insert message
    insert into public.messages (conversation_id, sender_id, text)
    values (conv_id, p_seller_id, intro_msg);

    -- Insert response record (ignore if duplicate)
    insert into public.buyer_request_responses (
        request_id, seller_id, listing_id, message, conversation_id, status
    )
    values (p_request_id, p_seller_id, p_listing_id, intro_msg, conv_id, 'pending')
    on conflict (request_id, seller_id) do update
        set listing_id = excluded.listing_id,
            conversation_id = excluded.conversation_id,
            updated_at = now()
    returning id into resp_id;

    -- Increment response_count
    update public.buyer_requests
    set response_count = response_count + 1
    where id = p_request_id;

    -- Notify the buyer
    insert into public.notifications (user_id, type, title, body, related_entity_id)
    values (
        req.buyer_id,
        'buyer_request_response',
        '💬 A seller has what you''re looking for!',
        'Tap to see their listing and start chatting.',
        conv_id
    );

    return query select resp_id, conv_id;
end;
$$;


-- ============================================================
-- SECTION 7: RLS for new tables
-- ============================================================

-- buyer_request_responses
alter table public.buyer_request_responses enable row level security;

-- Buyer sees responses to their requests; seller sees their own responses
drop policy if exists "brr_select_participant" on public.buyer_request_responses;
create policy "brr_select_participant"
    on public.buyer_request_responses for select
    using (
        seller_id = auth.uid()
        or exists (
            select 1 from public.buyer_requests br
            where br.id = request_id and br.buyer_id = auth.uid()
        )
    );

-- Sellers insert their own responses
drop policy if exists "brr_insert_seller" on public.buyer_request_responses;
create policy "brr_insert_seller"
    on public.buyer_request_responses for insert
    with check (
        auth.uid() = seller_id
        and exists (
            select 1 from public.buyer_requests br
            where br.id = request_id and br.status = 'ACTIVE'
        )
    );

-- seller_notification_prefs
alter table public.seller_notification_prefs enable row level security;

drop policy if exists "snp_select_own" on public.seller_notification_prefs;
create policy "snp_select_own"
    on public.seller_notification_prefs for select
    using (auth.uid() = seller_id);

drop policy if exists "snp_upsert_own" on public.seller_notification_prefs;
create policy "snp_upsert_own"
    on public.seller_notification_prefs for all
    using (auth.uid() = seller_id)
    with check (auth.uid() = seller_id);
