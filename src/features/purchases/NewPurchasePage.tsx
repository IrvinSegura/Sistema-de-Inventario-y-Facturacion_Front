import { ArrowRight, PackagePlus, Trash2, TriangleAlert } from 'lucide-react'
import { useEffect, useReducer, useRef, useState } from 'react'
import { useTranslation } from 'react-i18next'
import { useLocation, useNavigate } from 'react-router'
import { toast } from 'sonner'

import { errorMessage } from '@/api/errors'
import { EmptyState } from '@/components/EmptyState'
import { Button } from '@/components/ui/button'
import { Card, CardContent, CardFooter, CardHeader, CardTitle } from '@/components/ui/card'
import { Input } from '@/components/ui/input'
import { Label } from '@/components/ui/label'
import { Table, TableBody, TableCell, TableHead, TableHeader, TableRow } from '@/components/ui/table'
import { ProductPicker } from '@/features/products/ProductPicker'
import type { Product } from '@/features/products/queries'
import { formatMoney } from '@/lib/money'
import { showSuccess } from '@/lib/success-popup'
import { cn } from '@/lib/utils'

import { PurchaseDetailDialog } from './PurchaseDetailDialog'
import {
  type DraftAction,
  type DraftLine,
  draftReducer,
  type DraftState,
  draftTotals,
  lineSubtotal,
  margin,
  MAX_LINES,
  MAX_QUANTITY,
  MAX_TOTAL,
  MAX_UNIT_COST,
  parseQuantity,
  parseUnitCost,
  type SupplierRef,
} from './purchase-draft'
import { useRecordPurchase } from './queries'
import { SupplierPicker } from './SupplierPicker'

const percent = new Intl.NumberFormat('es-MX', { style: 'percent', maximumFractionDigits: 1 })

/**
 * Stock in from a supplier: pick the supplier, scan or search the products, and type how many
 * arrived and what each unit cost. Recording it raises the stock of every line at once.
 */
