import { useState, type FormEvent } from 'react'
import { TrashIcon } from '@/components/icons/Icons'
import { PageHeader } from '@/components/layout/AppLayout'
import { Alert, AmountField, Button, Card, CardTitle, EmptyState, PageLoader, ProgressBar, TextField } from '@/components/ui'
import { useGoals } from '@/hooks/useGoals'
import { useToast } from '@/hooks/useToast'
import { useToday } from '@/hooks/useToday'
import { formatDate } from '@/lib/dates'
import { goalProgress } from '@/lib/goals'
import { formatSAR, parseAmount } from '@/lib/money'
import type { NewSavingsGoal, SavingsGoal } from '@/types/domain'

export default function GoalsPage() {
  const today = useToday()
  const { data, loading, error, add, update, adjust, remove } = useGoals()
  const toast = useToast()

  if (error && !data) return <Alert tone="error">{error.message}</Alert>
  if (loading && !data) return <PageLoader />
  const goals = data ?? []
  const totalSaved = goals.reduce((s, g) => s + g.currentAmount, 0)

  return (
    <div className="space-y-4">
      <PageHeader title="أهداف الادخار" subtitle="حدد هدفك وموعده، ونحسب لك كم تحتاج تحوّل كل شهر." />
      {goals.length > 0 && <Alert tone="success">مجموع مدخراتك في الأهداف: <b>{formatSAR(totalSaved)}</b></Alert>}

      <AddGoalCard today={today} onAdd={async (g) => { await add(g); toast.show('تمت إضافة الهدف ✓') }} />

      {goals.length === 0 ? (
        <Card><EmptyState icon="🎯" title="ما عندك أهداف بعد">ابدأ بصندوق طوارئ يغطي 3 أشهر من مصاريفك.</EmptyState></Card>
      ) : (
        <ul className="space-y-3" data-testid="goal-list">
          {goals.map((g) => (
            <li key={g.id}>
              <GoalCard goal={g} today={today}
                onUpdate={async (patch) => { await update(g.id, patch); toast.show('تم تعديل الهدف ✓') }}
                onAdjust={async (delta) => {
                  await adjust(g.id, delta)
                  toast.show(delta > 0 ? `تم إيداع ${formatSAR(delta)} ✓` : `تم سحب ${formatSAR(-delta)}`)
                }}
                onDelete={async () => {
                  if (!window.confirm(`تحذف هدف «${g.name}»؟`)) return
                  try { await remove(g.id); toast.show('تم حذف الهدف') } catch (e) { toast.show((e as Error).message, 'error') }
                }} />
            </li>
          ))}
        </ul>
      )}
    </div>
  )
}

function GoalCard({ goal, today, onAdjust, onDelete, onUpdate }: {
  goal: SavingsGoal; today: string; onAdjust: (d: number) => Promise<void>; onDelete: () => void
  onUpdate: (p: { name: string; targetAmount: number; targetDate: string | null }) => Promise<void>
}) {
  const [editing, setEditing] = useState(false)
  const p = goalProgress(goal, today)
  const [amount, setAmount] = useState('')
  const [error, setError] = useState<string | null>(null)
  const [busy, setBusy] = useState(false)

  const act = async (sign: 1 | -1) => {
    const v = parseAmount(amount)
    if (v === null) return setError('اكتب مبلغًا صحيحًا.')
    setError(null)
    setBusy(true)
    try {
      await onAdjust(sign * v)
      setAmount('')
    } catch (e) {
      setError((e as Error).message)
    } finally {
      setBusy(false)
    }
  }

  if (editing) {
    return (
      <Card aria-label={`تعديل هدف ${goal.name}`}>
        <GoalForm today={today} initial={goal} submitLabel="حفظ التعديل" onCancel={() => setEditing(false)}
          onSubmit={async (g) => { await onUpdate({ name: g.name, targetAmount: g.targetAmount, targetDate: g.targetDate }); setEditing(false) }} />
      </Card>
    )
  }
  return (
    <Card aria-label={`هدف ${goal.name}`}>
      <div className="flex items-start justify-between gap-2">
        <div className="min-w-0">
          <h3 className="text-lg font-bold">{goal.name} {p.status === 'done' && '🎉'}</h3>
          <p className="text-sm text-ink-600">{formatSAR(goal.currentAmount)} من {formatSAR(goal.targetAmount)}</p>
        </div>
        <div className="flex shrink-0 items-center">
          <button onClick={() => setEditing(true)} className="rounded-lg px-2 py-2 text-xs font-bold text-brand-600 hover:bg-brand-50" aria-label={`تعديل هدف ${goal.name}`}>تعديل</button>
          <button onClick={onDelete} className="rounded-lg p-2 text-ink-500 hover:bg-danger-50 hover:text-danger-600" aria-label={`حذف هدف ${goal.name}`}><TrashIcon className="size-5" /></button>
        </div>
      </div>
      <div className="mt-3"><ProgressBar label={`تقدم هدف ${goal.name}`} value={p.ratio} /></div>
      <p className="mt-2 text-xs text-ink-600">
        {p.status === 'done' && 'وصلت لهدفك! 👏'}
        {p.status === 'no_date' && `باقي ${formatSAR(p.remaining)} · حدد موعدًا لنحسب المبلغ الشهري.`}
        {p.status === 'on_track' && `باقي ${formatSAR(p.remaining)} · تحتاج ${formatSAR(p.monthlyNeeded ?? 0)} شهريًا حتى ${formatDate(goal.targetDate!)}`}
        {p.status === 'past_due' && <span className="text-danger-600">فات الموعد ({formatDate(goal.targetDate!)}) · باقي {formatSAR(p.remaining)}</span>}
      </p>
      <div className="mt-3 flex items-end gap-2">
        <AmountField className="flex-1" label="المبلغ" value={amount} onChange={(e) => setAmount(e.target.value)} placeholder="0" error={error} />
        <Button size="sm" className="mb-[2px] min-h-12" loading={busy} onClick={() => void act(1)}>إيداع</Button>
        <Button size="sm" variant="secondary" className="mb-[2px] min-h-12" disabled={busy || goal.currentAmount <= 0} onClick={() => void act(-1)}>سحب</Button>
      </div>
    </Card>
  )
}

