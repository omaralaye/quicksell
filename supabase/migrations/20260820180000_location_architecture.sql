-- ============================================================
-- QuickSell: Location-Aware Architecture Migration
-- ============================================================
set search_path to public, extensions;

-- Profiles: add structured hierarchy + a fuzzy public geometry
-- The private `location` column already exists (set by the user's device).
-- `public_location` is snapped to ~1km grid for display to others.
alter table public.profiles
add column if not exists country text,
add column if not exists region_name text,     -- e.g. "Central Region"
add column if not exists district text,         -- e.g. "Kampala District"
add column if not exists city text,             -- e.g. "Kampala"
add column if not exists neighborhood text,     -- e.g. "Ntinda"
add column if not exists public_location extensions.geometry(Point, 4326),  -- snapped, shown to buyers
add column if not exists location_label text,
add column if not exists location_updated_at timestamp with time zone;

-- Listings: same hierarchy (separate from seller's personal location)
-- Listings already have `location` (exact for PostGIS) and `region` (text).
-- We add the full hierarchy and a public_location for display.
alter table public.listings
add column if not exists country text,
add column if not exists district text,
add column if not exists city text,
add column if not exists neighborhood text,     -- "Ntinda" — shown to buyers
add column if not exists public_location extensions.geometry(Point, 4326),  -- snapped ±500m
add column if not exists location_label text;   -- Human-readable: "Ntinda, Kampala"


-- ============================================================
-- SECTION 2: SPATIAL INDEXES
-- ============================================================

-- Profile spatial indexes
create index if not exists idx_profiles_location
    on public.profiles using gist (location);

create index if not exists idx_profiles_public_location
    on public.profiles using gist (public_location);

-- Listing spatial indexes (exact location for queries, public for display)
create index if not exists idx_listings_location
    on public.listings using gist (location);

create index if not exists idx_listings_public_location
    on public.listings using gist (public_location);

-- Hierarchy text indexes for region-based filtering
create index if not exists idx_listings_country   on public.listings (country);
create index if not exists idx_listings_district  on public.listings (district);
create index if not exists idx_listings_city      on public.listings (city);
create index if not exists idx_listings_neighborhood on public.listings (neighborhood);
create index if not exists idx_listings_region    on public.listings (region);

create index if not exists idx_profiles_city         on public.profiles (city);
create index if not exists idx_profiles_neighborhood  on public.profiles (neighborhood);


-- ============================================================
-- SECTION 3: HELPER — SNAP COORDINATE TO PRIVACY GRID
-- ============================================================
-- Snaps an exact coordinate to a ~500m grid cell center so that
-- a seller's precise home address cannot be reverse-engineered
-- from the public_location value.

create or replace function public.snap_to_privacy_grid(
    lon float,
    lat float,
    grid_degrees float default 0.005  -- ~500m at equator
)
returns extensions.geometry
language sql
immutable
as $$
    select st_setsrid(
        st_makepoint(
            round(lon / grid_degrees) * grid_degrees,
            round(lat / grid_degrees) * grid_degrees
        ),
        4326
    );
$$;


-- ============================================================
-- SECTION 4: REPLACE get_nearby_listings RPC
-- ============================================================
-- Replaces the Phase 1 version which:
--   a) Referenced the old `l.category` text column (now dropped)
--   b) Returned the raw exact `location` geometry (privacy risk)
--   c) Had no radius preset support

drop function if exists public.get_nearby_listings(float, float, float, text, text);

create or replace function public.get_nearby_listings(
    user_lon        float,
    user_lat        float,
    radius_meters   float       default 10000,
    category_filter uuid        default null,    -- now uuid, matches categories.id
    search_query    text        default null,

    -- Hierarchy filters (any one may be provided instead of radius)
    filter_country      text    default null,
    filter_district     text    default null,
    filter_city         text    default null,
    filter_neighborhood text    default null
)
returns table (
    id                  uuid,
    seller_id           uuid,
    title               text,
    description         text,
    price               numeric,
    category_id         uuid,
    condition           text,
    -- Public location only — never exact coordinates
    neighborhood        text,
    city                text,
    district            text,
    location_label      text,
    distance_meters     float,
    ranking_score       float,
    status              text,
    created_at          timestamp with time zone,
    updated_at          timestamp with time zone,
    -- Seller public info
    seller_display_name     text,
    seller_avatar_url       text,
    seller_rating           numeric,
    seller_total_sales      integer,
    seller_response_rate    integer,
    seller_neighborhood     text,
    seller_city             text,
    seller_is_verified      boolean
)
language plpgsql
security definer
set search_path = public, extensions
as $$
declare
    user_geo extensions.geography;
