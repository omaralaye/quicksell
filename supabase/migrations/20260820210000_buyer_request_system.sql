-- ============================================================
-- QuickSell: Buyer Request System (Comprehensive Migration)
-- ============================================================
-- Implements full request lifecycle (ACTIVE, MATCHED, FULFILLED, EXPIRED, CANCELLED),
-- seller quote responses with price & availability & product linking,
-- targeted seller dispatch, and buyer response management (accept/ignore/chat).
-- ============================================================

-- 1. Ensure status check constraint on buyer_requests supports standard statuses
alter table public.buyer_requests
    add column if not exists budget_min numeric(10,2),
    add column if not exists budget_max numeric(10,2),
    add column if not exists desired_condition text,
    add column if not exists region text,
    add column if not exists district text,
    add column if not exists city text,
    add column if not exists latitude double precision,
    add column if not exists longitude double precision,
    add column if not exists radius integer default 25;

-- Update status default to ACTIVE uppercase and ensure constraint
alter table public.buyer_requests
    drop constraint if exists buyer_requests_status_check;

update public.buyer_requests
set status = upper(status)
where status in ('active', 'matched', 'fulfilled', 'expired', 'cancelled');

alter table public.buyer_requests
    add constraint buyer_requests_status_check
    check (status in ('ACTIVE', 'MATCHED', 'FULFILLED', 'EXPIRED', 'CANCELLED'));

alter table public.buyer_requests
    alter column status set default 'ACTIVE';

-- 2. Update buyer_request_responses table with price & availability
alter table public.buyer_request_responses
    add column if not exists product_id uuid references public.listings(id) on delete set null,
    add column if not exists price numeric(10,2),
    add column if not exists availability text default 'in_stock';

-- Ensure link to product_id is synced with listing_id
update public.buyer_request_responses
set product_id = listing_id
where product_id is null and listing_id is not null;

-- Response status check
alter table public.buyer_request_responses
    drop constraint if exists buyer_request_responses_status_check;

alter table public.buyer_request_responses
    add constraint buyer_request_responses_status_check
    check (status in ('pending', 'accepted', 'ignored', 'declined'));


set search_path to public, extensions;

-- ============================================================
-- RPC 1: submit_buyer_request_v2
-- ============================================================
create or replace function public.submit_buyer_request_v2(
    p_buyer_id          uuid,
    p_title             text,
    p_description       text            default null,
    p_category_id       uuid            default null,
    p_budget_min        numeric         default null,
    p_budget_max        numeric         default null,
    p_desired_condition text            default 'any',
    p_region            text            default null,
    p_district          text            default null,
    p_city              text            default null,
    p_latitude          double precision default null,
    p_longitude         double precision default null,
    p_radius            integer         default 25,
    p_expires_in_days   integer         default 7
)
returns table (
    request_id          uuid,
    notified_sellers    integer
)
language plpgsql
security definer
as $$
declare
    new_request_id      uuid;
    loc_geom            extensions.geometry(Point, 4326) := null;
    calculated_expiry   timestamp with time zone;
    seller_rec          record;
    notified_count      integer := 0;
begin
    if p_latitude is not null and p_longitude is not null then
        loc_geom := st_setsrid(st_makePoint(p_longitude, p_latitude), 4326);
    end if;

    calculated_expiry := now() + (coalesce(p_expires_in_days, 7) || ' days')::interval;

    insert into public.buyer_requests (
        buyer_id, title, description, category_id,
        budget_min, budget_max, budget, desired_condition, condition_pref,
        region, district, city, location_label,
        latitude, longitude, location, radius, max_distance_km,
        expires_at, status
    )
    values (
        p_buyer_id, p_title, p_description, p_category_id,
        p_budget_min, p_budget_max, p_budget_max, p_desired_condition, p_desired_condition,
        p_region, p_district, p_city, coalesce(p_city, p_district, p_region, 'Nearby'),
        p_latitude, p_longitude, loc_geom, p_radius, p_radius,
        calculated_expiry, 'ACTIVE'
    )
    returning id into new_request_id;

    -- Find and notify eligible sellers
    for seller_rec in
        select * from public.find_eligible_sellers_for_request(new_request_id)
    loop
        insert into public.notifications (
            user_id, type, title, body, related_entity_id
        )
        values (
            seller_rec.seller_id,
            'buyer_request',
            '📦 New Request: ' || left(p_title, 40),
            case
                when p_budget_max is not null
                then 'Budget: UGX ' || to_char(p_budget_max, 'FM999,999,999') ||
                     case when p_city is not null then ' · ' || p_city else '' end
                else coalesce(p_city, 'Near you')
            end,
            new_request_id
        );
        notified_count := notified_count + 1;
    end loop;

    return query select new_request_id, notified_count;
