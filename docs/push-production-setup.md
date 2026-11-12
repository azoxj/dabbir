# تفعيل Web Push في دبّر — إعداد الإنتاج (بدون خدمات مدفوعة)
تم نشر Edge Function باسم `dabbir-push` وإنشاء جدول `push_subscriptions` المحمي بـ RLS وجدول `push_delivery_log`.
لا تُعتبر الإشعارات مفعّلة حتى تكتمل الأسرار والجدولة واختبار الجهاز الحقيقي.

## 1. إنشاء مفاتيح VAPID (مرة واحدة)
على جهاز موثوق فيه Node.js:
```sh
npx --yes web-push@3.6.7 generate-vapid-keys
```
لا ترسل المفتاح الخاص في المحادثة ولا تضعه في GitHub. من Supabase Dashboard → Project Settings → Edge Functions → Secrets، أضف:
- `VAPID_PUBLIC_KEY` = Public Key
- `VAPID_PRIVATE_KEY` = Private Key
- `VAPID_SUBJECT` = `mailto:YOUR_VERIFIED_EMAIL` (بريد تملكه)

إعدادات `SUPABASE_URL` و `SUPABASE_SERVICE_ROLE_KEY` توفرها بيئة Edge Functions تلقائيًا؛ لا تُرسلها للمستخدم ولا تُضمّنها في المتصفح.

## 2. تفعيل الجدولة (بعد التأكد من عمل Edge Function)
من SQL Editor في Supabase: فعّل امتداد `pg_net` إذا لم يكن مفعّلًا. خزّن service_role key في Vault باسم `dabbir_push_cron_key` باستخدام واجهة Supabase الآمنة، وليس في نص ملف GitHub. لا تُنسخ القيمة إلى سجل محادثة.
ثم شغّل SQL التالي. المهمة ترسل يوميًا الساعة 9 صباحًا بتوقيت الرياض (06:00 UTC):
```sql
select cron.schedule(
  'dabbir-push-daily',
  '0 6 * * *',
  $job$
  select net.http_post(
    url := 'https://iokdoysweppfcspfvlde.supabase.co/functions/v1/dabbir-push',
    headers := jsonb_build_object(
      'Content-Type', 'application/json',
      'Authorization', 'Bearer ' || (select decrypted_secret from vault.decrypted_secrets where name = 'dabbir_push_cron_key')
    ),
    body := '{}'::jsonb
  );
  $job$
);
```
تحقق من تشغيل المهمة في `cron.job_run_details` وسجلات Edge Functions. لا تنشئ المهمة قبل تخزين السر، ولا تكرر الجدولة بدون فحص المهمة الموجودة.

## 3. اختبار الأجهزة
انشر الواجهة بعد نجاح CI، سجّل الدخول لحساب حقيقي، ثم من الإعدادات اختر «تفعيل التذكيرات على هذا الجهاز».
على iPhone: Safari → مشاركة → إضافة إلى الشاشة الرئيسية → افتح دبّر من الأيقونة → وافق على الإذن.
أنشئ التزامًا بتاريخ اليوم أو الأيام القادمة ضمن فترة التنبيه؛ اختبر استدعاء المرسل من بيئة آمنة، ثم تحقق من وصول الإشعار، وسجل `push_delivery_log`، وعدم تكرار الإرسال في اليوم نفسه. على Android اختبر بنفس الطريقة.
لا تُعتبر الخدمة مكتملة قبل اختبار وصول فعلي. لا تظهر تفاصيل مالية في الإشعار.
