import { useRef, useState } from 'react'
import { Alert, Button, Card, CardTitle } from '@/components/ui'
import { useRepository } from '@/hooks/useRepository'
import { useToast } from '@/hooks/useToast'
import { BackupError, exportBackup, importBackup, MAX_BACKUP_BYTES, parseBackup } from '@/lib/backup'
import { todayISO } from '@/lib/dates'

/** تنزيل/استعادة نسخة احتياطية (JSON). لا يرسل أي بيانات لأي خادم. */
export function BackupCard({ onImported }: { onImported?: () => void }) {
  const repo = useRepository()
  const toast = useToast()
  const input = useRef<HTMLInputElement>(null)
  const [busy, setBusy] = useState(false)
  const [error, setError] = useState<string | null>(null)

  const download = async () => {
    setBusy(true)
    setError(null)
    try {
      const data = await exportBackup(repo)
      const blob = new Blob([JSON.stringify(data, null, 2)], { type: 'application/json' })
      const url = URL.createObjectURL(blob)
      const a = document.createElement('a')
      a.href = url
      a.download = `dabbir-backup-${todayISO()}.json`
      document.body.append(a)
      a.click()
      a.remove()
      setTimeout(() => URL.revokeObjectURL(url), 1000)
      toast.show('تم تنزيل النسخة الاحتياطية ✓')
    } catch (e) {
      setError((e as Error).message)
    } finally {
      setBusy(false)
    }
  }

  const restore = async (file: File) => {
    setError(null)
    if (file.size > MAX_BACKUP_BYTES) return setError('الملف كبير جدًا')
    let parsed
    try {
      parsed = parseBackup(await file.text())
    } catch (e) {
      return setError(e instanceof BackupError ? e.message : 'تعذّر قراءة الملف')
    }
    const total = parsed.expenses.length + parsed.commitments.length + parsed.goals.length + parsed.limits.length
    if (!window.confirm(`استعادة ${total} عنصر من النسخة الاحتياطية؟ ستُضاف لبياناتك الحالية ولن يُحذف شيء.`)) return
    setBusy(true)
    try {
      const r = await importBackup(repo, parsed)
      toast.show(`تمت الاستعادة ✓ (${r.expenses} مصروف، ${r.commitments} التزام، ${r.goals} هدف)`)
      onImported?.()
    } catch (e) {
      setError((e as Error).message)
    } finally {
      setBusy(false)
    }
  }

  return (
    <Card aria-labelledby="backup-title">
      <CardTitle><span id="backup-title">النسخة الاحتياطية</span></CardTitle>
      <p className="mb-3 text-sm text-ink-600">نزّل كل بياناتك في ملف على جهازك، واستعدها في أي وقت أو على أي رابط أو جهاز آخر.</p>
      <div className="grid grid-cols-2 gap-2">
        <Button variant="secondary" loading={busy} onClick={() => void download()}>تنزيل نسخة احتياطية</Button>
        <Button variant="ghost" disabled={busy} onClick={() => input.current?.click()}>استعادة من ملف</Button>
      </div>
      <input ref={input} type="file" accept="application/json,.json" className="hidden" aria-label="ملف النسخة الاحتياطية"
        onChange={(e) => { const f = e.target.files?.[0]; e.target.value = ''; if (f) void restore(f) }} />
      {error && <Alert tone="error" className="mt-3">{error}</Alert>}
    </Card>
  )
}
