import { useTranslation } from 'react-i18next'

import { Badge } from '@/components/ui/badge'

// Out of stock, at or below the minimum, or fine.
export function StockBadge({ stock, lowStock }: { stock: number; lowStock: boolean }) {
  const { t } = useTranslation()
  if (stock <= 0) {
    return <Badge variant="destructive">{t('inventory.status.out')}</Badge>
  }
  if (lowStock) {
    return <Badge variant="outline" className="border-amber-500/50 text-amber-700 dark:text-amber-400">{t('inventory.status.low')}</Badge>
  }
  return <Badge variant="secondary">{t('inventory.status.ok')}</Badge>
}