function AddGoalCard({ today, onAdd }: { today: string; onAdd: (g: NewSavingsGoal) => Promise<void> }) {
  const [open, setOpen] = useState(false)
  if (!open) return <Button block onClick={() => setOpen(true)}>+ هدف ادخار جديد</Button>
  return (
    <Card aria-labelledby="add-goal-title">
      <CardTitle><span id="add-goal-title">هدف جديد</span></CardTitle>
      <GoalForm today={today} submitLabel="حفظ الهدف" onCancel={() => setOpen(false)}
        onSubmit={async (g) => { await onAdd(g); setOpen(false) }} />
    </Card>
  )
}

/** نموذج مشترك: إضافة هدف (مع المبلغ الحالي) أو تعديل هدف (الاسم والمستهدف والموعد؛ الرصيد يتغير بالإيداع/السحب فقط). */
function GoalForm({ today, initial, submitLabel, onSubmit, onCancel }: {
  today: string; initial?: SavingsGoal; submitLabel: string
  onSubmit: (g: NewSavingsGoal) => Promise<void>; onCancel: () => void
}) {
  const [name, setName] = useState(initial?.name ?? '')
  const [target, setTarget] = useState(initial ? String(initial.targetAmount) : '')
  const [current, setCurrent] = useState('')
  const [date, setDate] = useState(initial?.targetDate ?? '')
  const [error, setError] = useState<string | null>(null)
  const [saving, setSaving] = useState(false)

  const submit = async (e: FormEvent) => {
    e.preventDefault()
    const t = parseAmount(target)
    const c = initial ? initial.currentAmount : current.trim() ? parseAmount(current, { allowZero: true }) : 0
    if (!name.trim()) return setError('اكتب اسم الهدف.')
    if (t === null) return setError('المبلغ المستهدف لازم يكون أكبر من صفر.')
    if (c === null) return setError('المبلغ الحالي غير صحيح.')
    if (date && date <= today && date !== initial?.targetDate) return setError('موعد الهدف لازم يكون في المستقبل.')
    setError(null)
    setSaving(true)
    try {
      await onSubmit({ name: name.trim(), targetAmount: t, currentAmount: c, targetDate: date || null })
    } catch (err) {
      setError((err as Error).message)
      setSaving(false)
    }
  }

  return (
    <form onSubmit={submit} noValidate className="space-y-3">
      <TextField label="اسم الهدف" value={name} onChange={(e) => setName(e.target.value)} maxLength={100} placeholder="مثال: صندوق الطوارئ، دفعة سيارة" autoFocus />
      <div className="grid grid-cols-2 gap-3">
        <AmountField label="المبلغ المستهدف" value={target} onChange={(e) => setTarget(e.target.value)} placeholder="20000" />
        {!initial && <AmountField label="المجمّع حاليًا" value={current} onChange={(e) => setCurrent(e.target.value)} placeholder="0" />}
      </div>
      <TextField label="الموعد المستهدف (اختياري)" type="date" min={today} value={date} onChange={(e) => setDate(e.target.value)} />
      {error && <Alert tone="error">{error}</Alert>}
      <div className="flex gap-2">
        <Button type="submit" className="flex-1" loading={saving}>{submitLabel}</Button>
        <Button type="button" variant="ghost" onClick={onCancel}>إلغاء</Button>
      </div>
    </form>
  )
}
