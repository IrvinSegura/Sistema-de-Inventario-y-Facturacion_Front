import { ChevronLeft, ChevronRight } from 'lucide-react'
import { useTranslation } from 'react-i18next'

import { Button } from '@/components/ui/button'

// Footer of a paged table: "21–40 of 75" and previous/next buttons (disabled while a page loads).
export function Pagination({ page, pageSize, total, loading, onPageChange }: {
  page: number
  pageSize: number
  total: number
  loading: boolean
  onPageChange: (page: number) => void
}) {
  const { t } = useTranslation()
  const from = total === 0 ? 0 : page * pageSize + 1
  const to = Math.min(total, (page + 1) * pageSize)

  return (
    <div className="flex items-center justify-between gap-4 border-t px-4 py-3 text-sm text-muted-foreground">
      <span className="tabular-nums">{t('pagination.range', { from, to, total })}</span>
      <div className="flex gap-1">
        <Button variant="outline" size="icon" aria-label={t('pagination.previous')}
          disabled={page === 0 || loading} onClick={() => onPageChange(page - 1)}>
          <ChevronLeft />
        </Button>
        <Button variant="outline" size="icon" aria-label={t('pagination.next')}
          disabled={to >= total || loading} onClick={() => onPageChange(page + 1)}>
          <ChevronRight />
        </Button>
      </div>
    </div>
  )
}