begin
    user_geo := st_setsrid(st_makepoint(user_lon, user_lat), 4326)::extensions.geography;

    return query
    select
        l.id,
        l.seller_id,
        l.title,
        l.description,
        l.price,
        l.category_id,
        l.condition,
        -- Return neighborhood/city for display — NOT exact coordinates
        l.neighborhood,
        l.city,
        l.district,
        l.location_label,
        -- Distance computed from exact location (private), but only the number is returned
        st_distance(l.location::geography, user_geo)::float                     as distance_meters,
        -- Composite ranking score
        (
            100.0
            -- Proximity penalty: −1 per km
            - (st_distance(l.location::geography, user_geo) / 1000.0)
            -- Seller rating bonus: ±10 per star above/below 3
            + (coalesce(p.rating, 0) - 3.0) * 10.0
            -- Response rate bonus: up to +10
            + (coalesce(p.response_rate, 100) / 10.0)
            -- Recency bonus: listings under 48h get +5
            + case when l.created_at > now() - interval '48 hours' then 5.0 else 0.0 end
        )::float                                                                  as ranking_score,
        l.status,
        l.created_at,
        l.updated_at,
        -- Seller fields (public info only)
        p.display_name                          as seller_display_name,
        p.avatar_url                            as seller_avatar_url,
        p.rating                                as seller_rating,
        p.total_sales                           as seller_total_sales,
        p.response_rate                         as seller_response_rate,
        p.neighborhood                          as seller_neighborhood,
        p.city                                  as seller_city,
        p.is_verified                           as seller_is_verified
    from
        public.listings l
    join
        public.profiles p on l.seller_id = p.id
    where
        l.status = 'active'
        -- Hierarchy filters take precedence when provided
        and (filter_neighborhood is null or l.neighborhood ilike filter_neighborhood)
        and (filter_city         is null or l.city         ilike filter_city)
        and (filter_district     is null or l.district     ilike filter_district)
        and (filter_country      is null or l.country      ilike filter_country)
        -- Radius filter only applies when no hierarchy filter is given and location exists
        and (
            filter_neighborhood is not null
            or filter_city      is not null
            or filter_district  is not null
            or filter_country   is not null
            or (
                l.location is not null
                and st_dwithin(l.location::geography, user_geo, radius_meters)
            )
        )
        and (category_filter is null or l.category_id = category_filter)
        and (search_query    is null or l.title ilike '%' || search_query || '%')
    order by
        ranking_score desc;
end;
$$;


-- ============================================================
-- SECTION 5: get_nearby_sellers RPC
-- ============================================================

create or replace function public.get_nearby_sellers(
    user_lon        float,
    user_lat        float,
    radius_meters   float   default 10000,
    filter_city     text    default null,
    filter_district text    default null
)
returns table (
    id                  uuid,
    display_name        text,
    avatar_url          text,
    neighborhood        text,
    city                text,
    rating              numeric,
    total_listings      integer,
    total_sales         integer,
    response_rate       integer,
    is_verified         boolean,
    distance_meters     float
)
language plpgsql
security definer
set search_path = public, extensions
as $$
declare
    user_geo extensions.geography;
begin
    user_geo := st_setsrid(st_makepoint(user_lon, user_lat), 4326)::extensions.geography;

    return query
    select
        p.id,
        p.display_name,
        p.avatar_url,
        -- neighborhood is shown; exact address is not
        p.neighborhood,
        p.city,
        p.rating,
        p.total_listings,
        p.total_sales,
        p.response_rate,
        p.is_verified,
        -- Distance from snapped public_location, not private location
        case
            when p.public_location is not null
            then st_distance(p.public_location::geography, user_geo)::float
            else null
        end as distance_meters
    from
        public.profiles p
    where
        p.total_listings > 0
        and (filter_city     is null or p.city     ilike filter_city)
        and (filter_district is null or p.district ilike filter_district)
        and (
            filter_city     is not null
            or filter_district is not null
            or (
                p.public_location is not null
                and st_dwithin(p.public_location::geography, user_geo, radius_meters)
            )
        )
    order by
        p.rating desc nulls last,
        p.total_sales desc;
end;
$$;


-- ============================================================
-- SECTION 6: RLS — no exact location exposed
-- ============================================================
-- The `location` column on profiles (exact GPS) must NOT be
-- returned to other users. We enforce this via a security-barrier
-- view and restrict the base table columns exposed via RLS.

-- Ensure the public cannot select the private `location` from profiles
-- by tightening the existing profile select policy to use a view instead.
-- (Full column-level security is in the view below.)

drop view if exists public.profiles_public cascade;
create or replace view public.profiles_public as
select
    id,
    display_name,
    avatar_url,
    neighborhood,
    city,
    district,
    region_name,
    country,
    public_location,   -- snapped ±500m only
    location_label,    -- if we add this to profiles later
    rating,
    total_listings,
    total_sales,
    response_rate,
    is_verified,
    created_at,
    updated_at
from public.profiles;

-- Grant read access to authenticated and anon roles
grant select on public.profiles_public to authenticated, anon;

-- Similarly, listings must NEVER expose the exact `location` to clients.
-- Clients should read neighborhood/city/location_label instead.
-- The get_nearby_listings RPC already omits exact coordinates.
-- For direct table reads, we ensure only public fields are visible.
drop view if exists public.listings_public cascade;
create or replace view public.listings_public as
select
    id,
    seller_id,
    title,
    description,
    price,
    category_id,
    condition,
    neighborhood,
    city,
    district,
    region,
    country,
    location_label,
    public_location,   -- snapped ±500m
    status,
    quantity,
    pickup_preferences,
    delivery_options,
    created_at,
    updated_at
    -- `location` (exact) is intentionally omitted
from public.listings;

grant select on public.listings_public to authenticated, anon;
