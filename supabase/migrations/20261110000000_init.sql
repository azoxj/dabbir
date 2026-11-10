-- =====================================================================
-- دبّر — المخطط الأولي (المرحلة الأولى)
-- يُنفَّذ على مشروع Supabase للتطوير/الاختبار أولًا، وليس على الإنتاج مباشرة.
-- المبدأ: كل صف يملكه مستخدم واحد (user_id = auth.uid())، و RLS مفعّل على كل جدول.
-- =====================================================================

create extension if not exists pgcrypto;

-- ---------------------------------------------------------------------
-- دوال مساعدة
-- ---------------------------------------------------------------------
create or replace function public.set_updated_at()
returns trigger
language plpgsql
set search_path = ''
as $$
begin
  new.updated_at := now();
  return new;
end;
$$;

-- يمنع تغيير مالك الصف بعد إنشائه (حتى لو سمحت السياسة بالتحديث).
create or replace function public.prevent_owner_change()
returns trigger
language plpgsql
set search_path = ''
as $$
begin
  if new.user_id is distinct from old.user_id then
    raise exception 'user_id is immutable' using errcode = '42501';
  end if;
  return new;
end;
$$;

-- ---------------------------------------------------------------------
-- profiles: ملف المستخدم + إعدادات الميزانية العامة
-- ---------------------------------------------------------------------
create table if not exists public.profiles (
  id             uuid primary key references auth.users (id) on delete cascade,
  display_name   text check (char_length(display_name) <= 80),
  monthly_income numeric(12, 2) not null default 0 check (monthly_income >= 0 and monthly_income <= 100000000),
  savings_target numeric(12, 2) not null default 0 check (savings_target >= 0 and savings_target <= 100000000),
  payday         smallint not null default 27 check (payday between 1 and 31),
  created_at     timestamptz not null default now(),
  updated_at     timestamptz not null default now()
);

-- ---------------------------------------------------------------------
-- expenses: المصاريف
-- ---------------------------------------------------------------------
create table if not exists public.expenses (
  id         uuid primary key default gen_random_uuid(),
  user_id    uuid not null default auth.uid() references auth.users (id) on delete cascade,
  amount     numeric(12, 2) not null check (amount > 0 and amount <= 100000000),
  category   text not null check (category in
               ('housing','food','transport','bills','health','education','family','entertainment','shopping','other')),
  note       text check (char_length(note) <= 200),
  spent_on   date not null default current_date,
  created_at timestamptz not null default now(),
  updated_at timestamptz not null default now()
);
create index if not exists expenses_user_spent_idx on public.expenses (user_id, spent_on desc);

-- ---------------------------------------------------------------------
-- budget_limits: حد شهري لكل فئة
-- ---------------------------------------------------------------------
create table if not exists public.budget_limits (
  id            uuid primary key default gen_random_uuid(),
  user_id       uuid not null default auth.uid() references auth.users (id) on delete cascade,
  category      text not null check (category in
                  ('housing','food','transport','bills','health','education','family','entertainment','shopping','other')),
  monthly_limit numeric(12, 2) not null check (monthly_limit > 0 and monthly_limit <= 100000000),
  created_at    timestamptz not null default now(),
  updated_at    timestamptz not null default now(),
  unique (user_id, category)
);

-- ---------------------------------------------------------------------
-- commitments: الالتزامات والمواعيد
-- ---------------------------------------------------------------------
create table if not exists public.commitments (
  id         uuid primary key default gen_random_uuid(),
  user_id    uuid not null default auth.uid() references auth.users (id) on delete cascade,
  title      text not null check (char_length(title) between 1 and 120),
  kind       text not null default 'other' check (kind in ('bill','appointment','renewal','installment','other')),
  due_date   date not null,
  due_time   time,
  amount     numeric(12, 2) check (amount is null or (amount >= 0 and amount <= 100000000)),
  recurrence text not null default 'none' check (recurrence in ('none','monthly','yearly')),
  done       boolean not null default false,
  notes      text check (char_length(notes) <= 500),
  created_at timestamptz not null default now(),
  updated_at timestamptz not null default now()
);
create index if not exists commitments_user_due_idx on public.commitments (user_id, done, due_date);

-- ---------------------------------------------------------------------
-- savings_goals: أهداف الادخار
-- ---------------------------------------------------------------------
create table if not exists public.savings_goals (
  id             uuid primary key default gen_random_uuid(),
  user_id        uuid not null default auth.uid() references auth.users (id) on delete cascade,
  name           text not null check (char_length(name) between 1 and 100),
  target_amount  numeric(12, 2) not null check (target_amount > 0 and target_amount <= 100000000),
  current_amount numeric(12, 2) not null default 0 check (current_amount >= 0 and current_amount <= 100000000),
  target_date    date,
  created_at     timestamptz not null default now(),
  updated_at     timestamptz not null default now()
);
create index if not exists savings_goals_user_idx on public.savings_goals (user_id);

