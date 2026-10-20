import { useTranslation } from 'react-i18next'
import { Outlet } from 'react-router'

import { managesStore, useUser } from '@/auth/auth-context'
import { type SectionTab, SectionTabs } from '@/components/SectionTabs'

const tabs: SectionTab[] = [
  { to: '/reports', label: 'reports.tabs.sales' },
  { to: '/reports/products', label: 'reports.tabs.products' },
  { to: '/reports/customers', label: 'reports.tabs.customers' },
  { to: '/reports/cash-closing', label: 'reports.tabs.closing' },
  { to: '/reports/cash-flow', label: 'reports.tabs.flow' },
]

// Every user gets their sales against the previous period (sellers only their own); managers also
// get sales by product and customer, a day's cash closing and money in and out. Each one prints or
// exports to Excel.
export function ReportsLayout() {
  const { t } = useTranslation()
  const user = useUser()
  const manager = managesStore(user.role)
  return (
    <div className="grid gap-6">
      <div className="grid gap-4">
        <div className="grid gap-1">
          <h1 className="text-2xl font-semibold tracking-tight">{t('reports.title')}</h1>
          <p className="text-sm text-muted-foreground">{t(manager ? 'reports.description' : 'reports.sellerDescription')}</p>
        </div>
        {/* Sellers have only their sales report, so no tabs. */}
        {manager && <SectionTabs label={t('reports.tabs.label')} tabs={tabs} />}
      </div>
      <Outlet />
    </div>
  )
}
