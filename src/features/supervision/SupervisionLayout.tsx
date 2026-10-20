import { useTranslation } from 'react-i18next'
import { Outlet } from 'react-router'

// Supervision shell; managers only (route guard and menu).
export function SupervisionLayout() {
  const { t } = useTranslation()
  return (
    <div className="grid gap-6">
      <div className="grid gap-1">
        <h1 className="text-2xl font-semibold tracking-tight">{t('supervision.title')}</h1>
        <p className="text-sm text-muted-foreground">{t('supervision.description')}</p>
      </div>
      <Outlet />
    </div>
  )
}
