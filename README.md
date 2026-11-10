# دبّر (Dabbir) — المرحلة الأولى

تطبيق ويب PWA عربي (RTL) للأفراد لإدارة الميزانية والمصاريف والالتزامات وأهداف الادخار.
**بدون أي ذكاء اصطناعي**: كل التنبيهات والأولويات قواعد ثابتة مكتوبة في `src/lib/` ومغطاة باختبارات.

> الحالة: مشروع مستقل، تطوير محلي فقط. **لم يُنشر شيء** ولم يُنفّذ أي تغيير على قاعدة بيانات حقيقية.
> نقطة البداية: «دبّر 2.0» (`dabbir-auth-v2.zip`) — صفحة HTML واحدة + جدول `user_data` (JSON). مخطط النسخة القديمة محفوظ للمرجع في `supabase/legacy/v2_user_data.sql`.

## ما الذي انتقل من النسخة 2.0 وكيف

| النسخة 2.0 | النسخة الجديدة |
| --- | --- |
| الراتب / هدف الادخار | الملف الشخصي (`monthly_income`, `savings_target`) + يوم الراتب |
| الإيجار / قسط السيارة (حقول ثابتة) | التزامات شهرية متكررة بمبلغ؛ تُخصم من «المتبقي» حتى تُنجز (نفس معادلة `salary − rent − car − other`) |
| مصاريف أخرى | مصاريف فعلية بالفئات + سقف شهري لكل فئة |
| نسبة المصاريف إلى الدخل + تنبيه ≥85% | `committedRatio` + نفس التنبيه في «وش أسوي اليوم؟» |
| نصائح: عجز / الادخار أعلى من المتبقي | نفس القواعد + قواعد إضافية (وتيرة الصرف، تجاوز السقوف، يوم الراتب، الأهداف) |
| المهام بتاريخ + إنجاز | الالتزامات والمواعيد (نوع، وقت، مبلغ، تكرار) |
| الأولويات (متأخر/اليوم/قريب) | محرك `todayPlan.ts` بنفس الترتيب |
| الأهداف + إيداع + حذف | أهداف بموعد، إيداع/سحب ذرّي، المبلغ الشهري المطلوب |
| «مسح جميع بياناتي» | الإعدادات → `reset_my_data()` ذرّية |
| بيانات `user_data` الحالية | `import_legacy_v2_data()` تنقلها مرة واحدة تلقائيًا ضمن الـ migration الثاني |

## التشغيل

```bash
cd dabbir
npm install   # Node 20+
npm run dev          # http://localhost:5173 — يعمل بالوضع التجريبي إذا لم يُضبط Supabase
```

| الأمر | الوظيفة |
| --- | --- |
| `npm run typecheck` | فحص TypeScript (strict) |
| `npm run lint` | ESLint + قواعد React Hooks/Compiler |
| `npm test` | اختبارات الوحدة والتكامل (Vitest + Testing Library) |
| `npm run build` | بناء الإنتاج + حقن قائمة الكاش في `sw.js` + CSP |
| `npm run test:e2e` | اختبار دخان بمتصفح Chromium حقيقي بحجم iPhone على نسخة البناء (يتطلب `npm run build` أولًا) |
| `npm run test:rls` | اختبارات عزل البيانات (RLS) على عنقود PostgreSQL مؤقت محلي |
| `npm run icons` | إعادة توليد أيقونات PWA من `scripts/icon.svg` |

### الوضع التجريبي (Demo)
عند غياب `VITE_SUPABASE_URL`/`VITE_SUPABASE_ANON_KEY` (أو عند رفض المفتاح لأنه سري)، يعمل التطبيق بمصادقة وبيانات محلية في `localStorage`:
- تسجيل/دخول/استعادة كلمة مرور محلية (كلمات المرور مخزنة كـ PBKDF2-SHA256 مع salt، وليست نصًا).
- زر «جرّب التطبيق ببيانات تجريبية» يفتح حساب ضيف ببيانات واقعية.
- Google معطّل مع توضيح. شريط أصفر دائم ينبّه أن البيانات في هذا المتصفح فقط.
- **ليس آمنًا كبديل للإنتاج** — للتجربة والتطوير فقط.

## هيكل المشروع

