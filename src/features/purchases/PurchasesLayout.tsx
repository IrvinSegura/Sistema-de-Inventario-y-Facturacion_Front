import { Plus } from 'lucide-react'
import { useTranslation } from 'react-i18next'
import { Link, Outlet, useMatch } from 'react-router'

import { SectionTabs } from '@/components/SectionTabs'
import { buttonVariants } from '@/components/ui/button'

// Admins and supervisors only (the route and the menu): purchases, a new one and the suppliers.
export function PurchasesLayout() {
  const { t } = useTranslation()
  const creating = useMatch('/purchases/new')

  return (
    <div className="grid gap-6">
      <div className="grid gap-4">
        <div className="flex flex-wrap items-end justify-between gap-4">
          <div className="grid gap-1">
            <h1 className="text-2xl font-semibold tracking-tight">{t('purchases.title')}</h1>
            <p className="text-sm text-muted-foreground">{t('purchases.description')}</p>
          </div>
          {!creating && (
            <Link to="/purchases/new" className={buttonVariants({ size: 'lg' })}>
              <Plus />
              {t('purchases.new')}
            </Link>
          )}
        </div>
        <SectionTabs label={t('purchases.tabs.label')} tabs={[
          { to: '/purchases', label: 'purchases.tabs.list' },
          { to: '/purchases/new', label: 'purchases.tabs.new' },
          { to: '/purchases/suppliers', label: 'purchases.tabs.suppliers' },
        ]} />
      </div>
      <Outlet />
    </div>
  )
}
