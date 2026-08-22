-- ============================================================
-- QuickSell: Marketplace Matching & Ranking Engine
-- ============================================================
-- This migration introduces a fully configurable, multi-signal
-- ranking system that replaces the hardcoded formula in the
-- previous get_nearby_listings RPC.
--
-- Architecture:
--   ranking_weights   → persisted config table (default + named profiles)
--   seller_trust_score → materialised column on profiles (maintained by trigger)
--   rank_listings     → the primary matching RPC (no N+1 queries)
--   get_nearby_listings → thin wrapper kept for backward compat
-- ============================================================


-- ============================================================
-- SECTION 1: ranking_weights config table
-- ============================================================
-- Weights sum to 1.0. A named profile ('default') is always read
-- at query time so no code change is required to tune the engine.

create table if not exists public.ranking_weights (
    id          uuid    default gen_random_uuid() primary key,
    profile     text    not null unique,  -- 'default', 'price_focused', etc.
    -- weights (must sum to 1.0 — enforced by check constraint)
    w_text      numeric(4,3) not null default 0.30,  -- text relevance
    w_distance  numeric(4,3) not null default 0.25,  -- geographic proximity
    w_price     numeric(4,3) not null default 0.15,  -- price competitiveness
    w_seller    numeric(4,3) not null default 0.15,  -- seller trust
    w_condition numeric(4,3) not null default 0.05,  -- product condition
    w_freshness numeric(4,3) not null default 0.05,  -- listing freshness
    w_response  numeric(4,3) not null default 0.03,  -- seller response rate
    w_avail     numeric(4,3) not null default 0.02,  -- product availability
    created_at  timestamp with time zone default now() not null,
    updated_at  timestamp with time zone default now() not null,

    -- Ensure weights are non-negative
    constraint weights_non_negative check (
        w_text >= 0 and w_distance >= 0 and w_price >= 0 and w_seller >= 0 and
        w_condition >= 0 and w_freshness >= 0 and w_response >= 0 and w_avail >= 0
    ),
    -- Ensure weights sum to exactly 1.0 (±0.001 for floating point)
    constraint weights_sum_to_one check (
        abs(w_text + w_distance + w_price + w_seller + w_condition +
            w_freshness + w_response + w_avail - 1.0) < 0.001
    )
);

-- Default weight profile
insert into public.ranking_weights (profile, w_text, w_distance, w_price, w_seller, w_condition, w_freshness, w_response, w_avail)
values ('default', 0.30, 0.25, 0.15, 0.15, 0.05, 0.05, 0.03, 0.02)
on conflict (profile) do nothing;

-- Price-focused profile (for price-sensitive buyers)
insert into public.ranking_weights (profile, w_text, w_distance, w_price, w_seller, w_condition, w_freshness, w_response, w_avail)
values ('price_focused', 0.25, 0.15, 0.35, 0.10, 0.05, 0.05, 0.03, 0.02)
on conflict (profile) do nothing;

-- Proximity-focused profile (for buyers who want the closest item)
insert into public.ranking_weights (profile, w_text, w_distance, w_price, w_seller, w_condition, w_freshness, w_response, w_avail)
values ('proximity_focused', 0.25, 0.40, 0.10, 0.10, 0.05, 0.05, 0.03, 0.02)
on conflict (profile) do nothing;

-- RLS: weights are read-only to everyone; only service role can write
alter table public.ranking_weights enable row level security;
drop policy if exists "ranking_weights_read" on public.ranking_weights;
create policy "ranking_weights_read" on public.ranking_weights for select using (true);


-- ============================================================
-- SECTION 2: seller_trust_score on profiles
-- ============================================================
-- A single pre-computed 0–1 score combining:
--   rating, total_sales, response_rate, is_verified, cancellation_rate
-- Updated by trigger on each relevant profile change.

alter table public.profiles
    add column if not exists seller_trust_score numeric(4,3) default 0.500,
    add column if not exists cancellation_rate  integer      default 0;   -- % (0–100)

-- Helper: compute the seller trust score from raw profile data
create or replace function public.compute_seller_trust_score(
    p_rating           numeric,
    p_total_sales      integer,
    p_response_rate    integer,
    p_is_verified      boolean,
    p_cancellation_rate integer
)
returns numeric
language plpgsql
immutable
as $$
declare
    -- Normalise each component to [0, 1]
    rating_norm       numeric;  -- rating 1–5 → 0–1
    sales_norm        numeric;  -- log scale: 0 sales → 0, 100+ → 1
    response_norm     numeric;  -- 0–100 → 0–1
    verified_bonus    numeric;  -- +0.05 if verified
    cancel_penalty    numeric;  -- cancellation rate penalty
    raw_score         numeric;
