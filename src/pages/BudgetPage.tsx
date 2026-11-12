import { useEffect, useMemo, useRef, useState, type FormEvent } from 'react'
import { Link, useLocation } from 'react-router-dom'
import { TrashIcon } from '@/components/icons/Icons'
import { PageHeader } from '@/components/layout/AppLayout'
import { Alert, AmountField, Button, Card, CardTitle, EmptyState, PageLoader, ProgressBar, SelectField, Stat, TextField } from '@/components/ui'
import { useCommitments } from '@/hooks/useCommitments'
import { useBudgetLimits, useMonthExpenses, useProfile } from '@/hooks/useFinance'
import { useToast } from '@/hooks/useToast'
import { useToday } from '@/hooks/useToday'
import { summarizeMonth } from '@/lib/budget'
import { fixedMonthlyCosts, nextMonthlyDate } from '@/lib/commitments'
import { formatShortDate, monthRange } from '@/lib/dates'
import { CATEGORY_EMOJI, CATEGORY_LABELS, KIND_LABELS } from '@/lib/labels'
import { formatSAR, parseAmount } from '@/lib/money'
import { EXPENSE_CATEGORIES, type Commitment, type CommitmentKind, type Expense, type ExpenseCategory, type ExpensePatch, type NewCommitment, type Profile } from '@/types/domain'


export default function BudgetPage() {
  const today = useToday()
  const profile = useProfile()
  const expenses = useMonthExpenses(today)
  const limits = useBudgetLimits()
  const commitments = useCommitments()
  const toast = useToast()

  const summary = useMemo(() => profile.data && expenses.data && limits.data && commitments.data
    ? summarizeMonth({ income: profile.data.monthlyIncome, savingsTarget: profile.data.savingsTarget, expenses: expenses.data, limits: limits.data, commitments: commitments.data, today })
    : null, [profile.data, expenses.data, limits.data, commitments.data, today])

  const error = profile.error ?? expenses.error ?? limits.error ?? commitments.error
  if (error && !summary) return <Alert tone="error">{error.message}</Alert>
  if (!summary || !profile.data || !expenses.data || !limits.data) return <PageLoader />

  const remove = async (id: string) => {
    if (!window.confirm('تحذف هذا المصروف؟')) return
    try {
      await expenses.remove(id)
      toast.show('تم حذف المصروف')
    } catch (e) {
      toast.show((e as Error).message, 'error')
    }
  }

  return (
    <div className="space-y-4">
      <PageHeader title="الميزانية والمصاريف" subtitle="سجّل مصاريفك أول بأول وحدد سقفًا لكل فئة." />
      <Link to="/reports" className="-mt-2 inline-block text-sm font-bold text-brand-600">📊 التقارير والإحصائيات ←</Link>

      <Card>
        <div className="grid grid-cols-2 gap-2.5">
          <Stat label="الدخل الشهري" value={formatSAR(summary.income)} tone="ink" />
          <Stat label="المصروف هذا الشهر" value={formatSAR(summary.spent)} tone={summary.remaining < 0 ? 'danger' : 'ink'} />
          <Stat label="التزامات باقية هذا الشهر" value={formatSAR(summary.pendingCommitments)} tone={summary.pendingCommitments > 0 ? 'warn' : 'ink'} />
          <Stat label="المتبقي بعد الالتزامات والادخار" value={formatSAR(summary.availableAfterSavings)} tone={summary.availableAfterSavings < 0 ? 'danger' : 'brand'} />
        </div>
        {summary.income > 0 && (
          <div className="mt-4 space-y-1.5">
            <div className="flex justify-between text-xs text-ink-600">
              <span>نسبة المصاريف والالتزامات إلى الدخل</span>
              <span data-testid="committed-ratio">{Math.round(summary.committedRatio * 100)}%</span>
            </div>
            <ProgressBar label="نسبة المصاريف والالتزامات إلى الدخل" value={summary.committedRatio}
              tone={summary.committedRatio > 1 ? 'danger' : summary.committedRatio >= 0.85 ? 'warn' : 'brand'} />
            <p className="text-xs text-ink-600">مصروفك اليومي المقترح لبقية الشهر: <b>{formatSAR(summary.dailyAllowance)}</b></p>
          </div>
        )}
      </Card>

      <FixedCostsCard commitments={commitments.data ?? []} today={today} income={summary.income}
        onAdd={async (c) => { await commitments.add(c); toast.show('تمت إضافة التكلفة الثابتة ✓') }} />

      <AddExpenseCard today={today} onAdd={async (e) => { await expenses.add(e); toast.show('تمت إضافة المصروف ✓') }} />

      <Card>
        <CardTitle>حسب الفئة</CardTitle>
        <CategoryLimits summary={summary} onSave={async (cat, value) => { await limits.set(cat, value); toast.show('تم حفظ الحد') }} />
      </Card>

      <Card>
        <CardTitle>مصاريف الشهر ({expenses.data.length})</CardTitle>
        {expenses.data.length === 0 ? (
          <EmptyState icon="🧾" title="ما سجّلت مصاريف هذا الشهر">ابدأ من نموذج «سجّل مصروف» فوق.</EmptyState>
        ) : (
          <ul className="divide-y divide-ink-100" data-testid="expense-list">
            {expenses.data.map((e) => (
              <ExpenseRow key={e.id} expense={e} today={today}
                onDelete={() => void remove(e.id)}
                onSave={async (patch) => { await expenses.update(e.id, patch); toast.show('تم تعديل المصروف ✓') }} />
            ))}
          </ul>
        )}
      </Card>

      <IncomeSettingsCard profile={profile.data} onSave={async (p) => { await profile.update(p); toast.show('تم حفظ إعدادات الدخل ✓') }} />
    </div>
  )
}

