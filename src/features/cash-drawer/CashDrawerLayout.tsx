import { useTranslation } from 'react-i18next'
import { NavLink, Outlet } from 'react-router'

import { managesStore, useUser } from '@/auth/auth-context'
import type { MessageKey } from '@/i18n'
import { cn } from '@/lib/utils'

interface Tab {
  to: string
  label: MessageKey
  // Sellers have a drawer; managers have none and look after everyone's.
  audience?: 'sellers' | 'managers'
}

const tabs: Tab[] = [
  { to: '/cash-drawer', label: 'drawer.tabs.mine', audience: 'sellers' },
  { to: '/cash-drawer/today', label: 'drawer.tabs.today', audience: 'managers' },
  { to: '/cash-drawer/history', label: 'drawer.tabs.history' },
]

export function CashDrawerLayout() {
  const { t } = useTranslation()
  const user = useUser()
  const viewer = managesStore(user.role) ? 'managers' : 'sellers'
  const visible = tabs.filter((tab) => !tab.audience || tab.audience === viewer)

  return (
    <div className="grid gap-6">
      <div className="grid gap-4">
        <h1 className="text-2xl font-semibold tracking-tight">{t('drawer.title')}</h1>
        <nav aria-label={t('drawer.tabs.label')} className="flex gap-1 overflow-x-auto border-b">
          {visible.map((tab) => (
            <NavLink key={tab.to} to={tab.to} end
              className={({ isActive }) => cn(
                '-mb-px border-b-2 px-3 py-2 text-sm font-medium whitespace-nowrap transition-colors outline-none',
                'focus-visible:ring-3 focus-visible:ring-ring/50',
                isActive ? 'border-primary text-foreground' : 'border-transparent text-muted-foreground hover:text-foreground',
              )}>
              {t(tab.label)}
            </NavLink>
          ))}
        </nav>
      </div>
      <Outlet />
    </div>
  )
}
