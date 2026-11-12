import clsx from 'clsx'
import { useState, type FormEvent } from 'react'
import { CheckIcon, TrashIcon } from '@/components/icons/Icons'
import { PageHeader } from '@/components/layout/AppLayout'
import { Alert, AmountField, Button, Card, CardTitle, EmptyState, PageLoader, SelectField, TextField } from '@/components/ui'
import { useCommitments } from '@/hooks/useCommitments'
import { useProfile } from '@/hooks/useFinance'
import { useToast } from '@/hooks/useToast'
import { useToday } from '@/hooks/useToday'
import { amountDueUntil, dueStatus, sortCommitments, type DueStatus } from '@/lib/commitments'
import { addDays, daysBetween, formatDate, isISODate, relativeDayLabel } from '@/lib/dates'
import { KIND_LABELS, RECURRENCE_LABELS } from '@/lib/labels'
import { formatSAR, parseAmount } from '@/lib/money'
import { COMMITMENT_KINDS, RECURRENCES, type Commitment, type CommitmentKind, type NewCommitment, type Recurrence } from '@/types/domain'

const BADGE: Record<DueStatus, string> = {
  overdue: 'bg-danger-50 text-danger-600',
  today: 'bg-warn-50 text-warn-600',
  soon: 'bg-info-50 text-info-600',
  upcoming: 'bg-ink-100 text-ink-600',
  later: 'bg-ink-100 text-ink-600',
  done: 'bg-brand-50 text-brand-700',
}

type Filter = 'open' | 'done'

export default function CommitmentsPage() {
  const today = useToday()
  const { data, loading, error, add, update, complete, reopen, remove } = useCommitments()
  const profile = useProfile()
  const alertDays = profile.data?.alertDays ?? 3
  const toast = useToast()
  const [filter, setFilter] = useState<Filter>('open')

  if (error && !data) return <Alert tone="error">{error.message}</Alert>
  if (loading && !data) return <PageLoader />
  const list = sortCommitments((data ?? []).filter((c) => (filter === 'open' ? !c.done : c.done)))
  const due30 = amountDueUntil(data ?? [], addDays(today, 30))

  const safe = (fn: () => Promise<unknown>, okMsg: string) => async () => {
    try {
      await fn()
      toast.show(okMsg)
    } catch (e) {
      toast.show((e as Error).message, 'error')
    }
  }

  return (
    <div className="space-y-4">
      <PageHeader title="الالتزامات والمواعيد" subtitle="فواتير، أقساط، تجديدات، ومواعيد — ما يفوتك شي." />
      {due30 > 0 && <Alert tone="info">مجموع المستحق خلال 30 يوم (شامل المتأخر): <b>{formatSAR(due30)}</b></Alert>}

      <AddCommitmentCard today={today} onAdd={async (c) => { await add(c); toast.show('تمت إضافة الالتزام ✓') }} />

      <Card>
        <div role="tablist" aria-label="تصفية الالتزامات" className="mb-3 grid grid-cols-2 gap-1 rounded-xl bg-ink-100 p-1">
          {(['open', 'done'] as const).map((f) => (
            <button key={f} role="tab" aria-selected={filter === f} onClick={() => setFilter(f)}
              className={clsx('rounded-lg py-2 text-sm font-bold', filter === f ? 'bg-white text-ink-900 shadow-sm' : 'text-ink-500')}>
              {f === 'open' ? 'القادمة' : 'المنجزة'}
            </button>
          ))}
        </div>
        {list.length === 0 ? (
          <EmptyState icon={filter === 'open' ? '🗓️' : '✅'} title={filter === 'open' ? 'ما عندك التزامات قادمة' : 'ما فيه التزامات منجزة'} />
        ) : (
          <ul className="divide-y divide-ink-100" data-testid="commitment-list">
            {list.map((c) => (
              <CommitmentRow key={c.id} c={c} today={today} alertDays={alertDays}
                onSave={async (patch) => { await update(c.id, patch); toast.show('تم تعديل الالتزام ✓') }}
                onComplete={async () => {
                  const logExpense = !!c.amount && window.confirm(`تسجّل ${formatSAR(c.amount ?? 0)} كمصروف اليوم في الميزانية؟`)
                  const base = c.recurrence === 'none' ? 'أحسنت! تم ✓' : 'تم — انتقل للموعد القادم ✓'
                  await safe(() => complete(c, { logExpense, today }), logExpense ? `${base} وسُجّل كمصروف` : base)()
                }}
                onReopen={safe(() => reopen(c.id), 'تمت الإعادة للقائمة')}
                onDelete={async () => { if (window.confirm(`تحذف «${c.title}»؟`)) await safe(() => remove(c.id), 'تم الحذف')() }} />
            ))}
          </ul>
        )}
      </Card>
    </div>
  )
}

