-- ============================================================
-- Migration: 20260821050000_buyer_request_matching_engine.sql
-- Description: Matching engine RPC to find eligible sellers for
-- buyer requests based on proximity, seller score, and responsiveness.
-- ============================================================

create or replace function public.find_eligible_sellers_for_buyer_request(
  p_request_id uuid,
  p_max_distance_km double precision default 50.0
)
returns table (
  seller_id uuid,
  display_name text,
  avatar_url text,
  rating numeric,
  completed_sales integer,
  distance_km double precision,
  match_score double precision,
  is_verified boolean
)
language plpgsql
security definer
set search_path = public, extensions
as $$
declare
  v_req record;
  v_buyer_loc extensions.geometry(Point, 4326);
begin
  -- Fetch target buyer request
  select * into v_req
  from public.buyer_requests
  where id = p_request_id;

  if v_req.id is null then
    raise exception 'Buyer request with ID % not found', p_request_id;
  end if;

  v_buyer_loc := v_req.location;

  return query
  select 
    p.id as seller_id,
    coalesce(p.display_name, 'QuickSell Seller') as display_name,
    p.avatar_url,
    coalesce(p.seller_rating, p.rating, 5.0) as rating,
    coalesce(p.completed_sales, 0) as completed_sales,
    case 
      when v_buyer_loc is not null and p.location is not null then
        (st_distance(p.location::extensions.geography, v_buyer_loc::extensions.geography) / 1000.0)
      else 5.0
    end as distance_km,
    (
      (coalesce(p.seller_rating, p.rating, 5.0) / 5.0) * 40.0 +
      (least(coalesce(p.completed_sales, 0), 50)::double precision / 50.0) * 30.0 +
      (case when coalesce(p.is_verified, false) then 20.0 else 0.0 end) +
      (greatest(0.0, (50.0 - case when v_buyer_loc is not null and p.location is not null then (st_distance(p.location::extensions.geography, v_buyer_loc::extensions.geography) / 1000.0) else 5.0 end)) / 50.0) * 10.0
    ) as match_score,
    coalesce(p.is_verified, false) as is_verified
  from public.profiles p
  where p.id != v_req.buyer_id
    and (
      v_buyer_loc is null or p.location is null or 
      (st_distance(p.location::extensions.geography, v_buyer_loc::extensions.geography) / 1000.0) <= p_max_distance_km
    )
  order by match_score desc
  limit 20;
end;
$$;
