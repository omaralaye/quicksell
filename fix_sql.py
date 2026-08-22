import re
import os

MIGRATIONS_DIR = 'supabase/migrations'
NEW_MIGRATION = os.path.join(MIGRATIONS_DIR, '20260820230000_fix_status_case.sql')

# Helper to read file
def read_file(filename):
    with open(os.path.join(MIGRATIONS_DIR, filename), 'r') as f:
        return f.read()

# Read the contents of the files that contain the functions
ranking_engine = read_file('20260820190000_ranking_engine.sql')
quick_match = read_file('20260820200000_quick_match.sql')

# We need to extract the CREATE OR REPLACE FUNCTION blocks.
def extract_function(sql, func_name):
    pattern = r'(create or replace function public\.' + func_name + r'\b.*?\$\$;)'
    match = re.search(pattern, sql, re.IGNORECASE | re.DOTALL)
    if not match:
        raise Exception(f"Function {func_name} not found!")
    return match.group(1)

funcs_to_extract = [
    (ranking_engine, 'rank_listings'),
    (ranking_engine, 'get_nearby_listings'),
    (quick_match, 'find_eligible_sellers_for_request'),
    (quick_match, 'create_buyer_request_with_notifications'),
    (quick_match, 'respond_to_buyer_request')
]

new_sql = """-- ============================================================
-- Fix Status Case Sensitivity in RPCs and RLS
-- ============================================================

-- 1. Fix Listings RLS Policies
drop policy if exists "listings_select_active_or_own" on public.listings;
create policy "listings_select_active_or_own"
  on public.listings for select
  using (status = 'ACTIVE' or seller_id = auth.uid());

drop policy if exists "listing_images_select_public" on public.listing_images;
create policy "listing_images_select_public"
  on public.listing_images for select
  using (
    exists (
      select 1 from public.listings
      where id = listing_images.listing_id
      and (status = 'ACTIVE' or seller_id = auth.uid())
    )
  );

-- 2. Fix Buyer Requests RLS Policies
drop policy if exists "buyer_requests_select_public" on public.buyer_requests;
create policy "buyer_requests_select_public"
  on public.buyer_requests for select
  using (status = 'ACTIVE' or buyer_id = auth.uid());

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

-- 3. Update RPCs to use 'ACTIVE' instead of 'active'
"""

for source, func_name in funcs_to_extract:
    func_sql = extract_function(source, func_name)
    # Replace 'active' with 'ACTIVE'
    func_sql = re.sub(r"'active'", r"'ACTIVE'", func_sql)
    new_sql += "\n" + func_sql + "\n"

# Add the filter to exclude seller's own listings in rank_listings if desired
# Actually, the user just wants to see their list right now. Wait, I should also add the filter since I offered it.
# The user hasn't explicitly asked for the filter yet, they just asked "why can't I see my list?". So I'll just fix the bug first.

with open(NEW_MIGRATION, 'w') as f:
    f.write(new_sql)

print(f"Created {NEW_MIGRATION}")
