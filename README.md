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
npm run dev          # http://localhost:5173/ — يعمل بالوضع التجريبي إذا لم يُضبط Supabase
```

| الأمر | الوظيفة |
| --- | --- |
| `npm run typecheck` | فحص TypeScript (strict) |
| `npm run lint` | ESLint + قواعد React Hooks/Compiler |
| `npm test` | اختبارات الوحدة والتكامل (Vitest + Testing Library) |
| `npm run build` | بناء الإنتاج + حقن قائمة الكاش في `sw.js` + CSP |
| `npm run test:e2e` | اختبار دخان بمتصفح Chromium حقيقي (iPhone 13 + Pixel 7) على نسخة البناء عبر خادم يحاكي GitHub Pages تحت `/dabbir/` (يتطلب `npm run build` أولًا) |
| `npm run test:rls` | اختبارات عزل البيانات (RLS) على عنقود PostgreSQL مؤقت محلي |
| `npm run icons` | إعادة توليد أيقونات PWA من `scripts/icon.svg` |

### وضعا التشغيل: حسابات حقيقية + وضع تجريبي منفصل تمامًا
- **حسابات حقيقية (Supabase):** عند وجود `VITE_SUPABASE_URL` و `VITE_SUPABASE_ANON_KEY` (مفتاح عام فقط). البيانات في قاعدة المستخدم ومتزامنة بين أجهزته.
- **وضع تجريبي:** يعمل تلقائيًا إذا لم تُضبط Supabase، أو عبر زر «جرّب بدون حساب» في صفحة الدخول. معزول تمامًا:
  مفاتيح تخزين مختلفة (`dabbir.demo.*`)، مستودع بيانات محلي، **ولا يُنشأ عميل Supabase أصلًا** (اختبار E2E يتحقق من صفر طلبات للخادم).
  شريط أصفر دائم، وزر «الخروج إلى الحسابات الحقيقية». كلمات مرور الوضع التجريبي PBKDF2 وليست نصًا.

## النشر على GitHub Pages (مجاني)

الرابط المستهدف: **https://azoxj.github.io/dabbir/** — المسار الأساسي `/dabbir/` مضبوط افتراضيًا (`VITE_BASE`).

ما تم تجهيزه:
- `vite.config.ts`: `base: '/dabbir/'`؛ كل الملفات والخطوط والأيقونات تُخدم تحت `/dabbir/`.
- `BrowserRouter basename` ← الروابط والتنقل تعمل تحت المسار الفرعي.
- `404.html` نسخة من `index.html` تُولَّد أثناء البناء ← **تحديث الصفحة أو فتح رابط مباشر** (مثل `/dabbir/budget`) يعمل. (GitHub Pages يعيدها بحالة 404 لكن المتصفح يعرض التطبيق طبيعيًا.)
- `.nojekyll` ← لا يتجاهل Pages أي ملف.
- الـ manifest بمسارات نسبية، والـ Service Worker يُسجَّل بنطاق `/dabbir/` ويحسب مساراته منه.
- `.github/workflows/deploy.yml`: فحص الأنواع + lint + الاختبارات + اختبارات RLS + البناء + حارس يمنع وجود مفتاح `service_role`/`sb_secret_` في الحزمة، ثم النشر من فرع `main` فقط.

خطوات التفعيل (مرة واحدة):
1. إنشاء مستودع `azoxj/dabbir` (**عام** — GitHub Pages مجاني للمستودعات العامة في الخطة المجانية).
2. Push لفرع `main`.
3. Settings → Pages → Source: **GitHub Actions**.
4. (اختياري، عند ربط Supabase) Settings → Secrets and variables → Actions → **Variables** (وليس Secrets — القيم عامة بطبيعتها):
   `VITE_SUPABASE_URL` و `VITE_SUPABASE_ANON_KEY` (Publishable/anon فقط). بدونها يُنشر بالوضع التجريبي.
5. في Supabase → Authentication → URL Configuration: Site URL = `https://azoxj.github.io/dabbir/`، وRedirect URLs:
   `https://azoxj.github.io/dabbir/` و `https://azoxj.github.io/dabbir/reset-password`.

اختبار محلي مطابق لسلوك Pages: `npm run build && npm run test:e2e` (خادم `tests/e2e/pages-server.mjs` يخدم `dist` تحت `/dabbir/` ويعيد `404.html` بحالة 404 للمسارات غير الموجودة).

## الدومين dabbir.online