export function NewPurchasePage() {
  const { t } = useTranslation()
  const location = useLocation()
  const navigate = useNavigate()
  const recordPurchase = useRecordPurchase()
  // Prefilled from a supplier, a repeated purchase or the low-stock report (router state).
  const [initial] = useState(() => (location.state ?? {}) as DraftState)
  const [supplier, setSupplier] = useState<SupplierRef | null>(initial.supplier ?? null)
  // The prefill goes through the reducer, so repeated products merge and MAX_LINES applies as when adding by hand.
  const [lines, dispatch] = useReducer(draftReducer, initial.lines ?? [],
    (prefill) => prefill.reduce<DraftLine[]>((draft, line) => draftReducer(draft, { type: 'add', line }), []))
  const [submitted, setSubmitted] = useState(false)
  const [recorded, setRecorded] = useState<number | null>(null)
  const pickerInput = useRef<HTMLInputElement>(null)
  // One key per purchase: kept across retries of the same one, renewed when anything changes
  // (the API rejects a key reused with a different request).
  const idempotencyKey = useRef<string | null>(null)

  const totals = draftTotals(lines)
  const invalidLines = lines.filter((line) => parseQuantity(line.quantity) === null || parseUnitCost(line.unitCost) === null)
  const tooLarge = totals.total > MAX_TOTAL

  // Leaving the page (reload, closing the tab) with lines asks first.
  useEffect(() => {
    if (lines.length === 0) {
      return
    }
    const warn = (event: BeforeUnloadEvent) => event.preventDefault()
    window.addEventListener('beforeunload', warn)
    return () => window.removeEventListener('beforeunload', warn)
  }, [lines.length])

  function update(action: DraftAction) {
    idempotencyKey.current = null
    dispatch(action)
  }

  function changeSupplier(next: SupplierRef | null) {
    idempotencyKey.current = null
    setSupplier(next)
  }

  function addProduct(product: Product) {
    // Warn here: the reducer silently drops new products past MAX_LINES, while one already listed just gets another unit.
    if (lines.length >= MAX_LINES && !lines.some((line) => line.productId === product.id)) {
      toast.error(t('purchases.form.tooManyLines', { count: MAX_LINES }))
      return
    }
    update({
      type: 'add',
      line: { productId: product.id!, sku: product.sku!, name: product.name!, stock: product.stock, salePrice: product.salePrice },
    })
  }

  function record() {
    setSubmitted(true)
    if (!supplier || lines.length === 0 || invalidLines.length > 0 || tooLarge) {
      return
    }
    idempotencyKey.current ??= crypto.randomUUID()
    recordPurchase.mutate({
      idempotencyKey: idempotencyKey.current,
      supplierId: supplier.id,
      items: lines.map((line) => ({
        productId: line.productId,
        quantity: parseQuantity(line.quantity)!,
        unitCost: parseUnitCost(line.unitCost)!,
      })),
    }, {
      onSuccess: (purchase) => {
        showSuccess(t('purchases.form.recordedTitle', { id: purchase.id }),
          t('purchases.form.recorded', { count: totals.units, supplier: purchase.supplier?.name }))
        idempotencyKey.current = null
        dispatch({ type: 'clear' })
        setSupplier(null)
        setSubmitted(false)
        setRecorded(purchase.id!)
        // The prefill is done: a reload must not bring it back.
        void navigate('.', { replace: true, state: null })
      },
      // Network errors keep the key: retrying returns the purchase if it was recorded after all.
      onError: (error) => toast.error(errorMessage(error)),
    })
  }

  const pending = recordPurchase.isPending

  return (
    <div className="grid gap-6 lg:grid-cols-[minmax(0,1fr)_20rem] lg:items-start">
      <div className="grid gap-4">
        <Card>
          <CardContent className="grid gap-4">
            <SupplierPicker id="purchase-supplier" value={supplier} onChange={changeSupplier} disabled={pending}
              invalid={submitted && !supplier} />
            {submitted && !supplier && <p className="-mt-2 text-sm text-destructive">{t('purchases.form.chooseSupplier')}</p>}
            <div className="grid gap-2">
              <Label htmlFor="purchase-product">{t('purchases.form.addProduct')}</Label>
              <ProductPicker id="purchase-product" inputRef={pickerInput} onPick={addProduct} disabled={pending}
                placeholder={t('purchases.form.productPlaceholder')} />
              <p className="text-xs text-muted-foreground">{t('purchases.form.productHint')}</p>
            </div>
          </CardContent>
        </Card>

        <Card className="gap-0 py-0">
          {lines.length === 0 ? (
            <EmptyState icon={PackagePlus} text={t('purchases.form.noLines')} />
          ) : (
            <Table>
              <TableHeader className="bg-muted/50">
                <TableRow>
                  <TableHead className="pl-4">{t('purchases.columns.product')}</TableHead>
                  <TableHead className="w-28">{t('purchases.columns.quantity')}</TableHead>
                  <TableHead className="w-36">{t('purchases.columns.unitCost')}</TableHead>
                  <TableHead className="hidden text-right sm:table-cell">{t('purchases.columns.subtotal')}</TableHead>
                  <TableHead className="w-12 pr-4"><span className="sr-only">{t('purchases.columns.actions')}</span></TableHead>
                </TableRow>
              </TableHeader>
              <TableBody>
                {lines.map((line) => (
                  <DraftRow key={line.productId} line={line} showErrors={submitted} disabled={pending} onChange={update} />
                ))}
              </TableBody>
            </Table>
          )}
        </Card>
      </div>

      <Card className="lg:sticky lg:top-20">
        <CardHeader>
          <CardTitle>{t('purchases.form.summary')}</CardTitle>
        </CardHeader>
        <CardContent className="grid gap-3">
          <dl className="grid grid-cols-2 gap-y-1.5 text-sm">
            <dt className="text-muted-foreground">{t('purchases.form.supplier')}</dt>
            <dd className="truncate text-right">{supplier?.name ?? '—'}</dd>
            <dt className="text-muted-foreground">{t('purchases.form.products')}</dt>
            <dd className="text-right tabular-nums">{lines.length}</dd>
            <dt className="text-muted-foreground">{t('purchases.form.units')}</dt>
            <dd className="text-right tabular-nums">{totals.units}</dd>
            <dt className="border-t pt-2 text-base font-semibold">{t('purchases.detail.total')}</dt>
            <dd className="border-t pt-2 text-right text-base font-semibold tabular-nums">{formatMoney(totals.total)}</dd>
          </dl>
          {submitted && invalidLines.length > 0 && (
            <p className="flex items-start gap-2 text-sm text-destructive">
              <TriangleAlert className="mt-0.5 size-4 shrink-0" />
              {t('purchases.form.fixLines', { count: invalidLines.length })}
            </p>
          )}
          {tooLarge && <p className="text-sm text-destructive">{t('purchases.form.tooLarge', { amount: formatMoney(MAX_TOTAL) })}</p>}
          <p className="text-xs text-muted-foreground">{t('purchases.form.recordHint')}</p>
        </CardContent>
        <CardFooter className="flex-col items-stretch gap-2">
          <Button size="lg" disabled={pending || lines.length === 0} onClick={record}>
            {pending ? t('purchases.form.recording') : t('purchases.form.record', { amount: formatMoney(totals.total) })}
          </Button>
          {lines.length > 0 && (
            <Button variant="ghost" disabled={pending} onClick={() => {
              update({ type: 'clear' })
              setSubmitted(false)
              pickerInput.current?.focus()
            }}>
              {t('purchases.form.clear')}
            </Button>
          )}
        </CardFooter>
      </Card>

      <PurchaseDetailDialog purchaseId={recorded} onClose={() => {
        setRecorded(null)
        pickerInput.current?.focus()
      }} />
    </div>
  )
}

