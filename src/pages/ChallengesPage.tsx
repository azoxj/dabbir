import { useCallback, useEffect, useState } from 'react'
import { PageHeader } from '@/components/layout/AppLayout'
import { Alert, Button, Card, CardTitle, PageLoader } from '@/components/ui'
import { appConfig } from '@/config/env'
import { useAuth } from '@/hooks/useAuth'
import { getSupabase } from '@/services/supabaseClient'

type Entry = { user_id: string; alias: string; joined_at: string }
type Result = { user_id: string; points: number; position: number; month: string }
const currentMonth = () => {
  const now = new Date()
  return [now.getFullYear(), String(now.getMonth() + 1).padStart(2, '0'), '01'].join('-')
}
export default function ChallengesPage() {
  const { user } = useAuth()
  const [entries, setEntries] = useState<Entry[]>([])
  const [results, setResults] = useState<Result[]>([])
  const [alias, setAlias] = useState('')
  const [loading, setLoading] = useState(true)
  const [busy, setBusy] = useState(false)
  const [error, setError] = useState<string | null>(null)
  const month = currentMonth()
  const supported = appConfig.mode === 'supabase'
  const enrolled = entries.some(e => e.user_id === user?.id)
  const load = useCallback(async () => {
    if (!supported) { setLoading(false); return }
    setError(null)
    try {
      const sb = getSupabase()
      const [a, b] = await Promise.all([
        sb.from('challenge_entries').select('user_id,alias,joined_at').eq('month', month).order('joined_at'),
        sb.from('challenge_results').select('user_id,points,position,month').order('month', { ascending: false }).limit(100),
      ])
      if (a.error) throw a.error
      if (b.error) throw b.error
      setEntries(a.data ?? [])
      setResults(b.data ?? [])
    } catch (e) { setError(e instanceof Error ? e.message : 'تعذّر تحميل التحديات') }
    finally { setLoading(false) }
  }, [month, supported])
  useEffect(() => {
    const task = window.setTimeout(() => { void load() }, 0)
    return () => window.clearTimeout(task)
  }, [load])
  const join = async () => {
    const name = alias.trim()
    if (name.length < 2 || name.length > 24) { setError('الاسم المستعار لازم يكون بين حرفين و24 حرف.'); return }
    if (!user) return
    setBusy(true); setError(null)
    try {
      const { error: err } = await getSupabase().from('challenge_entries').insert({ user_id: user.id, month, alias: name })
      if (err) throw err
      await load()
    } catch (e) { setError(e instanceof Error ? e.message : 'تعذّر الانضمام') }
    finally { setBusy(false) }
  }
  const leave = async () => {
    if (!user || !window.confirm('متأكد تبي تنسحب من تحدي هذا الشهر؟')) return
    setBusy(true)
    try {
      const { error: err } = await getSupabase().from('challenge_entries').delete().eq('month', month).eq('user_id', user.id)
      if (err) throw err
      await load()
    } catch (e) { setError(e instanceof Error ? e.message : 'تعذّر الانسحاب') }
    finally { setBusy(false) }
  }
  return <div className="space-y-4">
    <PageHeader title="تحديات دبّر 🏆" subtitle="منافسة شهرية على الانضباط المالي، مو على حجم الراتب" />
    <section className="rounded-3xl bg-gradient-to-bl from-teal-900 to-emerald-700 p-6 text-white">
      <p className="text-sm text-emerald-100">تحدي الشهر</p>
      <h2 className="mt-2 text-2xl font-bold">تحدّى نفسك، مو راتب غيرك</h2>
      <p className="mt-3 text-sm leading-7 text-emerald-50">الاشتراك اختياري. نعرض اسمك المستعار فقط للمنافسين، ولا نعرض راتبك أو مصاريفك أو أهدافك المالية.</p>
      <div className="mt-4 rounded-xl bg-white/15 px-4 py-3 text-sm">🏅 وسام الفائز الشهري — فائز واحد بعد اعتماد النتائج</div>
    </section>
    {error && <Alert tone="error">{error}</Alert>}
    {!supported ? <Alert tone="warning">التحديات تحتاج حسابًا متصلًا بـ Supabase.</Alert> : loading ? <PageLoader /> :
      <Card>
        <CardTitle>المشاركة في التحدي</CardTitle>
        {enrolled ? <>
          <p className="text-sm text-ink-600">أنت مشترك باسم <strong>{entries.find(e => e.user_id === user?.id)?.alias}</strong>. عدد المشاركين: {entries.length}.</p>
          <Button variant="secondary" block loading={busy} onClick={() => void leave()}>الانسحاب من تحدي الشهر</Button>
        </> : <>
          <p className="mb-3 text-sm text-ink-600">اختر اسمًا مستعارًا يظهر للمشتركين. لا تستخدم بريدك أو رقم جوالك.</p>
          <label htmlFor="challenge-alias" className="mb-1 block text-sm font-semibold">الاسم المستعار</label>
          <input id="challenge-alias" value={alias} onChange={e => setAlias(e.target.value)} maxLength={24} placeholder="مثال: مدبّر 77" className="mb-3 w-full rounded-xl border border-ink-300 bg-white px-4 py-3 text-ink-900" />
          <Button block loading={busy} onClick={() => void join()}>انضم للتحدي</Button>
        </>}
      </Card>}
    <Card>
      <CardTitle>لوحة المنافسة</CardTitle>
      <p className="text-sm text-ink-600">المشاركون هذا الشهر: {entries.length}. النقاط والترتيب بتظهر بعد تفعيل الاحتساب الموثوق من السيرفر؛ ما راح نعرض ترتيبًا وهميًا.</p>
      {entries.length > 0 && <ul className="mt-3 space-y-2">{entries.map(e => <li key={e.user_id} className="flex items-center justify-between rounded-xl bg-ink-50 p-3 text-sm"><span>👤 {e.alias}</span><span className="text-ink-500">مشارك</span></li>)}</ul>}
    </Card>
    <Card>
      <CardTitle>قاعة الأوسمة</CardTitle>
      {results.filter(r => r.position === 1).length === 0 ? <p className="text-sm text-ink-500">ما فيه فائز معتمد للحين. الأوسمة ما تُمنح إلا بعد إغلاق الشهر والتحقق من النتائج.</p> :
        <ul className="space-y-2">{results.filter(r => r.position === 1).map(r => <li key={r.month} className="rounded-xl bg-amber-50 p-3 text-sm">🥇 {r.month} — {entries.find(e => e.user_id === r.user_id)?.alias ?? 'فائز سابق'} · {r.points} نقطة</li>)}</ul>}
    </Card>
    <p className="pb-4 text-xs leading-6 text-ink-500">التحديات قيد الإطلاق المرحلي: الاشتراك يعمل، أما احتساب النقاط وإعلان الفائز فغير مفعّلين حتى اكتمال نظام التحقق والعدالة.</p>
  </div>
}
