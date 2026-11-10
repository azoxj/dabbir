import { useState, type FormEvent } from 'react'
import { Link } from 'react-router-dom'
import { Divider, GoogleButton } from '@/components/auth/GoogleButton'
import { AuthLayout } from '@/components/layout/AuthLayout'
import { Alert, Button, TextField } from '@/components/ui'
import { useAuth } from '@/hooks/useAuth'
import { MIN_PASSWORD_LENGTH, validateEmail, validatePassword } from '@/services/auth'
import { toAppError } from '@/services/errors'

export default function RegisterPage() {
  const { service } = useAuth()
  const [name, setName] = useState('')
  const [email, setEmail] = useState('')
  const [password, setPassword] = useState('')
  const [confirm, setConfirm] = useState('')
  const [errors, setErrors] = useState<Record<string, string | null>>({})
  const [formError, setFormError] = useState<string | null>(null)
  const [sentTo, setSentTo] = useState<string | null>(null)
  const [loading, setLoading] = useState(false)

  const submit = async (e: FormEvent) => {
    e.preventDefault()
    const next = {
      name: name.trim().length > 80 ? 'الاسم طويل جدًا.' : null,
      email: validateEmail(email),
      password: validatePassword(password),
      confirm: password !== confirm ? 'كلمتا المرور غير متطابقتين.' : null,
    }
    setErrors(next)
    if (Object.values(next).some(Boolean)) return
    setFormError(null)
    setLoading(true)
    try {
      const { needsEmailConfirmation } = await service.signUp(email, password, name)
      if (needsEmailConfirmation) setSentTo(email.trim())
    } catch (err) {
      setFormError(toAppError(err).message)
    } finally {
      setLoading(false)
    }
  }

  if (sentTo) {
    return (
      <AuthLayout title="تحقق من بريدك" subtitle="باقي خطوة وحدة.">
        <Alert tone="success">أرسلنا رابط التفعيل إلى <b dir="ltr">{sentTo}</b>. افتح الرابط لتفعيل حسابك ثم سجّل دخولك.</Alert>
        <p className="mt-3 text-xs text-ink-500">ما وصلتك؟ تأكد من مجلد الرسائل غير المرغوبة. إذا كان البريد مسجلًا مسبقًا لن تصلك رسالة جديدة.</p>
        <Link to="/login" className="mt-6 block text-center font-bold text-brand-600">الرجوع لتسجيل الدخول</Link>
      </AuthLayout>
    )
  }

  return (
    <AuthLayout title="إنشاء حساب" subtitle="ابدأ ترتيب ميزانيتك والتزاماتك وأهدافك.">
      <form onSubmit={submit} noValidate className="space-y-4">
        <TextField label="الاسم (اختياري)" autoComplete="name" value={name} onChange={(e) => setName(e.target.value)} error={errors.name} maxLength={80} />
        <TextField label="البريد الإلكتروني" type="email" autoComplete="email" dir="ltr" placeholder="name@example.com"
          value={email} onChange={(e) => setEmail(e.target.value)} error={errors.email} />
        <TextField label="كلمة المرور" type="password" autoComplete="new-password" dir="ltr"
          value={password} onChange={(e) => setPassword(e.target.value)} error={errors.password}
          hint={`${MIN_PASSWORD_LENGTH} أحرف على الأقل، حروف وأرقام.`} />
        <TextField label="تأكيد كلمة المرور" type="password" autoComplete="new-password" dir="ltr"
          value={confirm} onChange={(e) => setConfirm(e.target.value)} error={errors.confirm} />
        {formError && <Alert tone="error">{formError}</Alert>}
        <Button type="submit" block loading={loading}>إنشاء الحساب</Button>
      </form>
      <Divider />
      <GoogleButton onError={setFormError} />
      <p className="mt-6 text-center text-sm text-ink-600">
        عندك حساب؟ <Link to="/login" className="font-bold text-brand-600 hover:underline">سجّل دخولك</Link>
      </p>
    </AuthLayout>
  )
}
