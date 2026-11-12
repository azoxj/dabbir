-- إنشاء حسابَي الاختبار الحي من مخرجات scripts/live-users.mjs (id, email, bcrypt hash فقط — بدون كلمات مرور).
-- مؤكَّدان مسبقًا لأن البريد لا يصل للمستخدمين العاديين قبل ربط SMTP.
-- الاستخدام: استبدل __USERS_JSON__ بمصفوفة JSON من سطر LIVE_USERS.
-- أعمدة الرموز يجب أن تكون نصًا فارغًا وليس NULL (GoTrue يرفض NULL عند البحث عن المستخدم).
insert into auth.users (instance_id, id, aud, role, email, encrypted_password, email_confirmed_at,
                        raw_app_meta_data, raw_user_meta_data, created_at, updated_at,
                        confirmation_token, recovery_token, email_change_token_new, email_change,
                        email_change_token_current, phone_change, phone_change_token, reauthentication_token)
select '00000000-0000-0000-0000-000000000000', (u->>'id')::uuid, 'authenticated', 'authenticated', u->>'email', u->>'hash', now(),
       '{"provider":"email","providers":["email"]}', '{"full_name":"اختبار حي"}', now(), now(),
       '', '', '', '', '', '', '', ''
from jsonb_array_elements('__USERS_JSON__'::jsonb) u
where u->>'email' like 'live-%@example.test';

insert into auth.identities (provider_id, user_id, identity_data, provider, last_sign_in_at, created_at, updated_at)
select (u->>'id'), (u->>'id')::uuid, jsonb_build_object('sub', u->>'id', 'email', u->>'email', 'email_verified', true),
       'email', now(), now(), now()
from jsonb_array_elements('__USERS_JSON__'::jsonb) u
where u->>'email' like 'live-%@example.test';
