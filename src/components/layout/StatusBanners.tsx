import { Link } from 'react-router-dom'
import { exitDemoMode, getRuntimeMode, realAccountsAvailable } from '@/config/mode'
import { useOnlineStatus } from '@/hooks/useOnlineStatus'

export function DemoBanner() {
  if (getRuntimeMode() !== 'demo') return null
  return (
    <div className="bg-warn-50 px-4 py-2 text-center text-xs font-semibold text-warn-600" data-testid="demo-banner">
      وضع تجريبي: بياناتك محفوظة في هذا المتصفح فقط ولا ترتبط بأي حساب.{' '}
      {realAccountsAvailable
        ? <button type="button" className="underline" onClick={exitDemoMode}>الخروج إلى الحسابات الحقيقية</button>
        : <Link to="/settings" className="underline">التفاصيل</Link>}
    </div>
  )
}

export function OfflineBanner() {
  const online = useOnlineStatus()
  if (online) return null
  return (
    <div role="status" className="bg-ink-800 px-4 py-2 text-center text-xs font-semibold text-white">
      أنت غير متصل بالإنترنت. {getRuntimeMode() === 'supabase' ? 'التعديلات تحتاج اتصالًا للحفظ.' : ''}
    </div>
  )
}
