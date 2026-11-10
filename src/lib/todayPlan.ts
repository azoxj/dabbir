/**
 * «وش أسوي اليوم؟» — محرك قواعد بسيط وشفاف (بدون أي ذكاء اصطناعي).
 * كل بطاقة ناتجة عن قاعدة مكتوبة هنا ويمكن اختبارها وشرحها للمستخدم.
 */
import type { BudgetLimit, Commitment, Expense, ISODate, Profile, SavingsGoal } from '@/types/domain'
import { HIGH_SPEND_RATIO, summarizeMonth, type MonthSummary } from './budget'
import { dueStatus } from './commitments'
import { daysBetween, daysInMonth, relativeDayLabel } from './dates'
import { goalProgress } from './goals'
import { CATEGORY_LABELS } from './labels'
import { formatSAR } from './money'

export type PlanSeverity = 'critical' | 'warning' | 'info' | 'success'

export interface PlanItem {
  id: string
  severity: PlanSeverity
  title: string
  detail?: string
  action?: { label: string; to: string }
}

export interface PlanInput {
  profile: Profile
  expenses: Expense[]
  limits: BudgetLimit[]
  commitments: Commitment[]
  goals: SavingsGoal[]
  today: ISODate
}

export interface TodayPlan {
  items: PlanItem[]
  summary: MonthSummary
}

const ORDER: Record<PlanSeverity, number> = { critical: 0, warning: 1, info: 2, success: 3 }
export const MAX_PLAN_ITEMS = 6

const withAmount = (c: Commitment) => (c.amount ? ` — ${formatSAR(c.amount)}` : '')

/** يوم الراتب الفعلي في الشهر (مثلًا 31 في شهر من 30 يومًا ← 30). */
export function effectivePayday(payday: number, today: ISODate): number {
  const [y, m] = today.split('-').map(Number) as [number, number]
  return Math.min(payday, daysInMonth(y, m))
}