function CommitmentRow({ c, today, alertDays, onComplete, onReopen, onDelete, onSave }: {
  c: Commitment; today: string; alertDays: number; onComplete: () => void; onReopen: () => void; onDelete: () => void
  onSave: (patch: NewCommitment) => Promise<void>
}) {
  const [editing, setEditing] = useState(false)
  const status = dueStatus(c, today, alertDays)
  if (editing) {
    return (
      <li className="py-3" aria-label={`تعديل ${c.title}`}>
        <div className="rounded-xl bg-surface p-3">
          <CommitmentForm today={today} initial={c} submitLabel="حفظ التعديل" onCancel={() => setEditing(false)}
            onSubmit={async (patch) => { await onSave(patch); setEditing(false) }} />
        </div>
      </li>
    )
  }
  return (
    <li className="flex items-start gap-3 py-3">
      <button onClick={c.done ? onReopen : onComplete}
        aria-label={c.done ? `إعادة فتح ${c.title}` : `تم ${c.title}`}
        className={clsx('mt-0.5 flex size-7 shrink-0 items-center justify-center rounded-full border-2',
          c.done ? 'border-brand-500 bg-brand-500 text-white' : 'border-ink-300 text-transparent hover:border-brand-500 hover:text-brand-500')}>
        <CheckIcon className="size-4" />
      </button>
      <div className="min-w-0 flex-1">
        <p className={clsx('font-semibold', c.done && 'text-ink-500 line-through')}>{c.title}</p>
        <p className="mt-0.5 text-xs text-ink-500">
          {KIND_LABELS[c.kind]} · {formatDate(c.dueDate)}{c.dueTime ? ` · ${c.dueTime}` : ''}
          {c.recurrence !== 'none' && ` · ${RECURRENCE_LABELS[c.recurrence]} 🔁`}
        </p>
        {c.notes && <p className="mt-1 text-xs text-ink-600">{c.notes}</p>}
        <div className="mt-1.5 flex flex-wrap items-center gap-2">
          {!c.done && <span className={clsx('rounded-full px-2.5 py-0.5 text-xs font-semibold', BADGE[status])}>{relativeDayLabel(daysBetween(today, c.dueDate))}</span>}
          {c.amount ? <span className="text-sm font-bold">{formatSAR(c.amount)}</span> : null}
        </div>
      </div>
      <button onClick={() => setEditing(true)} className="shrink-0 rounded-lg px-2 py-2 text-xs font-bold text-brand-600 hover:bg-brand-50" aria-label={`تعديل ${c.title}`}>تعديل</button>
      <button onClick={onDelete} className="shrink-0 rounded-lg p-2 text-ink-500 hover:bg-danger-50 hover:text-danger-600" aria-label={`حذف ${c.title}`}>
        <TrashIcon className="size-5" />
      </button>
    </li>
  )
}

