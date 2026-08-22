-- ============================================================================
-- Migration: 20260821020000_two_sided_reputation_system.sql
-- Description: Two-sided reputation system tracking Buyer & Seller ratings,
--              trust score calculation, and transactional review submission RPC.
-- ============================================================================

-- 1. Extend Profiles Table with Two-Sided Reputation & Verification Columns
alter table public.profiles
    add column if not exists seller_rating numeric(3,2) default 0.00,
    add column if not exists seller_rating_count integer default 0,
    add column if not exists buyer_rating numeric(3,2) default 0.00,
    add column if not exists buyer_rating_count integer default 0,
    add column if not exists overall_rating numeric(3,2) default 0.00,
    add column if not exists completed_sales integer default 0,
    add column if not exists completed_purchases integer default 0,
    add column if not exists cancelled_orders_count integer default 0,
    add column if not exists cancellation_rate numeric(5,2) default 0.00,
    add column if not exists response_rate numeric(5,2) default 100.00,
    add column if not exists verification_status text default 'unverified',
    add column if not exists seller_trust_score numeric(5,2) default 50.00;

-- Verification constraint
alter table public.profiles
    drop constraint if exists profiles_verification_status_check;

alter table public.profiles
    add constraint profiles_verification_status_check
    check (verification_status in ('unverified', 'phone_verified', 'id_verified', 'fully_verified'));

-- 2. Extend Reviews Table with Review Type & Anti-Fraud Constraints
alter table public.reviews
    add column if not exists review_type text default 'SELLER_REVIEW';

alter table public.reviews
    drop constraint if exists reviews_review_type_check;

alter table public.reviews
    add constraint reviews_review_type_check
    check (review_type in ('SELLER_REVIEW', 'BUYER_REVIEW'));

-- Prevent self rating
alter table public.reviews
    drop constraint if exists check_no_self_review;

alter table public.reviews
    add constraint check_no_self_review
    check (reviewer_id <> reviewee_id);

-- Unique constraint: one review per user per order
alter table public.reviews
    drop constraint if exists unique_order_reviewer;

alter table public.reviews
    add constraint unique_order_reviewer
    unique (order_id, reviewer_id);


-- 3. Function to Recalculate User Profile Reputation Metrics
create or replace function public.recalculate_profile_reputation(
    p_user_id uuid
)
returns void
language plpgsql
security definer
as $$
declare
    v_completed_sales       integer := 0;
    v_completed_purchases   integer := 0;
    v_cancelled_orders      integer := 0;
    v_total_orders          integer := 0;
    v_cancellation_rate     numeric(5,2) := 0.00;
    
    v_seller_rating         numeric(3,2) := 0.00;
    v_seller_count          integer := 0;
    
    v_buyer_rating          numeric(3,2) := 0.00;
    v_buyer_count           integer := 0;
    
    v_overall_rating        numeric(3,2) := 0.00;
    v_verification          text;
    v_verif_subscore        numeric(5,2) := 0.00;
    v_volume_subscore       numeric(5,2) := 0.00;
    v_trust_score           numeric(5,2) := 50.00;
