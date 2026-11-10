-- اختبارات عزل بيانات المستخدمين. أي فشل يوقف السكربت (ON_ERROR_STOP).
\set ON_ERROR_STOP on
\set QUIET on

-- مستخدمان: A و B (إدخالهما يطلق trigger إنشاء profiles)
insert into auth.users (id, email, raw_user_meta_data) values
  ('aaaaaaaa-0000-0000-0000-000000000001', 'a@example.com', '{"full_name":"سارة"}'),
  ('bbbbbbbb-0000-0000-0000-000000000002', 'b@example.com', '{}');

create function pg_temp.assert(cond boolean, msg text) returns void language plpgsql as $$
begin
  if not coalesce(cond, false) then raise exception 'ASSERTION FAILED: %', msg; end if;
  raise notice 'PASS: %', msg;
end $$;
grant execute on function pg_temp.assert(boolean, text) to anon, authenticated;

select pg_temp.assert((select count(*) from public.profiles) = 2, 'trigger ينشئ profile لكل مستخدم جديد');
select pg_temp.assert((select display_name from public.profiles where id = 'aaaaaaaa-0000-0000-0000-000000000001') = 'سارة', 'display_name من بيانات Google/metadata');
select pg_temp.assert((select display_name from public.profiles where id = 'bbbbbbbb-0000-0000-0000-000000000002') = 'b', 'display_name احتياطي من البريد');

-- ===== المستخدم A يضيف بياناته =====
set role authenticated;
select set_config('request.jwt.claim.sub', 'aaaaaaaa-0000-0000-0000-000000000001', false);
insert into public.expenses (amount, category, note) values (120, 'food', 'غداء');
insert into public.commitments (title, due_date) values ('تجديد الاستمارة', current_date + 3);
insert into public.savings_goals (name, target_amount) values ('صندوق الطوارئ', 10000);
insert into public.budget_limits (category, monthly_limit) values ('food', 1500);
select pg_temp.assert((select user_id from public.expenses limit 1) = 'aaaaaaaa-0000-0000-0000-000000000001', 'user_id يُعبّأ تلقائيًا من auth.uid()');
select pg_temp.assert((select count(*) from public.profiles) = 1, 'A يرى ملفه فقط');
update public.profiles set monthly_income = 9000 where true;
select pg_temp.assert((select monthly_income from public.profiles) = 9000, 'A يعدّل ملفه');

-- ===== المستخدم B لا يرى ولا يعدّل بيانات A =====
select set_config('request.jwt.claim.sub', 'bbbbbbbb-0000-0000-0000-000000000002', false);
select pg_temp.assert((select count(*) from public.expenses) = 0, 'B لا يرى مصاريف A');
select pg_temp.assert((select count(*) from public.commitments) = 0, 'B لا يرى التزامات A');
select pg_temp.assert((select count(*) from public.savings_goals) = 0, 'B لا يرى أهداف A');
select pg_temp.assert((select count(*) from public.budget_limits) = 0, 'B لا يرى حدود ميزانية A');
select pg_temp.assert((select count(*) from public.profiles) = 1, 'B يرى ملفه فقط');

with u as (update public.expenses set amount = 1 returning 1) select pg_temp.assert((select count(*) from u) = 0, 'B لا يعدّل مصاريف A');
with d as (delete from public.savings_goals returning 1) select pg_temp.assert((select count(*) from d) = 0, 'B لا يحذف أهداف A');
with u as (update public.profiles set monthly_income = 1 where id = 'aaaaaaaa-0000-0000-0000-000000000001' returning 1)
  select pg_temp.assert((select count(*) from u) = 0, 'B لا يعدّل ملف A');

-- B يحاول إدخال صف باسم A → يجب أن يُرفض
do $$ begin
  begin
    insert into public.expenses (user_id, amount, category) values ('aaaaaaaa-0000-0000-0000-000000000001', 5, 'other');
    raise exception 'ASSERTION FAILED: B أدخل صفًا باسم A';
  exception when insufficient_privilege then raise notice 'PASS: رفض إدخال صف باسم مستخدم آخر';
  end;
end $$;

-- B ينقل صفه إلى A → يجب أن يُرفض
insert into public.commitments (title, due_date) values ('موعد', current_date);
do $$ begin
  begin
    update public.commitments set user_id = 'aaaaaaaa-0000-0000-0000-000000000001';
    raise exception 'ASSERTION FAILED: B نقل ملكية صف';
  exception when insufficient_privilege then raise notice 'PASS: رفض تغيير مالك الصف';
  end;