function AddCommitmentCard({ today, onAdd }: { today: string; onAdd: (c: NewCommitment) => Promise<void> }) {
  const [open, setOpen] = useState(false)
  if (!open) return <Button block onClick={() => setOpen(true)}>+ إضافة التزام أو موعد</Button>
  return (
    <Card aria-labelledby="add-commitment-title">
      <CardTitle><span id="add-commitment-title">التزام جديد</span></CardTitle>
      <CommitmentForm today={today} submitLabel="حفظ" onCancel={() => setOpen(false)}
        onSubmit={async (c) => { await onAdd(c); setOpen(false) }} />
    </Card>
  )
}

/** نموذج مشترك للإضافة والتعديل. */
function CommitmentForm({ today, initial, submitLabel, onSubmit, onCancel }: {
  today: string; initial?: Commitment; submitLabel: string
  onSubmit: (c: NewCommitment) => Promise<void>; onCancel: () => void
}) {
  const [title, setTitle] = useState(initial?.title ?? '')
  const [kind, setKind] = useState<CommitmentKind>(initial?.kind ?? 'bill')
  const [dueDate, setDueDate] = useState(initial?.dueDate ?? today)
  const [dueTime, setDueTime] = useState(initial?.dueTime ?? '')
  const [amount, setAmount] = useState(initial?.amount ? String(initial.amount) : '')
  const [recurrence, setRecurrence] = useState<Recurrence>(initial?.recurrence ?? 'none')
  const [notes, setNotes] = useState(initial?.notes ?? '')
  const [error, setError] = useState<string | null>(null)
  const [saving, setSaving] = useState(false)

  const submit = async (e: FormEvent) => {
    e.preventDefault()
    if (!title.trim()) return setError('اكتب اسم الالتزام.')
    if (!isISODate(dueDate)) return setError('اختر تاريخًا صحيحًا.')
    const amt = amount.trim() ? parseAmount(amount) : null
    if (amount.trim() && amt === null) return setError('المبلغ غير صحيح.')
    setError(null)
    setSaving(true)
    try {
      await onSubmit({ title: title.trim(), kind, dueDate, dueTime: dueTime || null, amount: amt, recurrence, notes: notes.trim() || null })
    } catch (err) {
      setError((err as Error).message)
      setSaving(false)
    }
  }

  return (
    <form onSubmit={submit} noValidate className="space-y-3">
      <TextField label="الاسم" value={title} onChange={(e) => setTitle(e.target.value)} maxLength={120} placeholder="مثال: تجديد الإقامة، فاتورة الكهرباء" autoFocus />
      <div className="grid grid-cols-2 gap-3">
        <SelectField label="النوع" value={kind} onChange={(e) => setKind(e.target.value as CommitmentKind)}>
          {COMMITMENT_KINDS.map((k) => <option key={k} value={k}>{KIND_LABELS[k]}</option>)}
        </SelectField>
        <SelectField label="التكرار" value={recurrence} onChange={(e) => setRecurrence(e.target.value as Recurrence)}>
          {RECURRENCES.map((r) => <option key={r} value={r}>{RECURRENCE_LABELS[r]}</option>)}
        </SelectField>
        <TextField label="تاريخ الاستحقاق" type="date" value={dueDate} onChange={(e) => setDueDate(e.target.value)} />
        <TextField label="الوقت (اختياري)" type="time" value={dueTime} onChange={(e) => setDueTime(e.target.value)} />
      </div>
      <AmountField label="المبلغ (اختياري)" value={amount} onChange={(e) => setAmount(e.target.value)} placeholder="0" />
      <TextField label="ملاحظات (اختياري)" value={notes} onChange={(e) => setNotes(e.target.value)} maxLength={500} />
      {error && <Alert tone="error">{error}</Alert>}
      <div className="flex gap-2">
        <Button type="submit" className="flex-1" loading={saving}>{submitLabel}</Button>
        <Button type="button" variant="ghost" onClick={onCancel}>إلغاء</Button>
      </div>
    </form>
  )
}
