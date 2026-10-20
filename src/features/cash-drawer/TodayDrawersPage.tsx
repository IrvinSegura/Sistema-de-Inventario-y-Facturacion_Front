import { Eye, Plus } from 'lucide-react'
import { useState } from 'react'
import { useTranslation } from 'react-i18next'

import { errorMessage } from '@/api/errors'
import { ErrorAlert } from '@/components/ErrorAlert'
import { LoadingBlock } from '@/components/LoadingBlock'
import { Alert, AlertDescription, AlertTitle } from '@/components/ui/alert'
import { Badge } from '@/components/ui/badge'
import { Button } from '@/components/ui/button'
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from '@/components/ui/card'
import { Table, TableBody, TableCell, TableHead, TableHeader, TableRow } from '@/components/ui/table'
import { addDays } from '@/features/dashboard/days'
import { formatMoney } from '@/lib/money'
import { useToday } from '@/lib/use-today'
import { cn } from '@/lib/utils'

import { DrawerDetailDialog } from './DrawerDetailDialog'
import { DrawerStatus, PaymentMethodSection, SharedBadge } from './DrawerParts'
import { differenceClass, formatDate } from './format'
import { memberNames } from './members'
import { OpenAssignedDrawerDialog } from './OpenAssignedDrawerDialog'
import { type CashDrawer, useAssignableSellers, useDayClosing, useDrawers } from './queries'

// How far back to look for drawers someone forgot to close.
const STALE_LOOKBACK_DAYS = 7
const MAX_STALE = 100

// Admins and supervisors: every drawer of today, the store's day so far and forgotten drawers; they
// also open drawers for sellers, alone or shared.
export function TodayDrawersPage() {
  const { t, i18n } = useTranslation()
  const today = useToday()
  const day = useDayClosing(today)
  const recent = useDrawers({ from: addDays(today, -STALE_LOOKBACK_DAYS), to: addDays(today, -1) }, 0, MAX_STALE)
  // Sellers with no drawer today (nor one left open): the ones a manager can still assign.
  const assignable = useAssignableSellers()
  const [selected, setSelected] = useState<CashDrawer | null>(null)
  const [assigning, setAssigning] = useState(false)

  if (day.isPending) {
    return <LoadingBlock />
  }
  if (day.isError) {
    return <ErrorAlert message={errorMessage(day.error)} />
  }

  const drawers = day.data.drawers ?? []
  const stale = recent.data?.content?.filter((drawer) => !drawer.closing) ?? []
  const notOpened = assignable.data ?? []
  const openCount = drawers.filter((drawer) => !drawer.closing).length

  return (
    <div className="grid gap-4">
      {stale.length > 0 && (
        <Alert variant="destructive">
          <AlertTitle>{t('drawer.today.staleTitle', { count: stale.length })}</AlertTitle>
          <AlertDescription>
            <ul className="mt-1 grid gap-1">
              {stale.map((drawer) => (
                <li key={drawer.id} className="flex flex-wrap items-center gap-2">
                  <span>{memberNames(drawer)} · {formatDate(drawer.businessDate!, i18n.language)}</span>
                  <Button size="sm" variant="outline" onClick={() => setSelected(drawer)}>
                    {t('drawer.today.review')}
                  </Button>
                </li>
              ))}
            </ul>
          </AlertDescription>
        </Alert>
      )}

      <div className="grid gap-4 lg:grid-cols-[1fr_22rem]">
        <Card className="gap-0 py-0">
          <CardHeader className="flex flex-wrap items-start justify-between gap-3 border-b py-4">
            <div className="grid gap-1.5">
              <CardTitle>{t('drawer.today.drawersTitle', { date: formatDate(today, i18n.language) })}</CardTitle>
              <CardDescription>{t('drawer.today.openCount', { open: openCount, total: drawers.length })}</CardDescription>
            </div>
            <Button size="sm" onClick={() => setAssigning(true)} disabled={!assignable.data}>
              <Plus />
              {t('drawer.open')}
            </Button>
          </CardHeader>
          {drawers.length === 0 && notOpened.length === 0 ? (
            <p className="px-4 py-12 text-center text-sm text-muted-foreground">{t('drawer.today.empty')}</p>
          ) : (
            <Table>
              <TableHeader className="bg-muted/50">
                <TableRow>
                  <TableHead className="pl-4">{t('drawer.columns.seller')}</TableHead>
                  <TableHead>{t('drawer.columns.status')}</TableHead>
                  <TableHead className="hidden text-right sm:table-cell">{t('drawer.columns.float')}</TableHead>
                  <TableHead className="text-right">{t('drawer.columns.difference')}</TableHead>
                  <TableHead className="w-12 pr-4"><span className="sr-only">{t('drawer.columns.actions')}</span></TableHead>
                </TableRow>
              </TableHeader>
              <TableBody>
                {drawers.map((drawer) => (
                  <TableRow key={drawer.id}>
                    <TableCell className="pl-4 font-medium">
                      <span className="flex flex-wrap items-center gap-2">{memberNames(drawer)}<SharedBadge drawer={drawer} /></span>
                    </TableCell>
                    <TableCell><DrawerStatus drawer={drawer} /></TableCell>
                    <TableCell className="hidden text-right tabular-nums sm:table-cell">
                      {formatMoney(drawer.openingFloat!)}
                    </TableCell>
                    <TableCell className={cn('text-right', drawer.closing && differenceClass(drawer.closing.difference!))}>
                      {drawer.closing ? formatMoney(drawer.closing.difference!) : '—'}
                    </TableCell>
                    <TableCell className="pr-4 text-right">
                      <Button variant="ghost" size="icon" onClick={() => setSelected(drawer)}
                        aria-label={t('drawer.today.view', { name: memberNames(drawer) })}>
                        <Eye />
                      </Button>
                    </TableCell>
                  </TableRow>
                ))}
                {notOpened.map((account) => (
                  <TableRow key={`user-${account.id}`} className="text-muted-foreground">
                    <TableCell className="pl-4">{account.name}</TableCell>
                    <TableCell><Badge variant="outline">{t('drawer.status.notOpened')}</Badge></TableCell>
                    <TableCell className="hidden text-right sm:table-cell">—</TableCell>
                    <TableCell className="text-right">—</TableCell>
                    <TableCell className="pr-4" />
                  </TableRow>
                ))}
              </TableBody>
            </Table>
          )}
        </Card>

        <Card className="content-start">
          <CardHeader>
            <CardTitle>{t('drawer.today.dayTitle')}</CardTitle>
            <CardDescription>
              {day.data.closed ? t('drawer.today.dayClosed') : t('drawer.today.dayInProgress')}
            </CardDescription>
          </CardHeader>
          <CardContent className="grid gap-4">
            <dl className="grid grid-cols-2 gap-y-2 text-sm">
              <dt className="text-muted-foreground">{t('drawer.today.floats')}</dt>
              <dd className="text-right tabular-nums">{formatMoney(day.data.openingFloat ?? 0)}</dd>
              <dt className="font-medium">{t('drawer.today.expectedInDrawers')}</dt>
              <dd className="text-right font-medium tabular-nums">{formatMoney(day.data.expectedCash ?? 0)}</dd>
            </dl>
            <PaymentMethodSection closing={day} />
          </CardContent>
        </Card>
      </div>

      <DrawerDetailDialog drawer={selected} onOpenChange={(open) => !open && setSelected(null)} />
      <OpenAssignedDrawerDialog open={assigning} onOpenChange={setAssigning} sellers={assignable.data ?? []} />
    </div>
  )
}
