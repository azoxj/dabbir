import { useEffect, useState } from 'react'
import { applyUpdate, onUpdateAvailable } from '@/services/pwa'

export function UpdateBanner() {
  const [reg, setReg] = useState<ServiceWorkerRegistration | null>(null)
  useEffect(() => onUpdateAvailable(setReg), [])
  if (!reg) return null
  return (
    <div role="status" className="fixed inset-x-4 top-[calc(0.75rem+env(safe-area-inset-top))] z-50 mx-auto flex max-w-md items-center justify-between gap-3 rounded-xl bg-ink-800 px-4 py-3 text-sm text-white shadow-lg">
      <span>فيه تحديث جديد لدبّر.</span>
      <button className="rounded-lg bg-white px-3 py-1.5 font-bold text-ink-800" onClick={() => applyUpdate(reg)}>تحديث</button>
    </div>
  )
}
