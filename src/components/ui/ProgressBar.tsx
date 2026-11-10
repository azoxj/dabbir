import clsx from 'clsx'

export function ProgressBar({ value, label, tone = 'brand' }: { value: number; label: string; tone?: 'brand' | 'warn' | 'danger' }) {
  const pct = Math.max(0, Math.min(100, Math.round(value * 100)))
  const tones = { brand: 'bg-brand-500', warn: 'bg-amber-500', danger: 'bg-danger-600' }
  return (
    <div role="progressbar" aria-label={label} aria-valuemin={0} aria-valuemax={100} aria-valuenow={pct} className="h-2.5 overflow-hidden rounded-full bg-ink-100">
      <div className={clsx('h-full rounded-full transition-[width] duration-300', tones[tone])} style={{ width: `${pct}%` }} />
    </div>
  )
}
