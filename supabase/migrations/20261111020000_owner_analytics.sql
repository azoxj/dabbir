-- Owner-only analytics. No financial records or customer identities are exposed.
create schema if not exists private;
create table if not exists private.analytics_owners (
  user_id uuid primary key references auth.users(id) on delete cascade,
  created_at timestamptz not null default now()
);
revoke all on schema private from public, anon, authenticated;
revoke all on private.analytics_owners from public, anon, authenticated;

-- Resolve the confirmed owner's account on migration execution, never grant by client-provided email.
insert into private.analytics_owners(user_id)
select id from auth.users where lower(email) = 'azozazo8z@gmail.com'
on conflict do nothing;

create or replace function public.owner_analytics()
returns jsonb
language plpgsql
security definer
set search_path = ''
as $$
declare result jsonb;
begin
  if (select auth.uid()) is null or not exists (
    select 1 from private.analytics_owners where user_id = (select auth.uid())
  ) then
    raise exception 'Not authorized' using errcode = '42501';
  end if;

  select jsonb_build_object(
    'total_users', (select count(*) from auth.users),
    'today_users', (select count(*) from auth.users
      where (created_at at time zone 'Asia/Riyadh')::date = (now() at time zone 'Asia/Riyadh')::date),
    'google_users', (select count(distinct user_id) from auth.identities where provider = 'google'),
    'signed_in_7d', (select count(*) from auth.users where last_sign_in_at >= now() - interval '7 days'),
    'daily', coalesce((select jsonb_agg(jsonb_build_object('date', day::date, 'count', total) order by day)
      from (select d.day, count(u.id) as total
        from generate_series(
          ((now() at time zone 'Asia/Riyadh')::date - 13)::timestamp,
          (now() at time zone 'Asia/Riyadh')::date::timestamp,
          interval '1 day'
        ) d(day)
        left join auth.users u on (u.created_at at time zone 'Asia/Riyadh')::date = d.day::date
        group by d.day) daily_counts), '[]'::jsonb)
  ) into result;
  return result;
end;
$$;
revoke all on function public.owner_analytics() from public, anon;
grant execute on function public.owner_analytics() to authenticated;