function AddExpenseCard({ today, onAdd }: { today: string; onAdd: (e: { amount: number; category: ExpenseCategory; note: string | null; spentOn: string }) => Promise<void> }) {
  const [amount, setAmount] = useState('')
  const [category, setCategory] = useState<ExpenseCategory>('food')
  const [note, setNote] = useState('')
  const [date, setDate] = useState(today)
  const [error, setError] = useState<string | null>(null)
  const [saving, setSaving] = useState(false)
  const amountRef = useRef<HTMLInputElement>(null)
  const location = useLocation()
  const { from } = monthRange(today)

  useEffect(() => {
    if (location.hash === '#add') amountRef.current?.focus()
  }, [location.hash])

  const submit = async (e: FormEvent) => {
    e.preventDefault()
    const value = parseAmount(amount)
    if (value === null) return setError('اكتب مبلغًا صحيحًا أكبر من صفر (مثال: 45 أو ٤٥٫٥).')
    if (date > today) return setError('ما تقدر تسجل مصروف بتاريخ مستقبلي.')
    setError(null)
    setSaving(true)
    try {
      await onAdd({ amount: value, category, note: note.trim() || null, spentOn: date })
      setAmount('')
      setNote('')
      amountRef.current?.focus()
    } catch (err) {
      setError((err as Error).message)
    } finally {
      setSaving(false)
    }
  }

  return (
    <Card id="add" aria-labelledby="add-expense-title">
      <CardTitle><span id="add-expense-title">سجّل مصروف</span></CardTitle>
      <form onSubmit={submit} noValidate className="space-y-3">
        <div className="grid grid-cols-2 gap-3">
          <AmountField ref={amountRef} label="المبلغ (ر.س)" placeholder="0" value={amount} onChange={(e) => setAmount(e.target.value)} />
          <SelectField label="الفئة" value={category} onChange={(e) => setCategory(e.target.value as ExpenseCategory)}>
            {EXPENSE_CATEGORIES.map((c) => <option key={c} value={c}>{CATEGORY_LABELS[c]}</option>)}
          </SelectField>
        </div>
        <div className="grid grid-cols-2 gap-3">
          <TextField label="ملاحظة (اختياري)" value={note} onChange={(e) => setNote(e.target.value)} maxLength={200} placeholder="مثال: قهوة" />
          <TextField label="التاريخ" type="date" value={date} min={from} max={today} onChange={(e) => setDate(e.target.value)} />
        </div>
        {error && <Alert tone="error">{error}</Alert>}
        <Button type="submit" block loading={saving}>إضافة المصروف</Button>
      </form>
    </Card>
  )
}

