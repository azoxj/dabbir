import { useEffect, useState } from 'react'
import { Outlet } from 'react-router-dom'
import { BottomNav, DesktopNav } from './BottomNav'
import { DemoBanner, MovingBanner, OfflineBanner } from './StatusBanners'

type InstallPromptEvent = Event & {
  prompt: () => Promise<void>
  userChoice: Promise<{ outcome: 'accepted' | 'dismissed' }>
}

function InstallAppBanner() {
  const [promptEvent, setPromptEvent] = useState<InstallPromptEvent | null>(null)
  const [installed, setInstalled] = useState(() => window.matchMedia('(display-mode: standalone)').matches ||
    (navigator as Navigator & { standalone?: boolean }).standalone === true)
  const [showHelp, setShowHelp] = useState(false)

  useEffect(() => {
    const onPrompt = (event: Event) => {
      event.preventDefault()
      setPromptEvent(event as InstallPromptEvent)
    }
    const onInstalled = () => { setInstalled(true); setPromptEvent(null) }
    window.addEventListener('beforeinstallprompt', onPrompt)
    window.addEventListener('appinstalled', onInstalled)
    return () => {
      window.removeEventListener('beforeinstallprompt', onPrompt)
      window.removeEventListener('appinstalled', onInstalled)
    }
  }, [])

  if (installed) return null

  const install = async () => {
    if (!promptEvent) { setShowHelp((value) => !value); return }
    try {
      await promptEvent.prompt()
      const result = await promptEvent.userChoice
      if (result.outcome === 'accepted') setPromptEvent(null)
    } catch {
      setShowHelp(true)
    }
  }

  return (
    <section aria-label="تثبيت تطبيق دبّر" className="mb-4 rounded-2xl border border-brand-100 bg-brand-50 p-4">
      <div className="flex items-center justify-between gap-3">
        <div>
          <p className="font-bold text-ink-900">📲 ثبّت دبّر على جوالك مجانًا</p>
          <p className="mt-1 text-xs text-ink-600">افتحه كتطبيق مستقل من الشاشة الرئيسية، بدون متجر.</p>
        </div>
        <button type="button" onClick={() => void install()} className="shrink-0 rounded-xl bg-brand-600 px-4 py-2 text-sm font-bold text-white hover:bg-brand-700">
          {promptEvent ? 'تثبيت' : 'طريقة التثبيت'}
        </button>
      </div>
      {showHelp && (
        <p className="mt-3 border-t border-brand-100 pt-3 text-sm text-ink-700">
          أندرويد (Chrome): افتح قائمة ⋮ ثم اختر «تثبيت التطبيق» أو «إضافة إلى الشاشة الرئيسية».
          آيفون (Safari): اضغط مشاركة ثم «إضافة إلى الشاشة الرئيسية».
        </p>
      )}
    </section>
  )
}

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
          <InstallAppBanner />
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