begin
    -- Rating: normalise 1–5 to 0–1 (no rating = 0.5 neutral)
    rating_norm    := coalesce((p_rating - 1.0) / 4.0, 0.5);
    -- Sales: logarithmic normalisation (100+ sales → 1.0)
    sales_norm     := least(ln(coalesce(p_total_sales, 0) + 1) / ln(101), 1.0);
    -- Response rate: straight 0–100 to 0–1
    response_norm  := coalesce(p_response_rate, 100) / 100.0;
    -- Verified seller gets a small bonus
    verified_bonus := case when p_is_verified then 0.05 else 0.0 end;
    -- Cancellation penalty: each % cancellation costs 0.005 (up to −0.5)
    cancel_penalty := least(coalesce(p_cancellation_rate, 0), 100) * 0.005;

    -- Weighted blend: rating 45%, sales 25%, response 20%, verified 5%, cancel −
    raw_score := (rating_norm * 0.45)
               + (sales_norm  * 0.25)
               + (response_norm * 0.20)
               + verified_bonus
               - cancel_penalty;

    return greatest(0.0, least(1.0, raw_score));
end;
$$;

-- Trigger function: keep seller_trust_score in sync
create or replace function public.trg_update_seller_trust_score()
returns trigger
language plpgsql
as $$
begin
    new.seller_trust_score := public.compute_seller_trust_score(
        new.rating,
        new.total_listings,
        new.response_rate,
        new.is_verified,
        new.cancellation_rate
    );
    return new;
end;
$$;

drop trigger if exists trg_seller_trust_score on public.profiles;
create trigger trg_seller_trust_score
    before insert or update of rating, total_listings, response_rate, is_verified, cancellation_rate
    on public.profiles
    for each row execute function public.trg_update_seller_trust_score();

-- Back-fill existing profiles
update public.profiles
set seller_trust_score = public.compute_seller_trust_score(
    rating, total_listings, response_rate, is_verified,
    coalesce(cancellation_rate, 0)
);


-- ============================================================
-- SECTION 3: Full-text search index on listings
-- ============================================================
-- Enables efficient text relevance scoring via tsvector.

alter table public.listings
    add column if not exists search_vector tsvector;

-- Populate from title + description
update public.listings
set search_vector = to_tsvector('english', coalesce(title, '') || ' ' || coalesce(description, ''));

-- GIN index for fast full-text search
create index if not exists idx_listings_search_vector
    on public.listings using gin (search_vector);

-- Trigger to keep search_vector current on insert/update
create or replace function public.trg_update_search_vector()
returns trigger
language plpgsql
as $$
begin
    new.search_vector :=
        to_tsvector('english',
            coalesce(new.title, '') || ' ' || coalesce(new.description, ''));
    return new;
end;
$$;

drop trigger if exists trg_search_vector on public.listings;
create trigger trg_search_vector
    before insert or update of title, description
    on public.listings
    for each row execute function public.trg_update_search_vector();


-- ============================================================
-- SECTION 4: rank_listings — the primary matching RPC
-- ============================================================
-- Returns a full per-signal score breakdown alongside the final score.
-- Weights are loaded from ranking_weights at query time — no code change
-- required to tune the algorithm.
-- Reads from all tables in a single query — zero N+1 queries.

set search_path to public, extensions;

create or replace function public.rank_listings(
    user_lon          float,
    user_lat          float,
    search_query      text        default null,
    radius_meters     float       default 10000,
    category_filter   uuid        default null,
    min_price         numeric     default null,
    max_price         numeric     default null,
    condition_filter  text        default null,   -- 'new', 'like_new', 'good', 'fair'
    filter_city       text        default null,
    filter_district   text        default null,
    filter_neighborhood text      default null,
    weight_profile    text        default 'default',
    page_size         integer     default 20,
    page_offset       integer     default 0
)
returns table (
    -- Identity
    listing_id          uuid,
    seller_id           uuid,
    -- Display
    title               text,
    description         text,
    price               numeric,
    condition           text,
    category_id         uuid,
    neighborhood        text,
    city                text,
    location_label      text,
    quantity            integer,
    -- Per-signal scores (all 0.0–1.0)
    score_text          float,
    score_distance      float,
    score_price         float,
    score_seller        float,
    score_condition     float,
    score_freshness     float,
    score_response      float,
    score_availability  float,
    -- Final weighted score
    final_score         float,
    -- Distance for display
    distance_meters     float,
    -- Seller public info
    seller_display_name     text,
    seller_avatar_url       text,
    seller_rating           numeric,
    seller_trust_score      numeric,
    seller_total_sales      integer,
    seller_response_rate    integer,
    seller_is_verified      boolean,
    seller_neighborhood     text,
    seller_city             text,
    -- Pagination
    total_count         bigint
)
language plpgsql
security definer
set search_path = public, extensions
stable
as $$
declare
    user_geo      extensions.geography;
    wt            public.ranking_weights%rowtype;
    -- Price bounds for normalisation (computed from the candidate set)
    p_min         numeric;
    p_max         numeric;
    -- Text query
    ts_query      tsquery;
