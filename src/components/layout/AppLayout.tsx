import { Link, Outlet } from 'react-router-dom'
import { BottomNav, DesktopNav } from './BottomNav'
import { DemoBanner, MovingBanner, OfflineBanner } from './StatusBanners'

export function AppLayout() {
  return (
    <div className="min-h-dvh pb-[calc(5rem+env(safe-area-inset-bottom))] lg:pb-0">
      <div className="sticky top-0 z-30 pt-[env(safe-area-inset-top)]">
        <OfflineBanner />
        <DemoBanner />
        <MovingBanner />
      </div>
      <div className="mx-auto flex w-full max-w-7xl gap-8 px-4 sm:px-6 lg:px-8">
        <DesktopNav />
        <main id="main-content" className="min-w-0 flex-1 py-6 lg:py-10">
          <Outlet />
        </main>
      </div>
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
