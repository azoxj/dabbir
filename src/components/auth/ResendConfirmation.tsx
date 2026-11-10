import { useState } from 'react'
import { Button } from '@/components/ui'
import { useAuth } from '@/hooks/useAuth'
import { toAppError } from '@/services/errors'

/** زر إعادة إرسال رسالة تأكيد البريد (مع مهلة بسيطة لمنع التكرار). */
export function ResendConfirmation({ email }: { email: string }) {
  const { service } = useAuth()
  const [state, setState] = useState<'idle' | 'sending' | 'sent'>('idle')
  const [error, setError] = useState<string | null>(null)
  if (!service.resendConfirmation || !email.trim()) return null
  const send = async () => {
    setState('sending')
    setError(null)
    try {
      await service.resendConfirmation!(email)
      setState('sent')
    } catch (e) {
      setError(toAppError(e).message)
      setState('idle')
    }
  }
  return (
    <div className="text-sm">
      {state === 'sent'
        ? <p className="text-brand-700">أعدنا إرسال رسالة التأكيد ✓ (تأكد من مجلد الرسائل غير المرغوبة)</p>
        : <Button type="button" variant="secondary" size="sm" block loading={state === 'sending'} onClick={() => void send()}>إعادة إرسال رسالة التأكيد</Button>}
      {error && <p className="mt-1 text-danger-600">{error}</p>}
    </div>
  )
}
