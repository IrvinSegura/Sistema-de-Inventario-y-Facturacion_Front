import { ChevronLeft, ChevronRight, ChevronsLeft, ChevronsRight } from 'lucide-react'
import { useTranslation } from 'react-i18next'

import { Button } from '@/components/ui/button'
import { Select } from '@/components/ui/select'
import { PAGE_SIZES } from '@/lib/use-page-size'

// Footer of a paged table: "21–40 of 75", rows per page (when the page offers the choice), "Page 2
// of 4" and first/previous/next/last (disabled while a page loads).
export function Pagination({ page, pageSize, total, loading, onPageChange, onPageSizeChange }: {
  page: number
  pageSize: number
  total: number
  loading: boolean
  onPageChange: (page: number) => void
  onPageSizeChange?: (size: number) => void
}) {
  const { t } = useTranslation()
  const pages = Math.max(1, Math.ceil(total / pageSize))
  const from = total === 0 ? 0 : page * pageSize + 1
  const to = Math.min(total, (page + 1) * pageSize)
  const first = page === 0 || loading
  const last = page + 1 >= pages || loading

  return (
    <div className="flex flex-wrap items-center justify-between gap-x-6 gap-y-3 border-t px-4 py-3 text-sm text-muted-foreground">
      <span className="tabular-nums">{t('pagination.range', { from, to, total })}</span>
      <div className="flex flex-wrap items-center gap-x-6 gap-y-2">
        {onPageSizeChange && (
          <label className="flex items-center gap-2">
            <span className="hidden sm:inline">{t('pagination.rowsPerPage')}</span>
            <Select aria-label={t('pagination.rowsPerPage')} className="h-8 w-20" value={String(pageSize)}
              onValueChange={(value) => value && onPageSizeChange(Number(value))}
              options={PAGE_SIZES.map((size) => ({ value: String(size), label: String(size) }))} />
          </label>
        )}
        <span className="tabular-nums">{t('pagination.pageOf', { page: page + 1, pages })}</span>
        <div className="flex gap-1">
          <Button variant="outline" size="icon" aria-label={t('pagination.first')} title={t('pagination.first')}
            className="hidden sm:inline-flex" disabled={first} onClick={() => onPageChange(0)}>
            <ChevronsLeft />
          </Button>
          <Button variant="outline" size="icon" aria-label={t('pagination.previous')} title={t('pagination.previous')}
            disabled={first} onClick={() => onPageChange(page - 1)}>
            <ChevronLeft />
          </Button>
          <Button variant="outline" size="icon" aria-label={t('pagination.next')} title={t('pagination.next')}
            disabled={last} onClick={() => onPageChange(page + 1)}>
            <ChevronRight />
          </Button>
          <Button variant="outline" size="icon" aria-label={t('pagination.last')} title={t('pagination.last')}
            className="hidden sm:inline-flex" disabled={last} onClick={() => onPageChange(pages - 1)}>
            <ChevronsRight />
          </Button>
        </div>
      </div>
    </div>
  )
}
