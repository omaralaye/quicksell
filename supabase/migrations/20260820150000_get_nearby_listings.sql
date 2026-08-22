set search_path to public, extensions;

create or replace function public.get_nearby_listings(
    user_lon float,
    user_lat float,
    radius_meters float default 50000,
    category_filter text default null,
    search_query text default null
)
returns table (
    id uuid,
    seller_id uuid,
    title text,
    description text,
    price numeric,
    category text,
    condition text,
    image_url text,
    region text,
    location extensions.geometry,
    status text,
    created_at timestamp with time zone,
    updated_at timestamp with time zone,
    distance_meters float,
    ranking_score float,
    seller_display_name text,
    seller_avatar_url text,
    seller_rating numeric,
    seller_total_sales integer,
    seller_response_rate integer
)
language plpgsql
as $$
begin
    return query
    select
        l.id,
        l.seller_id,
        l.title,
        l.description,
        l.price,
        l.category,
        l.condition,
        l.image_url,
        l.region,
        l.location,
        l.status,
        l.created_at,
        l.updated_at,
        st_distance(l.location::geography, st_setsrid(st_makepoint(user_lon, user_lat), 4326)::geography) as distance_meters,
        (
            -- Composite ranking score calculation
            -- Base: 100 points
            -- -1 point for every 1km of distance
            -- +10 points for every rating star above 3
            -- + (response_rate / 10) points
            100.0 
            - (st_distance(l.location::geography, st_setsrid(st_makepoint(user_lon, user_lat), 4326)::geography) / 1000.0) 
            + (coalesce(p.rating, 0) - 3.0) * 10.0 
            + (coalesce(p.response_rate, 100) / 10.0)
        ) as ranking_score,
        p.display_name as seller_display_name,
        p.avatar_url as seller_avatar_url,
        p.rating as seller_rating,
        p.total_sales as seller_total_sales,
        p.response_rate as seller_response_rate
    from
        public.listings l
    join
        public.profiles p on l.seller_id = p.id
    where
        l.status = 'active'
        and st_dwithin(
            l.location::geography,
            st_setsrid(st_makepoint(user_lon, user_lat), 4326)::geography,
            radius_meters
        )
        and (category_filter is null or l.category = category_filter)
        and (search_query is null or l.title ilike '%' || search_query || '%')
    order by
        ranking_score desc;
end;
$$;