```
dabbir/
├─ index.html                  # RTL + وسوم iOS/Android PWA
├─ vite.config.ts              # إضافات: CSP للإنتاج + حقن precache في sw.js
├─ public/
│  ├─ manifest.webmanifest     # ar/rtl، standalone، أيقونات any + maskable، اختصارات
│  ├─ sw.js                    # Service Worker (لا يخزّن طلبات Supabase)
│  └─ icons/                   # 192، 512، maskable-512، apple-touch-icon 180، favicon.svg
├─ supabase/
│  ├─ migrations/
│  │  ├─ 20261110000000_init.sql                    # الجداول + القيود + RLS + triggers + adjust_goal_amount
│  │  └─ 20261110000100_reset_and_legacy_import.sql # reset_my_data + استيراد بيانات 2.0
│  ├─ legacy/v2_user_data.sql  # مخطط النسخة القديمة (مرجع/اختبار فقط)
│  └─ tests/                   # auth-stub.sql، rls.test.sql، legacy.test.sql، run-rls-tests.sh
├─ scripts/                    # icon.svg + generate-icons.mjs
├─ tests/e2e/smoke.mjs         # Playwright smoke
└─ src/
   ├─ main.tsx · App.tsx       # نقطة الدخول + المسارات (lazy loading)
   ├─ config/env.ts            # قراءة الإعدادات + رفض مفاتيح service_role/secret
   ├─ types/domain.ts          # أنواع النطاق (Expense, Commitment, SavingsGoal…)
   ├─ lib/                     # منطق نقي قابل للاختبار
   │  ├─ money.ts              # تنسيق الريال + قراءة الأرقام العربية (٤٥٫٥)
   │  ├─ dates.ts              # تواريخ محلية، هجري/ميلادي، «بكرة/بعد يومين»
   │  ├─ budget.ts             # ملخص الشهر، حدود الفئات، وتيرة الصرف، المصروف اليومي
   │  ├─ commitments.ts        # حالة الاستحقاق، التكرار الشهري/السنوي
   │  ├─ goals.ts              # التقدم والمبلغ الشهري المطلوب
   │  └─ todayPlan.ts          # محرك «وش أسوي اليوم؟»
   ├─ services/
   │  ├─ supabaseClient.ts     # عميل بالمفتاح العام فقط
   │  ├─ errors.ts             # رسائل أخطاء عربية
   │  ├─ pwa.ts                # تسجيل SW + إشعار التحديث
   │  ├─ auth/                 # AuthService: supabaseAuth | demoAuth
   │  └─ data/                 # DataRepository: supabaseRepository | demoRepository (+ seed)
   ├─ context/                 # AuthContext, RepositoryContext, ToastContext
   ├─ hooks/                   # useAuth, useAsync, useDashboard, useFinance, useCommitments, useGoals, useToday…
   ├─ components/
   │  ├─ ui/                   # Button, Field, Card, ProgressBar, Alert, Spinner
   │  ├─ layout/               # AppLayout, BottomNav, AuthLayout, Banners, UpdateBanner
   │  ├─ routing/Guards.tsx    # ProtectedRoute / PublicOnlyRoute
   │  ├─ auth/ · icons/
   └─ pages/                   # Dashboard, Budget, Commitments, Goals, Settings, NotFound + auth/*
```

**المبدأ:** الصفحات لا تعرف Supabase. تتعامل مع `hooks` ← `DataRepository`/`AuthService` (واجهتان)، والتنفيذ يُختار حسب الإعدادات. هذا ما يسمح بالوضع التجريبي واختبار كل الواجهة بدون شبكة.

## قاعدة البيانات

| الجدول | المحتوى | ملاحظات |
| --- | --- | --- |
| `profiles` | الاسم، الدخل الشهري، هدف الادخار، يوم الراتب | يُنشأ تلقائيًا بـ trigger عند التسجيل؛ المستخدم يقرأ/يعدّل أعمدة محددة فقط ولا يحذفه |
| `expenses` | المبلغ، الفئة، الملاحظة، التاريخ | فهرس `(user_id, spent_on)` |
| `budget_limits` | سقف شهري لكل فئة | `unique(user_id, category)` |
| `commitments` | العنوان، النوع، التاريخ/الوقت، المبلغ، التكرار، منجز | فهرس `(user_id, done, due_date)` |
| `savings_goals` | الاسم، المستهدف، الحالي، الموعد | إيداع/سحب ذرّي عبر `adjust_goal_amount()` |

الأمان:
- RLS مفعّل على **كل** الجداول؛ 4 سياسات لكل جدول بشرط `(select auth.uid()) = user_id`.
- `user_id default auth.uid()` — الواجهة لا ترسل user_id عند الإدخال.
- trigger يمنع تغيير `user_id` بعد الإنشاء، و`anon` بلا أي صلاحيات.
- قيود CHECK على المبالغ (موجبة، حد أعلى)، الفئات، الأطوال.
- `on delete cascade` من `auth.users` — حذف الحساب يحذف بياناته.
- الدوال `security definer` محصورة بـ `set search_path = ''` ومسحوب منها EXECUTE العام.

## تفعيل Supabase (متطلبات متبقية — تُنفّذ يدويًا على مشروع تطوير أولًا)

