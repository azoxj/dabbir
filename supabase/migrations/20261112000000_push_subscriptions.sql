-- Web Push subscriptions: each user may opt in per device; no financial data in payloads.
create table if not exists public.push_subscriptions (
  id uuid primary key default gen_random_uuid(),
  user_id uuid not null references auth.users(id) on delete cascade,
  endpoint text not null check (length(endpoint) between 20 and 2048 and endpoint ~ '^https://'),
  p256dh text not null check (length(p256dh) between 20 and 256),
  auth text not null check (length(auth) between 8 and 256),
  created_at timestamptz not null default now(),
  updated_at timestamptz not null default now(),
  unique (user_id, endpoint)
);
create index if not exists push_subscriptions_user_id_idx on public.push_subscriptions(user_id);
alter table public.push_subscriptions enable row level security;
revoke all on public.push_subscriptions from anon, authenticated;
grant select, insert, update, delete on public.push_subscriptions to authenticated;
drop policy if exists push_subscriptions_select_own on public.push_subscriptions;
create policy push_subscriptions_select_own on public.push_subscriptions for select to authenticated using ((select auth.uid()) = user_id);
drop policy if exists push_subscriptions_insert_own on public.push_subscriptions;
create policy push_subscriptions_insert_own on public.push_subscriptions for insert to authenticated with check ((select auth.uid()) = user_id);
drop policy if exists push_subscriptions_update_own on public.push_subscriptions;
create policy push_subscriptions_update_own on public.push_subscriptions for update to authenticated using ((select auth.uid()) = user_id) with check ((select auth.uid()) = user_id);
drop policy if exists push_subscriptions_delete_own on public.push_subscriptions;
create policy push_subscriptions_delete_own on public.push_subscriptions for delete to authenticated using ((select auth.uid()) = user_id);
-- Idempotent once-per-day notifications per event and subscription; only trusted server writes.
create table if not exists public.push_delivery_log (
  subscription_id uuid not null references public.push_subscriptions(id) on delete cascade,
  reminder_key text not null check (length(reminder_key) between 5 and 256),
  delivery_day date not null,
  sent_at timestamptz not null default now(),
  primary key (subscription_id, reminder_key, delivery_day)
);
alter table public.push_delivery_log enable row level security;
revoke all on public.push_delivery_log from anon, authenticated;
