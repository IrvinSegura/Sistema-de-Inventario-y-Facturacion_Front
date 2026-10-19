import { useTranslation } from 'react-i18next'
import { Outlet } from 'react-router'

import { SectionTabs } from '@/components/SectionTabs'

// Admins and supervisors only (the route and the menu): stock, products low on it and the ledger.
export function InventoryLayout() {
  const { t } = useTranslation()
  return (
    <div className="grid gap-6">
      <div className="grid gap-4">
        <div className="grid gap-1">
          <h1 className="text-2xl font-semibold tracking-tight">{t('inventory.title')}</h1>
          <p className="text-sm text-muted-foreground">{t('inventory.description')}</p>
        </div>
        <SectionTabs label={t('inventory.tabs.label')} tabs={[
          { to: '/inventory', label: 'inventory.tabs.stock' },
          { to: '/inventory/low-stock', label: 'inventory.tabs.lowStock' },
          { to: '/inventory/movements', label: 'inventory.tabs.movements' },
        ]} />
      </div>
      <Outlet />
    </div>
  )
}
