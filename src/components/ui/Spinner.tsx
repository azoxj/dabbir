import clsx from 'clsx'

export function Spinner({ className }: { className?: string }) {
  return <span aria-hidden className={clsx('inline-block animate-spin rounded-full border-2 border-current border-e-transparent', className ?? 'size-6')} />
}

export function PageLoader({ label = 'جاري التحميل…' }: { label?: string }) {
  return (
    <div role="status" className="flex flex-col items-center justify-center gap-3 py-16 text-ink-500">
      <Spinner className="size-8 text-brand-600" />
      <span className="text-sm">{label}</span>
    </div>
  )
}
