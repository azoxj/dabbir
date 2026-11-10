-- =====================================================================
-- دبّر — تفضيلات المستخدم (إضافة فقط، بدون حذف أو تعديل بيانات موجودة)
-- =====================================================================
alter table public.profiles
  add column if not exists show_hijri boolean not null default true,
  add column if not exists alert_days smallint not null default 3;

do $$ begin
  if not exists (select 1 from pg_constraint where conname = 'profiles_alert_days_check') then
    alter table public.profiles add constraint profiles_alert_days_check check (alert_days between 1 and 14);
  end if;
end $$;

-- صلاحية التعديل على أعمدة محددة فقط (id وتواريخ الإنشاء غير قابلة للتعديل).
grant update (display_name, monthly_income, savings_target, payday, show_hijri, alert_days) on public.profiles to authenticated;

-- reset_my_data يعيد التفضيلات للافتراضي أيضًا.
create or replace function public.reset_my_data()
returns void
language plpgsql
security invoker
set search_path = ''
as $$
declare uid uuid := auth.uid();
begin
  if uid is null then
    raise exception 'not authenticated' using errcode = '42501';
  end if;
  delete from public.expenses      where user_id = uid;
  delete from public.budget_limits where user_id = uid;
  delete from public.commitments   where user_id = uid;
  delete from public.savings_goals where user_id = uid;
  update public.profiles set monthly_income = 0, savings_target = 0, payday = 27, show_hijri = true, alert_days = 3 where id = uid;
end;
$$;
revoke execute on function public.reset_my_data() from public, anon;
grant execute on function public.reset_my_data() to authenticated;
