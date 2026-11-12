import { useState, type FormEvent } from 'react'
import { Link } from 'react-router-dom'
import { PageHeader } from '@/components/layout/AppLayout'
import { BackupCard } from '@/components/settings/BackupCard'
import { Alert, Button, buttonClasses, Card, CardTitle, PageLoader, SelectField, TextField } from '@/components/ui'
import { ALERT_DAY_OPTIONS, type Profile } from '@/types/domain'
import { exitDemoMode, getRuntimeMode, realAccountsAvailable } from '@/config/mode'
import { appConfig } from '@/config/env'
import { useAuth } from '@/hooks/useAuth'
import { useProfile } from '@/hooks/useFinance'
import { useRepository } from '@/hooks/useRepository'
import { useToast } from '@/hooks/useToast'
import { toAppError } from '@/services/errors'
import { canRequestNotifications, requestReminderPermission } from '@/lib/pushPermission'

/** الملف الشخصي والإعدادات. */
export default function SettingsPage() {
  const { user, service } = useAuth()
  const profile = useProfile()
  const repo = useRepository()
  const toast = useToast()
  const [busy, setBusy] = useState(false)

  const isDemo = getRuntimeMode() === 'demo'
  const signOut = async (everywhere = false) => {
    if (everywhere && !window.confirm('تسجيل الخروج من كل الأجهزة؟ ستحتاج تسجيل الدخول من جديد في كل جهاز.')) return
    setBusy(true)
    try {
      await service.signOut({ everywhere })
      // الخروج من الوضع التجريبي يعيدك لصفحة الحسابات الحقيقية.
      if (isDemo && realAccountsAvailable) exitDemoMode()
    } catch (e) {
      toast.show(toAppError(e).message, 'error')
      setBusy(false)
    }
  }

  const clearAll = async () => {
    // من النسخة القديمة: «مسح جميع بياناتي» مع تأكيد صريح.
    if (!window.confirm('متأكد تبي تمسح جميع بياناتك؟ (المصاريف، الالتزامات، الأهداف، وحدود الميزانية). ما تقدر تتراجع.')) return
    try {
      await repo.clearAllData()
      await profile.reload()
      toast.show('تم مسح بياناتك')
    } catch (e) {
      toast.show((e as Error).message, 'error')
    }
  }

  return (
    <div className="space-y-4">
      <PageHeader title="حسابي" subtitle="ملفك الشخصي، إنجازاتك، وإعدادات حسابك في مكان واحد" />

      <section className="overflow-hidden rounded-3xl bg-gradient-to-bl from-emerald-900 via-teal-800 to-teal-700 px-5 py-6 text-white shadow-lg" aria-label="بطاقة الحساب">
        <div className="flex items-center gap-4">
          <div className="flex size-16 shrink-0 items-center justify-center rounded-2xl border border-white/25 bg-white/15 text-3xl font-bold" aria-hidden="true">{(profile.data?.displayName || user?.displayName || 'د').trim().charAt(0)}</div>
          <div className="min-w-0 flex-1">
            <p className="text-xs text-emerald-100">مرحبًا بك في دبّر</p>
            <h2 className="truncate text-xl font-bold">{profile.data?.displayName || user?.displayName || 'مستخدم دبّر'}</h2>
            <p className="truncate text-xs text-emerald-100" dir="ltr">{user?.email || '—'}</p>
          </div>
        </div>
        <div className="mt-5 flex items-center justify-between rounded-2xl bg-white/10 px-4 py-3 text-sm">
          <span>طريقة الدخول</span><span className="font-bold">{user?.provider === 'google' ? 'Google ✓' : user?.provider === 'demo' ? 'تجريبي' : 'البريد الإلكتروني'}</span>
        </div>
      </section>

      <section className="grid grid-cols-2 gap-3" aria-label="اختصارات الحساب">
        <Link to="/budget" className="rounded-2xl border border-ink-100 bg-white p-4 text-center text-sm font-bold text-brand-600 shadow-sm">💰 الميزانية والادخار</Link>
        <Link to="/goals" className="rounded-2xl border border-ink-100 bg-white p-4 text-center text-sm font-bold text-brand-600 shadow-sm">🎯 أهدافي المالية</Link>
      </section>

      <Card aria-labelledby="profile-title">
        <CardTitle><span id="profile-title">تعديل الملف الشخصي</span></CardTitle>
        {profile.data ? (
          <ProfileForm key={profile.data.displayName ?? ''} initialName={profile.data.displayName ?? user?.displayName ?? ''}
            onSave={async (displayName) => { await profile.update({ displayName }); toast.show('تم حفظ الاسم ✓') }} />
        ) : profile.error ? <Alert tone="error">{profile.error.message}</Alert> : <PageLoader />}
        <dl className="mt-4 hidden space-y-2 border-t border-ink-100 pt-3 text-sm">
          <div className="flex justify-between gap-2"><dt className="text-ink-500">البريد</dt><dd className="truncate font-semibold" dir="ltr">{user?.email || '—'}</dd></div>
          <div className="flex justify-between gap-2"><dt className="text-ink-500">طريقة الدخول</dt><dd className="font-semibold">{user?.provider === 'google' ? 'Google' : user?.provider === 'demo' ? 'حساب تجريبي محلي' : 'البريد وكلمة المرور'}</dd></div>
        </dl>
        <div className="mt-4 space-y-2">

          {user?.provider !== 'google' && <Link to="/reset-password" className={buttonClasses('secondary', { block: true })}>تغيير كلمة المرور</Link>}

        </div>
      </Card>

      <section className="rounded-3xl border border-ink-100 bg-white p-5 shadow-sm" aria-label="الأوسمة والتحديات">
        <div className="flex items-center gap-3"><span className="text-3xl" aria-hidden="true">🏆</span><div><h2 className="text-lg font-bold text-ink-900">تحديات دبّر الشهرية</h2><p className="text-sm text-ink-500">تنافس على عادات مالية أفضل، واكسب وسام الفائز</p></div></div>
        <p className="mt-3 text-sm text-ink-600">اشترك باسم مستعار في تحديات الشهر، وتابع المشاركين والأوسمة بدون كشف بياناتك المالية.</p>
        <Link to="/challenges" className="mt-4 block rounded-xl bg-brand-600 px-4 py-3 text-center text-sm font-bold text-white">استكشف التحديات الشهرية</Link>
      </section>

      <Card>
        <CardTitle>إشعارات الجوال (تجريبي)</CardTitle>
        <p className="mb-3 text-sm text-ink-600">يمكنك السماح بإشعارات دبّر. تفعيل الإذن لا يعني أن التذكيرات ستصل تلقائيًا بعد إغلاق التطبيق؛ خدمة إرسال الإشعارات المجدولة لم تكتمل بعد.</p>
        <Button variant="secondary" block disabled={!canRequestNotifications()} onClick={() => {
          void requestReminderPermission().then((permission) => {
            toast.show(permission === 'granted' ? 'تم السماح بالإشعارات. الإرسال التلقائي غير مفعل بعد.' : 'لم يتم السماح بالإشعارات')
          }).catch((e: unknown) => toast.show(toAppError(e).message, 'error'))
        }}>طلب إذن إشعارات الجوال</Button>
        {!canRequestNotifications() && <p className="mt-2 text-xs text-ink-500">على الآيفون: افتح الموقع من Safari ثم أضفه للشاشة الرئيسية وافتحه من الأيقونة.</p>}
      </Card>

      {profile.data && <PreferencesCard profile={profile.data} onSave={async (patch) => { await profile.update(patch); toast.show('تم حفظ التفضيلات ✓') }} />}

      <BackupCard onImported={() => void profile.reload()} />

      <Card>
        <CardTitle>البيانات والخصوصية</CardTitle>
        {appConfig.mode === 'supabase' ? (
          <Alert tone="success">بياناتك محفوظة في حسابك على Supabase ومحمية بسياسات تمنع أي مستخدم آخر من قراءتها.</Alert>
        ) : (
          <Alert tone="warning">
            <b>وضع تجريبي.</b> {appConfig.demoReason} البيانات محفوظة في هذا المتصفح فقط ولا تُزامَن، وتضيع إذا مسحت بيانات المتصفح.
          </Alert>
        )}
        <ul className="mt-3 list-disc space-y-1 ps-5 text-sm text-ink-600">
          <li>دبّر لا يستخدم الذكاء الاصطناعي ولا يرسل بياناتك لأي طرف لتحليلها.</li>
          <li>كل الحسابات والتنبيهات تتم بقواعد ثابتة داخل التطبيق.</li>
          <li>لا نطلب أرقام بطاقات أو بيانات دخول بنكية. لا تكتب كلمات مرور أو معلومات حساسة في الملاحظات.</li>
        </ul>
        <Button variant="danger" block className="mt-4" onClick={() => void clearAll()}>مسح جميع بياناتي</Button>
      </Card>
      <section className="space-y-3 rounded-3xl border border-ink-100 bg-white p-5 shadow-sm" aria-label="أمان الحساب">
        <h2 className="text-lg font-bold text-ink-900">أمان الحساب</h2>
        <Button variant="danger" block loading={busy} onClick={() => void signOut()}>تسجيل الخروج</Button>
        {!isDemo && <Button variant="ghost" block disabled={busy} onClick={() => void signOut(true)}>تسجيل الخروج من كل الأجهزة</Button>}
      </section>
      <p className="pb-4 text-center text-xs text-ink-500">دبّر · حسابك تحت تحكمك</p>
    </div>
  )
}

