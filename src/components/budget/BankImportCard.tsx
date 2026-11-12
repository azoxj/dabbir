import { useMemo, useState } from 'react'
import { Alert, Button, Card, CardTitle } from '@/components/ui'
import { previewBankCsv, type BankCsvPreview } from '@/lib/bankCsv'
import type { Expense } from '@/types/domain'

interface Props {
  today: string
  expenses: Expense[]
  onAdd: (entry: { amount: number; category: 'other'; note: string; spentOn: string }) => Promise<void>
}
/** Explicit opt-in bank statement import; raw CSV is parsed in the browser only. */
export function BankImportCard({ today, expenses, onAdd }: Props) {
  const [preview, setPreview] = useState<BankCsvPreview | null>(null)
  const [error, setError] = useState<string | null>(null)
  const [busy, setBusy] = useState(false)
  const existing = useMemo(() => new Set(expenses.map(e =>
    `${e.spentOn}|${(e.note ?? '').trim().toLocaleLowerCase()}|${Math.round(e.amount * 100)}`
  )), [expenses])
  const select = async (file: File | undefined) => {
    setPreview(null); setError(null)
    if (!file) return
    if (file.size > 1024 * 1024) { setError('الحد الأقصى لحجم الملف 1 ميجابايت.'); return }
    try {
      const result = previewBankCsv(await file.text(), existing)
      const month = today.slice(0, 7)
      const eligible = result.transactions.filter(t => t.date.slice(0, 7) === month && t.date <= today)
      setPreview({ ...result, transactions: eligible, rejectedRows: result.rejectedRows + result.transactions.length - eligible.length })
    } catch (e) { setError((e as Error).message) }
  }
  const confirm = async () => {
    if (!preview?.transactions.length || busy) return
    setBusy(true); setError(null)
    let imported = 0
    try {
      for (const item of preview.transactions) {
        await onAdd({ amount: item.amount, category: 'other', note: item.merchant, spentOn: item.date })
        imported++
      }
      setPreview(null)
    } catch (e) {
      setError(`تم تسجيل ${imported} عملية، ثم توقف الاستيراد: ${(e as Error).message}. حدّث الصفحة قبل إعادة المحاولة.`)
      setPreview(null)
    } finally { setBusy(false) }
  }
  return (
    <Card aria-labelledby="bank-import-title">
      <CardTitle><span id="bank-import-title">استيراد كشف حساب بنكي (تجريبي)</span></CardTitle>
      <p className="mb-3 text-sm text-ink-600">اختر ملف CSV بأعمدة date, merchant, amount أو التاريخ، التاجر، المبلغ. يتم تحليل الملف داخل جهازك. يدعم مصاريف الشهر الحالي فقط، ولا يقرأ البطاقة تلقائيًا.</p>
      <label className="block text-sm font-semibold">
        ملف كشف الحساب
        <input aria-label="ملف كشف الحساب CSV" type="file" accept=".csv,text/csv" className="mt-2 block w-full text-sm" disabled={busy} onChange={e => void select(e.target.files?.[0])} />
      </label>
      {error && <div className="mt-3"><Alert tone="error">{error}</Alert></div>}
      {preview && (
        <div className="mt-3 space-y-3">
          <p className="text-sm">جاهزة للمراجعة: <b>{preview.transactions.length}</b> · مكررة: {preview.duplicates} · مستبعدة: {preview.rejectedRows}</p>
          <ul className="max-h-48 overflow-y-auto text-sm" aria-label="معاينة العمليات">
            {preview.transactions.map((t, index) => <li key={t.fingerprint + index} className="border-b border-ink-100 py-2">{t.date} · {t.merchant} · {t.amount.toFixed(2)} ر.س</li>)}
          </ul>
          <p className="text-xs text-ink-600">راجع كل عملية قبل الحفظ. قد تتشابه عمليات شراء صحيحة، والتكرار يعتمد على التاريخ والتاجر والمبلغ.</p>
          <div className="flex gap-2">
            <Button disabled={busy || !preview.transactions.length} loading={busy} onClick={() => void confirm()}>تأكيد تسجيل المصاريف</Button>
            <Button variant="secondary" disabled={busy} onClick={() => setPreview(null)}>إلغاء</Button>
          </div>
        </div>
      )}
    </Card>
  )
}
