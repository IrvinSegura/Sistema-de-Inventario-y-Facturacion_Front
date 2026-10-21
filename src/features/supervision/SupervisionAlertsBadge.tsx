import { use } from 'react'
import { useTranslation } from 'react-i18next'

import { Badge } from '@/components/ui/badge'

import { LiveAlertsContext } from './live-alerts'
import { alertCount } from './live-day'

/**
 * How many live alerts are pending, next to Supervision in the menu: a count, or a dot over the icon
 * when the menu is collapsed. Nothing while there are none or they're still loading.
 */
export function SupervisionAlertsBadge({ compact }: { compact: boolean }) {
  const { t } = useTranslation()
  // Null outside LiveAlertsProvider's manager branch: nothing to count.
  const alerts = use(LiveAlertsContext)?.alerts
  const count = alerts ? alertCount(alerts) : 0
  if (count === 0) {
    return null
  }
  // Read as part of the link's name: "Supervision, 3 alerts pending".
  const label = <span className="sr-only">, {t('supervision.live.alerts.badge', { count })}</span>
  return compact ? (
    <span className="absolute top-1.5 right-1.5 size-2 rounded-full bg-destructive">{label}</span>
  ) : (
    <Badge variant="destructive" className="ml-auto tabular-nums">
      <span aria-hidden>{count}</span>
      {label}
    </Badge>
  )
}
