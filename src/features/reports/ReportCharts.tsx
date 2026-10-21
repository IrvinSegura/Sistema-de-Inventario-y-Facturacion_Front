import type { ReactNode } from 'react'
import { useTranslation } from 'react-i18next'
import { Bar, CartesianGrid, ComposedChart, Line, Tooltip, type TooltipContentProps, XAxis, YAxis } from 'recharts'

import type { MessageKey } from '@/i18n'
import { addDays } from '@/lib/days'
import { formatMoney, formatMoneyCompact } from '@/lib/money'

import { bucketLabel, bucketTitle } from './format'
import { type Bucket, type ComparisonPoint, type FlowPoint, type Grouping } from './periods'

interface Series {
  key: string
  label: MessageKey
  color: string
  kind: 'bar' | 'line'
  dashed?: boolean
}

const comparison: Series[] = [
  { key: 'current', label: 'reports.series.current', color: 'var(--chart-1)', kind: 'bar' },
  { key: 'previous', label: 'reports.series.previous', color: 'var(--chart-2)', kind: 'line', dashed: true },
]

const flow: Series[] = [
  { key: 'sales', label: 'reports.series.sales', color: 'var(--chart-1)', kind: 'bar' },
  { key: 'purchases', label: 'reports.series.purchases', color: 'var(--chart-2)', kind: 'bar' },
  { key: 'cumulative', label: 'reports.series.cumulative', color: 'var(--foreground)', kind: 'line' },
]

/** Sales of each bucket as bars, with the same days of the previous period as a dashed line. */
export function ComparisonChart({ data, grouping, previousShift }: {
  data: ComparisonPoint[]
  grouping: Grouping
  /** Days between a bucket and the same days of the previous period, to name them in the tooltip. */
  previousShift: number
}) {
  return (
    <MoneyComposedChart data={data} grouping={grouping} series={comparison}
      subtitle={(point, language) => bucketTitle(shift(point, previousShift), grouping, language)} />
  )
}

/** Money in and out per bucket, and the net flow accumulated since the start of the period. */
export function FlowChart({ data, grouping }: { data: FlowPoint[]; grouping: Grouping }) {
  return <MoneyComposedChart data={data} grouping={grouping} series={flow} />
}

function shift(bucket: Bucket, days: number): Bucket {
  return { start: addDays(bucket.start, days), end: addDays(bucket.end, days) }
}

function MoneyComposedChart<T extends Bucket>({ data, grouping, series, subtitle }: {
  data: T[]
  grouping: Grouping
  series: Series[]
  /** Second line of the tooltip for the dashed series, e.g. the previous period's dates. */
  subtitle?: (point: T, language: string) => string
}) {
  const { t, i18n } = useTranslation()
  return (
    <div className="grid gap-3">
      <ul className="flex flex-wrap gap-4 text-xs text-muted-foreground">
        {series.map((item) => (
          <li key={item.key} className="flex items-center gap-1.5">
            {item.kind === 'bar' ? (
              <span className="size-2.5 rounded-xs" style={{ background: item.color }} aria-hidden />
            ) : (
              <span className="w-3.5 border-t-2" style={{ borderColor: item.color, borderStyle: item.dashed ? 'dashed' : 'solid' }}
                aria-hidden />
            )}
            {t(item.label)}
          </li>
        ))}
      </ul>
      <ComposedChart data={data} responsive style={{ width: '100%', height: 280 }}
        margin={{ top: 4, right: 4, bottom: 0, left: 0 }} barGap={2} barCategoryGap="20%">
        <CartesianGrid vertical={false} stroke="var(--border)" />
        <XAxis dataKey={(point: T) => bucketLabel(point, grouping, i18n.language)} tickLine={false} axisLine={false}
          minTickGap={16} tick={{ fill: 'var(--muted-foreground)', fontSize: 12 }} />
        <YAxis width={64} tickLine={false} axisLine={false} tickCount={5}
          tickFormatter={(value: number) => formatMoneyCompact(value)}
          tick={{ fill: 'var(--muted-foreground)', fontSize: 12 }} />
        <Tooltip cursor={{ fill: 'var(--muted)', opacity: 0.6 }} isAnimationActive={false}
          content={(props) => (
            <ChartTooltip {...props} title={(point: T) => bucketTitle(point, grouping, i18n.language)}
              note={subtitle && ((point: T) => t('reports.series.previousDates', { dates: subtitle(point, i18n.language) }))} />
          )} />
        {series.map((item) => item.kind === 'bar' ? (
          <Bar key={item.key} dataKey={item.key} name={t(item.label)} fill={item.color} radius={[4, 4, 0, 0]} maxBarSize={28} />
        ) : (
          <Line key={item.key} dataKey={item.key} name={t(item.label)} stroke={item.color} strokeWidth={2}
            strokeDasharray={item.dashed ? '5 4' : undefined} dot={data.length <= 31 ? { r: 2.5 } : false}
            type="monotone" isAnimationActive={false} />
        ))}
      </ComposedChart>
    </div>
  )
}

function ChartTooltip<T>({ active, payload, title, note }: TooltipContentProps & {
  title: (point: T) => string
  note?: (point: T) => ReactNode
}) {
  const point = payload?.[0]?.payload as T | undefined
  if (!active || !point) {
    return null
  }
  return (
    <div className="grid min-w-48 gap-1.5 rounded-lg bg-popover px-3 py-2 text-xs text-popover-foreground shadow-md ring-1 ring-foreground/10">
      <p className="font-medium">{title(point)}</p>
      {payload.map((entry) => (
        <p key={String(entry.dataKey)} className="flex items-center gap-1.5 text-muted-foreground">
          <span className="size-2.5 rounded-xs" style={{ background: entry.color }} aria-hidden />
          {entry.name}
          <span className="ml-auto pl-3 font-medium text-foreground tabular-nums">{formatMoney(Number(entry.value))}</span>
        </p>
      ))}
      {note && <p className="text-muted-foreground">{note(point)}</p>}
    </div>
  )
}