1. أنشئ مشروع Supabase **للتطوير/الاختبار** (ليس الإنتاج).
2. نفّذ ملفي `supabase/migrations/` بالترتيب (SQL Editor أو `supabase db push`).
   - السكربتات قابلة لإعادة التنفيذ (idempotent) ومختبرة محليًا.
   - إذا نُفذت على مشروع «دبّر 2.0» القائم، يُنقل محتوى `user_data` تلقائيًا مرة واحدة لكل مستخدم (ولا يُحذف الجدول القديم). **جرّب ذلك على نسخة من القاعدة أولًا.**
3. انسخ `.env.example` إلى `.env.local` وضع:
   - `VITE_SUPABASE_URL` = Project URL
   - `VITE_SUPABASE_ANON_KEY` = **Publishable key** (`sb_publishable_…`) أو anon key. التطبيق يرفض تلقائيًا `service_role`/`sb_secret_…`.
4. Authentication → Providers → **Email**: فعّل «Confirm email». اضبط الحد الأدنى لكلمة المرور 8 ومتطلبات (حروف+أرقام) لتطابق الواجهة.
5. Authentication → Providers → **Google**: أنشئ OAuth Client في Google Cloud Console، وأضف Redirect URI الخاص بـ Supabase (`https://<project>.supabase.co/auth/v1/callback`). Client ID/Secret تُدخل في لوحة Supabase فقط — **ليس** في ملفات الواجهة.
6. Authentication → URL Configuration: Site URL = رابط التطبيق، وأضف إلى Redirect URLs:
   `http://localhost:5173/**` و `<رابط النشر>/` و `<رابط النشر>/reset-password`.
7. (موصى به) SMTP مخصص لإرسال البريد؛ مزود Supabase الافتراضي محدود جدًا ولا يصلح للإنتاج.
8. شغّل `npm run dev` وجرّب يدويًا: تسجيل → تأكيد بريد → دخول → Google → استعادة كلمة المرور → عزل حسابين.
9. عند النشر: الاستضافة يجب أن تعيد `index.html` لكل المسارات (SPA fallback) وتخدم `sw.js` بدون كاش طويل (`Cache-Control: no-cache`).

## المخاطر والملاحظات

- **لم يُختبر مقابل Supabase حقيقي.** RLS اختُبر على PostgreSQL 16 محلي مع محاكاة `auth.uid()`؛ سلوك Auth الفعلي (البريد، Google، روابط الاستعادة) يحتاج اختبارًا يدويًا بعد الربط. `supabaseRepository` مغطى باختبارات التحويل فقط.
- **iOS PWA**: تطبيق الشاشة الرئيسية له تخزين منفصل عن Safari؛ رابط التأكيد/الاستعادة من البريد يفتح في Safari فتكون الجلسة هناك. اخترنا `flowType: 'implicit'` حتى تعمل الروابط في أي متصفح، والمقابل أن الرموز تمر في fragment الرابط (تُحذف فورًا). أعد التقييم مع PKCE إن لزم.
- **بدون اتصال**: الواجهة تفتح وتعرض حالة عدم الاتصال، لكن **لا توجد طابور مزامنة**؛ الإضافة دون اتصال تفشل برسالة. (مرحلة لاحقة.)
- **التعارض بين جهازين**: آخر كتابة تفوز للحقول العادية؛ الإيداع/السحب في الأهداف ذري.
- **استيراد بيانات 2.0**: مختبر محليًا على بيانات سليمة وتالفة، لكن ليس على بيانات المستخدمين الحقيقية. الالتزامات الشهرية المنقولة (الإيجار/القسط) تأخذ تاريخ أول الشهر القادم لأن النسخة القديمة بلا تواريخ — يحتاج المستخدم تعديله. بيانات `localStorage` القديمة (`dabbir_v1`/`dabbir_v2`) على أجهزة المستخدمين لا تُنقل.
- **تسجيل الالتزام كمصروف**: عند «تم» لالتزام بمبلغ يسأل التطبيق إن كان يسجّله كمصروف؛ إن سجّله المستخدم يدويًا أيضًا سيُحسب مرتين.
- **حجم الحزمة**: `@supabase/supabase-js` يُحمَّل حتى في الوضع التجريبي (~60KB gzip). يمكن تحميله ديناميكيًا لاحقًا.
- **الشهر المالي** = الشهر الميلادي. يوم الراتب يُستخدم للتذكير فقط؛ دورة «من راتب لراتب» مرحلة لاحقة.
- لا يوجد بعد: حذف الحساب ذاتيًا، تصدير البيانات، سياسة خصوصية/شروط، إشعارات Push، تعديل المصروف بعد إدخاله.
- CSP مضاف كـ `<meta>` في نسخة البناء؛ عند النشر يُفضّل إرساله كـ HTTP header مع `frame-ancestors 'none'`.
