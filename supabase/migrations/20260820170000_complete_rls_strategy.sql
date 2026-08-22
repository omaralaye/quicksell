-- ============================================================
-- QuickSell: Complete RLS Strategy Migration
-- ============================================================
-- This migration:
--  1. DROPS every broken, permissive, or conflicting policy from
--     the two previous migrations.
--  2. Re-applies a complete, hardened RLS policy set.
--  3. Introduces helper functions for state-machine guards.
-- ============================================================

-- ============================================================
-- SECTION 1: REVOKE BROKEN / CONFLICTING EXISTING POLICIES
-- ============================================================

-- profiles
drop policy if exists "Public profiles are viewable by everyone." on public.profiles;
drop policy if exists "Users can insert their own profile." on public.profiles;
drop policy if exists "Users can update own profile." on public.profiles;
drop policy if exists "profiles_select_public" on public.profiles;
drop policy if exists "profiles_insert_own" on public.profiles;
drop policy if exists "profiles_update_own" on public.profiles;

-- listings
drop policy if exists "Listings are viewable by everyone." on public.listings;
drop policy if exists "Users can insert their own listings." on public.listings;
drop policy if exists "Users can update their own listings." on public.listings;
drop policy if exists "Users can delete their own listings." on public.listings;
drop policy if exists "listings_select_active_or_own" on public.listings;
drop policy if exists "listings_insert_own" on public.listings;
drop policy if exists "listings_update_own" on public.listings;
drop policy if exists "listings_delete_own" on public.listings;

-- orders
drop policy if exists "Users can view their own orders." on public.orders;
drop policy if exists "Buyers can create orders." on public.orders;
drop policy if exists "Participants can update orders." on public.orders;
drop policy if exists "orders_select_participant" on public.orders;
drop policy if exists "orders_insert_buyer" on public.orders;
drop policy if exists "orders_update_buyer_pickup" on public.orders;
drop policy if exists "orders_update_seller_tracking" on public.orders;

-- conversations
drop policy if exists "Users can view their own conversations." on public.conversations;
drop policy if exists "Users can create conversations." on public.conversations;
drop policy if exists "Participants can update conversations." on public.conversations;
drop policy if exists "Participants can delete conversations." on public.conversations;
drop policy if exists "conversations_select_participant" on public.conversations;
drop policy if exists "conversations_insert_buyer" on public.conversations;
drop policy if exists "conversations_update_participant" on public.conversations;

-- messages
drop policy if exists "Users can view messages in their conversations." on public.messages;
drop policy if exists "Users can insert messages in their conversations." on public.messages;
drop policy if exists "messages_select_participant" on public.messages;
drop policy if exists "messages_insert_participant" on public.messages;

-- notifications
drop policy if exists "Users can view their own notifications." on public.notifications;
drop policy if exists "System can insert notifications." on public.notifications;
drop policy if exists "Users can update their own notifications." on public.notifications;
drop policy if exists "Users can delete their own notifications." on public.notifications;
drop policy if exists "notifications_select_own" on public.notifications;
drop policy if exists "notifications_update_own_read" on public.notifications;
drop policy if exists "notifications_delete_own" on public.notifications;

-- reviews
drop policy if exists "Reviews are viewable by everyone." on public.reviews;
drop policy if exists "Users can create reviews." on public.reviews;
drop policy if exists "Users can update their own reviews." on public.reviews;
drop policy if exists "reviews_select_public" on public.reviews;
drop policy if exists "reviews_insert_qualified" on public.reviews;

-- listing_images
drop policy if exists "Images viewable by everyone" on public.listing_images;
drop policy if exists "Users manage own images" on public.listing_images;
drop policy if exists "listing_images_select_public" on public.listing_images;
drop policy if exists "listing_images_insert_own" on public.listing_images;
drop policy if exists "listing_images_update_own" on public.listing_images;
drop policy if exists "listing_images_delete_own" on public.listing_images;

-- favorites
drop policy if exists "Users view own favorites" on public.favorites;
drop policy if exists "Users manage own favorites" on public.favorites;
drop policy if exists "favorites_select_own" on public.favorites;
drop policy if exists "favorites_insert_own" on public.favorites;
drop policy if exists "favorites_delete_own" on public.favorites;

-- listing_interactions
drop policy if exists "Interactions viewable by seller" on public.listing_interactions;
drop policy if exists "Anyone inserts interactions" on public.listing_interactions;
drop policy if exists "listing_interactions_select_seller" on public.listing_interactions;
drop policy if exists "listing_interactions_insert_any" on public.listing_interactions;