end $$;

-- B لا يستطيع الإيداع في هدف A عبر RPC
do $$ begin
  begin
    perform public.adjust_goal_amount((select id from public.savings_goals limit 1), 10);
    raise exception 'ASSERTION FAILED: لا يوجد هدف ظاهر لـ B أصلًا';
  exception when no_data_found then raise notice 'PASS: B لا يصل لأهداف A عبر RPC (يرى 0 أهداف)';
  end;
end $$;
reset role;
select set_config('request.jwt.claim.sub', 'bbbbbbbb-0000-0000-0000-000000000002', false);
set role authenticated;
do $$ begin
  begin
    perform public.adjust_goal_amount((select id from public.savings_goals s where s.user_id = 'aaaaaaaa-0000-0000-0000-000000000001'), 10);
    raise exception 'ASSERTION FAILED: B عدّل هدف A';
  exception when no_data_found then raise notice 'PASS: RPC adjust_goal_amount يحترم RLS';
  end;
end $$;

-- B لا يستطيع حذف profile ولا تعديل أعمدة محمية
do $$ begin
  begin
    delete from public.profiles;
    raise exception 'ASSERTION FAILED: حذف profile مسموح';
  exception when insufficient_privilege then raise notice 'PASS: حذف profile غير مسموح للمستخدم';
  end;
end $$;
do $$ begin
  begin
    update public.profiles set id = gen_random_uuid();
    raise exception 'ASSERTION FAILED: تعديل profiles.id مسموح';
  exception when insufficient_privilege then raise notice 'PASS: تعديل profiles.id غير مسموح';
  end;
end $$;

-- قيود البيانات
do $$ begin
  begin
    insert into public.expenses (amount, category) values (-5, 'food');
    raise exception 'ASSERTION FAILED: مبلغ سالب مقبول';
  exception when check_violation then raise notice 'PASS: رفض مبلغ سالب';
  end;
  begin
    insert into public.expenses (amount, category) values (5, 'crypto');
    raise exception 'ASSERTION FAILED: فئة غير معروفة مقبولة';
  exception when check_violation then raise notice 'PASS: رفض فئة غير معروفة';
  end;
end $$;

-- ===== A: الإيداع الذري يعمل، والسحب لا ينزل تحت الصفر =====
select set_config('request.jwt.claim.sub', 'aaaaaaaa-0000-0000-0000-000000000001', false);
select pg_temp.assert((public.adjust_goal_amount((select id from public.savings_goals limit 1), 250.5)).current_amount = 250.5, 'إيداع في الهدف');
select pg_temp.assert((public.adjust_goal_amount((select id from public.savings_goals limit 1), -9999)).current_amount = 0, 'السحب لا ينزل تحت الصفر');

-- ===== الزائر (anon) لا يملك أي وصول =====
reset role;
set role anon;
select set_config('request.jwt.claim.sub', '', false);
do $$
declare t text;
begin
  foreach t in array array['profiles','expenses','budget_limits','commitments','savings_goals'] loop
    begin
      execute format('select count(*) from public.%I', t);
      raise exception 'ASSERTION FAILED: anon قرأ %', t;
    exception when insufficient_privilege then raise notice 'PASS: anon ممنوع من قراءة %', t;
    end;
  end loop;
  begin
    perform public.adjust_goal_amount(gen_random_uuid(), 1);
    raise exception 'ASSERTION FAILED: anon نفّذ RPC';
  exception when insufficient_privilege then raise notice 'PASS: anon ممنوع من تنفيذ adjust_goal_amount';
  end;
end $$;

-- ===== RLS مفعّل على كل جدول في public =====
reset role;
select pg_temp.assert(
  not exists (select 1 from pg_tables where schemaname = 'public' and not rowsecurity),
  'RLS مفعّل على جميع جداول public');

-- ===== حذف المستخدم يحذف بياناته =====
delete from auth.users where id = 'aaaaaaaa-0000-0000-0000-000000000001';
select pg_temp.assert((select count(*) from public.expenses where user_id = 'aaaaaaaa-0000-0000-0000-000000000001') = 0, 'حذف الحساب يحذف بياناته (cascade)');

\echo 'ALL RLS TESTS PASSED'
