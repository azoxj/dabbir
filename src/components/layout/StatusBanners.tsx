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

export function OfflineBanner() {
  const online = useOnlineStatus()
  if (online) return null
  return (
    <div role="status" className="bg-ink-800 px-4 py-2 text-center text-xs font-semibold text-white">
      أنت غير متصل بالإنترنت. {appConfig.mode === 'supabase' ? 'التعديلات تحتاج اتصالًا للحفظ.' : ''}
    </div>
  )
}