function DraftRow({ line, showErrors, disabled, onChange }: {
  line: DraftLine
  showErrors: boolean
  disabled: boolean
  onChange: (action: DraftAction) => void
}) {
  const { t } = useTranslation()
  const quantity = parseQuantity(line.quantity)
  const cost = parseUnitCost(line.unitCost)
  const subtotal = lineSubtotal(line)
  const lineMargin = margin(line)
  // Typed values are checked right away; blank ones only after a record attempt.
  const quantityInvalid = (showErrors || line.quantity !== '') && quantity === null
  const costInvalid = (showErrors || line.unitCost !== '') && cost === null

  return (
    <TableRow className="align-top">
      <TableCell className="pl-4">
        <span className="grid min-w-0 gap-0.5">
          <span className="truncate font-medium">{line.name}</span>
          <span className="truncate font-mono text-xs text-muted-foreground">{line.sku}</span>
          {line.stock !== undefined && (
            <span className="flex items-center gap-1 text-xs text-muted-foreground tabular-nums">
              {t('purchases.form.stockNow', { count: line.stock })}
              {quantity !== null && (
                <>
                  <ArrowRight className="size-3" />
                  <span className="font-medium text-emerald-700 dark:text-emerald-400">{line.stock + quantity}</span>
                </>
              )}
            </span>
          )}
        </span>
      </TableCell>
      <TableCell>
        <Input type="number" inputMode="numeric" min={1} max={MAX_QUANTITY} step={1} value={line.quantity} disabled={disabled}
          aria-label={t('purchases.form.quantityOf', { name: line.name })} aria-invalid={quantityInvalid}
          className="h-9 tabular-nums"
          onChange={(event) => onChange({ type: 'update', productId: line.productId, field: 'quantity', value: event.target.value })} />
        {quantityInvalid && <p className="mt-1 text-xs text-destructive">{t('purchases.form.invalidQuantity', { max: MAX_QUANTITY })}</p>}
      </TableCell>
      <TableCell>
        <div className="relative">
          <span className="pointer-events-none absolute top-1/2 left-2.5 -translate-y-1/2 text-sm text-muted-foreground">$</span>
          <Input type="number" inputMode="decimal" min={0} max={MAX_UNIT_COST} step="0.01" value={line.unitCost} disabled={disabled}
            placeholder="0.00" aria-label={t('purchases.form.costOf', { name: line.name })} aria-invalid={costInvalid}
            className="h-9 pl-6 tabular-nums"
            onChange={(event) => onChange({ type: 'update', productId: line.productId, field: 'unitCost', value: event.target.value })} />
        </div>
        {costInvalid ? (
          <p className="mt-1 text-xs text-destructive">{t('purchases.form.invalidCost')}</p>
        ) : line.salePrice !== undefined && (
          <p className={cn('mt-1 text-xs', lineMargin !== null && lineMargin <= 0 ? 'text-destructive' : 'text-muted-foreground')}>
            {lineMargin === null
              ? t('purchases.form.salePrice', { amount: formatMoney(line.salePrice) })
              : t('purchases.form.margin', { margin: percent.format(lineMargin), amount: formatMoney(line.salePrice) })}
          </p>
        )}
      </TableCell>
      <TableCell className="hidden pt-4 text-right font-medium tabular-nums sm:table-cell">
        {subtotal === null ? <span className="text-muted-foreground">—</span> : formatMoney(subtotal)}
      </TableCell>
      <TableCell className="pr-4 text-right">
        <Button variant="ghost" size="icon" disabled={disabled} aria-label={t('purchases.form.remove', { name: line.name })}
          className="text-muted-foreground hover:text-destructive"
          onClick={() => onChange({ type: 'remove', productId: line.productId })}>
          <Trash2 />
        </Button>
      </TableCell>
    </TableRow>
  )
}
