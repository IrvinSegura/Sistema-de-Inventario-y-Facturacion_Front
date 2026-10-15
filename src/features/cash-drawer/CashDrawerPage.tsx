import { zodResolver } from '@hookform/resolvers/zod'
import { useForm } from 'react-hook-form'
import { toast } from 'sonner'
import { z } from 'zod'

import { errorMessage } from '@/api/errors'
import { FullPageSpinner } from '@/components/FullPageSpinner'
import { Alert, AlertDescription, AlertTitle } from '@/components/ui/alert'
import { Button } from '@/components/ui/button'
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from '@/components/ui/card'
import { Input } from '@/components/ui/input'
import { Label } from '@/components/ui/label'
import { formatMoney } from '@/lib/money'
import { cn } from '@/lib/utils'

import {
  type CashDrawer,
  useCloseDrawer,
  useCurrentDrawer,
  useLatestDrawer,
  useOpenDrawer,
} from './queries'

// Up to 2 decimals, within the API's limits.
const amount = (max: number) =>
  z.coerce
    .number({ error: 'Enter an amount' })
    .min(0, 'Must be zero or more')
    .max(max, `Must be at most ${formatMoney(max)}`)
    // Tolerance: 0.1 * 100 is 10.000000000000002 in floating point.
    .refine((value) => Math.abs(value * 100 - Math.round(value * 100)) < 1e-6, 'Use at most 2 decimals')

const openSchema = z.object({ openingFloat: amount(999_999.99) })
const closeSchema = z.object({
  countedCash: amount(9_999_999.99),
  note: z.string().trim().max(255, 'At most 255 characters').optional(),
})

export function CashDrawerPage() {
  const current = useCurrentDrawer()
  const latest = useLatestDrawer(current.data === null)

  if (current.isPending) {
    return <FullPageSpinner />
  }
  if (current.isError) {
    return <ErrorAlert message={errorMessage(current.error)} />
  }
  return (
    <div className="grid gap-4 md:grid-cols-2">
      {current.data ? <CloseDrawerCard drawer={current.data} /> : <OpenDrawerCard />}
      {!current.data && latest.data?.closing && <ClosingSummaryCard drawer={latest.data} />}
    </div>
  )
}

function OpenDrawerCard() {
  const openDrawer = useOpenDrawer()
  const { register, handleSubmit, formState: { errors } } = useForm({
    resolver: zodResolver(openSchema),
    defaultValues: { openingFloat: 0 },
  })

  const onSubmit = handleSubmit(({ openingFloat }) =>
    openDrawer.mutate(openingFloat, {
      onSuccess: () => toast.success('Cash drawer opened. You can start selling.'),
    }))

  return (
    <Card>
      <CardHeader>
        <CardTitle>Open your cash drawer</CardTitle>
        <CardDescription>Count the change you start the day with. Sales need an open drawer.</CardDescription>
      </CardHeader>
      <CardContent>
        <form onSubmit={onSubmit} className="grid gap-4" noValidate>
          {openDrawer.isError && <ErrorAlert message={errorMessage(openDrawer.error)} />}
          <div className="grid gap-2">
            <Label htmlFor="openingFloat">Opening float (MXN)</Label>
            <Input id="openingFloat" type="number" inputMode="decimal" step="0.01" min="0" autoFocus
              aria-invalid={!!errors.openingFloat} {...register('openingFloat')} />
            {errors.openingFloat && <p className="text-sm text-destructive">{errors.openingFloat.message}</p>}
          </div>
          <Button type="submit" size="lg" disabled={openDrawer.isPending}>
            {openDrawer.isPending ? 'Opening…' : 'Open drawer'}
          </Button>
        </form>
      </CardContent>
    </Card>
  )
}