function CategoryLimits({ summary, onSave }: { summary: ReturnType<typeof summarizeMonth>; onSave: (c: ExpenseCategory, v: number | null) => Promise<void> }) {
  const [editing, setEditing] = useState<ExpenseCategory | null>(null)
  const [value, setValue] = useState('')
  const [error, setError] = useState<string | null>(null)
  const [newCat, setNewCat] = useState<ExpenseCategory | ''>('')
  const shown = new Set(summary.categories.map((c) => c.category))
  const available = EXPENSE_CATEGORIES.filter((c) => !shown.has(c))

  const save = async (cat: ExpenseCategory) => {
    const v = value.trim() === '' ? null : parseAmount(value)
    if (value.trim() !== '' && v === null) return setError('مبلغ غير صحيح.')
    try {
      await onSave(cat, v)
      setEditing(null)
      setError(null)
    } catch (e) {
      setError((e as Error).message)
    }
  }
  const startEdit = (cat: ExpenseCategory, current: number | null) => {
    setEditing(cat)
    setValue(current ? String(current) : '')
    setError(null)
  }

  return (
    <div className="space-y-4">
      {summary.categories.length === 0 && <p className="text-sm text-ink-500">سجّل مصاريف أو حدد سقفًا لفئة لتظهر هنا.</p>}
      {summary.categories.map((c) => (
        <div key={c.category}>
          <div className="mb-1 flex items-center justify-between gap-2 text-sm">
            <span className="font-semibold">{CATEGORY_EMOJI[c.category]} {CATEGORY_LABELS[c.category]}</span>
            <span className="text-ink-600">
              {formatSAR(c.spent)}{c.limit ? ` / ${formatSAR(c.limit)}` : ''}
              <button className="ms-2 text-xs font-bold text-brand-600" onClick={() => startEdit(c.category, c.limit)}>{c.limit ? 'تعديل' : 'حدد سقف'}</button>
            </span>
          </div>
          {c.limit && <ProgressBar label={`استهلاك حد ${CATEGORY_LABELS[c.category]}`} value={c.ratio ?? 0} tone={c.status === 'over' ? 'danger' : c.status === 'near' ? 'warn' : 'brand'} />}
          {editing === c.category && (
            <div className="mt-2 flex items-end gap-2">
              <AmountField className="flex-1" label={`السقف الشهري لـ${CATEGORY_LABELS[c.category]}`} value={value} onChange={(e) => setValue(e.target.value)} hint="اتركه فاضي لإلغاء السقف" error={error} autoFocus />
              <Button size="sm" className="mb-5" onClick={() => void save(c.category)}>حفظ</Button>
            </div>
          )}
        </div>
      ))}
      {available.length > 0 && editing === null && (
        <div className="flex items-end gap-2 border-t border-ink-100 pt-3">
          <SelectField className="flex-1" label="إضافة سقف لفئة" value={newCat} onChange={(e) => setNewCat(e.target.value as ExpenseCategory)}>
            <option value="">اختر فئة…</option>
            {available.map((c) => <option key={c} value={c}>{CATEGORY_LABELS[c]}</option>)}
          </SelectField>
          <Button size="sm" variant="secondary" disabled={!newCat} onClick={() => newCat && startEdit(newCat, null)} className="mb-1">التالي</Button>
        </div>
      )}
      {editing && !shown.has(editing) && (
        <div className="flex items-end gap-2">
          <AmountField className="flex-1" label={`السقف الشهري لـ${CATEGORY_LABELS[editing]}`} value={value} onChange={(e) => setValue(e.target.value)} error={error} autoFocus />
          <Button size="sm" className="mb-1" onClick={() => void save(editing).then(() => setNewCat(''))}>حفظ</Button>
        </div>
      )}
    </div>
  )
}