end;
$$;


-- ============================================================
-- RPC 2: respond_to_buyer_request_with_offer
-- ============================================================
create or replace function public.respond_to_buyer_request_with_offer(
    p_seller_id     uuid,
    p_request_id    uuid,
    p_message       text,
    p_price         numeric,
    p_product_id    uuid    default null,
    p_availability  text    default 'in_stock'
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
    prod            public.listings%rowtype;
    conv_id         uuid;
    resp_id         uuid;
    formatted_msg   text;
begin
    -- Load & validate request
    select * into req from public.buyer_requests where id = p_request_id;
    if not found then raise exception 'Buyer request not found'; end if;
    if req.status in ('FULFILLED', 'EXPIRED', 'CANCELLED') then
        raise exception 'This buyer request is no longer active';
    end if;
    if req.buyer_id = p_seller_id then
        raise exception 'Cannot respond to your own request';
    end if;

    -- If product linked, verify ownership
    if p_product_id is not null then
        select * into prod from public.listings where id = p_product_id;
        if not found or prod.seller_id <> p_seller_id then
            raise exception 'Linked product must belong to you';
        end if;
    end if;

    -- Find or create conversation
    select id into conv_id
    from public.conversations
    where buyer_id = req.buyer_id
      and seller_id = p_seller_id
      and (p_product_id is null or listing_id = p_product_id)
    order by last_message_at desc
    limit 1;

    if conv_id is null then
        insert into public.conversations (
            listing_id, buyer_id, seller_id,
            last_message, last_message_at
        )
        values (
            p_product_id, req.buyer_id, p_seller_id,
            p_message, now()
        )
        returning id into conv_id;
    end if;

    -- Format opening message with quote detail
    formatted_msg := p_message || E'\n\n' ||
        '🏷️ Offer Price: UGX ' || to_char(p_price, 'FM999,999,999') || E'\n' ||
        '📦 Availability: ' || replace(p_availability, '_', ' ');

    if p_product_id is not null then
        formatted_msg := formatted_msg || E'\n🔗 Linked Product: ' || prod.title;
    end if;

    -- Send message
    insert into public.messages (conversation_id, sender_id, text)
    values (conv_id, p_seller_id, formatted_msg);

    -- Insert/Update response
    insert into public.buyer_request_responses (
        request_id, seller_id, listing_id, product_id,
        message, price, availability, conversation_id, status
    )
    values (
        p_request_id, p_seller_id, p_product_id, p_product_id,
        p_message, p_price, p_availability, conv_id, 'pending'
    )
    on conflict (request_id, seller_id) do update
        set product_id = excluded.product_id,
            listing_id = excluded.product_id,
            message = excluded.message,
            price = excluded.price,
            availability = excluded.availability,
            conversation_id = excluded.conversation_id,
            status = 'pending',
            updated_at = now()
    returning id into resp_id;

    -- Update request status to MATCHED if currently ACTIVE
    update public.buyer_requests
    set status = 'MATCHED',
        response_count = response_count + 1
    where id = p_request_id and status = 'ACTIVE';

    -- Notify buyer
    insert into public.notifications (user_id, type, title, body, related_entity_id)
    values (
        req.buyer_id,
        'buyer_request_response',
        '💬 New Offer for "' || left(req.title, 30) || '"',
        'UGX ' || to_char(p_price, 'FM999,999,999') || ' · Tap to view details and chat.',
        conv_id
    );

    return query select resp_id, conv_id;
end;
$$;


-- ============================================================
-- RPC 3: accept_buyer_request_response
-- ============================================================
create or replace function public.accept_buyer_request_response(
    p_buyer_id      uuid,
    p_response_id   uuid
)
returns boolean
language plpgsql
security definer
as $$
declare
    resp    public.buyer_request_responses%rowtype;
    req     public.buyer_requests%rowtype;
begin
    select * into resp from public.buyer_request_responses where id = p_response_id;
    if not found then raise exception 'Response not found'; end if;

    select * into req from public.buyer_requests where id = resp.request_id;
    if not found or req.buyer_id <> p_buyer_id then
        raise exception 'Unauthorized';
    end if;

    -- Mark response as accepted
    update public.buyer_request_responses
    set status = 'accepted', updated_at = now()
    where id = p_response_id;

    -- Mark request as FULFILLED
    update public.buyer_requests
    set status = 'FULFILLED', updated_at = now()
    where id = req.id;

    -- Notify seller
    insert into public.notifications (user_id, type, title, body, related_entity_id)
    values (
        resp.seller_id,
        'offer_accepted',
        '🎉 Offer Accepted!',
        'The buyer accepted your offer for "' || left(req.title, 35) || '". Tap to open chat.',
        resp.conversation_id
    );

    return true;
end;
$$;


-- ============================================================
-- RPC 4: ignore_buyer_request_response
-- ============================================================
create or replace function public.ignore_buyer_request_response(
    p_buyer_id      uuid,
    p_response_id   uuid
)
returns boolean
language plpgsql
security definer
as $$
declare
    resp    public.buyer_request_responses%rowtype;
    req     public.buyer_requests%rowtype;
begin
    select * into resp from public.buyer_request_responses where id = p_response_id;
    if not found then raise exception 'Response not found'; end if;

    select * into req from public.buyer_requests where id = resp.request_id;
    if not found or req.buyer_id <> p_buyer_id then
        raise exception 'Unauthorized';
    end if;

    update public.buyer_request_responses
    set status = 'ignored', updated_at = now()
    where id = p_response_id;

    return true;
end;
$$;


-- ============================================================
-- RPC 5: get_buyer_request_details
-- ============================================================
-- Fetches a buyer request along with all seller responses + linked products + seller profile info.
create or replace function public.get_buyer_request_details(
    p_request_id uuid
)
returns json
language plpgsql
security definer
stable
as $$
declare
    result json;
begin
    select json_build_object(
        'request', (
            select row_to_json(r)
            from (
                select br.*,
                       cat.name as category_name,
                       p.display_name as buyer_name,
                       p.avatar_url as buyer_avatar
                from public.buyer_requests br
                left join public.categories cat on cat.id = br.category_id
                left join public.profiles p on p.id = br.buyer_id
                where br.id = p_request_id
            ) r
        ),
        'responses', coalesce((
            select json_agg(resp_row)
            from (
                select
                    brr.*,
                    sp.display_name as seller_name,
                    sp.avatar_url as seller_avatar,
                    sp.seller_trust_score,
                    sp.seller_rating,
                    sp.is_verified as seller_is_verified,
                    case
                        when brr.product_id is not null then row_to_json(l)
                        else null
                    end as product
                from public.buyer_request_responses brr
                join public.profiles sp on sp.id = brr.seller_id
                left join public.listings l on l.id = brr.product_id
                where brr.request_id = p_request_id
                order by
                    case brr.status
                        when 'accepted' then 1
                        when 'pending' then 2
                        else 3
                    end,
                    brr.created_at desc
            ) resp_row
        ), '[]'::json)
    ) into result;

    return result;
end;
$$;
