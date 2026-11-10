import { useMemo } from 'react'
import { PageHeader } from '@/components/layout/AppLayout'
import { Alert, Card, CardTitle, PageLoader, ProgressBar, Stat } from '@/components/ui'
import { useAsync } from '@/hooks/useAsync'
import { useRepository } from '@/hooks/useRepository'
import { useToday } from '@/hooks/useToday'
import { fixedMonthlyCosts } from '@/lib/commitments'
import { monthRange } from '@/lib/dates'
import { CATEGORY_EMOJI, CATEGORY_LABELS } from '@/lib/labels'
import { formatSAR } from '@/lib/money'
import {
  categoryTotals, compareWithPreviousMonth, formatMonthLong, formatMonthShort, monthlyTotals, reportRange, savingsSummary,
  type MonthTotal,
} from '@/lib/reports'

const MONTHS = 6

/** التقارير والإحصائيات — كلها محسوبة محليًا من بيانات المستخدم. */
export default function ReportsPage() {
  const today = useToday()
  const repo = useRepository()
  const { from, to } = reportRange(today, MONTHS)
  const { data, error, loading } = useAsync(async () => {
    const [profile, expenses, goals, commitments] = await Promise.all([
      repo.getProfile(), repo.listExpenses({ from, to }), repo.listGoals(), repo.listCommitments(),
    ])
    return { profile, expenses, goals, commitments }
  }, [repo, from, to])

  const report = useMemo(() => {
    if (!data) return null
    const totals = monthlyTotals(data.expenses, today, MONTHS)
    const thisMonth = monthRange(today)
    return {
      totals,
      cmp: compareWithPreviousMonth(totals, today),
      categories: categoryTotals(data.expenses, thisMonth.from, thisMonth.to),
      savings: savingsSummary(data.goals),
      fixed: fixedMonthlyCosts(data.commitments),
    }
  }, [data, today])

  if (error && !data) return <Alert tone="error">{error.message}</Alert>
  if ((loading && !data) || !report || !data) return <PageLoader />
  const { totals, cmp, categories, savings, fixed } = report
  const income = data.profile.monthlyIncome

  return (
    <div className="space-y-4">
      <PageHeader title="التقارير والإحصائيات" subtitle={`آخر ${MONTHS} أشهر · محسوبة من بياناتك فقط`} />

      <Card>
        <div className="grid grid-cols-2 gap-2.5">
          <Stat label="مصروف هذا الشهر" value={formatSAR(cmp.current)} tone="ink" />
          <Stat label="مقارنة بالشهر الماضي" tone={cmp.change !== null && cmp.change > 0.1 ? 'warn' : 'ink'}
            value={<span data-testid="month-change">{cmp.change === null ? '—' : `${cmp.change > 0 ? '▲ أعلى' : cmp.change < 0 ? '▼ أقل' : 'نفس'} ${Math.abs(Math.round(cmp.change * 100))}%`}</span>} />
          <Stat label="متوسط الصرف اليومي" value={formatSAR(cmp.dailyAverage)} tone="ink" />
          <Stat label="مجموع مدخراتك في الأهداف" value={formatSAR(savings.saved)} tone="brand" />
        </div>
      </Card>

      <Card aria-labelledby="monthly-title">
        <CardTitle><span id="monthly-title">المصروف الشهري</span></CardTitle>
        <MonthlyBars totals={totals} income={income} />
      </Card>

      <Card aria-labelledby="cat-title">
        <CardTitle><span id="cat-title">توزيع مصروف {formatMonthLong(totals.at(-1)!.month)}</span></CardTitle>
        {categories.length === 0 ? (
          <p className="text-sm text-ink-500">ما فيه مصاريف مسجلة هذا الشهر.</p>
        ) : (
          <ul className="space-y-3" data-testid="category-report">
            {categories.map((c) => (
              <li key={c.category}>
                <div className="mb-1 flex justify-between gap-2 text-sm">
                  <span className="font-semibold">{CATEGORY_EMOJI[c.category]} {CATEGORY_LABELS[c.category]}</span>
                  <span className="text-ink-600">{formatSAR(c.total)} · {Math.round(c.share * 100)}%</span>
                </div>
                <ProgressBar label={`نسبة ${CATEGORY_LABELS[c.category]} من مصروف الشهر`} value={c.share} />
              </li>
            ))}
          </ul>
        )}
      </Card>

      <Card aria-labelledby="commit-title">
        <CardTitle><span id="commit-title">الالتزامات والادخار</span></CardTitle>
        <dl className="space-y-2 text-sm">
          <Row label="التكاليف الثابتة الشهرية" value={formatSAR(fixed.total)} hint={income > 0 ? `${Math.round((fixed.total / income) * 100)}% من الدخل` : undefined} />
          <Row label="هدف الادخار الشهري" value={formatSAR(data.profile.savingsTarget)} />
          <Row label="الأهداف المكتملة" value={`${savings.completed} من ${data.goals.length}`} />
        </dl>
        {savings.target > 0 && (
          <div className="mt-3">
            <div className="mb-1 flex justify-between text-xs text-ink-600"><span>التقدم الكلي في الأهداف</span><span>{Math.round(savings.ratio * 100)}%</span></div>
            <ProgressBar label="التقدم الكلي في أهداف الادخار" value={savings.ratio} />
          </div>
        )}
      </Card>
    </div>
  )
}

