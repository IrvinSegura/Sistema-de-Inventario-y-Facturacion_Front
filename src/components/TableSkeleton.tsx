import { useTranslation } from 'react-i18next'

import { Card } from '@/components/ui/card'
import { cn } from '@/lib/utils'

// Widths of the placeholder bars, so the rows don't look like a block.
const WIDTHS = ['w-3/4', 'w-1/2', 'w-2/3', 'w-5/6', 'w-2/5']

// Gray rows in the shape of a table while its first page loads, instead of a spinner that pushes the
// page down and back.
export function TableSkeleton({ rows = 8, columns = 5 }: { rows?: number; columns?: number }) {
  const { t } = useTranslation()
  return (
    <Card className="gap-0 py-0" role="status" aria-label={t('app.loading')}>
      <div className="flex h-10 items-center gap-6 border-b bg-muted/50 px-4">
        {Array.from({ length: columns }, (_, column) => (
          <span key={column} className={cn('h-3 flex-1 animate-pulse rounded bg-muted-foreground/15', column === 0 && 'flex-2')} />
        ))}
      </div>
      {Array.from({ length: rows }, (_, row) => (
        <div key={row} className="flex h-14 items-center gap-6 border-b px-4 last:border-b-0">
          {Array.from({ length: columns }, (_, column) => (
            <span key={column} className={cn('flex flex-1', column === 0 && 'flex-2 items-center gap-3')}>
              {column === 0 && <span className="size-9 shrink-0 animate-pulse rounded-full bg-muted" />}
              <span className={cn('h-3 animate-pulse rounded bg-muted', WIDTHS[(row + column) % WIDTHS.length])}
                style={{ animationDelay: `${row * 60}ms` }} />
            </span>
          ))}
        </div>
      ))}
    </Card>
  )
}