begin
    user_geo := st_setsrid(st_makepoint(user_lon, user_lat), 4326)::extensions.geography;

    -- Load weights (fallback to default if named profile not found)
    select * into wt from public.ranking_weights
    where profile = weight_profile;
    if not found then
        select * into wt from public.ranking_weights where profile = 'default';
    end if;

    -- Prepare full-text query
    if search_query is not null and search_query <> '' then
        ts_query := plainto_tsquery('english', search_query);
    end if;

    -- Compute price bounds for normalisation across this result set
    select
        min(l2.price),
        max(l2.price)
    into p_min, p_max
    from public.listings l2
    where l2.status = 'ACTIVE'
      and (category_filter is null or l2.category_id = category_filter)
      and (min_price is null or l2.price >= min_price)
      and (max_price is null or l2.price <= max_price);

    return query
    with candidates as (
        select
            l.id                                                           as listing_id,
            l.seller_id,
            l.title,
            l.description,
            l.price,
            l.condition,
            l.category_id,
            l.neighborhood,
            l.city,
            l.location_label,
            coalesce(l.quantity, 1)                                        as quantity,
            l.created_at,
            l.search_vector,
            -- Raw distance in metres (null when no location stored)
            case when l.location is not null
                then st_distance(l.location::extensions.geography, user_geo)
                else null
            end                                                            as dist_m,
            p.display_name                                                 as seller_display_name,
            p.avatar_url                                                   as seller_avatar_url,
            p.rating                                                       as seller_rating,
            p.seller_trust_score,
            p.total_sales                                                  as seller_total_sales,
            p.response_rate                                                as seller_response_rate,
            p.is_verified                                                  as seller_is_verified,
            p.neighborhood                                                 as seller_neighborhood,
            p.city                                                         as seller_city
        from public.listings  l
        join public.profiles  p on p.id = l.seller_id
        where
            l.status = 'ACTIVE'
            -- ── Filters ──────────────────────────────────────────────
            and (category_filter   is null or l.category_id = category_filter)
            and (min_price         is null or l.price >= min_price)
            and (max_price         is null or l.price <= max_price)
            and (condition_filter  is null or l.condition ilike condition_filter)
            -- Hierarchy filters take precedence over radius
            and (filter_neighborhood is null or l.neighborhood ilike filter_neighborhood)
            and (filter_city         is null or l.city         ilike filter_city)
            and (filter_district     is null or l.district     ilike filter_district)
            and (
                filter_neighborhood is not null
                or filter_city      is not null
                or filter_district  is not null
                or (l.location is not null
                    and st_dwithin(l.location::extensions.geography, user_geo, radius_meters))
            )
            -- Full-text filter when a query is provided
            and (
                ts_query is null
                or l.search_vector @@ ts_query
                or l.title ilike '%' || search_query || '%'
            )
    ),
    scored as (
        select
            c.*,

            -- ── 1. Text relevance (0–1) ──────────────────────────────
            case
                when ts_query is null then 1.0
                when c.search_vector is null then 0.0
                else least(ts_rank_cd(c.search_vector, ts_query) * 10.0, 1.0)
            end                                                            as s_text,

            -- ── 2. Distance score (0–1; closer is better) ────────────
            -- 0 m = 1.0; at radius_meters = 0.0; exponential decay
            case
                when c.dist_m is null then 0.5  -- no location = neutral
                when c.dist_m <= 0    then 1.0
                else greatest(0.0, 1.0 - (c.dist_m / radius_meters))
            end                                                            as s_distance,

            -- ── 3. Price competitiveness (0–1; cheaper within range = higher) ──
            case
                when p_max is null or p_max = p_min then 0.5  -- all same price
                else 1.0 - ((c.price - p_min) / (p_max - p_min))
            end                                                            as s_price,

            -- ── 4. Seller trust score (0–1; pre-computed) ───────────
            coalesce(c.seller_trust_score, 0.5)                           as s_seller,

            -- ── 5. Condition score (0–1) ─────────────────────────────
            case c.condition
                when 'new'       then 1.0
                when 'like_new'  then 0.85
                when 'good'      then 0.65
                when 'fair'      then 0.45
                when 'poor'      then 0.25
                else 0.5
            end                                                            as s_condition,

            -- ── 6. Freshness score (0–1; decay over 30 days) ─────────
            greatest(0.0,
                1.0 - (extract(epoch from (now() - c.created_at)) / (30 * 86400.0))
            )                                                              as s_freshness,

            -- ── 7. Response rate score (0–1) ─────────────────────────
            coalesce(c.seller_response_rate, 100) / 100.0                 as s_response,

            -- ── 8. Availability score (0–1) ───────────────────────────
            -- quantity 0 = 0, 1 = 0.7, 5+ = 1.0
            case
                when coalesce(c.quantity, 1) = 0 then 0.0
                when coalesce(c.quantity, 1) = 1 then 0.7
                when coalesce(c.quantity, 1) < 5 then 0.85
                else 1.0
            end                                                            as s_availability

        from candidates c
    ),
    ranked as (
        select
            s.*,
            -- Weighted final score
            (
                (s.s_text        * wt.w_text)
              + (s.s_distance    * wt.w_distance)
              + (s.s_price       * wt.w_price)
              + (s.s_seller      * wt.w_seller)
              + (s.s_condition   * wt.w_condition)
              + (s.s_freshness   * wt.w_freshness)
              + (s.s_response    * wt.w_response)
              + (s.s_availability * wt.w_avail)
            )                                                              as f_score,
            count(*) over ()                                               as total_count
        from scored s
    )
    select
        r.listing_id,
        r.seller_id,
        r.title,
        r.description,
        r.price,
        r.condition,
        r.category_id,
        r.neighborhood,
        r.city,
        r.location_label,
        r.quantity,
        r.s_text::float,
        r.s_distance::float,
        r.s_price::float,
        r.s_seller::float,
        r.s_condition::float,
        r.s_freshness::float,
        r.s_response::float,
        r.s_availability::float,
        r.f_score::float,
        r.dist_m::float,
        r.seller_display_name,
        r.seller_avatar_url,
        r.seller_rating,
        r.seller_trust_score,
        r.seller_total_sales::integer,
        r.seller_response_rate::integer,
        r.seller_is_verified,
        r.seller_neighborhood,
        r.seller_city,
        r.total_count
    from ranked r
    order by r.f_score desc
    limit  page_size
    offset page_offset;
