import { Link } from 'react-router-dom'
import { buttonClasses } from '@/components/ui'

export default function NotFoundPage() {
  return (
    <div className="flex min-h-[60dvh] flex-col items-center justify-center gap-3 text-center">
      <p className="text-5xl" aria-hidden>🧭</p>
      <h1 className="text-xl font-bold">الصفحة غير موجودة</h1>
      <Link to="/" className={buttonClasses('primary')}>الرجوع للرئيسية</Link>
    </div>
  )
}