function Row({ label, value, hint }: { label: string; value: string; hint?: string }) {
  return (
    <div className="flex justify-between gap-2">
      <dt className="text-ink-600">{label}</dt>
      <dd className="font-bold">{value}{hint && <span className="ms-1 text-xs font-normal text-ink-500">({hint})</span>}</dd>
    </div>
  )
}

/**
 * أعمدة شهرية (سلسلة واحدة، محور واحد بالريال). خط مرجعي متقطع للدخل الشهري.
 * تلميح عند المرور/التركيز على كل عمود، وقيمة مكتوبة على الشهر الحالي فقط، وجدول بديل.
 */
function MonthlyBars({ totals, income }: { totals: MonthTotal[]; income: number }) {
  const max = Math.max(1, income, ...totals.map((t) => t.total))
  const H = 160
  return (
    <div>
      {/* 28px إضافية أعلى الرسم لتسمية خط الدخل حتى لا تتداخل مع عنوان البطاقة */}
      <div className="relative" style={{ height: H + 24 + 28 }} role="img" aria-label="أعمدة المصروف الشهري لآخر ستة أشهر">
        {income > 0 && (
          <div className="pointer-events-none absolute inset-x-0 border-t-2 border-dashed border-ink-300" style={{ bottom: 24 + (income / max) * H }}>
            <span className="absolute -top-5 start-0 bg-white px-1 text-[11px] text-ink-500">الدخل {formatSAR(income)}</span>
          </div>
        )}
        <ul className="absolute inset-x-0 bottom-0 flex items-end gap-[2px] border-b border-ink-300" style={{ height: H + 24 }} data-testid="monthly-bars">
          {totals.map((t, i) => {
            const last = i === totals.length - 1
            const h = t.total > 0 ? Math.max(4, (t.total / max) * H) : 0
            return (
              <li key={t.month} className="group relative flex h-full flex-1 flex-col items-center justify-end">
                {last && t.total > 0 && <span className="mb-1 text-[11px] font-bold text-ink-800">{formatSAR(t.total)}</span>}
                <button type="button" className="flex w-full justify-center focus:outline-none" aria-label={`${formatMonthLong(t.month)}: ${formatSAR(t.total)}`}>
                  <span className={`block w-3/5 max-w-10 rounded-t ${last ? 'bg-brand-600' : 'bg-brand-500/60'}`} style={{ height: h }} />
                </button>
                <span className="mt-1 h-5 text-[11px] text-ink-500">{formatMonthShort(t.month)}</span>
                <span role="tooltip" className="pointer-events-none absolute bottom-full z-10 mb-1 hidden whitespace-nowrap rounded-lg bg-ink-800 px-2 py-1 text-xs text-white shadow group-hover:block group-focus-within:block">
                  {formatMonthLong(t.month)}<br /><b>{formatSAR(t.total)}</b> · {t.count} مصروف
                </span>
              </li>
            )
          })}
        </ul>
      </div>
      <details className="mt-3 text-sm">
        <summary className="cursor-pointer font-semibold text-brand-600">عرض كجدول</summary>
        <table className="mt-2 w-full text-start">
          <thead><tr className="text-ink-500"><th className="py-1 text-start font-normal">الشهر</th><th className="text-start font-normal">المصروف</th><th className="text-start font-normal">العدد</th></tr></thead>
          <tbody>
            {totals.map((t) => <tr key={t.month} className="border-t border-ink-100"><td className="py-1">{formatMonthLong(t.month)}</td><td>{formatSAR(t.total)}</td><td>{t.count}</td></tr>)}
          </tbody>
        </table>
      </details>
    </div>
  )
}
