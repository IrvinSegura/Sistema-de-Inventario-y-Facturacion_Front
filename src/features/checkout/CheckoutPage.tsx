import { Minus, Plus, ScanBarcode, Trash2 } from 'lucide-react'
import { type FormEvent, useReducer, useRef, useState } from 'react'
import { Trans, useTranslation } from 'react-i18next'
import { Link } from 'react-router'
import { toast } from 'sonner'

import { ApiError, errorMessage } from '@/api/errors'
import { FullPageSpinner } from '@/components/FullPageSpinner'
import { Alert, AlertDescription, AlertTitle } from '@/components/ui/alert'
import { Button } from '@/components/ui/button'
import { Card, CardContent, CardFooter, CardHeader, CardTitle } from '@/components/ui/card'
import { Input } from '@/components/ui/input'
import { Label } from '@/components/ui/label'
import { Table, TableBody, TableCell, TableHead, TableHeader, TableRow } from '@/components/ui/table'
import { useCurrentDrawer } from '@/features/cash-drawer/queries'
import { formatMoney } from '@/lib/money'
import { cn } from '@/lib/utils'

import { type CartAction, cartReducer, cartTotals } from './cart'
import { findProductByBarcode, type PaymentMethod, type Sale, useRecordSale } from './queries'
import { ReceiptDialog } from './ReceiptDialog'

const paymentMethods: PaymentMethod[] = ['CASH', 'CARD', 'TRANSFER']