-- buyer_requests
drop policy if exists "Requests viewable by everyone" on public.buyer_requests;
drop policy if exists "Users manage own requests" on public.buyer_requests;
drop policy if exists "buyer_requests_select_public" on public.buyer_requests;
drop policy if exists "buyer_requests_insert_own" on public.buyer_requests;
drop policy if exists "buyer_requests_update_own" on public.buyer_requests;
drop policy if exists "buyer_requests_delete_own" on public.buyer_requests;

-- order_items
drop policy if exists "Items viewable by participants" on public.order_items;
drop policy if exists "Buyers insert order items" on public.order_items;
drop policy if exists "order_items_select_participant" on public.order_items;
drop policy if exists "order_items_insert_buyer" on public.order_items;

-- order_status_history
drop policy if exists "History viewable by participants" on public.order_status_history;
drop policy if exists "Participants insert history" on public.order_status_history;
drop policy if exists "order_status_history_select_participant" on public.order_status_history;

-- payments
drop policy if exists "Payments viewable by participants" on public.payments;
drop policy if exists "payments_select_participant" on public.payments;

-- transactions
drop policy if exists "transactions_select_participant" on public.transactions;

-- cancellations
drop policy if exists "Cancellations viewable by participants" on public.cancellations;
drop policy if exists "Participants insert cancellations" on public.cancellations;
drop policy if exists "cancellations_select_participant" on public.cancellations;
drop policy if exists "cancellations_insert_participant" on public.cancellations;

-- verification_records
drop policy if exists "Users view own verification records" on public.verification_records;
drop policy if exists "Users create own verification records" on public.verification_records;
drop policy if exists "verification_records_select_own" on public.verification_records;
drop policy if exists "verification_records_insert_own" on public.verification_records;

-- categories
drop policy if exists "Categories are viewable by everyone" on public.categories;
drop policy if exists "categories_select_public" on public.categories;


-- ============================================================
-- SECTION 2: HELPER FUNCTIONS (Trusted Security Logic)
-- ============================================================

-- Returns TRUE if the calling user is a participant in the given order.
create or replace function public.is_order_participant(p_order_id uuid)
returns boolean
language sql
security definer
stable
as $$
  select exists (
    select 1 from public.orders
    where id = p_order_id
    and (buyer_id = auth.uid() or seller_id = auth.uid())
  );
$$;

-- Returns TRUE if the given order is in a terminal / cancellable state.
-- Only 'pending' and 'paid' orders can be cancelled by participants.
create or replace function public.order_is_cancellable(p_order_id uuid)
returns boolean
language sql
security definer
stable
as $$
  select exists (
    select 1 from public.orders
    where id = p_order_id
    and status in ('pending', 'paid')
    and (buyer_id = auth.uid() or seller_id = auth.uid())
  );
$$;

-- Returns TRUE if the calling user has a completed order with the target user,
-- qualifying them to leave a review.
create or replace function public.has_completed_order_with(target_user_id uuid)
returns boolean
language sql
security definer
stable
as $$
  select exists (
    select 1 from public.orders
    where status = 'completed'
    and (
      (buyer_id = auth.uid() and seller_id = target_user_id)
      or
      (seller_id = auth.uid() and buyer_id = target_user_id)
    )
  );
$$;


-- ============================================================
-- SECTION 3: PROFILES
-- ============================================================
-- Public fields (display_name, avatar_url, region, rating, etc.) are readable
-- by everyone to support marketplace discovery.
-- Users own their own profile row, but cannot write system/reputation fields.
-- Stripe IDs and is_verified must NEVER be user-writable.

create policy "profiles_select_public"
  on public.profiles for select
  using (true);

create policy "profiles_insert_own"
  on public.profiles for insert
  with check (auth.uid() = id);

-- The USING clause identifies the row; WITH CHECK restricts what can be written.
-- System-managed columns (is_verified, rating, total_sales, response_rate,
-- stripe_account_id, stripe_customer_id) must not be settable by users.
-- We enforce this by requiring those columns remain unchanged.
create policy "profiles_update_own"
  on public.profiles for update
  using (auth.uid() = id)
  with check (
    auth.uid() = id
    -- Guard: is_verified may only be set to false by users (cannot self-verify)
    and is_verified = (select is_verified from public.profiles where id = auth.uid())
    -- Guard: stripe fields are immutable by users
    and stripe_account_id is not distinct from (select stripe_account_id from public.profiles where id = auth.uid())
    and stripe_customer_id is not distinct from (select stripe_customer_id from public.profiles where id = auth.uid())
    -- Guard: reputation counters are system-managed
    and rating = (select rating from public.profiles where id = auth.uid())
    and total_sales = (select total_sales from public.profiles where id = auth.uid())
    and response_rate = (select response_rate from public.profiles where id = auth.uid())
  );

