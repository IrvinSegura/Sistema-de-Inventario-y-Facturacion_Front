import { useTranslation } from 'react-i18next'
import { Bar, BarChart, CartesianGrid, Tooltip, type TooltipContentProps, XAxis, YAxis } from 'recharts'

import { dateLocale } from '@/i18n'
import { formatMoney, formatMoneyCompact } from '@/lib/money'

import type { MoneyBucket } from './money-series'

const series = [
  { key: 'sales', label: 'dashboard.series.sales', color: 'var(--chart-1)' },
  { key: 'purchases', label: 'dashboard.series.purchases', color: 'var(--chart-2)' },
] as const

// Money in (sales) next to money out (purchases), per day or week; one axis, both in MXN.
export function MoneyChart({ data, showPurchases }: { data: MoneyBucket[]; showPurchases: boolean }) {
  const { t, i18n } = useTranslation()
  const visible = showPurchases ? series : series.slice(0, 1)
  const day = new Intl.DateTimeFormat(dateLocale(i18n.language), { day: 'numeric', month: 'short' })
  const label = (bucket: MoneyBucket) => day.format(new Date(`${bucket.start}T00:00:00`))

  return (
    <div className="grid gap-3">
      {/* A legend only when there is more than one series; the card title names a single one. */}
      {visible.length > 1 && (
        <ul className="flex flex-wrap gap-4 text-xs text-muted-foreground">
          {visible.map((item) => (
            <li key={item.key} className="flex items-center gap-1.5">
              <span className="size-2.5 rounded-xs" style={{ background: item.color }} aria-hidden />
              {t(item.label)}
            </li>
          ))}
        </ul>
      )}
      <BarChart data={data} responsive style={{ width: '100%', height: 260 }}
        margin={{ top: 4, right: 4, bottom: 0, left: 0 }} barGap={2} barCategoryGap="20%">
        <CartesianGrid vertical={false} stroke="var(--border)" />
        <XAxis dataKey={label} tickLine={false} axisLine={false} minTickGap={16}
          tick={{ fill: 'var(--muted-foreground)', fontSize: 12 }} />
        <YAxis width={64} tickLine={false} axisLine={false} tickCount={5}
          tickFormatter={(value: number) => formatMoneyCompact(value)}
          tick={{ fill: 'var(--muted-foreground)', fontSize: 12 }} />
        <Tooltip cursor={{ fill: 'var(--muted)', opacity: 0.6 }} isAnimationActive={false}
          content={(props) => <MoneyTooltip {...props} />} />
        {visible.map((item) => (
          <Bar key={item.key} dataKey={item.key} name={t(item.label)} fill={item.color}
            radius={[4, 4, 0, 0]} maxBarSize={28} />
        ))}
      </BarChart>
    </div>
  )
}

function MoneyTooltip({ active, payload }: TooltipContentProps) {
  const { t, i18n } = useTranslation()
  const bucket = payload?.[0]?.payload as MoneyBucket | undefined
  if (!active || !bucket) {
    return null
  }
  const format = new Intl.DateTimeFormat(dateLocale(i18n.language), { day: 'numeric', month: 'long' })
  const start = format.format(new Date(`${bucket.start}T00:00:00`))
  const title = bucket.start === bucket.end
    ? start
    : t('dashboard.dateRange', { from: start, to: format.format(new Date(`${bucket.end}T00:00:00`)) })

  return (
    <div className="grid min-w-44 gap-1.5 rounded-lg bg-popover px-3 py-2 text-xs text-popover-foreground shadow-md ring-1 ring-foreground/10">
      <p className="font-medium">{title}</p>
      {payload.map((entry) => (
        <p key={String(entry.dataKey)} className="flex items-center gap-1.5 text-muted-foreground">
          <span className="size-2.5 rounded-xs" style={{ background: entry.color }} aria-hidden />
          {entry.name}
          <span className="ml-auto pl-3 font-medium text-foreground tabular-nums">{formatMoney(Number(entry.value))}</span>
        </p>
      ))}
    </div>
  )
}
