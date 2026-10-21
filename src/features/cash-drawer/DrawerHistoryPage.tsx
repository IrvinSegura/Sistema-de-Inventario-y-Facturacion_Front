import { Eye, History } from 'lucide-react'
import { useState } from 'react'
import { useTranslation } from 'react-i18next'

import { errorMessage } from '@/api/errors'
import { managesStore, useUser } from '@/auth/auth-context'
import { DateRangeFilter } from '@/components/DateRangeFilter'
import { ErrorAlert } from '@/components/ErrorAlert'
import { Pagination } from '@/components/Pagination'
import { SortableHead } from '@/components/SortableHead'
import { TableSkeleton } from '@/components/TableSkeleton'
import { Button } from '@/components/ui/button'
import { Card } from '@/components/ui/card'
import { Label } from '@/components/ui/label'
import { Select } from '@/components/ui/select'
import { Table, TableBody, TableCell, TableHead, TableHeader, TableRow } from '@/components/ui/table'
import { type DayRange, lastDaysRange } from '@/features/dashboard/days'
import { useSellerOptions } from '@/features/sales/use-seller-options'
import { formatMoney } from '@/lib/money'
import { type SortState } from '@/lib/sort'
import { usePageSize } from '@/lib/use-page-size'
import { cn } from '@/lib/utils'

import { DrawerDetailDialog } from './DrawerDetailDialog'
import { DrawerStatus, SharedBadge } from './DrawerParts'
import { differenceClass, formatDate } from './format'
import { memberNames } from './members'
import { type CashDrawer, type DrawerSearch, useDrawers } from './queries'

const DEFAULT_RANGE_DAYS = 30
const ALL_SELLERS = 'all'

/** Past drawers by business day; sellers see the ones they were in, managers everyone's. */
export function DrawerHistoryPage() {
  const { t, i18n } = useTranslation()
  const user = useUser()
  const manager = managesStore(user.role)
  const [range, setRange] = useState<DayRange>(() => lastDaysRange(DEFAULT_RANGE_DAYS))
  const [seller, setSeller] = useState(ALL_SELLERS)
  const [page, setPage] = useState(0)
  const [pageSize, setPageSize] = usePageSize('drawer-history')
  // null sends no sort, so the API's default applies: newest business day first.
  const [sort, setSort] = useState<SortState | null>(null)
  const [selected, setSelected] = useState<CashDrawer | null>(null)
  // Managers filter by seller; only sellers have drawers.
  const sellers = useSellerOptions(range, manager)

  const search: DrawerSearch = { ...range, sellerId: seller === ALL_SELLERS ? undefined : Number(seller) }
  const drawers = useDrawers(search, page, pageSize, sort)
  const changeSort = (next: SortState | null) => {
    setSort(next)
    setPage(0)
  }

  return (
    <div className="grid gap-4">
      <div className="flex flex-wrap items-end gap-3">
        <DateRangeFilter value={range} onChange={(next) => {
          setRange(next)
          setPage(0)
        }} />
        {manager && (
          <div className="grid gap-2">
            <Label htmlFor="history-seller">{t('drawer.columns.seller')}</Label>
            <Select id="history-seller" className="h-9 w-52" value={seller}
              onValueChange={(value) => {
                setSeller(value || ALL_SELLERS)
                setPage(0)
              }}
              options={[
                { value: ALL_SELLERS, label: t('drawer.history.allSellers') },
                ...sellers.map((option) => ({ value: String(option.id), label: option.name })),
              ]} />
          </div>
        )}
      </div>

      {drawers.isPending ? (
        <TableSkeleton />
      ) : drawers.isError ? (
        <ErrorAlert message={errorMessage(drawers.error)} />
      ) : (drawers.data.content ?? []).length === 0 ? (
        <Card className="flex flex-col items-center gap-3 px-4 py-16 text-center">
          <span className="flex size-12 items-center justify-center rounded-full bg-muted">
            <History className="size-6 text-muted-foreground" />
          </span>
          <p className="text-sm text-muted-foreground">{t('drawer.history.empty')}</p>
        </Card>
      ) : (
        <Card className="gap-0 py-0">
          <Table stickyHeader>
            <TableHeader className="bg-muted/50">
              <TableRow>
                <SortableHead field="businessDate" first="desc" sort={sort} onSort={changeSort} className="pl-4">{t('drawer.columns.date')}</SortableHead>
                {manager && <TableHead>{t('drawer.columns.seller')}</TableHead>}
                <TableHead className="hidden md:table-cell">{t('drawer.columns.status')}</TableHead>
                <SortableHead field="openingFloat" first="desc" align="right" sort={sort} onSort={changeSort} className="hidden lg:table-cell">{t('drawer.columns.float')}</SortableHead>
                <SortableHead field="expectedCash" first="desc" align="right" sort={sort} onSort={changeSort} className="hidden sm:table-cell">{t('drawer.columns.expected')}</SortableHead>
                <SortableHead field="countedCash" first="desc" align="right" sort={sort} onSort={changeSort} className="hidden sm:table-cell">{t('drawer.columns.counted')}</SortableHead>
                <TableHead className="text-right">{t('drawer.columns.difference')}</TableHead>
                <TableHead className="w-12 pr-4"><span className="sr-only">{t('drawer.columns.actions')}</span></TableHead>
              </TableRow>
            </TableHeader>
            <TableBody>
              {drawers.data.content!.map((drawer) => (
                <TableRow key={drawer.id}>
                  <TableCell className="pl-4 whitespace-nowrap">{formatDate(drawer.businessDate!, i18n.language)}</TableCell>
                  {manager && (
                    <TableCell className="font-medium">
                      <span className="flex flex-wrap items-center gap-2">{memberNames(drawer)}<SharedBadge drawer={drawer} /></span>
                    </TableCell>
                  )}
                  <TableCell className="hidden md:table-cell"><DrawerStatus drawer={drawer} /></TableCell>
                  <TableCell className="hidden text-right tabular-nums lg:table-cell">{formatMoney(drawer.openingFloat!)}</TableCell>
                  <TableCell className="hidden text-right tabular-nums sm:table-cell">
                    {drawer.closing ? formatMoney(drawer.closing.expectedCash!) : '—'}
                  </TableCell>
                  <TableCell className="hidden text-right tabular-nums sm:table-cell">
                    {drawer.closing ? formatMoney(drawer.closing.countedCash!) : '—'}
                  </TableCell>
                  <TableCell className={cn('text-right', drawer.closing && differenceClass(drawer.closing.difference!))}>
                    {drawer.closing ? formatMoney(drawer.closing.difference!) : '—'}
                  </TableCell>
                  <TableCell className="pr-4 text-right">
                    <Button variant="ghost" size="icon" onClick={() => setSelected(drawer)}
                      aria-label={t('drawer.history.view', { date: formatDate(drawer.businessDate!, i18n.language) })}>
                      <Eye />
                    </Button>
                  </TableCell>
                </TableRow>
              ))}
            </TableBody>
          </Table>
          <Pagination page={page} pageSize={pageSize} total={drawers.data.page?.totalElements ?? 0}
            loading={drawers.isPlaceholderData} onPageChange={setPage}
            onPageSizeChange={(size) => {
              setPageSize(size)
              setPage(0)
            }} />
        </Card>
      )}

      <DrawerDetailDialog drawer={selected} onOpenChange={(open) => !open && setSelected(null)} />
    </div>
  )
}