- **نسخة واحدة لعنوانين:** المسار يُحدد وقت التشغيل (`src/config/base.ts`): `/dabbir/` على `azoxj.github.io` والجذر على `dabbir.online`. لذلك يمكن ربط الدومين في أي وقت **بدون توقف**.
- `public/CNAME` = `dabbir.online` (توثيق؛ في نشر GitHub Actions يُضبط الدومين من إعدادات Pages).
- سجلات DNS المطلوبة: `ops/dns-dabbir.online.json` (4×A + 4×AAAA للجذر، و `www` CNAME → `azoxj.github.io`).
  `npm run dns:plan` / `npm run dns:apply` عبر Spaceship API (يحتاج مفتاح Spaceship بصلاحيات `dnsrecords:read` و `dnsrecords:write`). لا يمس سجلات البريد.
- `npm run domain:check` (يعمل في CI): DNS، الشهادة، http→https، www→الجذر، تحويل الرابط القديم.
- **بيانات الوضع التجريبي لا تنتقل تلقائيًا** بين `azoxj.github.io` و `dabbir.online` (عنوانان مختلفان في المتصفح). الحل: «حسابي ← النسخة الاحتياطية»: تنزيل من الرابط القديم ثم استعادة على الجديد. يظهر تنبيه بذلك على الرابط القديم.
- اختبار الانتقال الكامل في متصفح حقيقي: `npm run build && npm run test:e2e:migration`.

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

## Supabase محلي حقيقي (للتطوير والاختبار)

نفس صور Supabase الرسمية في Docker: Postgres 17 (`supabase/postgres`) + GoTrue (المصادقة) + PostgREST + Mailpit (يلتقط رسائل البريد) + بوابة بنفس مسارات Supabase.

```bash
npm run supabase:start     # يولّد أسرارًا محلية عشوائية (supabase/local/.env — غير مُلتزم) ويطبّق migrations
npm run dev:local          # التطبيق على Supabase المحلي: http://localhost:5173/dabbir/
                           # رسائل التأكيد والاستعادة: http://localhost:54324
npm run supabase:stop      # أو supabase:reset لمسح كل شيء
```

| الأمر | ما يختبره |
|---|---|
| `npm test` | الوحدات والواجهة (Vitest) |
| `npm run test:rls` | RLS والاستيراد والقيود على PostgreSQL مؤقت |
| `npm run test:integration` | على Supabase المحلي، بكود التطبيق نفسه: التسجيل/تأكيد البريد/إعادة الإرسال/الاستعادة/الجلسات/الخروج من كل الأجهزة، CRUD لكل الكيانات، المزامنة بين جهازين، RLS بحسابين + JWT مزوّر + بدون مفتاح |
| `npm run build:local && npm run test:e2e:supabase` | متصفح حقيقي (iPhone + Android) على Supabase المحلي: الرحلة الكاملة من التسجيل حتى المزامنة والاستعادة وعزل المستخدمين والوضع التجريبي |
| `npm run build && npm run test:e2e` | نسخة GitHub Pages (الوضع التجريبي) تحت `/dabbir/` |

GitHub Actions يشغّل كل ما سبق (بما فيه Supabase داخل الـ runner) على كل push، والنشر من `main` فقط بعد نجاح الكل.

## المشروع الحقيقي: dabbir-production

- العنوان: `https://iokdoysweppfcspfvlde.supabase.co` (المنطقة: ap-southeast-2) — `.env.production` يحتوي الرابط والمفتاح **العام** فقط.
- ✅ طُبّقت الـ migrations الثلاثة وRLS على كل الجداول (القاعدة كانت فارغة: 0 مستخدمين، لا جداول).
- ✅ `npm run test:rls:remote`: 22 فحص عزل على القاعدة الحقيقية داخل معاملة تُلغى بالكامل (لا يبقى أي أثر).
- ✅ `npm run test:live` (يعمل في CI): فحوص حية بالمفتاح العام فقط بدون كتابة بيانات.
- ⏳ إعدادات المصادقة (رابط الموقع، روابط العودة، 8 أحرف، القوالب العربية) لم تُطبّق: التوكن يفتقد صلاحية `project_admin_write`.
- ⏳ SMTP مخصص مطلوب قبل استقبال مستخدمين حقيقيين.

## ربط مشروع Supabase الحقيقي (الخطة المجانية)

