import { useState, type FormEvent } from 'react'
import { Link } from 'react-router-dom'
import { PageHeader } from '@/components/layout/AppLayout'
import { BackupCard } from '@/components/settings/BackupCard'
import { Alert, Button, buttonClasses, Card, CardTitle, PageLoader, TextField } from '@/components/ui'
import { appConfig } from '@/config/env'
import { useAuth } from '@/hooks/useAuth'
import { useProfile } from '@/hooks/useFinance'
import { useRepository } from '@/hooks/useRepository'
import { useToast } from '@/hooks/useToast'
import { toAppError } from '@/services/errors'

/** الملف الشخصي والإعدادات. */
export default function SettingsPage() {
  const { user, service } = useAuth()
  const profile = useProfile()
  const repo = useRepository()
  const toast = useToast()
  const [busy, setBusy] = useState(false)

  const signOut = async () => {
    setBusy(true)
    try {
      await service.signOut()
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
      <PageHeader title="الملف الشخصي والإعدادات" />

      <Card aria-labelledby="profile-title">
        <CardTitle><span id="profile-title">ملفي الشخصي</span></CardTitle>
        {profile.data ? (
          <ProfileForm key={profile.data.displayName ?? ''} initialName={profile.data.displayName ?? user?.displayName ?? ''}
            onSave={async (displayName) => { await profile.update({ displayName }); toast.show('تم حفظ الاسم ✓') }} />
        ) : profile.error ? <Alert tone="error">{profile.error.message}</Alert> : <PageLoader />}
        <dl className="mt-4 space-y-2 border-t border-ink-100 pt-3 text-sm">
          <div className="flex justify-between gap-2"><dt className="text-ink-500">البريد</dt><dd className="truncate font-semibold" dir="ltr">{user?.email || '—'}</dd></div>
          <div className="flex justify-between gap-2"><dt className="text-ink-500">طريقة الدخول</dt><dd className="font-semibold">{user?.provider === 'google' ? 'Google' : user?.provider === 'demo' ? 'حساب تجريبي محلي' : 'البريد وكلمة المرور'}</dd></div>
        </dl>
        <div className="mt-4 space-y-2">
          <Link to="/budget" className={buttonClasses('secondary', { block: true })}>الدخل والادخار ويوم الراتب</Link>
          {appConfig.mode === 'supabase' && <Link to="/mfa-settings" className={buttonClasses('secondary', { block: true })}>التحقق بخطوتين — تطبيق المصادقة</Link>}
          {user?.provider !== 'google' && <Link to="/reset-password" className={buttonClasses('secondary', { block: true })}>تغيير كلمة المرور</Link>}
          <Button variant="danger" block loading={busy} onClick={() => void signOut()}>تسجيل الخروج</Button>
        </div>
      </Card>

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
      <p className="pb-4 text-center text-xs text-ink-500">دبّر · الإصدار 0.1 (المرحلة الأولى)</p>
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
