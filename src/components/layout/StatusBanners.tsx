import { Link } from 'react-router-dom'
import { appConfig } from '@/config/env'
import { useOnlineStatus } from '@/hooks/useOnlineStatus'

export function DemoBanner() {
  if (appConfig.mode !== 'demo') return null
  return (
    <div className="bg-warn-50 px-4 py-2 text-center text-xs font-semibold text-warn-600">
      وضع تجريبي: بياناتك محفوظة في هذا المتصفح فقط. <Link to="/settings" className="underline">التفاصيل</Link>
    </div>
  )
}

/** على الرابط القديم فقط: تنبيه بالانتقال للدومين الجديد وأن بيانات هذا المتصفح لا تنتقل تلقائيًا. */
export function MovingBanner() {
  // github.io (و github.io.localhost للاختبار المحلي فقط)
  if (typeof window === 'undefined' || !/(^|\.)github\.io(\.localhost)?$/.test(window.location.hostname)) return null
  return (
    <div role="status" className="bg-info-50 px-4 py-2 text-center text-xs font-semibold text-info-600" data-testid="moving-banner">
      دبّر ينتقل إلى <b dir="ltr">dabbir.online</b>. بياناتك المحفوظة في هذا المتصفح لا تنتقل تلقائيًا:{' '}
      <Link to="/settings" className="underline">نزّل نسخة احتياطية</Link> ثم استعدها على الرابط الجديد.
    </div>
  )
}

export function OfflineBanner() {
  const online = useOnlineStatus()
  if (online) return null
  return (
    <div role="status" className="bg-ink-800 px-4 py-2 text-center text-xs font-semibold text-white">
      أنت غير متصل بالإنترنت. {appConfig.mode === 'supabase' ? 'التعديلات تحتاج اتصالًا للحفظ.' : ''}
    </div>
  )
}
