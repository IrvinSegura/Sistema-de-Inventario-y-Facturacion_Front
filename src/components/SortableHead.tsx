import { ArrowDown, ArrowUp, ChevronsUpDown } from 'lucide-react'
import type { ReactNode } from 'react'
import { useTranslation } from 'react-i18next'

import { TableHead } from '@/components/ui/table'
import { nextSort, type SortDirection, type SortState } from '@/lib/sort'
import { cn } from '@/lib/utils'

// Table header that orders the list by its field: click for its first direction, again for the
// other, a third time for the list's default order. The arrow shows the current one.
export function SortableHead({ field, sort, onSort, first = 'asc', align = 'left', className, children }: {
  field: string
  sort: SortState | null
  onSort: (sort: SortState | null) => void
  // asc for text; desc for amounts, quantities and dates (largest or newest first).
  first?: SortDirection
  align?: 'left' | 'right'
  className?: string
  children: ReactNode
}) {
  const { t } = useTranslation()
  const active = sort?.field === field ? sort.direction : null
  const Icon = active === 'asc' ? ArrowUp : active === 'desc' ? ArrowDown : ChevronsUpDown

  return (
    <TableHead className={cn(align === 'right' && 'text-right', className)}
      aria-sort={active === 'asc' ? 'ascending' : active === 'desc' ? 'descending' : 'none'}>
      <button type="button" onClick={() => onSort(nextSort(sort, field, first))}
        title={t('sort.by', { column: typeof children === 'string' ? children : '' })}
        className={cn(
          'group/sort -mx-1.5 inline-flex items-center gap-1 rounded-md px-1.5 py-1 font-medium transition-colors outline-none',
          'hover:bg-muted hover:text-foreground focus-visible:ring-2 focus-visible:ring-ring/50',
          align === 'right' && 'flex-row-reverse',
          active ? 'text-foreground' : 'text-foreground/80',
        )}>
        {children}
        <Icon className={cn('size-3.5 shrink-0', active ? 'text-primary' : 'text-muted-foreground/50 group-hover/sort:text-muted-foreground')} />
      </button>
    </TableHead>
  )
}
