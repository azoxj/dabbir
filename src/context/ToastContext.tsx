import { createContext, useCallback, useMemo, useRef, useState, type ReactNode } from 'react'
import clsx from 'clsx'

type ToastKind = 'success' | 'error' | 'info'
interface Toast { id: number; kind: ToastKind; message: string }
export interface ToastApi { show(message: string, kind?: ToastKind): void }

export const ToastContext = createContext<ToastApi | null>(null)

export function ToastProvider({ children }: { children: ReactNode }) {
  const [toasts, setToasts] = useState<Toast[]>([])
  const seq = useRef(0)
  const show = useCallback((message: string, kind: ToastKind = 'success') => {
    const id = ++seq.current
    setToasts((t) => [...t.slice(-2), { id, kind, message }])
    setTimeout(() => setToasts((t) => t.filter((x) => x.id !== id)), kind === 'error' ? 6000 : 3000)
  }, [])
  const api = useMemo(() => ({ show }), [show])
  return (
    <ToastContext.Provider value={api}>
      {children}
      <div className="pointer-events-none fixed inset-x-0 bottom-[calc(5rem+env(safe-area-inset-bottom))] z-50 flex flex-col items-center gap-2 px-4" aria-live="polite">
        {toasts.map((t) => (
          <div key={t.id} role={t.kind === 'error' ? 'alert' : 'status'}
            className={clsx('pointer-events-auto w-full max-w-md rounded-xl px-4 py-3 text-sm font-semibold shadow-lg',
              t.kind === 'error' ? 'bg-danger-600 text-white' : t.kind === 'info' ? 'bg-ink-800 text-white' : 'bg-brand-700 text-white')}>
            {t.message}
          </div>
        ))}
      </div>
    </ToastContext.Provider>
  )
}
