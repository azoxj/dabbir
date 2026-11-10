-- Monthly challenge foundation. No monetary figures are shared with other users.
create table if not exists public.challenge_entries (
  user_id uuid not null references auth.users(id) on delete cascade,
  month date not null,
  alias text not null check (char_length(alias) between 2 and 24),
  joined_at timestamptz not null default now(),
  primary key(user_id, month),
  constraint challenge_month_first check (extract(day from month)=1)
);
create table if not exists public.challenge_results (
  month date not null,
  user_id uuid not null references auth.users(id) on delete cascade,
  points integer not null check (points between 0 and 100),
  position integer not null check (position >= 1),
  awarded_at timestamptz not null default now(),
  primary key(month,user_id),
  unique(month,position)
);
create unique index if not exists challenge_one_winner_per_month on public.challenge_results(month) where position=1;
alter table public.challenge_entries enable row level security;
alter table public.challenge_results enable row level security;
revoke all on public.challenge_entries, public.challenge_results from anon;
revoke all on public.challenge_entries, public.challenge_results from authenticated;
grant select, insert, delete on public.challenge_entries to authenticated;
grant select on public.challenge_results to authenticated;
create policy challenge_entries_public_alias on public.challenge_entries for select to authenticated using (true);
create policy challenge_entries_join_own on public.challenge_entries for insert to authenticated
 with check ((select auth.uid())=user_id and month=date_trunc('month',current_date)::date);
create policy challenge_entries_leave_own on public.challenge_entries for delete to authenticated
 using ((select auth.uid())=user_id and month=date_trunc('month',current_date)::date);
create policy challenge_results_visible on public.challenge_results for select to authenticated
 using (exists (select 1 from public.challenge_entries e where e.user_id=challenge_results.user_id and e.month=challenge_results.month));
-- No client writes to scores or awards. Scoring and winner settlement require a separate trusted server job.