function IncomeSettingsCard({ profile, onSave }: { profile: Profile; onSave: (p: Partial<Profile>) => Promise<void> }) {
  const [income, setIncome] = useState(String(profile.monthlyIncome || ''))
  const [saving, setSaving] = useState(String(profile.savingsTarget || ''))
  const [payday, setPayday] = useState(String(profile.payday))
  const [error, setError] = useState<string | null>(null)
  const [busy, setBusy] = useState(false)

  const submit = async (e: FormEvent) => {
    e.preventDefault()
    const inc = income.trim() === '' ? 0 : parseAmount(income, { allowZero: true })
    const sav = saving.trim() === '' ? 0 : parseAmount(saving, { allowZero: true })
    const day = Number(payday)
    if (inc === null || sav === null) return setError('تأكد من المبالغ المدخلة.')
    if (!Number.isInteger(day) || day < 1 || day > 31) return setError('يوم الراتب بين 1 و 31.')
    if (inc > 0 && sav > inc) return setError('هدف الادخار أكبر من الدخل.')
    setError(null)
    setBusy(true)
    try {
      await onSave({ monthlyIncome: inc, savingsTarget: sav, payday: day })
    } catch (err) {
      setError((err as Error).message)
    } finally {
      setBusy(false)
    }
  }

  return (
    <Card aria-labelledby="income-title">
      <CardTitle><span id="income-title">الدخل والادخار</span></CardTitle>
      <form onSubmit={submit} noValidate className="space-y-3">
        <div className="grid grid-cols-2 gap-3">
          <AmountField label="الدخل الشهري (ر.س)" value={income} onChange={(e) => setIncome(e.target.value)} placeholder="مثال: 9000" />
          <AmountField label="هدف الادخار الشهري" value={saving} onChange={(e) => setSaving(e.target.value)} placeholder="مثال: 1000" />
        </div>
        <TextField label="يوم نزول الراتب" type="number" inputMode="numeric" min={1} max={31} value={payday} onChange={(e) => setPayday(e.target.value)} hint="نذكّرك فيه تحوّل مبلغ الادخار أول." />
        {error && <Alert tone="error">{error}</Alert>}
        <Button type="submit" variant="secondary" block loading={busy}>حفظ</Button>
      </form>
    </Card>
  )
}

function ExpenseRow({ expense: e, today, onDelete, onSave }: { expense: Expense; today: string; onDelete: () => void; onSave: (p: ExpensePatch) => Promise<void> }) {
  const [editing, setEditing] = useState(false)
  const [amount, setAmount] = useState(String(e.amount))
  const [category, setCategory] = useState<ExpenseCategory>(e.category)
  const [note, setNote] = useState(e.note ?? '')
  const [date, setDate] = useState(e.spentOn)
  const [error, setError] = useState<string | null>(null)
  const [saving, setSaving] = useState(false)
  const label = e.note || CATEGORY_LABELS[e.category]

  const save = async (ev: FormEvent) => {
    ev.preventDefault()
    const value = parseAmount(amount)
    if (value === null) return setError('اكتب مبلغًا صحيحًا أكبر من صفر.')
    if (date > today) return setError('ما تقدر تسجل مصروف بتاريخ مستقبلي.')
    setSaving(true)
    setError(null)
    try {
      await onSave({ amount: value, category, note: note.trim() || null, spentOn: date })
      setEditing(false)
    } catch (err) {
      setError((err as Error).message)
    } finally {
      setSaving(false)
    }
  }

  if (editing) {
    return (
      <li className="py-3">
        <form onSubmit={save} noValidate className="space-y-3 rounded-xl bg-surface p-3" aria-label={`تعديل ${label}`}>
          <div className="grid grid-cols-2 gap-3">
            <AmountField label="المبلغ" value={amount} onChange={(x) => setAmount(x.target.value)} autoFocus />
            <SelectField label="الفئة" value={category} onChange={(x) => setCategory(x.target.value as ExpenseCategory)}>
              {EXPENSE_CATEGORIES.map((c) => <option key={c} value={c}>{CATEGORY_LABELS[c]}</option>)}
            </SelectField>
            <TextField label="الملاحظة" value={note} onChange={(x) => setNote(x.target.value)} maxLength={200} />
            <TextField label="التاريخ" type="date" value={date} max={today} onChange={(x) => setDate(x.target.value)} />
          </div>
          {error && <Alert tone="error">{error}</Alert>}
          <div className="flex gap-2">
            <Button type="submit" size="sm" className="flex-1" loading={saving}>حفظ التعديل</Button>
            <Button type="button" size="sm" variant="ghost" onClick={() => setEditing(false)}>إلغاء</Button>
          </div>
        </form>
      </li>
    )
  }
  return (
    <li className="flex items-center gap-2 py-2.5">
      <span aria-hidden className="text-xl">{CATEGORY_EMOJI[e.category]}</span>
      <div className="min-w-0 flex-1">
        <p className="truncate font-medium">{label}</p>
        <p className="text-xs text-ink-500">{CATEGORY_LABELS[e.category]} · {formatShortDate(e.spentOn)}</p>
      </div>
      <span className="shrink-0 font-bold">{formatSAR(e.amount)}</span>
      <button onClick={() => setEditing(true)} className="shrink-0 rounded-lg px-2 py-2 text-xs font-bold text-brand-600 hover:bg-brand-50" aria-label={`تعديل ${label}`}>تعديل</button>
      <button onClick={onDelete} className="shrink-0 rounded-lg p-2 text-ink-500 hover:bg-danger-50 hover:text-danger-600" aria-label={`حذف ${label}`}>
        <TrashIcon className="size-5" />
      </button>
    </li>
  )
}