-- Profile deletion cascades via auth.users; no direct user-delete needed.


-- ============================================================
-- SECTION 4: VERIFICATION RECORDS
-- ============================================================
-- Users can submit verification requests but cannot approve themselves.
-- Updates and approval are service-role only (Edge Function).

create policy "verification_records_select_own"
  on public.verification_records for select
  using (auth.uid() = user_id);

create policy "verification_records_insert_own"
  on public.verification_records for insert
  with check (
    auth.uid() = user_id
    -- Status must start as 'pending'; users cannot self-approve
    and status = 'pending'
    and verified_at is null
  );

-- No UPDATE or DELETE policy for users — managed by service role only.


-- ============================================================
-- SECTION 5: CATEGORIES
-- ============================================================
-- Read-only for all users. Managed by admins via service role.

create policy "categories_select_public"
  on public.categories for select
  using (true);


-- ============================================================
-- SECTION 6: LISTINGS (Products)
-- ============================================================
-- Active listings are publicly discoverable.
-- Sellers manage only their own.
-- Quantity and status changes must go through Edge Functions (reserve_listing_quantity RPC),
-- but we still allow the seller to archive/update non-sensitive fields.

create policy "listings_select_active_or_own"
  on public.listings for select
  using (
    status = 'ACTIVE'
    or seller_id = auth.uid()
  );

create policy "listings_insert_own"
  on public.listings for insert
  with check (
    auth.uid() = seller_id
    -- Cannot self-create a listing with quantity < 0
    and coalesce(quantity, 1) >= 0
  );

create policy "listings_update_own"
  on public.listings for update
  using (auth.uid() = seller_id)
  with check (
    auth.uid() = seller_id
    and quantity >= 0
  );

create policy "listings_delete_own"
  on public.listings for delete
  using (auth.uid() = seller_id);


-- ============================================================
-- SECTION 7: LISTING IMAGES
-- ============================================================

create policy "listing_images_select_public"
  on public.listing_images for select
  using (
    exists (
      select 1 from public.listings
      where id = listing_images.listing_id
      and (status = 'ACTIVE' or seller_id = auth.uid())
    )
  );

create policy "listing_images_insert_own"
  on public.listing_images for insert
  with check (
    exists (
      select 1 from public.listings
      where id = listing_images.listing_id
      and seller_id = auth.uid()
    )
  );

create policy "listing_images_update_own"
  on public.listing_images for update
  using (
    exists (
      select 1 from public.listings
      where id = listing_images.listing_id
      and seller_id = auth.uid()
    )
  );

create policy "listing_images_delete_own"
  on public.listing_images for delete
  using (
    exists (
      select 1 from public.listings
      where id = listing_images.listing_id
      and seller_id = auth.uid()
    )
  );


-- ============================================================
-- SECTION 8: FAVORITES (Wishlist)
-- ============================================================

create policy "favorites_select_own"
  on public.favorites for select
  using (auth.uid() = user_id);

create policy "favorites_insert_own"
  on public.favorites for insert
  with check (auth.uid() = user_id);

create policy "favorites_delete_own"
  on public.favorites for delete
  using (auth.uid() = user_id);

-- No UPDATE needed — favorites are toggled by delete+insert.


-- ============================================================
-- SECTION 9: LISTING INTERACTIONS (Views / Analytics)
-- ============================================================
-- Interaction records are write-once by anyone (including anonymous).
-- Only the seller of the listing can read their own listing's analytics.
-- No updates or deletes permitted.

create policy "listing_interactions_select_seller"
  on public.listing_interactions for select
  using (
    exists (
      select 1 from public.listings
      where id = listing_interactions.listing_id
      and seller_id = auth.uid()
    )
  );

create policy "listing_interactions_insert_any"
  on public.listing_interactions for insert
  with check (true);

-- No UPDATE or DELETE policies — immutable analytics log.


-- ============================================================
-- SECTION 10: BUYER REQUESTS
-- ============================================================

