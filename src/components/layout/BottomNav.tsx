import clsx from 'clsx'
import { NavLink } from 'react-router-dom'
import { CalendarIcon, HomeIcon, SettingsIcon, TargetIcon, WalletIcon } from '@/components/icons/Icons'

const ITEMS = [
  { to: '/', label: 'اليوم', Icon: HomeIcon, end: true },
  { to: '/budget', label: 'الميزانية', Icon: WalletIcon },
  { to: '/commitments', label: 'الالتزامات', Icon: CalendarIcon },
  { to: '/goals', label: 'الأهداف', Icon: TargetIcon },
  { to: '/settings', label: 'حسابي', Icon: SettingsIcon },
]

export function BottomNav() {
  return (
    <nav aria-label="القائمة الرئيسية" className="fixed inset-x-0 bottom-0 z-40 border-t border-ink-100 bg-white/95 pb-[env(safe-area-inset-bottom)] backdrop-blur">
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
