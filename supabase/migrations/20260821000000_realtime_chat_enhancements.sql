-- ============================================================
-- Migration: 20260821000000_realtime_chat_enhancements.sql
-- Description: Real-Time Buyer-Seller Messaging System Enhancements
-- Adds image attachments, order/request references, and read receipt RPCs.
-- ============================================================

-- 1. Extend messages table
alter table public.messages 
  add column if not exists image_url text,
  add column if not exists order_id uuid references public.orders(id) on delete set null;

-- 2. Extend conversations table
alter table public.conversations
  add column if not exists order_id uuid references public.orders(id) on delete set null,
  add column if not exists buyer_request_id uuid references public.buyer_requests(id) on delete set null;

-- 3. Stored function to clear unread flag atomically for a user in a conversation
create or replace function public.mark_conversation_as_read(
  p_conversation_id uuid,
  p_user_id uuid
)
returns void
language plpgsql
security definer
as $$
declare
  v_buyer_id uuid;
  v_seller_id uuid;
begin
  select buyer_id, seller_id into v_buyer_id, v_seller_id
  from public.conversations
  where id = p_conversation_id;

  if not found then
    return;
  end if;

  if p_user_id = v_buyer_id then
    update public.conversations
    set buyer_unread = false
    where id = p_conversation_id;
  elsif p_user_id = v_seller_id then
    update public.conversations
    set seller_unread = false
    where id = p_conversation_id;
  end if;
end;
$$;

-- Grant execution to authenticated users
grant execute on function public.mark_conversation_as_read to authenticated;

-- Ensure Realtime publication includes messages and conversations
do $$
begin
  if not exists (
    select 1 from pg_publication_tables 
    where pubname = 'supabase_realtime' and schemaname = 'public' and tablename = 'messages'
  ) then
    alter publication supabase_realtime add table public.messages;
  end if;

  if not exists (
    select 1 from pg_publication_tables 
    where pubname = 'supabase_realtime' and schemaname = 'public' and tablename = 'conversations'
  ) then
    alter publication supabase_realtime add table public.conversations;
  end if;
end $$;