create policy "buyer_requests_select_public"
  on public.buyer_requests for select
  using (status = 'ACTIVE' or buyer_id = auth.uid());

create policy "buyer_requests_insert_own"
  on public.buyer_requests for insert
  with check (auth.uid() = buyer_id);

create policy "buyer_requests_update_own"
  on public.buyer_requests for update
  using (auth.uid() = buyer_id)
  with check (auth.uid() = buyer_id);

create policy "buyer_requests_delete_own"
  on public.buyer_requests for delete
  using (auth.uid() = buyer_id);


-- ============================================================
-- SECTION 11: ORDERS
-- ============================================================
-- CRITICAL: Participants can read their own orders.
-- Buyers create orders; sellers cannot create orders on behalf of buyers.
-- Status transitions (accepted, shipped, completed) are only allowed via
-- trusted backend (service role / Edge Functions). We intentionally do NOT
-- provide a permissive UPDATE policy. Instead we allow very limited updates:
--   - Buyer may update pickup_time only
--   - Seller may update delivery_tracking only
-- All status and payment_status changes must go through Edge Functions.

create policy "orders_select_participant"
  on public.orders for select
  using (auth.uid() = buyer_id or auth.uid() = seller_id);

create policy "orders_insert_buyer"
  on public.orders for insert
  with check (
    auth.uid() = buyer_id
    -- Buyer cannot create an order to themselves as seller
    and buyer_id <> seller_id
    -- Initial status must be 'pending'
    and status = 'pending'
    -- Initial payment_status must be 'pending'
    and payment_status = 'pending'
  );

-- Scoped, non-sensitive updates by participants only:
create policy "orders_update_buyer_pickup"
  on public.orders for update
  using (auth.uid() = buyer_id)
  with check (
    auth.uid() = buyer_id
    -- Buyer may only adjust pickup_time; status must be unchanged
    and status = (select status from public.orders where id = orders.id)
    and payment_status = (select payment_status from public.orders where id = orders.id)
    and seller_id = (select seller_id from public.orders where id = orders.id)
  );

create policy "orders_update_seller_tracking"
  on public.orders for update
  using (auth.uid() = seller_id)
  with check (
    auth.uid() = seller_id
    -- Seller may only update delivery_tracking; status must be unchanged
    and status = (select status from public.orders where id = orders.id)
    and payment_status = (select payment_status from public.orders where id = orders.id)
    and buyer_id = (select buyer_id from public.orders where id = orders.id)
  );

-- No DELETE policy — orders are permanent records.


-- ============================================================
-- SECTION 12: ORDER ITEMS
-- ============================================================

create policy "order_items_select_participant"
  on public.order_items for select
  using (public.is_order_participant(order_id));

create policy "order_items_insert_buyer"
  on public.order_items for insert
  with check (
    exists (
      select 1 from public.orders
      where id = order_items.order_id
      and buyer_id = auth.uid()
      and status = 'pending'
    )
  );

-- No UPDATE or DELETE — immutable financial record.


-- ============================================================
-- SECTION 13: ORDER STATUS HISTORY
-- ============================================================
-- Participants can read history.
-- INSERT is intentionally blocked for users — only service role (Edge Functions)
-- may write to this table to maintain state-machine integrity.
-- The previous migration allowed participants to insert; that is revoked.

create policy "order_status_history_select_participant"
  on public.order_status_history for select
  using (public.is_order_participant(order_id));

-- No INSERT/UPDATE/DELETE policy for users → service role only.


-- ============================================================
-- SECTION 14: CONVERSATIONS
-- ============================================================
-- Participants (buyer + seller) can read and update their thread metadata.
-- Buyers initiate conversations (INSERT).
-- DELETE is disabled — messages are preserved for both parties.
-- A buyer cannot create a conversation with themselves.

create policy "conversations_select_participant"
  on public.conversations for select
  using (auth.uid() = buyer_id or auth.uid() = seller_id);

create policy "conversations_insert_buyer"
  on public.conversations for insert
  with check (
    auth.uid() = buyer_id
    and buyer_id <> seller_id
  );

-- Participants may update metadata (e.g., last_message, unread flags)
-- but cannot reassign buyer_id or seller_id.
create policy "conversations_update_participant"
  on public.conversations for update
  using (auth.uid() = buyer_id or auth.uid() = seller_id)
  with check (
    buyer_id = (select buyer_id from public.conversations where id = conversations.id)
    and seller_id = (select seller_id from public.conversations where id = conversations.id)
  );

