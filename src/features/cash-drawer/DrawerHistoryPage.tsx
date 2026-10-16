import { Eye, History } from 'lucide-react'
import { useState } from 'react'
import { useTranslation } from 'react-i18next'

import { errorMessage } from '@/api/errors'
import { managesStore, useUser } from '@/auth/auth-context'
import { ErrorAlert } from '@/components/ErrorAlert'
import { FullPageSpinner } from '@/components/FullPageSpinner'
import { Pagination } from '@/components/Pagination'
import { Button } from '@/components/ui/button'
import { Card } from '@/components/ui/card'
import { Input } from '@/components/ui/input'
import { Label } from '@/components/ui/label'
import { Select } from '@/components/ui/select'
import { Table, TableBody, TableCell, TableHead, TableHeader, TableRow } from '@/components/ui/table'
import { addDays, toDay } from '@/features/dashboard/days'
import { formatMoney } from '@/lib/money'
import { cn } from '@/lib/utils'

import { DrawerDetailDialog } from './DrawerDetailDialog'
import { DrawerStatus, SharedBadge } from './DrawerParts'
import { differenceClass, formatDate } from './format'
import { memberNames } from './members'
import { type CashDrawer, type DrawerSearch, HISTORY_PAGE_SIZE, useDrawers, useStoreUsers } from './queries'

const DEFAULT_RANGE_DAYS = 30
const ALL_SELLERS = 'all'

// Past drawers by business day; sellers see the ones they were in, managers everyone's.
export function DrawerHistoryPage() {
  const { t, i18n } = useTranslation()
  const user = useUser()
  const manager = managesStore(user.role)
  const [today] = useState(() => toDay(new Date()))
  const [from, setFrom] = useState(addDays(today, -DEFAULT_RANGE_DAYS))
  const [to, setTo] = useState(today)
  const [seller, setSeller] = useState(ALL_SELLERS)
  const [page, setPage] = useState(0)
  const [selected, setSelected] = useState<CashDrawer | null>(null)
  // Only admins can list accounts to filter by seller.
  const users = useStoreUsers(user.role === 'ADMIN')

  const search: DrawerSearch = { from, to, userId: seller === ALL_SELLERS ? undefined : Number(seller) }
  const drawers = useDrawers(search, page)

  // A range always runs forward: moving one end past the other drags it along.
  function changeFrom(value: string) {
    if (!value) {
      return
    }
    setFrom(value)
    if (value > to) {
      setTo(value)
    }
    setPage(0)
  }

  function changeTo(value: string) {
    if (!value) {
      return
    }
    setTo(value)
    if (value < from) {
      setFrom(value)
    }
    setPage(0)
  }

  return (
    <div className="grid gap-4">
      <div className="flex flex-wrap items-end gap-3">
        <div className="grid gap-2">
          <Label htmlFor="history-from">{t('drawer.history.from')}</Label>
          <Input id="history-from" type="date" value={from} max={today} className="w-40"
            onChange={(event) => changeFrom(event.target.value)} />
        </div>
        <div className="grid gap-2">
          <Label htmlFor="history-to">{t('drawer.history.to')}</Label>
          <Input id="history-to" type="date" value={to} max={today} className="w-40"
            onChange={(event) => changeTo(event.target.value)} />
        </div>
        {users.data && (
          <div className="grid gap-2">
            <Label htmlFor="history-seller">{t('drawer.columns.seller')}</Label>
            <Select id="history-seller" className="h-9 w-52" value={seller}
              onValueChange={(value) => {
                setSeller(value || ALL_SELLERS)
                setPage(0)
              }}
              options={[
                { value: ALL_SELLERS, label: t('drawer.history.allSellers') },
                ...users.data.map((account) => ({ value: String(account.id), label: account.name })),
              ]} />
          </div>
        )}
      </div>

      {drawers.isPending ? (
        <FullPageSpinner />
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
          <Table>
            <TableHeader className="bg-muted/50">
              <TableRow>
                <TableHead className="pl-4">{t('drawer.columns.date')}</TableHead>
                {manager && <TableHead>{t('drawer.columns.seller')}</TableHead>}
                <TableHead className="hidden md:table-cell">{t('drawer.columns.status')}</TableHead>
                <TableHead className="hidden text-right lg:table-cell">{t('drawer.columns.float')}</TableHead>
                <TableHead className="hidden text-right sm:table-cell">{t('drawer.columns.expected')}</TableHead>
                <TableHead className="hidden text-right sm:table-cell">{t('drawer.columns.counted')}</TableHead>
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
          <Pagination page={page} pageSize={HISTORY_PAGE_SIZE} total={drawers.data.page?.totalElements ?? 0}
            loading={drawers.isPlaceholderData} onPageChange={setPage} />
        </Card>
      )}

      <DrawerDetailDialog drawer={selected} onOpenChange={(open) => !open && setSelected(null)} />
    </div>
  )
}
