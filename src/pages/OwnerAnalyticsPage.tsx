import { useEffect, useState } from 'react'
import { Link } from 'react-router-dom'
import { getSupabase } from '@/services/supabaseClient'
import { appConfig } from '@/config/env'
import { PageHeader } from '@/components/layout/AppLayout'

type Day = { date: string; count: number }
type Analytics = {
  total_users: number
  today_users: number
  google_users: number
  signed_in_7d: number
  daily: Day[]
}
const number = (value: number) => new Intl.NumberFormat('ar-SA').format(value)

export default function OwnerAnalyticsPage() {
  const [data, setData] = useState<Analytics | null>(null)
  const [status, setStatus] = useState<'loading' | 'denied' | 'error'>('loading')

  useEffect(() => {
    let mounted = true
    if (appConfig.mode !== 'supabase') { setStatus('denied'); return }
    getSupabase().rpc('owner_analytics').then(({ data, error }) => {
      if (!mounted) return
      if (error) { setStatus(error.code === '42501' || error.code === 'PGRST301' ? 'denied' : 'error'); return }
      setData(data as Analytics)
    }).catch(() => mounted && setStatus('error'))
    return () => { mounted = false }
  }, [])

  if (status === 'loading' && !data) return <p role="status" className="p-8">جاري تحميل إحصائيات المنصة...</p>
  if (status === 'denied') return <div className="rounded-2xl bg-white p-6"><h1 className="text-xl font-bold">لوحة المالك</h1><p className="mt-3">ما عندك صلاحية للوصول لهذي الصفحة.</p><Link to="/" className="mt-4 inline-block text-brand-700 underline">العودة للرئيسية</Link></div>
  if (!data) return <div className="rounded-2xl bg-white p-6"><h1 className="text-xl font-bold">تعذر تحميل الإحصائيات</h1><p className="mt-2 text-sm">تأكد من تفعيل تحديث قاعدة البيانات، ثم حاول مرة ثانية.</p><button className="mt-4 text-brand-700 underline" onClick={() => window.location.reload()}>إعادة المحاولة</button></div>

  const max = Math.max(1, ...data.daily.map(d => d.count))
  const stats = [
    { label: 'إجمالي المسجلين', value: data.total_users, symbol: '👥' },
    { label: 'المسجلون اليوم', value: data.today_users, symbol: '✨' },
    { label: 'المسجلون عبر Google', value: data.google_users, symbol: '🔐' },
    { label: 'سجّلوا دخول خلال 7 أيام', value: data.signed_in_7d, symbol: '📈' },
  ]

  return <section className="space-y-6" aria-label="لوحة إحصائيات المالك">
    <div className="rounded-3xl bg-gradient-to-bl from-emerald-950 via-teal-900 to-emerald-700 px-6 py-8 text-white">
      <p className="text-sm text-emerald-100">إدارة منصة دبّر</p>
      <h1 className="mt-2 text-3xl font-bold">لوحة المالك</h1>
      <p className="mt-2 text-sm text-emerald-100">نظرة عامة على نمو المنصة — بدون الاطلاع على بيانات العملاء المالية</p>
    </div>
    <PageHeader title="إحصائيات المستخدمين" subtitle="تُحسب الأرقام مباشرة من قاعدة البيانات بتوقيت الرياض" />
    <div className="grid grid-cols-2 gap-3 lg:grid-cols-4">
      {stats.map(s => <div key={s.label} className="rounded-2xl border border-ink-100 bg-white p-4 shadow-sm">
        <span aria-hidden className="text-xl">{s.symbol}</span>
        <p className="mt-2 text-xs text-ink-500">{s.label}</p>
        <p className="mt-2 text-3xl font-bold text-ink-900" dir="ltr">{number(s.value)}</p>
      </div>)}
    </div>
    <div className="rounded-3xl border border-ink-100 bg-white p-5 shadow-sm">
      <h2 className="text-lg font-bold">التسجيلات خلال آخر 14 يوم</h2>
      <p className="mt-1 text-xs text-ink-500">عدد الحسابات الجديدة يوميًا</p>
      <div className="mt-6 flex h-44 items-end gap-1.5 sm:gap-3" role="img" aria-label="رسم بياني للتسجيلات اليومية">
        {data.daily.map(d => <div key={d.date} className="group flex h-full min-w-0 flex-1 flex-col items-center justify-end gap-1" title={`${d.date}: ${number(d.count)}`}>
          <span className="text-[10px] font-semibold text-ink-600">{number(d.count)}</span>
          <div className="w-full rounded-t-lg bg-brand-600" style={{ height: `${Math.max(3, (d.count / max) * 115)}px` }} />
          <span className="text-[9px] text-ink-500" dir="ltr">{d.date.slice(5)}</span>
        </div>)}
      </div>
    </div>
    <p className="text-xs leading-6 text-ink-500">مؤشر آخر 7 أيام يقيس الحسابات التي سجلت دخولًا، وليس النشاط داخل التطبيق. وقد تتضمن الأرقام حسابات تجريبية.</p>
  </section>
}