`scripts/supabase-provision.mjs` عبر Management API الرسمية — آمن لإعادة التشغيل:
1. يجد مشروع `dabbir` أو ينشئه (خطة مجانية).
2. **يتوقف إذا وُجدت بيانات** في جداول دبّر ما لم تؤكد نسخة احتياطية (`--i-have-a-backup`).
3. يطبّق `supabase/migrations` ويتحقق أن RLS مفعّل على كل الجداول.
4. يضبط المصادقة: تأكيد البريد إلزامي، 8 أحرف، تدوير رموز التجديد، روابط العودة لـ `https://azoxj.github.io/dabbir/`، قوالب بريد عربية (`supabase/templates`).
5. يكتب `.env.production` بالقيم العامة فقط (يُفحص في CI بـ `npm run check:env`).

```bash
node scripts/supabase-provision.mjs plan    # عرض فقط
node scripts/supabase-provision.mjs apply
```

**مطلوب للإنتاج الفعلي — البريد (SMTP):** خادم البريد الافتراضي في Supabase المجاني لا يرسل إلا لأعضاء فريق المشروع وبحد صغير جدًا، فلن تصل رسائل التأكيد للمستخدمين العاديين. اربط مزود SMTP مجاني (مثل Resend أو Brevo) من Authentication → Emails → SMTP Settings. بيانات SMTP تُدخل في لوحة Supabase فقط.

**Google (اختياري):** OAuth Client من Google Cloud Console، وRedirect URI: `https://<ref>.supabase.co/auth/v1/callback`، ثم المعرّف والسر في لوحة Supabase فقط.

## المخاطر والملاحظات

- **مختبر على Supabase محلي بصورها الرسمية، وليس على مشروع مستضاف بعد.** الفروق المتوقعة في الاستضافة: مزود البريد (انظر SMTP)، وحدود المعدلات، وGoogle OAuth (لم يُختبر).
- **iOS PWA**: تطبيق الشاشة الرئيسية له تخزين منفصل عن Safari؛ رابط التأكيد/الاستعادة من البريد يفتح في Safari فتكون الجلسة هناك. اخترنا `flowType: 'implicit'` حتى تعمل الروابط في أي متصفح، والمقابل أن الرموز تمر في fragment الرابط (تُحذف فورًا). أعد التقييم مع PKCE إن لزم.
- **المزامنة** تتم بإعادة الجلب عند الرجوع للتطبيق/عودة الاتصال (وليست لحظية عبر Realtime). **بدون اتصال** لا توجد طابور كتابة؛ الإضافة دون اتصال تفشل برسالة. (مرحلة لاحقة.)
- **التعارض بين جهازين**: آخر كتابة تفوز للحقول العادية؛ الإيداع/السحب في الأهداف ذري.
- **استيراد بيانات 2.0**: مختبر محليًا على بيانات سليمة وتالفة، لكن ليس على بيانات المستخدمين الحقيقية. الالتزامات الشهرية المنقولة (الإيجار/القسط) تأخذ تاريخ أول الشهر القادم لأن النسخة القديمة بلا تواريخ — يحتاج المستخدم تعديله. بيانات `localStorage` القديمة (`dabbir_v1`/`dabbir_v2`) على أجهزة المستخدمين لا تُنقل.
- **تسجيل الالتزام كمصروف**: عند «تم» لالتزام بمبلغ يسأل التطبيق إن كان يسجّله كمصروف؛ إن سجّله المستخدم يدويًا أيضًا سيُحسب مرتين.
- **حجم الحزمة**: `@supabase/supabase-js` يُحمَّل حتى في الوضع التجريبي (~60KB gzip). يمكن تحميله ديناميكيًا لاحقًا.
- **الشهر المالي** = الشهر الميلادي. يوم الراتب يُستخدم للتذكير فقط؛ دورة «من راتب لراتب» مرحلة لاحقة.
- لا يوجد بعد: حذف الحساب نهائيًا ذاتيًا، تصدير البيانات، سياسة خصوصية/شروط، إشعارات Push.
- CSP مضاف كـ `<meta>` في نسخة البناء. GitHub Pages لا يسمح بترويسات HTTP مخصصة، فلا يمكن إضافة `frame-ancestors` (حماية من التضمين في iframe) — تحتاج استضافة تدعم الترويسات (مثل Cloudflare Pages المجانية) إذا كان ذلك مطلوبًا.
- GitHub Pages يعيد حالة **404** للروابط العميقة (التطبيق يعمل، لكن بعض أدوات الفحص/محركات البحث تعتبرها غير موجودة). لا يؤثر على المستخدمين.
- المسار الأساسي ثابت وقت البناء: لو تغيّر اسم المستودع أو أضفت نطاقًا خاصًا، اضبط المتغير `VITE_BASE`.
