-- اختبار عزل البيانات (RLS) على مشروع Supabase الحقيقي عبر Management API.
-- كل شيء داخل كتلة DO واحدة تنتهي دائمًا بـ RAISE ← يُلغى كل التغيير (rollback) ولا يبقى أي أثر.
-- النجاح = رسالة "ALL_PASSED <عدد>"، والفشل = "ASSERTION FAILED: ...".
do $test$
declare
  a uuid := gen_random_uuid();
  b uuid := gen_random_uuid();
  n int; passed int := 0; g uuid; e uuid; amt numeric;
  procedure_ok boolean;
begin
  -- مستخدمان مؤقتان (يُلغى كل شيء بالـ rollback في النهاية)
  insert into auth.users (id, email, raw_user_meta_data, aud, role) values
    (a, 'rls-a@example.test', '{"full_name":"اختبار أ"}', 'authenticated', 'authenticated'),
    (b, 'rls-b@example.test', '{}', 'authenticated', 'authenticated');
  select count(*) into n from public.profiles where id in (a, b);
  if n <> 2 then raise exception 'ASSERTION FAILED: profile trigger (%)', n; end if; passed := passed + 1;

  -- ===== A يضيف بياناته =====
  perform set_config('request.jwt.claims', json_build_object('sub', a, 'role', 'authenticated')::text, true);
  perform set_config('request.jwt.claim.sub', a::text, true);
  set local role authenticated;
  insert into public.expenses (amount, category, note) values (120, 'food', 'غداء') returning id into e;
  insert into public.commitments (title, due_date, amount, recurrence) values ('الإيجار', current_date + 5, 2500, 'monthly');
  insert into public.savings_goals (name, target_amount) values ('طوارئ', 10000) returning id into g;
  insert into public.budget_limits (category, monthly_limit) values ('food', 1500);
  update public.profiles set monthly_income = 9000, alert_days = 7 where id = a;
  select count(*) into n from public.profiles; if n <> 1 then raise exception 'ASSERTION FAILED: A sees % profiles', n; end if; passed := passed + 1;
  select (public.adjust_goal_amount(g, 250)).current_amount into amt; if amt <> 250 then raise exception 'ASSERTION FAILED: deposit'; end if; passed := passed + 1;
  reset role;

  -- ===== B لا يرى ولا يعدّل بيانات A =====
  perform set_config('request.jwt.claims', json_build_object('sub', b, 'role', 'authenticated')::text, true);
  perform set_config('request.jwt.claim.sub', b::text, true);
  set local role authenticated;
  select count(*) into n from public.expenses;      if n <> 0 then raise exception 'ASSERTION FAILED: B sees expenses'; end if; passed := passed + 1;
  select count(*) into n from public.commitments;   if n <> 0 then raise exception 'ASSERTION FAILED: B sees commitments'; end if; passed := passed + 1;
  select count(*) into n from public.savings_goals; if n <> 0 then raise exception 'ASSERTION FAILED: B sees goals'; end if; passed := passed + 1;
  select count(*) into n from public.budget_limits; if n <> 0 then raise exception 'ASSERTION FAILED: B sees limits'; end if; passed := passed + 1;
  select count(*) into n from public.profiles where id = a; if n <> 0 then raise exception 'ASSERTION FAILED: B sees A profile'; end if; passed := passed + 1;
  with u as (update public.expenses set amount = 1 where id = e returning 1) select count(*) into n from u;
  if n <> 0 then raise exception 'ASSERTION FAILED: B updated A expense'; end if; passed := passed + 1;
  with d as (delete from public.savings_goals where id = g returning 1) select count(*) into n from d;
  if n <> 0 then raise exception 'ASSERTION FAILED: B deleted A goal'; end if; passed := passed + 1;
  with u as (update public.profiles set monthly_income = 1 where id = a returning 1) select count(*) into n from u;
  if n <> 0 then raise exception 'ASSERTION FAILED: B updated A profile'; end if; passed := passed + 1;
  begin
    insert into public.expenses (user_id, amount, category) values (a, 5, 'other');
    raise exception 'ASSERTION FAILED: B inserted as A';
  exception when insufficient_privilege then passed := passed + 1; end;
  begin
    perform public.adjust_goal_amount(g, 10);
    raise exception 'ASSERTION FAILED: B deposited into A goal';
  exception when no_data_found then passed := passed + 1; end;
  insert into public.expenses (amount, category) values (3, 'food') returning id into e;
  begin
    update public.expenses set user_id = a where id = e;
    raise exception 'ASSERTION FAILED: B moved row to A';
  exception when insufficient_privilege then passed := passed + 1; end;
  begin
    delete from public.profiles;
    raise exception 'ASSERTION FAILED: profile delete allowed';
  exception when insufficient_privilege then passed := passed + 1; end;
  begin
    insert into public.expenses (amount, category) values (-5, 'food');
    raise exception 'ASSERTION FAILED: negative amount accepted';
  exception when check_violation then passed := passed + 1; end;
  perform public.reset_my_data();
  reset role;
  select count(*) into n from public.expenses where user_id = a; if n <> 1 then raise exception 'ASSERTION FAILED: B reset touched A'; end if; passed := passed + 1;

  -- ===== anon بلا أي صلاحية =====
  perform set_config('request.jwt.claims', '{"role":"anon"}', true);
  perform set_config('request.jwt.claim.sub', '', true);
  set local role anon;
  begin perform count(*) from public.expenses; raise exception 'ASSERTION FAILED: anon read expenses';
  exception when insufficient_privilege then passed := passed + 1; end;
  begin perform count(*) from public.profiles; raise exception 'ASSERTION FAILED: anon read profiles';
  exception when insufficient_privilege then passed := passed + 1; end;
  begin perform public.reset_my_data(); raise exception 'ASSERTION FAILED: anon reset';
  exception when insufficient_privilege then passed := passed + 1; end;
  reset role;

  -- ===== RLS على كل الجداول، وحذف الحساب يحذف بياناته =====
  select count(*) into n from pg_tables where schemaname = 'public' and not rowsecurity;
  if n <> 0 then raise exception 'ASSERTION FAILED: % tables without RLS', n; end if; passed := passed + 1;
  delete from auth.users where id = a;
  select count(*) into n from public.expenses where user_id = a; if n <> 0 then raise exception 'ASSERTION FAILED: cascade'; end if; passed := passed + 1;

  -- كل الاختبارات نجحت: نلغي المعاملة كاملة حتى لا يبقى أي أثر في قاعدة الإنتاج.
  raise exception 'ALL_PASSED %', passed;
end
$test$;