export function buildTodayPlan(input: PlanInput): TodayPlan {
  const { profile, today } = input
  const summary = summarizeMonth({
    income: profile.monthlyIncome,
    savingsTarget: profile.savingsTarget,
    expenses: input.expenses,
    limits: input.limits,
    commitments: input.commitments,
    today,
  })
  const items: PlanItem[] = []

  // 1) الالتزامات حسب الاستحقاق
  for (const c of input.commitments) {
    const status = dueStatus(c, today)
    const days = daysBetween(today, c.dueDate)
    const time = c.dueTime ? ` الساعة ${c.dueTime.slice(0, 5)}` : ''
    if (status === 'overdue') {
      items.push({ id: `c-${c.id}`, severity: 'critical', title: `متأخر: ${c.title}`, detail: `${relativeDayLabel(days)}${withAmount(c)}`, action: { label: 'الالتزامات', to: '/commitments' } })
    } else if (status === 'today') {
      items.push({ id: `c-${c.id}`, severity: 'warning', title: `اليوم: ${c.title}`, detail: `مستحق اليوم${time}${withAmount(c)}`, action: { label: 'الالتزامات', to: '/commitments' } })
    } else if (status === 'soon') {
      items.push({ id: `c-${c.id}`, severity: 'info', title: `قريب: ${c.title}`, detail: `${relativeDayLabel(days)}${time}${withAmount(c)}`, action: { label: 'الالتزامات', to: '/commitments' } })
    }
  }

  // 2) الميزانية
  if (summary.income <= 0) {
    items.push({ id: 'b-income', severity: 'info', title: 'أدخل دخلك الشهري', detail: 'عشان نحسب لك كم تقدر تصرف كل يوم.', action: { label: 'الميزانية', to: '/budget' } })
  } else if (summary.remaining < 0) {
    items.push({ id: 'b-deficit', severity: 'critical', title: 'مصاريفك تجاوزت دخلك هذا الشهر', detail: `العجز ${formatSAR(-summary.remaining)}. أجّل أي مصروف غير ضروري.`, action: { label: 'الميزانية', to: '/budget' } })
  } else if (summary.availableAfterCommitments < 0) {
    items.push({ id: 'b-commitments', severity: 'critical', title: 'التزاماتك المتبقية أكبر من المتبقي من دخلك', detail: `باقي عليك ${formatSAR(summary.pendingCommitments)} هذا الشهر، وينقصك ${formatSAR(-summary.availableAfterCommitments)}.`, action: { label: 'الالتزامات', to: '/commitments' } })
  } else if (summary.availableAfterSavings < 0) {
    items.push({ id: 'b-savings', severity: 'warning', title: 'هدف الادخار في خطر', detail: `ينقصك ${formatSAR(-summary.availableAfterSavings)} للوصول لهدف الادخار الشهري.`, action: { label: 'الميزانية', to: '/budget' } })
  } else if (summary.committedRatio >= HIGH_SPEND_RATIO) {
    items.push({ id: 'b-high', severity: 'warning', title: `مصاريفك والتزاماتك تستهلك ${Math.round(summary.committedRatio * 100)}% من دخلك`, detail: 'حاول تزيد هامش الأمان وتأجل غير الضروري.', action: { label: 'الميزانية', to: '/budget' } })
  } else if (summary.pace === 'fast') {
    items.push({ id: 'b-pace', severity: 'warning', title: 'صرفك هذا الشهر أسرع من المعتاد', detail: `صرفت ${Math.round(summary.spentRatio * 100)}% من دخلك ومضى ${Math.round(summary.elapsedRatio * 100)}% من الشهر.`, action: { label: 'الميزانية', to: '/budget' } })
  }

  for (const cat of summary.categories) {
    const label = CATEGORY_LABELS[cat.category]
    if (cat.status === 'over' && cat.limit) {
      items.push({ id: `l-${cat.category}`, severity: 'critical', title: `تجاوزت حد «${label}»`, detail: `صرفت ${formatSAR(cat.spent)} من ${formatSAR(cat.limit)}.`, action: { label: 'الميزانية', to: '/budget' } })
    } else if (cat.status === 'near' && cat.limit) {
      items.push({ id: `l-${cat.category}`, severity: 'warning', title: `قربت من حد «${label}»`, detail: `باقي ${formatSAR(cat.limit - cat.spent)} فقط.`, action: { label: 'الميزانية', to: '/budget' } })
    }
  }

  // 3) يوم الراتب
  const [, , dayOfMonth] = today.split('-').map(Number) as [number, number, number]
  if (summary.income > 0 && dayOfMonth === effectivePayday(profile.payday, today)) {
    items.push({
      id: 'payday', severity: 'info', title: 'اليوم يوم الراتب 🎉',
      detail: profile.savingsTarget > 0 ? `ابدأ بنفسك: حوّل ${formatSAR(profile.savingsTarget)} للادخار قبل أي صرف.` : 'حدّد هدف ادخار شهري وحوّله أول ما ينزل الراتب.',
      action: { label: 'الأهداف', to: '/goals' },
    })
  }

  // 4) الأهداف
  for (const g of input.goals) {
    const p = goalProgress(g, today)
    if (p.status === 'past_due') {
      items.push({ id: `g-${g.id}`, severity: 'warning', title: `فات موعد هدف «${g.name}»`, detail: `باقي ${formatSAR(p.remaining)}. حدّث الموعد أو المبلغ.`, action: { label: 'الأهداف', to: '/goals' } })
    } else if (p.status === 'on_track' && p.monthlyNeeded && summary.income > 0 && p.monthlyNeeded > Math.max(0, profile.savingsTarget)) {
      items.push({ id: `g-${g.id}`, severity: 'info', title: `هدف «${g.name}» يحتاج ${formatSAR(p.monthlyNeeded)} شهريًا`, detail: `وهذا أعلى من هدف ادخارك الشهري (${formatSAR(profile.savingsTarget)}).`, action: { label: 'الأهداف', to: '/goals' } })
    }
  }

  // 5) تذكير التسجيل اليومي
  if (!input.expenses.some((e) => e.spentOn === today)) {
    items.push({ id: 'log-today', severity: 'info', title: 'سجّل مصاريف اليوم', detail: 'التسجيل اليومي يخلي أرقامك دقيقة.', action: { label: 'إضافة مصروف', to: '/budget#add' } })
  }

  const sorted = items.sort((a, b) => ORDER[a.severity] - ORDER[b.severity]).slice(0, MAX_PLAN_ITEMS)
  if (!sorted.some((i) => i.severity === 'critical' || i.severity === 'warning')) {
    sorted.unshift({ id: 'all-good', severity: 'success', title: 'وضعك ممتاز اليوم ✅', detail: 'ما عندك شي متأخر أو عاجل.' })
  }
  return { items: sorted.slice(0, MAX_PLAN_ITEMS), summary }
}
