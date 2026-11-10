import clsx from 'clsx'
import type { ButtonHTMLAttributes } from 'react'
import { Spinner } from './Spinner'

type Variant = 'primary' | 'secondary' | 'ghost' | 'danger'
const VARIANTS: Record<Variant, string> = {
  primary: 'bg-brand-600 text-white hover:bg-brand-700 disabled:bg-ink-300',
  secondary: 'bg-brand-50 text-brand-700 hover:bg-brand-100',
  ghost: 'bg-transparent text-brand-700 hover:bg-brand-50',
  danger: 'bg-danger-50 text-danger-600 hover:bg-red-100',
}

export interface ButtonProps extends ButtonHTMLAttributes<HTMLButtonElement> {
  variant?: Variant
  size?: 'md' | 'sm'
  loading?: boolean
  block?: boolean
}

/** نفس شكل الزر لعناصر أخرى (مثل Link) بدون تداخل عناصر تفاعلية. */
export function buttonClasses(variant: Variant = 'primary', opts: { block?: boolean; size?: 'md' | 'sm' } = {}) {
  return clsx(
    'inline-flex items-center justify-center gap-2 rounded-xl font-bold transition-colors',
    opts.size === 'sm' ? 'min-h-9 px-3 text-sm' : 'min-h-12 px-5 text-base',
    VARIANTS[variant], opts.block && 'w-full',
  )
}

export function Button({ variant = 'primary', size = 'md', loading, block, className, children, disabled, ...rest }: ButtonProps) {
  return (
    <button
      {...rest}
      disabled={disabled || loading}
      aria-busy={loading || undefined}
      className={clsx(
        'inline-flex items-center justify-center gap-2 rounded-xl font-bold transition-colors disabled:cursor-not-allowed',
        size === 'md' ? 'min-h-12 px-5 text-base' : 'min-h-9 px-3 text-sm',
        VARIANTS[variant], block && 'w-full', className,
      )}
    >
      {loading && <Spinner className="size-4" />}
      {children}
    </button>
  )
}