function CloseDrawerCard({ drawer }: { drawer: CashDrawer }) {
  const closeDrawer = useCloseDrawer()
  const { register, handleSubmit, formState: { errors } } = useForm({ resolver: zodResolver(closeSchema) })

  const onSubmit = handleSubmit(({ countedCash, note }) =>
    closeDrawer.mutate({ id: drawer.id!, countedCash, note: note || undefined }, {
      onSuccess: () => toast.success('Cash drawer closed.'),
    }))

  return (
    <Card>
      <CardHeader>
        <CardTitle>Drawer open · {drawer.businessDate}</CardTitle>
        <CardDescription>
          Opened at {formatTime(drawer.openedAt!)} with {formatMoney(drawer.openingFloat!)}.
        </CardDescription>
      </CardHeader>
      <CardContent>
        <form onSubmit={onSubmit} className="grid gap-4" noValidate>
          {closeDrawer.isError && <ErrorAlert message={errorMessage(closeDrawer.error)} />}
          {/* Blind count: the expected cash is only shown after the count is recorded. */}
          <p className="text-sm text-muted-foreground">
            Count every bill and coin in the drawer, opening float included. After closing you can't sell
            until the next day's drawer is opened.
          </p>
          <div className="grid gap-2">
            <Label htmlFor="countedCash">Counted cash (MXN)</Label>
            <Input id="countedCash" type="number" inputMode="decimal" step="0.01" min="0" autoFocus
              aria-invalid={!!errors.countedCash} {...register('countedCash')} />
            {errors.countedCash && <p className="text-sm text-destructive">{errors.countedCash.message}</p>}
          </div>
          <div className="grid gap-2">
            <Label htmlFor="note">Note (optional)</Label>
            <Input id="note" maxLength={255} {...register('note')} />
            {errors.note && <p className="text-sm text-destructive">{errors.note.message}</p>}
          </div>
          <Button type="submit" size="lg" variant="destructive" disabled={closeDrawer.isPending}>
            {closeDrawer.isPending ? 'Closing…' : 'Close drawer'}
          </Button>
        </form>
      </CardContent>
    </Card>
  )
}

function ClosingSummaryCard({ drawer }: { drawer: CashDrawer }) {
  const closing = drawer.closing!
  const difference = closing.difference!
  return (
    <Card>
      <CardHeader>
        <CardTitle>Last closing · {drawer.businessDate}</CardTitle>
        <CardDescription>Closed at {formatTime(closing.closedAt!)} by {closing.closedBy?.name}.</CardDescription>
      </CardHeader>
      <CardContent>
        <dl className="grid grid-cols-2 gap-y-2 text-sm">
          <dt className="text-muted-foreground">Opening float</dt>
          <dd className="text-right tabular-nums">{formatMoney(drawer.openingFloat!)}</dd>
          <dt className="text-muted-foreground">Expected cash</dt>
          <dd className="text-right tabular-nums">{formatMoney(closing.expectedCash!)}</dd>
          <dt className="text-muted-foreground">Counted cash</dt>
          <dd className="text-right tabular-nums">{formatMoney(closing.countedCash!)}</dd>
          <dt className="font-medium">{difference < 0 ? 'Shortage' : difference > 0 ? 'Surplus' : 'Difference'}</dt>
          <dd className={cn('text-right font-medium tabular-nums',
            difference < 0 && 'text-destructive', difference > 0 && 'text-amber-600')}>
            {formatMoney(difference)}
          </dd>
        </dl>
        {closing.note && <p className="mt-4 text-sm text-muted-foreground">Note: {closing.note}</p>}
      </CardContent>
    </Card>
  )
}

function ErrorAlert({ message }: { message: string }) {
  return (
    <Alert variant="destructive">
      <AlertTitle>Couldn't complete the request</AlertTitle>
      <AlertDescription>{message}</AlertDescription>
    </Alert>
  )
}

function formatTime(instant: string): string {
  return new Date(instant).toLocaleTimeString('es-MX', { hour: '2-digit', minute: '2-digit' })
}
