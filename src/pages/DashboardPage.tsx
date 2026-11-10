import clsx from 'clsx'
import { Link } from 'react-router-dom'
import { Alert, buttonClasses, Card, CardTitle, PageLoader, ProgressBar, Stat } from '@/components/ui'
import { useAuth } from '@/hooks/useAuth'
import { useDashboard } from '@/hooks/useDashboard'
import { useToday } from '@/hooks/useToday'
import { dueStatus, sortCommitments } from '@/lib/commitments'
import { daysBetween, formatDate, formatHijri, formatWeekday, relativeDayLabel } from '@/lib/dates'
import { goalProgress } from '@/lib/goals'
import { formatSAR } from '@/lib/money'
import type { PlanSeverity } from '@/lib/todayPlan'
import type { Commitment, ISODate } from '@/types/domain'

const SEVERITY: Record<PlanSeverity, { box: string; icon: string; label: string }> = {
  critical: { box: 'border-danger-600 bg-danger-50', icon: '🔴', label: 'عاجل' },
  warning: { box: 'border-amber-500 bg-warn-50', icon: '🟠', label: 'انتبه' },
  info: { box: 'border-info-600 bg-info-50', icon: '🔵', label: 'تذكير' },
  success: { box: 'border-brand-500 bg-brand-50', icon: '✅', label: 'تمام' },
}

function greeting(): string {
  const h = new Date().getHours()
  return h < 12 ? 'صباح الخير' : 'مساء الخير'
}

export default function DashboardPage() {
  const today = useToday()
  const { user } = useAuth()
  const { data, plan, loading, error, reload } = useDashboard(today)

  const name = data?.profile.displayName || user?.displayName

  return (
    <div className="space-y-4">
      <header>
        <p className="text-sm text-ink-500">{greeting()}{name ? `، ${name}` : ''} 👋</p>
        <h1 className="mt-1 text-3xl font-bold text-ink-900">وش أسوي اليوم؟</h1>
        <p className="mt-1 text-xs text-ink-500">{formatWeekday(today)} {formatDate(today)} · {formatHijri(today)}</p>
      </header>

      {loading && !data && <PageLoader />}
      {error && (
        <Alert tone="error">
          {error.message} <button className="font-bold underline" onClick={() => void reload()}>إعادة المحاولة</button>
        </Alert>
      )}

      {plan && data && (
        <>
          <Card aria-labelledby="plan-title">
            <CardTitle><span id="plan-title">أولوياتك اليوم</span></CardTitle>
            <ul className="space-y-2.5" data-testid="today-plan">
              {plan.items.map((item) => {
                const s = SEVERITY[item.severity]
                return (
                  <li key={item.id} className={clsx('flex items-start gap-3 rounded-xl border-s-4 p-3', s.box)}>
                    <span aria-hidden className="mt-0.5 text-sm">{s.icon}</span>
                    <div className="min-w-0 flex-1">
                      <p className="font-semibold text-ink-900"><span className="sr-only">{s.label}: </span>{item.title}</p>
                      {item.detail && <p className="mt-0.5 text-sm text-ink-600">{item.detail}</p>}
                    </div>
                    {item.action && (
                      <Link to={item.action.to} className="shrink-0 self-center rounded-lg bg-white/70 px-2.5 py-1.5 text-xs font-bold text-brand-700 hover:bg-white">
                        {item.action.label}
                      </Link>
                    )}
                  </li>
                )
              })}
            </ul>
            <p className="mt-3 text-[11px] text-ink-500">الأولويات محسوبة بقواعد ثابتة من بياناتك على جهازك — بدون ذكاء اصطناعي.</p>
          </Card>

          <Card>
            <CardTitle action={<Link to="/budget" className="text-sm font-bold text-brand-600">التفاصيل</Link>}>ميزانية هذا الشهر</CardTitle>
            <div className="grid grid-cols-2 gap-2.5">
              <Stat label="تقدر تصرف اليوم" value={formatSAR(plan.summary.dailyAllowance)} tone={plan.summary.dailyAllowance > 0 ? 'brand' : 'danger'} />
              <Stat label="المتبقي بعد الالتزامات" value={formatSAR(plan.summary.availableAfterCommitments)} tone={plan.summary.availableAfterCommitments < 0 ? 'danger' : 'ink'} />
            </div>
            {plan.summary.income > 0 && (
              <div className="mt-4 space-y-1.5">
                <div className="flex justify-between text-xs text-ink-600">
                  <span>صرفت {formatSAR(plan.summary.spent)} من {formatSAR(plan.summary.income)}</span>
                  <span>{Math.round(plan.summary.spentRatio * 100)}%</span>
                </div>
                <ProgressBar label="نسبة الصرف من الدخل" value={plan.summary.spentRatio}
                  tone={plan.summary.spentRatio > 1 ? 'danger' : plan.summary.pace === 'fast' ? 'warn' : 'brand'} />
                <p className="text-[11px] text-ink-500">مضى {Math.round(plan.summary.elapsedRatio * 100)}% من الشهر · باقي {plan.summary.daysLeft} يوم</p>
              </div>
            )}
            <Link to="/budget#add" className={clsx(buttonClasses('secondary', { block: true }), 'mt-4')}>+ سجّل مصروف</Link>
          </Card>

          <UpcomingCard commitments={data.commitments} today={today} />

          {data.goals.length > 0 && (
            <Card>
              <CardTitle action={<Link to="/goals" className="text-sm font-bold text-brand-600">الكل</Link>}>أهدافك</CardTitle>
              <ul className="space-y-3">
                {data.goals.slice(0, 3).map((g) => {
                  const p = goalProgress(g, today)
                  return (
                    <li key={g.id}>
                      <div className="mb-1 flex justify-between text-sm"><span className="font-semibold">{g.name}</span><span className="text-ink-500">{Math.round(p.ratio * 100)}%</span></div>
                      <ProgressBar label={`تقدم هدف ${g.name}`} value={p.ratio} />
                    </li>
                  )
                })}
              </ul>
            </Card>
          )}
        </>
      )}
    </div>
  )
}

function UpcomingCard({ commitments, today }: { commitments: Commitment[]; today: ISODate }) {
  const upcoming = sortCommitments(commitments.filter((c) => !c.done)).slice(0, 4)
  return (
    <Card>
      <CardTitle action={<Link to="/commitments" className="text-sm font-bold text-brand-600">الكل</Link>}>التزاماتك القادمة</CardTitle>
      {upcoming.length === 0 ? (
        <p className="text-sm text-ink-500">ما عندك التزامات قادمة. <Link to="/commitments" className="font-bold text-brand-600">أضف التزام</Link></p>
      ) : (
        <ul className="divide-y divide-ink-100">
          {upcoming.map((c) => {
            const st = dueStatus(c, today)
            return (
              <li key={c.id} className="flex items-center justify-between gap-2 py-2.5">
                <span className="min-w-0 truncate font-medium">{c.title}</span>
                <span className={clsx('shrink-0 rounded-full px-2.5 py-0.5 text-xs font-semibold',
                  st === 'overdue' ? 'bg-danger-50 text-danger-600' : st === 'today' ? 'bg-warn-50 text-warn-600' : 'bg-ink-100 text-ink-600')}>
                  {relativeDayLabel(daysBetween(today, c.dueDate))}
                </span>
              </li>
            )
          })}
        </ul>
      )}
    </Card>
  )
}
