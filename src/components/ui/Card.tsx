import clsx from 'clsx'
import type { HTMLAttributes, ReactNode } from 'react'

export function Card({ className, ...rest }: HTMLAttributes<HTMLElement>) {
  return <section className={clsx('rounded-2xl bg-white p-4 shadow-[0_4px_18px_#173a4c0f] sm:p-5', className)} {...rest} />
}

export function CardTitle({ children, action, as: Tag = 'h2' }: { children: ReactNode; action?: ReactNode; as?: 'h2' | 'h3' }) {
  return (
    <div className="mb-3 flex items-center justify-between gap-2">
      <Tag className="text-lg font-bold text-ink-800">{children}</Tag>
      {action}
    </div>
  )
}

export function Stat({ label, value, tone = 'brand' }: { label: string; value: ReactNode; tone?: 'brand' | 'danger' | 'warn' | 'ink' }) {
  const tones = { brand: 'bg-brand-50', danger: 'bg-danger-50 text-danger-600', warn: 'bg-warn-50 text-warn-600', ink: 'bg-ink-100' }
  return (
    <div className={clsx('rounded-xl p-3', tones[tone])}>
      <div className="text-xs text-ink-600">{label}</div>
      <div className="mt-1 text-lg font-bold sm:text-xl">{value}</div>
    </div>
  )
}
