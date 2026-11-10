import type { ReactNode } from 'react'
import { DemoBanner } from './StatusBanners'

export function AuthLayout({ title, subtitle, children }: { title: string; subtitle?: string; children: ReactNode }) {
  return (
    <div className="flex min-h-dvh flex-col bg-gradient-to-br from-ink-800 to-brand-700">
      <div className="pt-[env(safe-area-inset-top)]"><DemoBanner /></div>
      <main className="flex flex-1 items-center justify-center px-4 py-8">
        <div className="w-full max-w-md rounded-3xl bg-white p-6 shadow-2xl sm:p-8">
          <div className="mb-6 text-center">
            <img src="/icons/icon-192.png" alt="" width={56} height={56} className="mx-auto mb-3 rounded-2xl" />
            <p className="text-sm font-bold tracking-wide text-brand-600">دبّر</p>
            <h1 className="mt-1 text-2xl font-bold text-ink-900">{title}</h1>
            {subtitle && <p className="mt-2 text-sm leading-relaxed text-ink-500">{subtitle}</p>}
          </div>
          {children}
        </div>
      </main>
    </div>
  )
}
