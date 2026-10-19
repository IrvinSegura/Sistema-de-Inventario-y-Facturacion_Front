import { useId } from 'react'
import { useTranslation } from 'react-i18next'

import { Button } from '@/components/ui/button'
import { Input } from '@/components/ui/input'
import { Label } from '@/components/ui/label'
import { addDays, type DayRange, todayDay } from '@/features/dashboard/days'
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
      return { from: `${today.slice(0, 8)}01`, to: today }
  }
}

// Two calendar days (both inclusive) and shortcuts for the usual periods. A range always runs
// forward: moving one end past the other drags it along.
export function DateRangeFilter({ value, onChange, disabled, className }: {
  value: DayRange
  onChange: (range: DayRange) => void
  disabled?: boolean
  className?: string
}) {
  const { t } = useTranslation()
  const id = useId()
  const today = todayDay()

  function changeFrom(from: string) {
    if (from) {
      onChange({ from, to: from > value.to ? from : value.to })
    }
  }

  function changeTo(to: string) {
    if (to) {
      onChange({ from: to < value.from ? to : value.from, to })
    }
  }

  return (
    <div className={cn('flex flex-wrap items-end gap-3', className)}>
      <div className="grid gap-2">
        <Label htmlFor={`${id}-from`}>{t('dateRange.from')}</Label>
        <Input id={`${id}-from`} type="date" value={value.from} max={today} className="h-9 w-40" disabled={disabled}
          onChange={(event) => changeFrom(event.target.value)} />
      </div>
      <div className="grid gap-2">
        <Label htmlFor={`${id}-to`}>{t('dateRange.to')}</Label>
        <Input id={`${id}-to`} type="date" value={value.to} max={today} className="h-9 w-40" disabled={disabled}
          onChange={(event) => changeTo(event.target.value)} />
      </div>
      <div role="group" aria-label={t('dateRange.shortcuts')} className="flex flex-wrap gap-1">
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
      </div>
    </div>
  )
}