begin
    -- Count Completed Sales & Purchases
    select count(*) into v_completed_sales
    from public.orders
    where seller_id = p_user_id and status = 'COMPLETED';

    select count(*) into v_completed_purchases
    from public.orders
    where buyer_id = p_user_id and status = 'COMPLETED';

    -- Count Cancelled Orders & Total Orders
    select count(*) into v_cancelled_orders
    from public.orders
    where (seller_id = p_user_id or buyer_id = p_user_id) and status = 'CANCELLED';

    select count(*) into v_total_orders
    from public.orders
    where seller_id = p_user_id or buyer_id = p_user_id;

    if v_total_orders > 0 then
        v_cancellation_rate := round(((v_cancelled_orders::numeric / v_total_orders::numeric) * 100.00), 2);
    else
        v_cancellation_rate := 0.00;
    end if;

    -- Compute Seller Rating & Count
    select coalesce(round(avg(rating)::numeric, 2), 0.00), count(*)
    into v_seller_rating, v_seller_count
    from public.reviews
    where reviewee_id = p_user_id and review_type = 'SELLER_REVIEW';

    -- Compute Buyer Rating & Count
    select coalesce(round(avg(rating)::numeric, 2), 0.00), count(*)
    into v_buyer_rating, v_buyer_count
    from public.reviews
    where reviewee_id = p_user_id and review_type = 'BUYER_REVIEW';

    -- Compute Overall Weighted Rating
    if v_seller_count > 0 and v_buyer_count > 0 then
        v_overall_rating := round(((v_seller_rating * v_seller_count + v_buyer_rating * v_buyer_count) / (v_seller_count + v_buyer_count)), 2);
    elsif v_seller_count > 0 then
        v_overall_rating := v_seller_rating;
    elsif v_buyer_count > 0 then
        v_overall_rating := v_buyer_rating;
    else
        v_overall_rating := 0.00;
    end if;

    -- Fetch current verification status
    select coalesce(verification_status, 'unverified') into v_verification
    from public.profiles
    where id = p_user_id;

    case v_verification
        when 'phone_verified' then v_verif_subscore := 10.00;
        when 'id_verified' then v_verif_subscore := 15.00;
        when 'fully_verified' then v_verif_subscore := 20.00;
        else v_verif_subscore := 0.00;
    end case;

    v_volume_subscore := least(15.00, v_completed_sales * 1.5);

    -- Calculate Seller Trust Score (0 - 100)
    -- Rating score (max 50) + Completion score (max 15) + Verif score (max 20) + Volume score (max 15)
    v_trust_score := least(100.00,
        (coalesce(v_seller_rating, 0.00) / 5.0 * 50.0) +
        ((100.00 - v_cancellation_rate) * 0.15) +
        v_verif_subscore +
        v_volume_subscore
    );

    -- Update Profile Record
    update public.profiles
    set
        seller_rating = v_seller_rating,
        seller_rating_count = v_seller_count,
        buyer_rating = v_buyer_rating,
        buyer_rating_count = v_buyer_count,
        overall_rating = v_overall_rating,
        completed_sales = v_completed_sales,
        completed_purchases = v_completed_purchases,
        cancelled_orders_count = v_cancelled_orders,
        cancellation_rate = v_cancellation_rate,
        seller_trust_score = v_trust_score,
        updated_at = now()
    where id = p_user_id;
end;
$$;


-- 4. Transactional Review Submission RPC
create or replace function public.submit_transaction_review(
    p_order_id uuid,
    p_rating integer,
    p_comment text default null
)
returns jsonb
language plpgsql
security definer
as $$
declare
    v_caller_id     uuid;
    v_order         public.orders%rowtype;
    v_reviewee_id   uuid;
    v_review_type   text;
    v_review_id     uuid;
begin
    v_caller_id := auth.uid();
    if v_caller_id is null then
        raise exception 'Authentication required to submit reviews.';
    end if;

    -- Validate Rating input
    if p_rating is null or p_rating < 1 or p_rating > 5 then
        raise exception 'Rating must be an integer between 1 and 5.';
    end if;

    -- Fetch order details
    select * into v_order
    from public.orders
    where id = p_order_id;

    if not found then
        raise exception 'Order not found for ID %', p_order_id;
    end if;

    -- Ensure order is completed
    if v_order.status <> 'COMPLETED' then
        raise exception 'Reviews can only be submitted for COMPLETED orders. Current order status: %', v_order.status;
    end if;

    -- Ensure caller is a participant
    if v_caller_id = v_order.buyer_id then
        v_reviewee_id := v_order.seller_id;
        v_review_type := 'SELLER_REVIEW';
    elsif v_caller_id = v_order.seller_id then
        v_reviewee_id := v_order.buyer_id;
        v_review_type := 'BUYER_REVIEW';
    else
        raise exception 'Unauthorized: Only buyer or seller of this order can submit a review.';
    end if;

    -- Check for duplicate review
    if exists (
        select 1 from public.reviews
        where order_id = p_order_id and reviewer_id = v_caller_id
    ) then
        raise exception 'You have already submitted a review for this order.';
    end if;

    -- Insert Review Record
    insert into public.reviews (
        reviewer_id,
        reviewee_id,
        order_id,
        rating,
        comment,
        review_type
    ) values (
        v_caller_id,
        v_reviewee_id,
        p_order_id,
        p_rating,
        p_comment,
        v_review_type
    )
    returning id into v_review_id;

    -- Recalculate target profile's reputation metrics
    perform public.recalculate_profile_reputation(v_reviewee_id);

    return jsonb_build_object(
        'success', true,
        'review_id', v_review_id,
        'reviewee_id', v_reviewee_id,
        'review_type', v_review_type
    );
end;
$$;
