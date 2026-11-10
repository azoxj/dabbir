-- Trusted monthly challenge scoring; no financial amounts are exposed.
create schema if not exists private;
create table if not exists private.challenge_activity (
  user_id uuid not null references auth.users(id) on delete cascade,
  activity_day date not null,
  first_recorded_at timestamptz not null default now(),
  primary key (user_id, activity_day)
);
revoke all on schema private from public, anon, authenticated;
revoke all on private.challenge_activity from public, anon, authenticated;

create or replace function private.track_challenge_expense()
returns trigger language plpgsql security definer set search_path = '' as $$
begin
  -- Count a day once; backdating spent_on does not count as activity.
  insert into private.challenge_activity(user_id, activity_day)
  values (new.user_id, (now() at time zone 'Asia/Riyadh')::date)
  on conflict do nothing;
  return new;
end $$;
revoke all on function private.track_challenge_expense() from public, anon, authenticated;
drop trigger if exists challenge_expense_activity on public.expenses;
create trigger challenge_expense_activity after insert on public.expenses
for each row execute function private.track_challenge_expense();

-- Immutable awarded scores; only this privileged job can write results.
create or replace function private.settle_monthly_challenge(p_month date)
returns integer language plpgsql security definer set search_path = '' as $$
declare v_winner uuid; v_points integer; v_count integer := 0;
begin
  if p_month is null or extract(day from p_month) <> 1
    or p_month >= date_trunc('month', now() at time zone 'Asia/Riyadh')::date then
    raise exception 'Only completed months may be settled';
  end if;
  perform pg_advisory_xact_lock(hashtext('dabbir-challenge'), extract(epoch from p_month::timestamp)::integer);
  if exists (select 1 from public.challenge_results where month = p_month) then return 0; end if;
  -- Fairness: one activity day = up to 5 points; capped at 100.
  -- At least 7 days in challenge and 3 distinct activity days to qualify.
  select e.user_id, least(100, count(a.activity_day)::integer * 5)
    into v_winner, v_points
  from public.challenge_entries e
  left join private.challenge_activity a
    on a.user_id = e.user_id
   and a.activity_day >= p_month
   and a.activity_day < (p_month + interval '1 month')::date
   and a.first_recorded_at >= e.joined_at
  where e.month = p_month
    and e.joined_at < (p_month + interval '1 month') - interval '7 days'
  group by e.user_id, e.joined_at
  having count(a.activity_day) >= 3
  order by count(a.activity_day) desc, e.joined_at asc, e.user_id asc
  limit 1;
  if v_winner is not null then
    insert into public.challenge_results(month, user_id, points, position)
    values (p_month, v_winner, v_points, 1);
    v_count := 1;
  end if;
  return v_count;
end $$;
revoke all on function private.settle_monthly_challenge(date) from public, anon, authenticated;
-- Re-run on the 1st-3rd to recover transient failures; idempotent settlement.
create extension if not exists pg_cron with schema pg_catalog;
do $$
begin
  if not exists (select 1 from cron.job where jobname = 'dabbir-monthly-challenge-settlement') then
    perform cron.schedule(
      'dabbir-monthly-challenge-settlement',
      '10 0 1-3 * *',
      $job$select private.settle_monthly_challenge((date_trunc('month', now() at time zone 'Asia/Riyadh') - interval '1 month')::date)$job$
    );
  end if;
end $$;