-- ---------------------------------------------------------------------
-- Triggers
-- ---------------------------------------------------------------------
do $$
declare t text;
begin
  foreach t in array array['profiles','expenses','budget_limits','commitments','savings_goals'] loop
    execute format('drop trigger if exists trg_%1$s_updated_at on public.%1$I', t);
    execute format('create trigger trg_%1$s_updated_at before update on public.%1$I
                    for each row execute function public.set_updated_at()', t);
  end loop;
  foreach t in array array['expenses','budget_limits','commitments','savings_goals'] loop
    execute format('drop trigger if exists trg_%1$s_owner on public.%1$I', t);
    execute format('create trigger trg_%1$s_owner before update on public.%1$I
                    for each row execute function public.prevent_owner_change()', t);
  end loop;
end $$;

-- إنشاء ملف المستخدم تلقائيًا عند التسجيل (Email أو Google).
create or replace function public.handle_new_user()
returns trigger
language plpgsql
security definer
set search_path = ''
as $$
begin
  insert into public.profiles (id, display_name)
  values (
    new.id,
    left(coalesce(new.raw_user_meta_data ->> 'full_name', new.raw_user_meta_data ->> 'name', split_part(new.email, '@', 1)), 80)
  )
  on conflict (id) do nothing;
  return new;
end;
$$;
revoke execute on function public.handle_new_user() from public, anon, authenticated;

drop trigger if exists on_auth_user_created on auth.users;
create trigger on_auth_user_created
  after insert on auth.users
  for each row execute function public.handle_new_user();

-- ---------------------------------------------------------------------
-- Row Level Security
-- ---------------------------------------------------------------------
alter table public.profiles      enable row level security;
alter table public.expenses      enable row level security;
alter table public.budget_limits enable row level security;
alter table public.commitments   enable row level security;
alter table public.savings_goals enable row level security;

-- الزائر غير المسجّل (anon) لا يملك أي صلاحية على بيانات المستخدمين.
revoke all on public.profiles, public.expenses, public.budget_limits, public.commitments, public.savings_goals from anon;

-- profiles: يُنشأ بالـ trigger فقط؛ المستخدم يقرأ ويعدّل ملفه فقط، ولا يحذفه (الحذف عبر حذف الحساب).
revoke all on public.profiles from authenticated;
grant select on public.profiles to authenticated;
grant update (display_name, monthly_income, savings_target, payday) on public.profiles to authenticated;

drop policy if exists profiles_select_own on public.profiles;
drop policy if exists profiles_update_own on public.profiles;
create policy profiles_select_own on public.profiles
  for select to authenticated using ((select auth.uid()) = id);
create policy profiles_update_own on public.profiles
  for update to authenticated using ((select auth.uid()) = id) with check ((select auth.uid()) = id);

-- الجداول المملوكة: نفس السياسات الأربع لكل جدول.
do $$
declare t text;
begin
  foreach t in array array['expenses','budget_limits','commitments','savings_goals'] loop
    execute format('grant select, insert, update, delete on public.%I to authenticated', t);
    execute format('drop policy if exists %1$s_select_own on public.%1$I', t);
    execute format('drop policy if exists %1$s_insert_own on public.%1$I', t);
    execute format('drop policy if exists %1$s_update_own on public.%1$I', t);
    execute format('drop policy if exists %1$s_delete_own on public.%1$I', t);
    execute format('create policy %1$s_select_own on public.%1$I for select to authenticated
                    using ((select auth.uid()) = user_id)', t);
    execute format('create policy %1$s_insert_own on public.%1$I for insert to authenticated
                    with check ((select auth.uid()) = user_id)', t);
    execute format('create policy %1$s_update_own on public.%1$I for update to authenticated
                    using ((select auth.uid()) = user_id) with check ((select auth.uid()) = user_id)', t);
    execute format('create policy %1$s_delete_own on public.%1$I for delete to authenticated
                    using ((select auth.uid()) = user_id)', t);
  end loop;
end $$;

-- ---------------------------------------------------------------------
-- RPC: إيداع/سحب ذرّي في هدف ادخار (يمنع تعارض قراءة-ثم-كتابة من جهازين).
-- security invoker → تنطبق RLS؛ المستخدم لا يعدّل إلا أهدافه.
-- ---------------------------------------------------------------------
create or replace function public.adjust_goal_amount(p_goal_id uuid, p_delta numeric)
returns public.savings_goals
language plpgsql
security invoker
set search_path = ''
as $$
declare result public.savings_goals;
begin
  if p_delta is null or p_delta = 0 or abs(p_delta) > 100000000 then
    raise exception 'invalid amount' using errcode = '22023';
  end if;
  update public.savings_goals
     set current_amount = greatest(0, current_amount + round(p_delta, 2))
   where id = p_goal_id
  returning * into result;
  if not found then
    raise exception 'goal not found' using errcode = 'P0002';
  end if;
  return result;
end;
$$;
revoke execute on function public.adjust_goal_amount(uuid, numeric) from public, anon;
grant execute on function public.adjust_goal_amount(uuid, numeric) to authenticated;
