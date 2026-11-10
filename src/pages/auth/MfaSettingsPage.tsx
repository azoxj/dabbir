import { useEffect, useState } from 'react'
import { Link } from 'react-router-dom'
import { getSupabase } from '@/services/supabaseClient'
import { useAuth } from '@/hooks/useAuth'

export default function MfaSettingsPage() {
  const { service } = useAuth()
  const [factors, setFactors] = useState<Array<{ id: string; friendly_name?: string; status: string }>>([])
  const [pending, setPending] = useState<{ id: string; qr: string; secret: string } | null>(null)
  const [code, setCode] = useState('')
  const [error, setError] = useState('')
  const [busy, setBusy] = useState(false)
  const [level, setLevel] = useState('aal1')
  const sb = service.mode === 'supabase' ? getSupabase() : null

  async function refresh() {
    if (!sb) return
    const [result, assurance] = await Promise.all([sb.auth.mfa.listFactors(), sb.auth.mfa.getAuthenticatorAssuranceLevel()])
    if (result.error || assurance.error) throw result.error ?? assurance.error
    setFactors(result.data.totp.filter((factor) => factor.status === 'verified'))
    setLevel(assurance.data.currentLevel ?? 'aal1')
  }
  useEffect(() => {
    if (!sb) return
    let active = true
    void Promise.all([sb.auth.mfa.listFactors(), sb.auth.mfa.getAuthenticatorAssuranceLevel()]).then(([result, assurance]) => {
      if (!active) return
      if (result.error || assurance.error) throw result.error ?? assurance.error
      setFactors(result.data.totp.filter((factor) => factor.status === 'verified'))
      setLevel(assurance.data.currentLevel ?? 'aal1')
    }).catch(() => { if (active) setError('تعذّر تحميل وسائل الحماية.') })
    return () => { active = false }
  }, [sb])

  async function enroll() {
    if (!sb) return
    setBusy(true); setError('')
    const { data, error: err } = await sb.auth.mfa.enroll({ factorType: 'totp', friendlyName: 'دبّر — تطبيق المصادقة' })
    if (err || !data.totp) setError('تعذّر إعداد المصادقة. حاول مرة ثانية.')
    else setPending({ id: data.id, qr: data.totp.qr_code, secret: data.totp.secret })
    setBusy(false)
  }

  async function verify() {
    if (!sb || !pending || !/^\d{6}$/.test(code)) return setError('أدخل رمزًا من 6 أرقام.')
    setBusy(true); setError('')
    const { error: err } = await sb.auth.mfa.challengeAndVerify({ factorId: pending.id, code })
    if (err) setError('الرمز غير صحيح أو انتهت صلاحيته.')
    else { setPending(null); setCode(''); await refresh().catch(() => setError('حدث خطأ أثناء تحديث الحالة.')) }
    setBusy(false)
  }

  async function remove(id: string) {
    if (!sb || level !== 'aal2') return setError('أكمل التحقق الثنائي قبل حذف وسيلة المصادقة.')
    if (!window.confirm('هل أنت متأكد من إزالة وسيلة المصادقة؟')) return
    setBusy(true); setError('')
    const { error: err } = await sb.auth.mfa.unenroll({ factorId: id })
    if (err) setError('تعذّر إزالة وسيلة المصادقة.')
    else await refresh().catch(() => setError('تعذّر تحديث الوسائل.'))
    setBusy(false)
  }

  return <main className="mx-auto max-w-md p-6 space-y-4" dir="rtl">
    <Link to="/settings" className="underline">العودة للإعدادات</Link>
    <h1 className="text-2xl font-bold">التحقق بخطوتين</h1>
    <p>هذه الميزة تستخدم تطبيق مصادقة مثل Google Authenticator. لا تمثل قائمة أجهزة موثوقة بعد.</p>
    {error && <p role="alert" className="text-red-700">{error}</p>}
    {factors.map((factor) => <div key={factor.id} className="rounded-xl border p-3">
      <p>{factor.friendly_name || 'تطبيق مصادقة'}</p>
      <button disabled={busy || level !== 'aal2'} className="underline" onClick={() => void remove(factor.id)}>إزالة الوسيلة</button>
    </div>)}
    {pending ? <section className="space-y-3 rounded-xl border p-4">
      <p>امسح رمز QR بتطبيق المصادقة، أو أدخل المفتاح يدويًا. لا تشاركه مع أحد.</p>
      <img src={pending.qr} alt="رمز إعداد المصادقة" className="mx-auto max-w-52" />
      <code className="block break-all" dir="ltr">{pending.secret}</code>
      <label className="block">الرمز من التطبيق
        <input aria-label="الرمز من التطبيق" inputMode="numeric" maxLength={6} value={code} onChange={(e) => setCode(e.target.value.replace(/\D/g, ''))} className="block w-full rounded-lg border p-3" dir="ltr" />
      </label>
      <button disabled={busy} onClick={() => void verify()} className="rounded-lg bg-teal-700 p-3 text-white">تأكيد وتفعيل</button>
    </section> : <button disabled={busy || !sb} onClick={() => void enroll()} className="rounded-lg bg-teal-700 p-3 text-white">إضافة تطبيق مصادقة</button>}
  </main>
}
