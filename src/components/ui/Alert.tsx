import clsx from 'clsx'
import type { ReactNode } from 'react'

type Tone = 'info' | 'success' | 'warning' | 'error'
const TONES: Record<Tone, string> = {
  info: 'bg-info-50 text-info-600 border-info-600/20',
  success: 'bg-brand-50 text-brand-700 border-brand-600/20',
  warning: 'bg-warn-50 text-warn-600 border-warn-600/20',
  error: 'bg-danger-50 text-danger-600 border-danger-600/20',
}

export function Alert({ tone = 'info', children, className }: { tone?: Tone; children: ReactNode; className?: string }) {
  return (
    <div role={tone === 'error' ? 'alert' : 'status'} className={clsx('rounded-xl border px-3.5 py-3 text-sm leading-relaxed', TONES[tone], className)}>
      {children}
    </div>
  )
}

export function EmptyState({ icon, title, children }: { icon: string; title: string; children?: ReactNode }) {
  return (
    <div className="flex flex-col items-center gap-1 px-4 py-8 text-center">
      <span className="text-3xl" aria-hidden>{icon}</span>
      <p className="font-semibold text-ink-800">{title}</p>
      {children && <p className="text-sm text-ink-500">{children}</p>}
    </div>
  )
}
