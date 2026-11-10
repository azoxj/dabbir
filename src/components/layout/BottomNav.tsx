import clsx from 'clsx'
import { NavLink } from 'react-router-dom'
import { CalendarIcon, HomeIcon, SettingsIcon, TargetIcon, WalletIcon } from '@/components/icons/Icons'

const ITEMS = [
  { to: '/', label: 'اليوم', Icon: HomeIcon, end: true },
  { to: '/budget', label: 'الميزانية', Icon: WalletIcon },
  { to: '/commitments', label: 'الالتزامات', Icon: CalendarIcon },
  { to: '/goals', label: 'الأهداف', Icon: TargetIcon },
  { to: '/challenges', label: 'التحديات', Icon: TargetIcon },
  { to: '/settings', label: 'حسابي', Icon: SettingsIcon },
]

export function BottomNav() {
  return (
    <nav aria-label="القائمة الرئيسية" className="fixed inset-x-0 bottom-0 z-40 lg:hidden border-t border-ink-100 bg-white/95 pb-[env(safe-area-inset-bottom)] backdrop-blur">
      <ul className="mx-auto flex max-w-2xl">
        {ITEMS.map(({ to, label, Icon, end }) => (
          <li key={to} className="flex-1">
            <NavLink to={to} end={end}
              className={({ isActive }) => clsx('flex min-h-16 flex-col items-center justify-center gap-1 text-[11px] font-semibold transition-colors',
                isActive ? 'text-brand-600' : 'text-ink-500 hover:text-ink-800')}>
              {({ isActive }) => (<><Icon className={clsx('size-6', isActive && 'stroke-[2.4]')} /><span>{label}</span></>)}
            </NavLink>
          </li>
        ))}
      </ul>
    </nav>
  )
}

export function DesktopNav() {
  return <aside className="sticky top-8 hidden h-fit w-64 shrink-0 py-8 lg:block">
    <div className="rounded-3xl border border-ink-100 bg-white/90 p-5 shadow-sm">
      <div className="mb-8 rounded-2xl bg-brand-700 p-5 text-white"><span className="text-2xl font-bold">دبّر ✦</span><p className="mt-1 text-xs text-brand-100">فلوسك أوضح، وقراراتك أذكى</p></div>
      <nav aria-label="التنقل الجانبي"><ul className="space-y-1">{ITEMS.map(({ to, label, Icon, end }) => <li key={to}><NavLink to={to} end={end} className={({ isActive }) => clsx('flex items-center gap-3 rounded-xl px-4 py-3 text-sm font-semibold transition-colors', isActive ? 'bg-brand-50 text-brand-700' : 'text-ink-600 hover:bg-ink-100')}><Icon className="size-5" />{label}</NavLink></li>)}</ul></nav>
      <p className="mt-8 border-t border-ink-100 pt-4 text-xs leading-6 text-ink-500">معلوماتك المالية خاصة في حسابك، ولا تظهر للمنافسين.</p>
    </div>
  </aside>
}
