import { useId, useState } from 'react'
import { useTranslation } from 'react-i18next'

import { Button } from '@/components/ui/button'
import { Input } from '@/components/ui/input'
import { Label } from '@/components/ui/label'
import { addDays, type DayRange, daysInRange, FIRST_DAY } from '@/features/dashboard/days'
import { useToday } from '@/lib/use-today'
import { cn } from '@/lib/utils'

type Preset = 'today' | 'last7' | 'last30' | 'thisMonth'

const presets: Preset[] = ['today', 'last7', 'last30', 'thisMonth']

function presetRange(preset: Preset, today: string): DayRange {
  switch (preset) {
    case 'today':
      return { from: today, to: today }
    case 'last7':
      return { from: addDays(today, -6), to: today }
    case 'last30':
      return { from: addDays(today, -29), to: today }
    case 'thisMonth':
      // Days are YYYY-MM-DD, so the first 8 characters plus 01 are the 1st of today's month.
      return { from: `${today.slice(0, 8)}01`, to: today }
  }
}

/**
 * Two calendar days (both inclusive) and shortcuts for the usual periods. A range always runs
 * forward and stays within what the API accepts (from FIRST_DAY to today, and at most maxDays long):
 * moving one end past a limit drags the other along. A day typed out of bounds stays in the input,
 * marked invalid, until it is fixed or the input loses focus.
 */
export function DateRangeFilter({ value, onChange, maxDays, disabled, className }: {
  value: DayRange
  onChange: (range: DayRange) => void
  /** Longest range allowed, e.g. the reports' 366 days. */
  maxDays?: number
  disabled?: boolean
  className?: string
}) {
  const { t } = useTranslation()
  const id = useId()
  const today = useToday()
  // What is typed in each input while it isn't a valid day.
  const [drafts, setDrafts] = useState<Partial<DayRange>>({})

  // A date input reports '' while its day is incomplete or impossible; ISO days compare as strings.
  const valid = (day: string) => day !== '' && day >= FIRST_DAY && day <= today

  function change(end: keyof DayRange, day: string) {
    if (!valid(day)) {
      setDrafts((current) => ({ ...current, [end]: day }))
      return
    }
    setDrafts((current) => ({ ...current, [end]: undefined }))
    if (end === 'from') {
      let to = day > value.to ? day : value.to
      if (maxDays && daysInRange({ from: day, to }) > maxDays) {
        to = addDays(day, maxDays - 1)
      }
      onChange({ from: day, to })
    } else {
      let from = day < value.from ? day : value.from
      if (maxDays && daysInRange({ from, to: day }) > maxDays) {
        from = addDays(day, -(maxDays - 1))
      }
      onChange({ from, to: day })
    }
  }

  const input = (end: keyof DayRange) => {
    const draft = drafts[end]
    return (
      <Input id={`${id}-${end}`} type="date" value={draft ?? value[end]} min={FIRST_DAY} max={today}
        className="h-9 w-40" disabled={disabled} aria-invalid={draft !== undefined}
        onChange={(event) => change(end, event.target.value)}
        onBlur={() => setDrafts((current) => ({ ...current, [end]: undefined }))} />
    )
  }

  return (
    <div className={cn('flex flex-wrap items-end gap-3', className)}>
      <div className="grid gap-2">
        <Label htmlFor={`${id}-from`}>{t('dateRange.from')}</Label>
        {input('from')}
      </div>
      <div className="grid gap-2">
        <Label htmlFor={`${id}-to`}>{t('dateRange.to')}</Label>
        {input('to')}
      </div>
      <div role="group" aria-label={t('dateRange.shortcuts')} className="flex flex-wrap items-center gap-1">
        {presets.map((preset) => {
          const range = presetRange(preset, today)
          const active = range.from === value.from && range.to === value.to
          return (
            <Button key={preset} type="button" size="sm" variant={active ? 'secondary' : 'ghost'} disabled={disabled}
              aria-pressed={active} className="h-9" onClick={() => onChange(range)}>
              {t(`dateRange.${preset}`)}
            </Button>
          )
        })}
        {maxDays && <span className="px-2 text-xs text-muted-foreground">{t('dateRange.maxDays', { count: maxDays })}</span>}
      </div>
    </div>
  )
}
