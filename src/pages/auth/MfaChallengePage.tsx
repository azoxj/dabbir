import { useEffect, useState } from 'react'
import { Navigate } from 'react-router-dom'
import { getSupabase } from '@/services/supabaseClient'
import { useAuth } from '@/hooks/useAuth'

/** MFA challenge for accounts that have already enrolled a verified TOTP factor.
 * This is a UI gate only. Do not ship as enforced security until database RLS
 * checks aal2 and recovery/enrollment are tested end-to-end.
 */
export default function MfaChallengePage() {
  const { status, service } = useAuth()
  const [factorId, setFactorId] = useState('')
  const [level, setLevel] = useState<'loading' | 'aal1' | 'aal2' | 'none' | 'error'>('loading')
  const [code, setCode] = useState('')
  const [error, setError] = useState('')
  const [busy, setBusy] = useState(false)

  useEffect(() => {
    if (status !== 'signedIn' || service.mode !== 'supabase') return
    let alive = true
    const sb = getSupabase()
    void Promise.all([sb.auth.mfa.getAuthenticatorAssuranceLevel(), sb.auth.mfa.listFactors()])
      .then(([assurance, factors]) => {
        if (!alive) return
        if (assurance.error || factors.error) throw assurance.error ?? factors.error
        if (assurance.data.currentLevel === 'aal2') return setLevel('aal2')
        const totp = factors.data.totp.find((f) => f.status === 'verified')
        setFactorId(totp?.id ?? '')
        setLevel(totp ? 'aal1' : 'none')
      }).catch(() => { if (alive) { setLevel('error'); setError('تعذّر تحميل إعدادات التحقق. حاول تحديث الصفحة.') } })
    return () => { alive = false }
  }, [status, service])

  if (status === 'signedOut') return <Navigate to="/login" replace />
  if (status === 'signedIn' && service.mode === 'demo') return <Navigate to="/" replace />
  if (level === 'aal2' || level === 'none') return <Navigate to="/" replace />

  async function verify() {
    if (!/^\d{6}$/.test(code) || !factorId) return setError('أدخل الرمز المكوّن من 6 أرقام.')
    setBusy(true)
    setError('')
    const { error: verifyError } = await getSupabase().auth.mfa.challengeAndVerify({ factorId, code })
    setBusy(false)
    if (verifyError) return setError('الرمز غير صحيح أو انتهت صلاحيته.')
    setLevel('aal2')
  }

  return <main className="mx-auto max-w-md p-6 space-y-4" dir="rtl">
    <h1 className="text-2xl font-bold">التحقق الإضافي</h1>
    <p>افتح تطبيق المصادقة وأدخل الرمز المكوّن من 6 أرقام لإكمال الدخول.</p>
    {error && <p role="alert" className="text-red-700">{error}</p>}
    <label className="block">رمز التحقق
      <input aria-label="رمز التحقق" className="block w-full rounded-lg border p-3" dir="ltr" inputMode="numeric" autoComplete="one-time-code" maxLength={6} value={code} onChange={(e) => setCode(e.target.value.replace(/\D/g, ''))} />
    </label>
    <button className="rounded-lg bg-teal-700 p-3 text-white" disabled={busy || level !== 'aal1'} onClick={() => void verify()}>{busy ? 'جاري التحقق...' : 'تأكيد الرمز'}</button>
    <button className="block underline" onClick={() => void service.signOut()}>تسجيل الخروج</button>
  </main>
}
