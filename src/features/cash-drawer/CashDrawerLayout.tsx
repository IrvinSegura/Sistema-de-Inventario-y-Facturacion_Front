import { useTranslation } from 'react-i18next'
import { Outlet } from 'react-router'

import { managesStore, useUser } from '@/auth/auth-context'
import { type SectionTab, SectionTabs } from '@/components/SectionTabs'

interface Tab extends SectionTab {
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
        <SectionTabs label={t('drawer.tabs.label')} tabs={visible} />
      </div>
      <Outlet />
    </div>
  )
}