const FIXED_KINDS: CommitmentKind[] = ['bill', 'installment', 'other']

function FixedCostsCard({ commitments, today, income, onAdd }: { commitments: Commitment[]; today: string; income: number; onAdd: (c: NewCommitment) => Promise<void> }) {
  const { items, total } = fixedMonthlyCosts(commitments)
  const [open, setOpen] = useState(false)
  const [title, setTitle] = useState('')
  const [amount, setAmount] = useState('')
  const [day, setDay] = useState('1')
  const [kind, setKind] = useState<CommitmentKind>('bill')
  const [error, setError] = useState<string | null>(null)
  const [saving, setSaving] = useState(false)

  const submit = async (e: FormEvent) => {
    e.preventDefault()
    const amt = parseAmount(amount)
    const d = Number(day)
    if (!title.trim()) return setError('اكتب اسم التكلفة (مثال: الإيجار).')
    if (amt === null) return setError('اكتب مبلغًا صحيحًا.')
    if (!Number.isInteger(d) || d < 1 || d > 31) return setError('يوم الاستحقاق بين 1 و 31.')
    setSaving(true)
    setError(null)
    try {
      await onAdd({ title: title.trim(), kind, dueDate: nextMonthlyDate(today, d), dueTime: null, amount: amt, recurrence: 'monthly', notes: null })
      setTitle(''); setAmount(''); setOpen(false)
    } catch (err) {
      setError((err as Error).message)
    } finally {
      setSaving(false)
    }
  }

  return (
    <Card aria-labelledby="fixed-title">
      <CardTitle action={<Link to="/commitments" className="text-sm font-bold text-brand-600">إدارة</Link>}>
        <span id="fixed-title">التكاليف الثابتة الشهرية</span>
      </CardTitle>
      {items.length === 0 ? (
        <p className="text-sm text-ink-500">أضف الإيجار وقسط السيارة والفواتير الثابتة؛ تُخصم تلقائيًا من المتبقي حتى تسددها.</p>
      ) : (
        <>
          <ul className="divide-y divide-ink-100" data-testid="fixed-costs">
            {items.map((c) => (
              <li key={c.id} className="flex items-center justify-between gap-2 py-2 text-sm">
                <span className="min-w-0 truncate"><b>{c.title}</b> <span className="text-xs text-ink-500">· {KIND_LABELS[c.kind]} · يوم {Number(c.dueDate.slice(8))}</span></span>
                <span className="shrink-0 font-bold">{formatSAR(c.amount ?? 0)}</span>
              </li>
            ))}
          </ul>
          <div className="mt-2 flex justify-between border-t border-ink-100 pt-2 text-sm font-bold">
            <span>المجموع{income > 0 ? ` (${Math.round((total / income) * 100)}% من الدخل)` : ''}</span>
            <span data-testid="fixed-total">{formatSAR(total)}</span>
          </div>
        </>
      )}
      {open ? (
        <form onSubmit={submit} noValidate className="mt-3 space-y-3">
          <div className="grid grid-cols-2 gap-3">
            <TextField label="اسم التكلفة" value={title} onChange={(e) => setTitle(e.target.value)} maxLength={120} placeholder="الإيجار" autoFocus />
            <AmountField label="المبلغ الشهري" value={amount} onChange={(e) => setAmount(e.target.value)} placeholder="0" />
            <TextField label="يوم الاستحقاق" type="number" inputMode="numeric" min={1} max={31} value={day} onChange={(e) => setDay(e.target.value)} />
            <SelectField label="النوع" value={kind} onChange={(e) => setKind(e.target.value as CommitmentKind)}>
              {FIXED_KINDS.map((k) => <option key={k} value={k}>{KIND_LABELS[k]}</option>)}
            </SelectField>
          </div>
          {error && <Alert tone="error">{error}</Alert>}
          <div className="flex gap-2">
            <Button type="submit" size="sm" className="flex-1" loading={saving}>إضافة</Button>
            <Button type="button" size="sm" variant="ghost" onClick={() => setOpen(false)}>إلغاء</Button>
          </div>
        </form>
      ) : (
        <Button variant="secondary" size="sm" block className="mt-3" onClick={() => setOpen(true)}>+ تكلفة ثابتة</Button>
      )}
    </Card>
  )
}
