-- =====================================================================
-- دبّر — (1) مسح بيانات المستخدم  (2) استيراد بيانات «دبّر 2.0» من جدول user_data
-- آمن لإعادة التنفيذ. إذا لم يوجد جدول user_data (مشروع جديد) لا يحدث استيراد.
-- =====================================================================

-- (1) «مسح جميع بياناتي» — ذرّي، security invoker فتنطبق RLS ولا يمس إلا بيانات المستدعي.
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
  update public.profiles set monthly_income = 0, savings_target = 0, payday = 27 where id = uid;
end;
$$;
revoke execute on function public.reset_my_data() from public, anon;
grant execute on function public.reset_my_data() to authenticated;

-- (2) سجل الاستيراد: يمنع استيراد مستخدم مرتين. لا يراه المستخدمون (RLS بلا سياسات).
create table if not exists public.legacy_v2_imports (
  user_id     uuid primary key references auth.users (id) on delete cascade,
  imported_at timestamptz not null default now()
);
alter table public.legacy_v2_imports enable row level security;
revoke all on public.legacy_v2_imports from anon, authenticated;

-- يحوّل قيمة JSON إلى مبلغ صالح (0..100,000,000) أو null.
create or replace function public.legacy_amount(v jsonb)
returns numeric
language sql
immutable
set search_path = ''
as $$
  select case
    when v is null then null
    when jsonb_typeof(v) = 'number' then v::text::numeric
    when jsonb_typeof(v) = 'string' and (v #>> '{}') ~ '^\s*\d+(\.\d+)?\s*$' then trim(v #>> '{}')::numeric
    else null
  end
$$;
revoke execute on function public.legacy_amount(jsonb) from public, anon, authenticated;

-- يحوّل نص YYYY-MM-DD إلى تاريخ صالح أو null (2026-02-30 ← null بدل الفشل).
create or replace function public.legacy_date(v text)
returns date
language plpgsql
immutable
set search_path = ''
as $$
begin
  if v is null or v !~ '^\d{4}-\d{2}-\d{2}$' then
    return null;
  end if;
  return v::date;
exception when others then
  return null;
end;
$$;
revoke execute on function public.legacy_date(text) from public, anon, authenticated;

/*
 * خريطة التحويل من payload النسخة 2.0:
 *   salary            → profiles.monthly_income   (إذا كان 0)
 *   saving            → profiles.savings_target   (إذا كان 0)
 *   rent  > 0         → commitments «الإيجار» شهري (bill)
 *   car   > 0         → commitments «قسط السيارة» شهري (installment)
 *   other > 0         → budget_limits(other) بنفس المبلغ
 *   tasks[{name,date,done}]        → commitments لمرة واحدة
 *   goals[{name,target,current}]   → savings_goals
 * الالتزامات الشهرية المنقولة تُستحق أول الشهر القادم مع ملاحظة لتعديل التاريخ (النسخة القديمة بلا تواريخ).
 */
create or replace function public.import_legacy_v2_data()
returns integer
language plpgsql
set search_path = ''
as $$
declare
  r record;
  p jsonb;
  t jsonb;
  g jsonb;
  amt numeric;
  tgt numeric;
  cur numeric;
  next_month date := (date_trunc('month', now()) + interval '1 month')::date;
  note text := 'منقول من دبّر 2.0 — عدّل تاريخ الاستحقاق';
  n integer := 0;
begin
  if to_regclass('public.user_data') is null then
    return 0;
  end if;

  for r in
    execute 'select u.user_id, u.payload from public.user_data u
             join auth.users au on au.id = u.user_id
             where not exists (select 1 from public.legacy_v2_imports i where i.user_id = u.user_id)'
  loop
    p := coalesce(r.payload, '{}'::jsonb);

    insert into public.profiles (id) values (r.user_id) on conflict (id) do nothing;

    amt := public.legacy_amount(p -> 'salary');
    if amt is not null and amt <= 100000000 then
      update public.profiles set monthly_income = round(amt, 2) where id = r.user_id and monthly_income = 0;
    end if;
    amt := public.legacy_amount(p -> 'saving');
    if amt is not null and amt <= 100000000 then
      update public.profiles set savings_target = round(amt, 2) where id = r.user_id and savings_target = 0;
    end if;

    amt := public.legacy_amount(p -> 'rent');
    if amt > 0 and amt <= 100000000 then
      insert into public.commitments (user_id, title, kind, due_date, amount, recurrence, notes)
      values (r.user_id, 'الإيجار', 'bill', next_month, round(amt, 2), 'monthly', note);
    end if;
    amt := public.legacy_amount(p -> 'car');
    if amt > 0 and amt <= 100000000 then
      insert into public.commitments (user_id, title, kind, due_date, amount, recurrence, notes)
      values (r.user_id, 'قسط السيارة', 'installment', next_month, round(amt, 2), 'monthly', note);
    end if;
    amt := public.legacy_amount(p -> 'other');
    if amt > 0 and amt <= 100000000 then
      insert into public.budget_limits (user_id, category, monthly_limit)
      values (r.user_id, 'other', round(amt, 2))
      on conflict (user_id, category) do nothing;
    end if;

    if jsonb_typeof(p -> 'tasks') = 'array' then
      for t in select * from jsonb_array_elements(p -> 'tasks') loop
        if jsonb_typeof(t) = 'object'
           and length(trim(coalesce(t ->> 'name', ''))) > 0
           and public.legacy_date(t ->> 'date') is not null then
          insert into public.commitments (user_id, title, kind, due_date, recurrence, done)
          values (r.user_id, left(trim(t ->> 'name'), 120), 'other', public.legacy_date(t ->> 'date'), 'none',
                  coalesce((t ->> 'done') = 'true', false));
        end if;
      end loop;
    end if;

    if jsonb_typeof(p -> 'goals') = 'array' then
      for g in select * from jsonb_array_elements(p -> 'goals') loop
        tgt := public.legacy_amount(g -> 'target');
        cur := coalesce(public.legacy_amount(g -> 'current'), 0);
        if jsonb_typeof(g) = 'object' and length(trim(coalesce(g ->> 'name', ''))) > 0
           and tgt > 0 and tgt <= 100000000 and cur <= 100000000 then
          insert into public.savings_goals (user_id, name, target_amount, current_amount)
          values (r.user_id, left(trim(g ->> 'name'), 100), round(tgt, 2), round(cur, 2));
        end if;
      end loop;
    end if;

    insert into public.legacy_v2_imports (user_id) values (r.user_id);
    n := n + 1;
  end loop;
  return n;
end;
$$;
revoke execute on function public.import_legacy_v2_data() from public, anon, authenticated;

-- ينفَّذ الاستيراد مرة واحدة الآن (لا شيء إن لم يوجد user_data). جدول user_data نفسه لا يُحذف.
select public.import_legacy_v2_data();
