import { useState } from 'react'
import { GoogleIcon } from '@/components/icons/Icons'
import { Button } from '@/components/ui'
import { useAuth } from '@/hooks/useAuth'
import { toAppError } from '@/services/errors'

export function GoogleButton({ onError }: { onError: (msg: string) => void }) {
  const { service } = useAuth()
  const [loading, setLoading] = useState(false)
  const click = async () => {
    setLoading(true)
    try {
      await service.signInWithGoogle() // يحوّل المتصفح لصفحة Google
    } catch (e) {
      onError(toAppError(e).message)
      setLoading(false)
    }
  }
  return (
    <div>
      <Button type="button" variant="secondary" block loading={loading} disabled={!service.supportsGoogle} onClick={click}
        className="border border-ink-300 !bg-white !text-ink-800 hover:!bg-ink-100 disabled:opacity-60">
        <GoogleIcon /> المتابعة باستخدام Google
      </Button>
      {!service.supportsGoogle && <p className="mt-1 text-center text-xs text-ink-500">يتطلب ربط Supabase (غير متاح في الوضع التجريبي).</p>}
    </div>
  )
}

export function Divider() {
  return (
    <div className="my-5 flex items-center gap-3 text-xs text-ink-500">
      <span className="h-px flex-1 bg-ink-100" /> أو <span className="h-px flex-1 bg-ink-100" />
    </div>
  )
}