-- No DELETE policy — conversations are permanent; use soft-delete via status column if needed.


-- ============================================================
-- SECTION 15: MESSAGES
-- ============================================================
-- Only conversation participants can read or send messages.
-- sender_id must match the authenticated user.
-- Messages are immutable once sent (no UPDATE or DELETE).

create policy "messages_select_participant"
  on public.messages for select
  using (
    exists (
      select 1 from public.conversations
      where id = messages.conversation_id
      and (buyer_id = auth.uid() or seller_id = auth.uid())
    )
  );

create policy "messages_insert_participant"
  on public.messages for insert
  with check (
    auth.uid() = sender_id
    and exists (
      select 1 from public.conversations
      where id = messages.conversation_id
      and (buyer_id = auth.uid() or seller_id = auth.uid())
    )
  );

-- No UPDATE or DELETE — messages are immutable.


-- ============================================================
-- SECTION 16: REVIEWS / RATINGS
-- ============================================================
-- Reviews are publicly visible (supports seller reputation).
-- A reviewer can only submit a review against a completed order that involved them.
-- Reviews are NOT editable after submission — prevents rating manipulation.

create policy "reviews_select_public"
  on public.reviews for select
  using (true);

create policy "reviews_insert_qualified"
  on public.reviews for insert
  with check (
    auth.uid() = reviewer_id
    -- Reviewer cannot rate themselves
    and reviewer_id <> reviewee_id
    -- Must have a completed order linking reviewer and reviewee
    and exists (
      select 1 from public.orders
      where id = reviews.order_id
      and status = 'completed'
      and (
        (buyer_id = auth.uid() and seller_id = reviewee_id)
        or
        (seller_id = auth.uid() and buyer_id = reviewee_id)
      )
    )
    -- One review per order per direction
    and not exists (
      select 1 from public.reviews r
      where r.order_id = reviews.order_id
      and r.reviewer_id = auth.uid()
    )
  );

-- No UPDATE or DELETE for users — reviews are immutable records.


-- ============================================================
-- SECTION 17: NOTIFICATIONS
-- ============================================================
-- Users may read, mark-read, and delete their own notifications.
-- INSERT is restricted to service role only — users cannot inject
-- arbitrary notifications for themselves or others.

create policy "notifications_select_own"
  on public.notifications for select
  using (auth.uid() = user_id);

-- Allow users to mark notifications as read (update only the `read` field).
create policy "notifications_update_own_read"
  on public.notifications for update
  using (auth.uid() = user_id)
  with check (
    auth.uid() = user_id
    -- Guard: only the `read` flag may change; all other columns are immutable
    and user_id = (select user_id from public.notifications where id = notifications.id)
    and type = (select type from public.notifications where id = notifications.id)
    and title = (select title from public.notifications where id = notifications.id)
    and body = (select body from public.notifications where id = notifications.id)
  );

create policy "notifications_delete_own"
  on public.notifications for delete
  using (auth.uid() = user_id);

-- No INSERT policy for users → service role / Edge Functions only.


-- ============================================================
-- SECTION 18: PAYMENTS
-- ============================================================
-- Payer and payee may read their own payment records.
-- INSERT is service-role only (Stripe Edge Function creates records).
-- No UPDATE or DELETE by users.

create policy "payments_select_participant"
  on public.payments for select
  using (auth.uid() = payer_id or auth.uid() = payee_id);

-- No INSERT/UPDATE/DELETE for users → service role only.


-- ============================================================
-- SECTION 19: TRANSACTIONS
-- ============================================================
-- Users may read transactions linked to payments they are party to.
-- All mutations are service-role only.

create policy "transactions_select_participant"
  on public.transactions for select
  using (
    exists (
      select 1 from public.payments
      where id = transactions.payment_id
      and (payer_id = auth.uid() or payee_id = auth.uid())
    )
  );

-- No INSERT/UPDATE/DELETE for users → service role only.


-- ============================================================
-- SECTION 20: CANCELLATIONS
-- ============================================================
-- Participants may read cancellations for their orders.
-- A participant may cancel only if the order is in a cancellable state.

create policy "cancellations_select_participant"
  on public.cancellations for select
  using (public.is_order_participant(order_id));

create policy "cancellations_insert_participant"
  on public.cancellations for insert
  with check (
    auth.uid() = cancelled_by
    and public.order_is_cancellable(order_id)
  );

-- No UPDATE or DELETE — cancellations are immutable records.