export function CheckoutPage() {
  const { t } = useTranslation()
  const drawer = useCurrentDrawer()
  const recordSale = useRecordSale()
  const [lines, dispatchCart] = useReducer(cartReducer, [])
  const [paymentMethod, setPaymentMethod] = useState<PaymentMethod>('CASH')
  const [cashReceived, setCashReceived] = useState('')
  const [barcode, setBarcode] = useState('')
  const [scanning, setScanning] = useState(false)
  const [receipt, setReceipt] = useState<Sale | null>(null)
  const barcodeInput = useRef<HTMLInputElement>(null)
  // One key per checkout: kept across retries of the same cart, renewed when the cart changes.
  const idempotencyKey = useRef<string | null>(null)

  const totals = cartTotals(lines)
  const received = Number(cashReceived)
  const change = paymentMethod === 'CASH' && cashReceived !== '' ? received - totals.total : null
  const drawerOpen = !!drawer.data
  const canCharge = drawerOpen && lines.length > 0 && !recordSale.isPending
    && (paymentMethod !== 'CASH' || cashReceived === '' || received >= totals.total)

  function updateCart(action: CartAction) {
    idempotencyKey.current = null
    dispatchCart(action)
  }

  async function scan(event: FormEvent) {
    event.preventDefault()
    const code = barcode.trim()
    if (!code || scanning) {
      return
    }
    setScanning(true)
    try {
      const product = await findProductByBarcode(code)
      if (!product.active) {
        toast.error(t('checkout.inactiveProduct', { name: product.name }))
      } else {
        updateCart({
          type: 'add',
          line: {
            productId: product.id!, sku: product.sku!, name: product.name!,
            unitPrice: product.salePrice!, taxRate: product.taxRate!, stock: product.stock!,
          },
        })
      }
    } catch (error) {
      toast.error(error instanceof ApiError && error.status === 404
        ? t('checkout.productNotFound', { code })
        : errorMessage(error))
    } finally {
      setBarcode('')
      setScanning(false)
      barcodeInput.current?.focus()
    }
  }

  function charge() {
    idempotencyKey.current ??= crypto.randomUUID()
    recordSale.mutate({
      idempotencyKey: idempotencyKey.current,
      paymentMethod,
      items: lines.map(({ productId, quantity }) => ({ productId, quantity })),
    }, {
      onSuccess: (sale) => {
        setReceipt(sale)
        idempotencyKey.current = null
        dispatchCart({ type: 'clear' })
        setCashReceived('')
        setPaymentMethod('CASH')
      },
      // Network errors keep the key: retrying returns the sale if it was recorded after all.
      onError: (error) => toast.error(errorMessage(error)),
    })
  }

  if (drawer.isPending) {
    return <FullPageSpinner />
  }

  return (
    <div className="grid gap-4 lg:grid-cols-[1fr_22rem]">
      <div className="grid content-start gap-4">
        {!drawerOpen && (
          <Alert>
            <AlertTitle>{t('checkout.drawerClosedTitle')}</AlertTitle>
            <AlertDescription>
              <span>
                <Trans i18nKey="checkout.drawerClosedHint"
                  components={{ link: <Link to="/cash-drawer" className="underline" /> }} />
              </span>
            </AlertDescription>
          </Alert>
        )}
        <form onSubmit={scan} className="flex gap-2">
          <div className="relative flex-1">
            <ScanBarcode className="pointer-events-none absolute top-1/2 left-3 size-4 -translate-y-1/2 text-muted-foreground" />
            <Input ref={barcodeInput} value={barcode} onChange={(event) => setBarcode(event.target.value)}
              placeholder={t('checkout.barcodePlaceholder')} aria-label={t('checkout.barcode')}
              className="h-11 pl-9 text-base" autoFocus autoComplete="off" disabled={!drawerOpen} />
          </div>
          <Button type="submit" size="lg" className="h-11" disabled={!drawerOpen || scanning}>{t('checkout.add')}</Button>
        </form>
        <Card>
          <CardContent>
            {lines.length === 0 ? (
              <p className="py-10 text-center text-sm text-muted-foreground">{t('checkout.emptyCart')}</p>
            ) : (
              <Table>
                <TableHeader>
                  <TableRow>
                    <TableHead>{t('checkout.product')}</TableHead>
                    <TableHead className="text-right">{t('checkout.price')}</TableHead>
                    <TableHead className="text-center">{t('checkout.quantity')}</TableHead>
                    <TableHead className="text-right">{t('checkout.amount')}</TableHead>
                    <TableHead><span className="sr-only">{t('checkout.remove')}</span></TableHead>
                  </TableRow>
                </TableHeader>
                <TableBody>
                  {lines.map((line) => (
                    <TableRow key={line.productId}>
                      <TableCell>
                        <div className="font-medium">{line.name}</div>
                        <div className="text-xs text-muted-foreground">
                          {line.sku}
                          {line.taxRate > 0 && ` · ${t('checkout.vatRate', { rate: Math.round(line.taxRate * 100) })}`}
                          {line.quantity > line.stock && (
                            <span className="text-destructive"> · {t('checkout.onlyInStock', { count: line.stock })}</span>
                          )}
                        </div>
                      </TableCell>
                      <TableCell className="text-right tabular-nums">{formatMoney(line.unitPrice)}</TableCell>
                      <TableCell>
                        <div className="flex items-center justify-center gap-1">
                          <Button variant="outline" size="icon-sm" aria-label={t('checkout.oneLess', { name: line.name })}
                            onClick={() => updateCart({ type: 'setQuantity', productId: line.productId, quantity: line.quantity - 1 })}>
                            <Minus />
                          </Button>
                          <span className="w-8 text-center tabular-nums">{line.quantity}</span>
                          <Button variant="outline" size="icon-sm" aria-label={t('checkout.oneMore', { name: line.name })}
                            onClick={() => updateCart({ type: 'setQuantity', productId: line.productId, quantity: line.quantity + 1 })}>
                            <Plus />
                          </Button>
                        </div>
                      </TableCell>
                      <TableCell className="text-right tabular-nums">{formatMoney(line.unitPrice * line.quantity)}</TableCell>
                      <TableCell className="text-right">
                        <Button variant="ghost" size="icon-sm" aria-label={t('checkout.removeItem', { name: line.name })}
                          onClick={() => updateCart({ type: 'remove', productId: line.productId })}>
                          <Trash2 />
                        </Button>
                      </TableCell>
                    </TableRow>
                  ))}
                </TableBody>
              </Table>
            )}
          </CardContent>
        </Card>
      </div>

      <Card className="h-fit lg:sticky lg:top-4">
        <CardHeader>
          <CardTitle>{t('checkout.total')}</CardTitle>
        </CardHeader>
        <CardContent className="grid gap-4">
          <dl className="grid grid-cols-2 gap-y-1 text-sm">
            <dt className="text-muted-foreground">{t('checkout.subtotal')}</dt>
            <dd className="text-right tabular-nums">{formatMoney(totals.subtotal)}</dd>
            <dt className="text-muted-foreground">{t('checkout.vat')}</dt>
            <dd className="text-right tabular-nums">{formatMoney(totals.tax)}</dd>
            <dt className="text-lg font-semibold">{t('checkout.total')}</dt>
            <dd className="text-right text-lg font-semibold tabular-nums">{formatMoney(totals.total)}</dd>
          </dl>
          <div className="grid gap-2">
            <Label>{t('checkout.paymentMethod')}</Label>
            <div className="grid grid-cols-3 gap-2" role="radiogroup" aria-label={t('checkout.paymentMethod')}>
              {paymentMethods.map((method) => (
                <Button key={method} type="button" role="radio" aria-checked={paymentMethod === method}
                  variant={paymentMethod === method ? 'default' : 'outline'}
                  onClick={() => setPaymentMethod(method)}>
                  {t(`checkout.paymentMethods.${method}`)}
                </Button>
              ))}
            </div>
          </div>
          {paymentMethod === 'CASH' && (
            <div className="grid gap-2">
              <Label htmlFor="cashReceived">{t('checkout.cashReceived')}</Label>
              <Input id="cashReceived" type="number" inputMode="decimal" step="0.01" min="0"
                value={cashReceived} onChange={(event) => setCashReceived(event.target.value)} />
              {change !== null && (
                <p className={cn('text-sm tabular-nums', change < 0 ? 'text-destructive' : 'text-muted-foreground')}>
                  {change < 0
                    ? t('checkout.missing', { amount: formatMoney(-change) })
                    : t('checkout.change', { amount: formatMoney(change) })}
                </p>
              )}
            </div>
          )}
        </CardContent>
        <CardFooter>
          <Button size="lg" className="h-12 w-full text-base" disabled={!canCharge} onClick={charge}>
            {recordSale.isPending ? t('checkout.charging') : t('checkout.charge', { amount: formatMoney(totals.total) })}
          </Button>
        </CardFooter>
      </Card>

      <ReceiptDialog sale={receipt} onClose={() => {
        setReceipt(null)
        barcodeInput.current?.focus()
      }} />
    </div>
  )
}
