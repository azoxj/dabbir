-- اختبار استيراد بيانات «دبّر 2.0» ومسح البيانات. يُشغَّل بعد rls.test.sql على نفس القاعدة.
\set ON_ERROR_STOP on
create function pg_temp.assert(cond boolean, msg text) returns void language plpgsql as $$
begin
  if not coalesce(cond, false) then raise exception 'ASSERTION FAILED: %', msg; end if;
  raise notice 'PASS: %', msg;
end $$;
grant execute on function pg_temp.assert(boolean, text) to authenticated;

-- جدول النسخة القديمة كما في ملف supabase.sql الأصلي
\i :legacy_schema

insert into auth.users (id, email) values
  ('cccccccc-0000-0000-0000-000000000003', 'old@example.com'),
  ('dddddddd-0000-0000-0000-000000000004', 'bad@example.com');
insert into public.user_data (user_id, payload) values
  ('cccccccc-0000-0000-0000-000000000003', '{"salary":6000,"rent":2000,"car":1500,"other":1800,"saving":500,
    "tasks":[{"id":"1","name":"تجديد الاستمارة","date":"2026-12-01","done":false},{"id":"2","name":"منجز","date":"2026-10-01","done":true}],
    "goals":[{"id":"g","name":"صندوق الطوارئ","target":10000,"current":2500}]}'),
  -- بيانات تالفة/خبيثة: يجب تجاهل القيم غير الصالحة بدون فشل
  ('dddddddd-0000-0000-0000-000000000004', '{"salary":"abc","rent":-5,"car":"1e99","tasks":[{"name":"","date":"2026-01-01"},{"name":"x","date":"2026-02-30"},"str",{"name":"y","date":"not-a-date"}],
    "goals":[{"name":"g","target":0},{"name":"","target":5},{"target":5}, 7]}');

select pg_temp.assert(public.import_legacy_v2_data() = 2, 'استيراد مستخدمَين من user_data');
select pg_temp.assert(public.import_legacy_v2_data() = 0, 'الاستيراد لا يتكرر (idempotent)');

select pg_temp.assert((select monthly_income = 6000 and savings_target = 500 from public.profiles where id = 'cccccccc-0000-0000-0000-000000000003'), 'salary/saving → profiles');
select pg_temp.assert((select count(*) = 2 from public.commitments where user_id = 'cccccccc-0000-0000-0000-000000000003' and recurrence = 'monthly' and title in ('الإيجار','قسط السيارة')), 'rent/car → التزامات شهرية');
select pg_temp.assert((select amount = 2000 from public.commitments where user_id = 'cccccccc-0000-0000-0000-000000000003' and title = 'الإيجار'), 'مبلغ الإيجار صحيح');
select pg_temp.assert((select monthly_limit = 1800 from public.budget_limits where user_id = 'cccccccc-0000-0000-0000-000000000003' and category = 'other'), 'other → سقف فئة أخرى');
select pg_temp.assert((select count(*) = 2 from public.commitments where user_id = 'cccccccc-0000-0000-0000-000000000003' and recurrence = 'none'), 'tasks → التزامات لمرة واحدة');
select pg_temp.assert((select done from public.commitments where user_id = 'cccccccc-0000-0000-0000-000000000003' and title = 'منجز'), 'حالة done محفوظة');
select pg_temp.assert((select current_amount = 2500 and target_amount = 10000 from public.savings_goals where user_id = 'cccccccc-0000-0000-0000-000000000003'), 'goals → savings_goals');

select pg_temp.assert((select monthly_income = 0 from public.profiles where id = 'dddddddd-0000-0000-0000-000000000004'), 'قيم تالفة: الدخل يبقى 0');
select pg_temp.assert((select count(*) = 0 from public.commitments where user_id = 'dddddddd-0000-0000-0000-000000000004'), 'قيم تالفة: لا التزامات غير صالحة');
select pg_temp.assert((select count(*) = 0 from public.savings_goals where user_id = 'dddddddd-0000-0000-0000-000000000004'), 'قيم تالفة: لا أهداف غير صالحة');

-- المستخدمون لا يرون سجل الاستيراد ولا يستطيعون تشغيل الاستيراد
set role authenticated;
select set_config('request.jwt.claim.sub', 'cccccccc-0000-0000-0000-000000000003', false);
do $$ begin
  begin perform count(*) from public.legacy_v2_imports; raise exception 'ASSERTION FAILED: legacy_v2_imports مقروء';
  exception when insufficient_privilege then raise notice 'PASS: سجل الاستيراد غير مرئي للمستخدم'; end;
  begin perform public.import_legacy_v2_data(); raise exception 'ASSERTION FAILED: المستخدم شغّل الاستيراد';
  exception when insufficient_privilege then raise notice 'PASS: المستخدم لا يستطيع تشغيل الاستيراد'; end;
end $$;

-- reset_my_data يمسح بيانات المستدعي فقط
select set_config('request.jwt.claim.sub', 'dddddddd-0000-0000-0000-000000000004', false);
insert into public.expenses (amount, category) values (10, 'food');
select set_config('request.jwt.claim.sub', 'cccccccc-0000-0000-0000-000000000003', false);
select public.reset_my_data();
select pg_temp.assert((select count(*) = 0 from public.commitments) and (select count(*) = 0 from public.savings_goals)
  and (select count(*) = 0 from public.budget_limits), 'reset_my_data يمسح بيانات المستخدم');
select pg_temp.assert((select monthly_income = 0 from public.profiles), 'reset_my_data يصفّر الدخل');
reset role;
select pg_temp.assert((select count(*) = 1 from public.expenses where user_id = 'dddddddd-0000-0000-0000-000000000004'), 'reset_my_data لا يمس بيانات مستخدم آخر');
set role anon;
do $$ begin
  begin perform public.reset_my_data(); raise exception 'ASSERTION FAILED: anon نفّذ reset';
  exception when insufficient_privilege then raise notice 'PASS: anon لا يستطيع reset_my_data'; end;
end $$;
reset role;
\echo 'ALL LEGACY/RESET TESTS PASSED'