end;
$$;


-- ============================================================
-- SECTION 5: Backward-compatible get_nearby_listings wrapper
-- ============================================================
-- The existing get_nearby_listings signature is preserved so
-- nothing breaks. It now delegates to rank_listings internally.

create or replace function public.get_nearby_listings(
    user_lon          float,
    user_lat          float,
    radius_meters     float   default 10000,
    category_filter   uuid    default null,
    search_query      text    default null,
    filter_country    text    default null,
    filter_district   text    default null,
    filter_city       text    default null,
    filter_neighborhood text  default null
)
returns table (
    id                   uuid,
    seller_id            uuid,
    title                text,
    description          text,
    price                numeric,
    category_id          uuid,
    condition            text,
    neighborhood         text,
    city                 text,
    district             text,
    location_label       text,
    distance_meters      float,
    ranking_score        float,
    status               text,
    created_at           timestamp with time zone,
    updated_at           timestamp with time zone,
    seller_display_name  text,
    seller_avatar_url    text,
    seller_rating        numeric,
    seller_total_sales   integer,
    seller_response_rate integer,
    seller_neighborhood  text,
    seller_city          text,
    seller_is_verified   boolean
)
language sql
security definer
stable
as $$
    select
        r.listing_id          as id,
        r.seller_id,
        r.title,
        r.description,
        r.price,
        r.category_id,
        r.condition,
        r.neighborhood,
        r.city,
        null::text            as district,
        r.location_label,
        r.distance_meters,
        r.final_score         as ranking_score,
        'ACTIVE'::text        as status,
        now()                 as created_at,
        now()                 as updated_at,
        r.seller_display_name,
        r.seller_avatar_url,
        r.seller_rating,
        r.seller_total_sales,
        r.seller_response_rate,
        r.seller_neighborhood,
        r.seller_city,
        r.seller_is_verified
    from public.rank_listings(
        user_lon, user_lat,
        search_query, radius_meters, category_filter,
        null, null, null,
        filter_city, filter_district, filter_neighborhood,
        'default', 200, 0
    ) r;
$$;


-- ============================================================
-- SECTION 6: RLS — ranking_weights read only, no user edits
-- ============================================================
-- Already enabled in section 1. No additional policies needed.
-- Service role can INSERT/UPDATE weight profiles for A/B testing.
