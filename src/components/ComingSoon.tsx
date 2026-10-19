import { Construction } from 'lucide-react'
import { useTranslation } from 'react-i18next'

import { Badge } from '@/components/ui/badge'
import { Card } from '@/components/ui/card'

// Sections already in the menu whose screens aren't built yet; the API behind them exists.
export type UpcomingSection = 'reports'

export function ComingSoon({ section }: { section: UpcomingSection }) {
  const { t } = useTranslation()
  return (
    <div className="grid gap-6">
      <div className="flex flex-wrap items-center gap-3">
        <h1 className="text-2xl font-semibold tracking-tight">{t(`upcoming.${section}.title`)}</h1>
        <Badge variant="secondary">{t('upcoming.badge')}</Badge>
      </div>
      <Card className="flex flex-col items-center gap-3 px-4 py-16 text-center">
        <span className="flex size-12 items-center justify-center rounded-full bg-muted">
          <Construction className="size-6 text-muted-foreground" />
        </span>
        <p className="max-w-md text-sm text-muted-foreground">{t(`upcoming.${section}.description`)}</p>
      </Card>
    </div>
  )
}
