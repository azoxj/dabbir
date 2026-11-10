import { useState, type FormEvent } from 'react'
import { Link } from 'react-router-dom'
import { Divider, GoogleButton } from '@/components/auth/GoogleButton'
import { AuthLayout } from '@/components/layout/AuthLayout'
import { Alert, Button, TextField } from '@/components/ui'
import { useAuth } from '@/hooks/useAuth'
import { validateEmail } from '@/services/auth'
import { toAppError } from '@/services/errors'

export default function LoginPage() {
  const { service } = useAuth()
  const [email, setEmail] = useState('')
  const [password, setPassword] = useState('')
  const [error, setError] = useState<string | null>(null)
  const [loading, setLoading] = useState(false)

  const submit = async (e: FormEvent) => {
    e.preventDefault()
    const emailErr = validateEmail(email)
    if (emailErr) return setError(emailErr)
    if (!password) return setError('اكتب كلمة المرور.')
    setError(null)
    setLoading(true)
    try {
      await service.signIn(email, password)
      // التوجيه يتم تلقائيًا عبر PublicOnlyRoute عند تغيّر الحالة.
    } catch (err) {
      setError(toAppError(err).message)
      setLoading(false)
    }
  }

  const guest = async () => {
    setLoading(true)
    try {
      await service.signInAsGuest?.()
    } catch (err) {
      setError(toAppError(err).message)
      setLoading(false)
    }
  }

  return (
    <AuthLayout title="تسجيل الدخول" subtitle="حياتك مرتبة، وقراراتك أوضح.">
      <form onSubmit={submit} noValidate className="space-y-4">
        <TextField label="البريد الإلكتروني" type="email" autoComplete="email" dir="ltr" placeholder="name@example.com"
          value={email} onChange={(e) => setEmail(e.target.value)} required />
        <TextField label="كلمة المرور" type="password" autoComplete="current-password" dir="ltr"
          value={password} onChange={(e) => setPassword(e.target.value)} required />
        <div className="text-start text-sm">
          <Link to="/forgot-password" className="font-semibold text-brand-600 hover:underline">نسيت كلمة المرور؟</Link>
        </div>
        {error && <Alert tone="error">{error}</Alert>}
        <Button type="submit" block loading={loading}>دخول</Button>
      </form>
      <Divider />
      <GoogleButton onError={setError} />
      {service.signInAsGuest && (
        <Button type="button" variant="ghost" block className="mt-3" onClick={guest} disabled={loading}>
          جرّب التطبيق ببيانات تجريبية
        </Button>
      )}
      <p className="mt-6 text-center text-sm text-ink-600">
        ما عندك حساب؟ <Link to="/register" className="font-bold text-brand-600 hover:underline">أنشئ حساب</Link>
      </p>
    </AuthLayout>
  )
}
