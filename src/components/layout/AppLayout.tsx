import { Outlet } from 'react-router-dom'
import { BottomNav } from './BottomNav'
import { DemoBanner, MovingBanner, OfflineBanner } from './StatusBanners'

export function AppLayout() {
  return (
    <div className="min-h-dvh pb-[calc(5rem+env(safe-area-inset-bottom))]">
      <div className="sticky top-0 z-30 pt-[env(safe-area-inset-top)]">
        <OfflineBanner />
        <DemoBanner />
        <MovingBanner />
      </div>
      <main className="mx-auto w-full max-w-2xl px-4 pt-4 sm:px-6">
        <Outlet />
      </main>
      <BottomNav />
    </div>
  )
}

export function PageHeader({ title, subtitle }: { title: string; subtitle?: string }) {
  return (
    <header className="mb-4">
      <h1 className="text-2xl font-bold text-ink-900">{title}</h1>
      {subtitle && <p className="mt-1 text-sm text-ink-500">{subtitle}</p>}
    </header>
  )
}
