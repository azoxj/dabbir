import { useState, type FormEvent } from 'react'
import { Link } from 'react-router-dom'
import { AuthLayout } from '@/components/layout/AuthLayout'
import { Alert, Button, TextField } from '@/components/ui'
import { useAuth } from '@/hooks/useAuth'
import { validateEmail } from '@/services/auth'
import { toAppError } from '@/services/errors'

export default function ForgotPasswordPage() {
  const { service } = useAuth()
  const [email, setEmail] = useState('')
  const [error, setError] = useState<string | null>(null)
  const [sent, setSent] = useState(false)
  const [loading, setLoading] = useState(false)

  const submit = async (e: FormEvent) => {
    e.preventDefault()
    const err = validateEmail(email)
    if (err) return setError(err)
    setError(null)
    setLoading(true)
    try {
      await service.sendPasswordReset(email)
      setSent(true)
    } catch (e2) {
      setError(toAppError(e2).message)
    } finally {
      setLoading(false)
    }
  }

  return (
    <AuthLayout title="استعادة كلمة المرور" subtitle="اكتب بريدك ونرسل لك رابط تعيين كلمة مرور جديدة.">
      {sent ? (
        // نفس الرسالة سواء كان البريد مسجلًا أم لا (لا نكشف وجود الحسابات).
        <Alert tone="success">
          إذا كان البريد مسجّلًا عندنا، بتوصلك رسالة فيها رابط الاستعادة خلال دقائق.
          {service.mode === 'demo' && ' (في الوضع التجريبي لا يُرسل بريد: إذا كان الحساب موجودًا ستنتقل مباشرة لتعيين كلمة المرور.)'}
        </Alert>
      ) : (
        <form onSubmit={submit} noValidate className="space-y-4">
          <TextField label="البريد الإلكتروني" type="email" autoComplete="email" dir="ltr" placeholder="name@example.com"
            value={email} onChange={(e) => setEmail(e.target.value)} error={error} />
          <Button type="submit" block loading={loading}>إرسال رابط الاستعادة</Button>
        </form>
      )}
      <Link to="/login" className="mt-6 block text-center text-sm font-bold text-brand-600">الرجوع لتسجيل الدخول</Link>
    </AuthLayout>
  )
}
