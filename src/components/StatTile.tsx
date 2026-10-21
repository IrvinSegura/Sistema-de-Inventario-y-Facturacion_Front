import type { ReactNode } from 'react'

import { Card, CardContent } from '@/components/ui/card'

/** One figure of a summary row; value undefined shows a placeholder while it loads. */
export function StatTile({ label, value, hint, className }: {
  label: string
  value?: ReactNode
  hint?: ReactNode
  className?: string
}) {
  return (
    <Card size="sm" className={className}>
      <CardContent className="grid gap-1">
        <p className="text-sm text-muted-foreground">{label}</p>
        {value === undefined ? (
          <span className="my-1 h-7 w-28 animate-pulse rounded-md bg-muted" />
        ) : (
          <p className="text-2xl font-semibold tracking-tight tabular-nums">{value}</p>
        )}
        {hint && <p className="text-xs text-muted-foreground">{hint}</p>}
      </CardContent>
    </Card>
  )
}
