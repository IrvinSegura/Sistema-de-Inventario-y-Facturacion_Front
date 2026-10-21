import { zodResolver } from '@hookform/resolvers/zod'
import type { TFunction } from 'i18next'
import { ArrowRight, Minus, Plus } from 'lucide-react'
import { useMemo, useState } from 'react'
import { useForm, useWatch } from 'react-hook-form'
import { useTranslation } from 'react-i18next'
import { z } from 'zod'

import { errorMessage } from '@/api/errors'
import { ErrorAlert } from '@/components/ErrorAlert'
import { FormField as Field } from '@/components/FormField'
import { Button } from '@/components/ui/button'
import { DialogClose, DialogFooter } from '@/components/ui/dialog'
import { Input } from '@/components/ui/input'
import { showSuccess } from '@/lib/success-popup'
import { cn } from '@/lib/utils'

import { MAX_ADJUSTMENT, type Product, useAdjustStock } from './queries'

// Same limit as the API (CreateStockAdjustmentRequest).
const REASON_MAX_LENGTH = 255

type Mode = 'add' | 'remove'

/** Common reasons, one click away; any other can be typed. */
const reasons = {
  add: ['count', 'initial', 'return'],
  remove: ['expired', 'damaged', 'missing', 'internal'],
} as const

function stockSchema(t: TFunction, stock: number) {
  return z.object({
    mode: z.enum(['add', 'remove']),
    quantity: z.string().trim().min(1, t('products.stock.invalidQuantity')).pipe(z.coerce
      .number<string>({ error: t('products.stock.invalidQuantity') })
      .int(t('products.stock.invalidQuantity'))
      .min(1, t('products.stock.invalidQuantity'))
      .max(MAX_ADJUSTMENT, t('products.stock.invalidQuantity'))),
    reason: z.string().trim()
      .min(1, t('products.stock.enterReason'))
      .max(REASON_MAX_LENGTH, t('validation.maxChars', { count: REASON_MAX_LENGTH })),
  }).refine((values) => values.mode === 'add' || values.quantity <= stock, {
    path: ['quantity'],
    message: t('products.stock.tooMany', { count: stock }),
  })
}

/**
 * Stock adjustment of one product, in the edit dialog's Stock tab and in inventory's adjust dialog.
 * Mounted once per opening (and per product), so each adjustment gets a fresh form and
 * Idempotency-Key, which a retry after an error reuses.
 */
export function StockForm({ product, onDone }: { product: Product; onDone: () => void }) {
  const { t } = useTranslation()
  const adjustStock = useAdjustStock()
  const [idempotencyKey] = useState(() => crypto.randomUUID())
  const stock = product.stock ?? 0
  const schema = useMemo(() => stockSchema(t, stock), [t, stock])
  const { register, handleSubmit, setValue, control, formState: { errors } } = useForm({
    resolver: zodResolver(schema),
    defaultValues: { mode: 'add' as Mode, quantity: '', reason: '' },
  })
  const [mode, quantity] = useWatch({ control, name: ['mode', 'quantity'] })
  const amount = Number(quantity)
  const valid = quantity.trim() !== '' && Number.isInteger(amount) && amount > 0
  const after = valid ? stock + (mode === 'add' ? amount : -amount) : null

  const onSubmit = handleSubmit((values) =>
    adjustStock.mutate({
      idempotencyKey,
      productId: product.id!,
      quantity: values.mode === 'add' ? values.quantity : -values.quantity,
      reason: values.reason,
    }, {
      onSuccess: (movement) => {
        showSuccess(t('products.stock.doneTitle'),
          t('products.stock.done', { name: product.name, count: movement.resultingStock }))
        onDone()
      },
    }))

  return (
    <form onSubmit={onSubmit} className="flex min-h-0 flex-1 flex-col" noValidate>
      <div className="grid min-h-0 flex-1 content-start gap-5 overflow-y-auto px-6 py-5">
        <div className="mx-auto grid w-full max-w-xl gap-5">
          {adjustStock.isError && <ErrorAlert message={errorMessage(adjustStock.error)} />}

          {/* Before and after, so the result is clear before saving. */}
          <div className="grid grid-cols-[1fr_auto_1fr] items-center gap-3 rounded-xl bg-muted/50 p-4 text-center">
            <span className="grid gap-1">
              <span className="text-xs text-muted-foreground">{t('products.stock.current')}</span>
              <span className="text-3xl font-semibold tabular-nums">{stock}</span>
            </span>
            <ArrowRight className="size-5 text-muted-foreground" />
            <span className="grid gap-1">
              <span className="text-xs text-muted-foreground">{t('products.stock.after')}</span>
              <span className={cn('text-3xl font-semibold tabular-nums',
                after === null ? 'text-muted-foreground' : after < 0 ? 'text-destructive' : 'text-primary')}>
                {after ?? '—'}
              </span>
            </span>
          </div>

          <fieldset className="grid grid-cols-2 gap-2">
            <legend className="sr-only">{t('products.stock.direction')}</legend>
            {(['add', 'remove'] as const).map((option) => (
              <label key={option}
                className={cn(
                  'flex h-10 cursor-pointer items-center justify-center gap-2 rounded-lg border text-sm font-medium transition-colors',
                  'has-focus-visible:ring-3 has-focus-visible:ring-ring/50',
                  mode === option
                    ? option === 'add' ? 'border-emerald-500 bg-emerald-500/10 text-emerald-700 dark:text-emerald-400'
                      : 'border-destructive bg-destructive/10 text-destructive'
                    : 'hover:bg-muted',
                )}>
                <input type="radio" value={option} className="sr-only" {...register('mode', {
                  // Each direction has its own suggested reasons.
                  onChange: () => setValue('reason', ''),
                })} />
                {option === 'add' ? <Plus className="size-4" /> : <Minus className="size-4" />}
                {t(`products.stock.${option}`)}
              </label>
            ))}
          </fieldset>

          <Field id="quantity" label={t('products.stock.quantity')} error={errors.quantity}>
            <Input id="quantity" type="number" inputMode="numeric" min={1} max={MAX_ADJUSTMENT} step={1} autoFocus
              aria-invalid={!!errors.quantity} {...register('quantity')} />
          </Field>

          <Field id="reason" label={t('products.stock.reason')} error={errors.reason}>
            <div className="flex flex-wrap gap-2">
              {reasons[mode].map((reason) => {
                // The translated text is what gets saved, in the language of whoever records it.
                const text = t(`products.stock.reasons.${reason}`)
                return (
                  <Button key={reason} type="button" variant="outline" size="sm" className="rounded-full"
                    onClick={() => setValue('reason', text, { shouldValidate: true, shouldDirty: true })}>
                    {text}
                  </Button>
                )
              })}
            </div>
            <Input id="reason" autoComplete="off" maxLength={REASON_MAX_LENGTH} placeholder={t('products.stock.reasonPlaceholder')}
              aria-invalid={!!errors.reason} {...register('reason')} />
          </Field>
        </div>
      </div>

      <DialogFooter className="m-0 px-6">
        <DialogClose render={<Button type="button" variant="outline" />}>{t('products.form.cancel')}</DialogClose>
        <Button type="submit" disabled={adjustStock.isPending}>
          {adjustStock.isPending ? t('products.form.saving') : t('products.stock.save')}
        </Button>
      </DialogFooter>
    </form>
  )
}