function ProfileForm({ initialName, onSave }: { initialName: string; onSave: (name: string | null) => Promise<void> }) {
  const [name, setName] = useState(initialName)
  const [error, setError] = useState<string | null>(null)
  const [saving, setSaving] = useState(false)
  const submit = async (e: FormEvent) => {
    e.preventDefault()
    if (name.trim().length > 80) return setError('الاسم طويل جدًا (80 حرفًا كحد أقصى).')
    setError(null)
    setSaving(true)
    try {
      await onSave(name.trim() || null)
    } catch (err) {
      setError((err as Error).message)
    } finally {
      setSaving(false)
    }
  }
  return (
    <form onSubmit={submit} noValidate className="flex items-end gap-2">
      <TextField className="flex-1" label="الاسم" value={name} onChange={(e) => setName(e.target.value)} maxLength={80} autoComplete="name" error={error} />
      <Button type="submit" size="sm" className="mb-1 min-h-12" loading={saving}>حفظ</Button>
    </form>
  )
}

function PreferencesCard({ profile, onSave }: { profile: Profile; onSave: (p: Partial<Profile>) => Promise<void> }) {
  const [busy, setBusy] = useState(false)
  const [error, setError] = useState<string | null>(null)
  const save = async (patch: Partial<Profile>) => {
    setBusy(true)
    setError(null)
    try {
      await onSave(patch)
    } catch (e) {
      setError((e as Error).message)
    } finally {
      setBusy(false)
    }
  }
  return (
    <Card aria-labelledby="prefs-title">
      <CardTitle><span id="prefs-title">التفضيلات</span></CardTitle>
      <div className="space-y-4">
        <label className="flex items-center justify-between gap-3 text-sm font-semibold">
          <span>عرض التاريخ الهجري في الرئيسية</span>
          <input type="checkbox" className="size-6 accent-brand-600" checked={profile.showHijri} disabled={busy}
            onChange={(e) => void save({ showHijri: e.target.checked })} />
        </label>
        <SelectField label="نبّهني على الالتزامات قبل موعدها بـ" value={String(profile.alertDays)} disabled={busy}
          onChange={(e) => void save({ alertDays: Number(e.target.value) })}>
          {ALERT_DAY_OPTIONS.map((d) => <option key={d} value={d}>{d === 1 ? 'يوم واحد' : d === 2 ? 'يومين' : `${d} أيام`}</option>)}
        </SelectField>
        {error && <Alert tone="error">{error}</Alert>}
      </div>
    </Card>
  )
}
