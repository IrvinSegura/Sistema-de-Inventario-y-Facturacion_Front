import { Minus, TrendingDown, TrendingUp } from 'lucide-react'
import { useTranslation } from 'react-i18next'

import { cn } from '@/lib/utils'

import { formatChange } from './format'
import { type Grouping, groupings } from './periods'

/**
 * Change against the previous period: green when it went the right way, red otherwise. `inverse`
 * is for figures where less is better, such as cancellations.
 */
export function ChangeBadge({ value, inverse, className }: {
  /** A fraction (0.25 = +25 %); null (growth from zero) shows as new, undefined renders nothing. */
  value: number | null | undefined
  inverse?: boolean
  className?: string
}) {
  const { t, i18n } = useTranslation()
  if (value === undefined) {
    return null
  }
  if (value === null) {
    return <span className={cn('text-xs font-medium text-muted-foreground', className)}>{t('reports.change.new')}</span>
  }
  const good = inverse ? value < 0 : value > 0
  const Icon = value > 0 ? TrendingUp : value < 0 ? TrendingDown : Minus
  return (
    <span className={cn(
      'inline-flex items-center gap-1 text-xs font-medium tabular-nums',
      value === 0 ? 'text-muted-foreground' : good ? 'text-emerald-600 dark:text-emerald-400' : 'text-destructive',
      className,
    )}>
      <Icon className="size-3.5" aria-hidden />
      {formatChange(value, i18n.language)}
    </span>
  )
}

/** Day, week or month, for the charts and tables of a period. */
export function GroupingToggle({ value, onChange }: { value: Grouping; onChange: (grouping: Grouping) => void }) {
  const { t } = useTranslation()
  return (
    <div role="group" aria-label={t('reports.grouping.label')} className="flex rounded-lg bg-muted p-1">
      {groupings.map((grouping) => (
        <button key={grouping} type="button" aria-pressed={value === grouping} onClick={() => onChange(grouping)}
          className={cn(
            'h-7 rounded-md px-2.5 text-xs font-medium text-muted-foreground transition-colors outline-none',
            'hover:text-foreground focus-visible:ring-3 focus-visible:ring-ring/50',
            value === grouping && 'bg-background text-foreground shadow-sm',
          )}>
          {t(`reports.grouping.${grouping}`)}
        </button>
      ))}
    </div>
  )
}

/** A bar showing a share of the whole (a fraction, clamped to 0–1), under a figure in a table. */
export function ShareBar({ value }: { value: number }) {
  return (
    <div className="h-1.5 rounded-full bg-muted" aria-hidden>
      <div className="h-full rounded-full bg-chart-1" style={{ width: `${Math.min(Math.max(value, 0), 1) * 100}%` }} />
    </div>
  )
}

export function ChartPlaceholder() {
  return <div className="h-[280px] animate-pulse rounded-lg bg-muted/60" />
}
