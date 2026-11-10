import { useState, type FormEvent } from 'react'
import { Link, useNavigate } from 'react-router-dom'
import { AuthLayout } from '@/components/layout/AuthLayout'
import { Alert, Button, PageLoader, TextField } from '@/components/ui'
import { useAuth } from '@/hooks/useAuth'
import { useToast } from '@/hooks/useToast'
import { MIN_PASSWORD_LENGTH, validatePassword } from '@/services/auth'
import { toAppError } from '@/services/errors'

/** تُفتح من رابط الاستعادة (جلسة recovery) أو من الإعدادات لمستخدم مسجّل. */
export default function ResetPasswordPage() {
  const { status, service, clearRecovery } = useAuth()
  const toast = useToast()
  const navigate = useNavigate()
  const [password, setPassword] = useState('')
  const [confirm, setConfirm] = useState('')
  const [error, setError] = useState<string | null>(null)
  const [loading, setLoading] = useState(false)

  if (status === 'loading') return <PageLoader />
  if (status === 'signedOut') {
    return (
      <AuthLayout title="الرابط غير صالح" subtitle="رابط الاستعادة منتهي أو مستخدم مسبقًا.">
        <Alert tone="warning">اطلب رابطًا جديدًا وافتحه من نفس الجهاز خلال مدة صلاحيته.</Alert>
        <Link to="/forgot-password" className="mt-6 block text-center font-bold text-brand-600">طلب رابط جديد</Link>
      </AuthLayout>
    )
  }

  const submit = async (e: FormEvent) => {
    e.preventDefault()
    const err = validatePassword(password) ?? (password !== confirm ? 'كلمتا المرور غير متطابقتين.' : null)
    if (err) return setError(err)
    setError(null)
    setLoading(true)
    try {
      await service.updatePassword(password)
      clearRecovery()
      toast.show('تم تحديث كلمة المرور ✓')
      navigate('/', { replace: true })
    } catch (e2) {
      setError(toAppError(e2).message)
      setLoading(false)
    }
  }

  return (
    <AuthLayout title="كلمة مرور جديدة" subtitle="اختر كلمة مرور قوية ما تستخدمها في مكان ثاني.">
      <form onSubmit={submit} noValidate className="space-y-4">
        <TextField label="كلمة المرور الجديدة" type="password" autoComplete="new-password" dir="ltr"
          value={password} onChange={(e) => setPassword(e.target.value)} hint={`${MIN_PASSWORD_LENGTH} أحرف على الأقل، حروف وأرقام.`} />
        <TextField label="تأكيد كلمة المرور" type="password" autoComplete="new-password" dir="ltr"
          value={confirm} onChange={(e) => setConfirm(e.target.value)} />
        {error && <Alert tone="error">{error}</Alert>}
        <Button type="submit" block loading={loading}>حفظ كلمة المرور</Button>
      </form>
    </AuthLayout>
  )
}
