import clsx from 'clsx'
import { useId, type ComponentProps, type ReactNode } from 'react'

const control = 'block w-full min-w-0 rounded-xl border border-ink-300 bg-white px-3.5 py-3 text-ink-800 placeholder:text-ink-500/70 focus:border-brand-500 focus:outline-none focus:ring-3 focus:ring-brand-100 aria-invalid:border-danger-600'

interface FieldProps { label: string; hint?: ReactNode; error?: string | null; className?: string }

export function TextField({ label, hint, error, className, ...rest }: FieldProps & ComponentProps<'input'>) {
  const id = useId()
  return (
    <div className={className}>
      <label htmlFor={id} className="mb-1.5 block text-sm font-semibold text-ink-800">{label}</label>
      <input id={id} aria-invalid={error ? true : undefined} aria-describedby={error || hint ? `${id}-msg` : undefined} className={control} {...rest} />
      {(error || hint) && <p id={`${id}-msg`} className={clsx('mt-1 text-xs', error ? 'text-danger-600' : 'text-ink-500')}>{error || hint}</p>}
    </div>
  )
}

export function SelectField({ label, hint, error, className, children, ...rest }: FieldProps & ComponentProps<'select'>) {
  const id = useId()
  return (
    <div className={className}>
      <label htmlFor={id} className="mb-1.5 block text-sm font-semibold text-ink-800">{label}</label>
      <select id={id} aria-invalid={error ? true : undefined} className={clsx(control, 'appearance-none bg-white')} {...rest}>{children}</select>
      {(error || hint) && <p className={clsx('mt-1 text-xs', error ? 'text-danger-600' : 'text-ink-500')}>{error || hint}</p>}
    </div>
  )
}

/** حقل مبلغ: نصّي مع لوحة أرقام عشرية، يقبل الأرقام العربية. */
export function AmountField(props: FieldProps & Omit<ComponentProps<'input'>, 'type'>) {
  return <TextField inputMode="decimal" autoComplete="off" dir="ltr" style={{ textAlign: 'right' }} {...props} />
}
