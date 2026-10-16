import { zodResolver } from '@hookform/resolvers/zod'
import type { TFunction } from 'i18next'
import { ClipboardList, Info, Package, PackageOpen, PackagePlus } from 'lucide-react'
import { type ReactNode, useMemo, useState } from 'react'
import { Controller, type Path, useForm, type UseFormSetError, useWatch } from 'react-hook-form'
import { useTranslation } from 'react-i18next'
import { toast } from 'sonner'
import { z } from 'zod'

import { ApiError, errorMessage } from '@/api/errors'
import { ErrorAlert } from '@/components/ErrorAlert'
import { FormField as Field } from '@/components/FormField'
import { Textarea } from '@/components/Textarea'
import { Button } from '@/components/ui/button'
import {
  Dialog,
  DialogClose,
  DialogContent,
  DialogDescription,
  DialogFooter,
  DialogHeader,
  DialogTitle,
} from '@/components/ui/dialog'
import { Input } from '@/components/ui/input'
import { Select } from '@/components/ui/select'
import type { LabeledCategory } from '@/features/categories/category-labels'
import type { Category } from '@/features/categories/queries'
import { amountField } from '@/lib/amount-field'
import { formatMoney, withTax } from '@/lib/money'
import { showSuccess } from '@/lib/success-popup'
import { CODE, filtered, LABEL, NOT_CODE_CHAR, NOT_DIGIT, NOT_LABEL_CHAR } from '@/lib/text-rules'
import { cn } from '@/lib/utils'

import { type ImageChoice, ImagePicker } from './ImagePicker'
import {
  MAX_ADJUSTMENT,
  type Product,
  useAdjustStock,
  useCreateProduct,
  useRemoveProductImage,
  useUpdateProduct,
  useUploadProductImage,
} from './queries'
import { StockForm } from './StockForm'
import { formatTaxRate, fromPercent, toPercent } from './tax-rate'

// Same limits as the API (CreateProductRequest / UpdateProductRequest).
const SKU_MAX_LENGTH = 50
const NAME_MAX_LENGTH = 150
const DESCRIPTION_MAX_LENGTH = 500
const PRICE_MAX = 9_999_999_999.99
const MIN_STOCK_MAX = 2_147_483_647
const BARCODE = /^\d{8,14}$/
const TWO_DECIMALS = (value: number) => Math.abs(value * 100 - Math.round(value * 100)) < 1e-6

function text(t: TFunction, max: number, required?: string) {
  const field = z.string().trim()
  return (required ? field.min(1, required) : field).max(max, t('validation.maxChars', { count: max }))
}

function productSchema(t: TFunction) {
  return z.object({
    name: text(t, NAME_MAX_LENGTH, t('products.form.enterName')).regex(LABEL, t('products.form.invalidName')),
    sku: text(t, SKU_MAX_LENGTH, t('products.form.enterSku')).regex(CODE, t('products.form.invalidSku')),
    barcode: z.string().trim().refine((value) => value === '' || BARCODE.test(value), t('products.form.invalidBarcode')),
    categoryId: z.string().min(1, t('products.form.chooseCategory')).transform(Number),
    salePrice: z.string().trim().min(1, t('validation.enterAmount')).pipe(amountField<string>(t, PRICE_MAX)),
    taxRate: z.string().trim().min(1, t('products.form.invalidTaxRate')).pipe(z.coerce
      .number<string>({ error: t('products.form.invalidTaxRate') })
      .min(0, t('products.form.invalidTaxRate'))
      .max(99.99, t('products.form.invalidTaxRate'))
      .refine(TWO_DECIMALS, t('products.form.invalidTaxRate'))),
    minStock: z.string().trim().min(1, t('products.form.invalidMinStock')).pipe(z.coerce
      .number<string>({ error: t('products.form.invalidMinStock') })
      .int(t('products.form.invalidMinStock'))
      .min(0, t('products.form.invalidMinStock'))
      .max(MIN_STOCK_MAX, t('products.form.invalidMinStock'))),
    description: text(t, DESCRIPTION_MAX_LENGTH),
    active: z.boolean(),
    // New products only: recorded as a stock adjustment right after creating it.
    initialStock: z.string().trim().min(1, t('products.form.invalidInitialStock')).pipe(z.coerce
      .number<string>({ error: t('products.form.invalidInitialStock') })
      .int(t('products.form.invalidInitialStock'))
      .min(0, t('products.form.invalidInitialStock'))
      .max(MAX_ADJUSTMENT, t('products.form.invalidInitialStock'))),
  })
}

type ProductValues = z.output<ReturnType<typeof productSchema>>

// Fields shared by create and update; empty optional texts are left out. The photo has its own endpoint.
function toRequest(values: ProductValues, imageUrl: string | undefined) {
  return {
    sku: values.sku,
    barcode: values.barcode || undefined,
    name: values.name,
    description: values.description || undefined,
    imageUrl,
    categoryId: values.categoryId,
    salePrice: values.salePrice,
    taxRate: fromPercent(values.taxRate),
    minStock: values.minStock,
  }
}

const formFields = ['name', 'sku', 'barcode', 'categoryId', 'salePrice', 'taxRate', 'minStock', 'description']

// Duplicates, an unusable category and 400 field messages go next to their inputs and return true;
// anything else (e.g. someone else saved first) is left for the alert above the form.
function applyServerErrors<T extends Record<string, unknown>>(error: unknown, setError: UseFormSetError<T>, t: TFunction): boolean {
  if (!(error instanceof ApiError)) {
    return false
  }
  const set = (field: string, message: string) => setError(field as Path<T>, { message })
  if (error.message === 'Name already exists') {
    set('name', t('products.form.nameTaken'))
    return true
  }
  if (error.message === 'SKU already exists') {
    set('sku', t('products.form.skuTaken'))
    return true
  }
  if (error.message === 'Barcode already exists') {
    set('barcode', t('products.form.barcodeTaken'))
    return true
  }
  if (error.message === 'Category is inactive' || error.message === 'Category not found') {
    set('categoryId', t('products.form.categoryUnavailable'))
    return true
  }
  const known = Object.entries(error.fieldErrors).filter(([field]) => formFields.includes(field))
  known.forEach(([field]) => set(field, t('validation.invalidValue')))
  return known.length > 0
}

// barcode: a scanned code that isn't registered yet; the form starts with it.
export function CreateProductDialog({ open, onOpenChange, categories, barcode }: {
  open: boolean
  onOpenChange: (open: boolean) => void
  categories: LabeledCategory[]
  barcode?: string
}) {
  const { t } = useTranslation()
  return (
    <Dialog open={open} onOpenChange={onOpenChange}>
      <ProductDialogContent icon={<PackagePlus />} title={t('products.createTitle')}
        description={barcode ? t('products.scan.newDescription', { code: barcode }) : t('products.createDescription')}>
        {/* Mounted only while open, so every opening starts with an empty form. */}
        <ProductForm categories={categories} initialBarcode={barcode} onDone={() => onOpenChange(false)} />
      </ProductDialogContent>
    </Dialog>
  )
}

export function EditProductDialog({ product, categories, onOpenChange }: {
  product: Product | null
  categories: LabeledCategory[]
  onOpenChange: (open: boolean) => void
}) {
  const { t } = useTranslation()
  const [tab, setTab] = useState<EditTab>('details')
  // Keeps the last product on screen while the dialog animates out; each product opens on its details.
  const [shown, setShown] = useState(product)
  if (product && product !== shown) {
    setShown(product)
    setTab('details')
  }
  return (
    <Dialog open={!!product} onOpenChange={onOpenChange}>
      <ProductDialogContent icon={<Package />} title={t('products.editTitle')} description={shown?.name}>
        {shown && (
          <>
            <div role="tablist" aria-label={t('products.editTitle')} className="flex gap-1 border-b px-6">
              {editTabs.map(({ value, icon: Icon }) => (
                <button key={value} type="button" role="tab" id={`edit-tab-${value}`} aria-controls={`edit-panel-${value}`}
                  aria-selected={tab === value} onClick={() => setTab(value)}
                  className={cn(
                    '-mb-px flex items-center gap-2 border-b-2 px-3 py-2.5 text-sm font-medium transition-colors outline-none focus-visible:ring-3 focus-visible:ring-ring/50',
                    tab === value ? 'border-primary text-foreground' : 'border-transparent text-muted-foreground hover:text-foreground',
                  )}>
                  <Icon className="size-4" />
                  {t(`products.editTabs.${value}`)}
                </button>
              ))}
            </div>
            {/* Both stay mounted, so switching tabs keeps what was typed in the other one. */}
            <div role="tabpanel" id="edit-panel-details" aria-labelledby="edit-tab-details" hidden={tab !== 'details'}
              className="flex min-h-0 flex-1 flex-col">
              <ProductForm product={shown} categories={categories} onDone={() => onOpenChange(false)} />
            </div>
            <div role="tabpanel" id="edit-panel-stock" aria-labelledby="edit-tab-stock" hidden={tab !== 'stock'}
              className="flex min-h-0 flex-1 flex-col">
              <StockForm key={shown.id} product={shown} onDone={() => onOpenChange(false)} />
            </div>
          </>
        )}
      </ProductDialogContent>
    </Dialog>
  )
}

type EditTab = 'details' | 'stock'

const editTabs: { value: EditTab; icon: typeof Package }[] = [
  { value: 'details', icon: ClipboardList },
  { value: 'stock', icon: PackageOpen },
]

// Wide on desktop; the header and the buttons stay put while the fields scroll.
function ProductDialogContent({ icon, title, description, children }: {
  icon: ReactNode
  title: string
  description?: string
  children: ReactNode
}) {
  return (
    <DialogContent className="flex max-h-[calc(100svh-2rem)] flex-col gap-0 overflow-hidden p-0 sm:max-w-[min(72rem,calc(100%-3rem))]">
      <DialogHeader className="flex-row items-center gap-3 border-b px-6 py-4 pr-12">
        <span className="flex size-10 shrink-0 items-center justify-center rounded-lg bg-primary/10 text-primary [&>svg]:size-5">
          {icon}
        </span>
        <span className="grid min-w-0 gap-1">
          <DialogTitle className="text-lg">{title}</DialogTitle>
          {description && <DialogDescription className="truncate">{description}</DialogDescription>}
        </span>
      </DialogHeader>
      {children}
    </DialogContent>
  )
}

// One form for both dialogs: without a product it creates one. Saves the fields first, then the
// initial stock and the photo (their endpoints bump the version the fields' save needs).
function ProductForm({ product, categories, initialBarcode, onDone }: {
  product?: Product
  categories: LabeledCategory[]
  initialBarcode?: string
  onDone: () => void
}) {
  const { t, i18n } = useTranslation()
  const createProduct = useCreateProduct()
  const updateProduct = useUpdateProduct()
  const uploadImage = useUploadProductImage()
  const removeImage = useRemoveProductImage()
  const adjustStock = useAdjustStock()
  // One key per form, so retrying never records the initial stock twice.
  const [initialStockKey] = useState(() => crypto.randomUUID())
  const [image, setImage] = useState<ImageChoice>(product?.imageUrl ? { kind: 'current', url: product.imageUrl } : { kind: 'none' })
  const [saving, setSaving] = useState(false)
  const [formError, setFormError] = useState<string | null>(null)
  const schema = useMemo(() => productSchema(t), [t])
  const { register, handleSubmit, setError, setValue, getValues, setFocus, control, formState: { errors, isDirty } } = useForm({
    resolver: zodResolver(schema),
    defaultValues: product
      ? {
          name: product.name!,
          sku: product.sku!,
          barcode: product.barcode ?? '',
          categoryId: String(product.category!.id),
          salePrice: String(product.salePrice),
          taxRate: String(toPercent(product.taxRate!)),
          minStock: String(product.minStock),
          description: product.description ?? '',
          active: product.active!,
          initialStock: '0',
        }
      : {
          name: '', sku: '', barcode: initialBarcode ?? '', categoryId: '', salePrice: '', taxRate: '', minStock: '0', description: '',
          active: true, initialStock: '0',
        },
  })
  const [salePrice, taxRate, categoryId] = useWatch({ control, name: ['salePrice', 'taxRate', 'categoryId'] })
  // The category whose VAT was just offered; the product's VAT changes only if the user accepts.
  const [suggested, setSuggested] = useState<LabeledCategory | null>(null)
  const imageChanged = image.kind !== (product?.imageUrl ? 'current' : 'none')
  // Active categories, plus the product's own if it was deactivated (so the form still shows it).
  const options = categories.filter((category) => category.active || category.id === product?.category?.id)

  // Picking a category offers its VAT (when it differs from the current one) instead of applying it.
  const onCategoryChange = (value: string) => {
    const category = categories.find((option) => String(option.id) === value)
    setSuggested(category && !sameRate(getValues('taxRate'), category) ? category : null)
  }
  const applySuggestedRate = () => {
    setValue('taxRate', String(toPercent(suggested!.defaultTaxRate!)), { shouldDirty: true, shouldValidate: true })
    setSuggested(null)
  }
  const keepOwnRate = () => {
    setSuggested(null)
    setFocus('taxRate')
  }
  // Under the VAT: whether it matches the selected category's default.
  const selected = categories.find((option) => String(option.id) === categoryId)
  const taxRateHint = selected && taxRate.trim() !== '' && Number.isFinite(Number(taxRate))
    ? sameRate(taxRate, selected)
      ? t('products.form.taxRateMatches')
      : t('products.form.taxRateDiffers', { rate: formatTaxRate(selected.defaultTaxRate!, i18n.language) })
    : undefined

  const onSubmit = handleSubmit(async (values) => {
    setSaving(true)
    setFormError(null)
    let saved: Product | undefined
    try {
      if (!product) {
        saved = await createProduct.mutateAsync(toRequest(values, undefined))
      } else if (isDirty) {
        saved = await updateProduct.mutateAsync({
          id: product.id!, ...toRequest(values, product.imageUrl), active: values.active, version: product.version!,
        })
      }
    } catch (error) {
      if (!applyServerErrors(error, setError, t)) {
        setFormError(errorMessage(error))
      }
      setSaving(false)
      return
    }

    const id = saved?.id ?? product!.id!
    const name = saved?.name ?? product!.name!
    // Once the fields are saved, a failed follow-up is reported but doesn't keep the dialog open.
    const failures: string[] = []
    if (!product && values.initialStock > 0) {
      try {
        await adjustStock.mutateAsync({
          idempotencyKey: initialStockKey, productId: id, quantity: values.initialStock, reason: t('products.stock.reasons.initial'),
        })
      } catch (error) {
        failures.push(t('products.stockFailed', { name, reason: errorMessage(error) }))
      }
    }
    try {
      if (image.kind === 'new') {
        await uploadImage.mutateAsync({ id, file: image.file })
      } else if (image.kind === 'none' && product?.imageUrl) {
        await removeImage.mutateAsync(id)
      }
    } catch (error) {
      // Nothing else was saved: stay so the user can fix it.
      if (!saved) {
        setFormError(errorMessage(error))
        setSaving(false)
        return
      }
      failures.push(t('products.imageFailed', { name, reason: errorMessage(error) }))
    }
    setSaving(false)
    if (failures.length > 0) {
      failures.forEach((failure) => toast.error(failure))
      onDone()
      return
    }
    showSuccess(t(product ? 'products.updatedTitle' : 'products.createdTitle'),
      t(product ? 'products.updated' : 'products.created', { name }))
    onDone()
  })

  return (
    <form onSubmit={onSubmit} className="flex min-h-0 flex-1 flex-col" noValidate>
      <div className="grid min-h-0 flex-1 gap-6 overflow-y-auto px-6 py-5 md:grid-cols-[16rem_1fr]">
        <aside className="grid content-start gap-4">
          <ImagePicker value={image} onChange={setImage} />
          {product && (
            <label className="flex items-start gap-3 rounded-lg border p-3">
              <input type="checkbox" className="mt-0.5 size-4 accent-primary" {...register('active')} />
              <span className="grid gap-0.5">
                <span className="text-sm font-medium">{t('products.form.active')}</span>
                <span className="text-xs text-muted-foreground">{t('products.form.activeHint')}</span>
              </span>
            </label>
          )}
        </aside>

        <div className="grid content-start gap-6">
          {formError && <ErrorAlert message={formError} />}
          <Section title={t('products.form.general')}>
            <Field id="name" label={t('products.form.name')} error={errors.name}>
              <Input id="name" autoComplete="off" autoFocus maxLength={NAME_MAX_LENGTH}
                aria-invalid={!!errors.name} {...filtered(register('name'), NOT_LABEL_CHAR)} />
            </Field>
            {/* Next to the name: in a store the product is usually in hand, ready to scan. */}
            <Field id="barcode" label={t('products.form.barcode')} error={errors.barcode} hint={t('products.form.barcodeHint')}>
              <Input id="barcode" inputMode="numeric" autoComplete="off" maxLength={14}
                aria-invalid={!!errors.barcode} {...filtered(register('barcode'), NOT_DIGIT)} />
            </Field>
            <Field id="category" label={t('products.form.category')} error={errors.categoryId}>
              <Controller control={control} name="categoryId" render={({ field }) => (
                <Select id="category" value={field.value} aria-invalid={!!errors.categoryId}
                  placeholder={t('products.form.chooseCategory')}
                  onValueChange={(value) => {
                    field.onChange(value)
                    onCategoryChange(value)
                  }}
                  options={options.map((category) => ({
                    value: String(category.id),
                    label: category.active ? category.label : t('products.form.inactiveCategory', { name: category.label }),
                  }))} />
              )} />
            </Field>
            <Field id="sku" label={t('products.form.sku')} error={errors.sku} hint={t('products.form.skuHint')}>
              {/* Uppercased while typing, as the API stores it. */}
              <Input id="sku" autoComplete="off" maxLength={SKU_MAX_LENGTH} aria-invalid={!!errors.sku}
                {...filtered(register('sku'), NOT_CODE_CHAR, (value) => value.toUpperCase())} />
            </Field>
          </Section>

          <Section title={t('products.form.pricing')} columns={3}>
            {suggested && !sameRate(taxRate, suggested) && (
              <div role="status" className="flex flex-wrap items-center gap-3 rounded-lg border border-primary/30 bg-primary/5 p-3 text-sm sm:col-span-2 lg:col-span-3">
                <Info className="size-4 shrink-0 text-primary" />
                <span className="min-w-0 flex-1">
                  {t('products.form.suggestTaxRate', {
                    category: suggested.label,
                    rate: formatTaxRate(suggested.defaultTaxRate!, i18n.language),
                  })}
                </span>
                <span className="flex gap-2">
                  <Button type="button" size="sm" onClick={applySuggestedRate}>
                    {t('products.form.applyTaxRate', { rate: formatTaxRate(suggested.defaultTaxRate!, i18n.language) })}
                  </Button>
                  <Button type="button" size="sm" variant="outline" onClick={keepOwnRate}>
                    {t('products.form.keepTaxRate')}
                  </Button>
                </span>
              </div>
            )}
            <Field id="salePrice" label={t('products.form.salePrice')} error={errors.salePrice}>
              <Input id="salePrice" type="number" inputMode="decimal" min={0} step="0.01" placeholder="0.00"
                aria-invalid={!!errors.salePrice} {...register('salePrice')} />
            </Field>
            <Field id="taxRate" label={t('products.form.taxRate')} error={errors.taxRate} hint={taxRateHint}>
              <Input id="taxRate" type="number" inputMode="decimal" min={0} max={99.99} step="0.01"
                aria-invalid={!!errors.taxRate} {...register('taxRate')} />
            </Field>
            <PriceWithVat salePrice={salePrice} taxRate={taxRate} />
          </Section>

          <div className="grid gap-4 sm:grid-cols-2 lg:grid-cols-3">
            <Field id="description" label={t('products.form.description')} error={errors.description}>
              <Textarea id="description" maxLength={DESCRIPTION_MAX_LENGTH}
                aria-invalid={!!errors.description} {...register('description')} />
            </Field>
            <Field id="minStock" label={t('products.form.minStock')} error={errors.minStock} hint={t('products.form.minStockHint')}>
              <Input id="minStock" type="number" inputMode="numeric" min={0} step={1}
                aria-invalid={!!errors.minStock} {...register('minStock')} />
            </Field>
            {/* Creating: what is on the shelf today. Editing: read only, it changes through adjustments. */}
            {product ? (
              <Field id="stock" label={t('products.form.stock')} hint={t('products.form.stockHint')}>
                <Input id="stock" value={product.stock} disabled readOnly />
              </Field>
            ) : (
              <Field id="initialStock" label={t('products.form.initialStock')} error={errors.initialStock}
                hint={t('products.form.initialStockHint')}>
                <Input id="initialStock" type="number" inputMode="numeric" min={0} max={MAX_ADJUSTMENT} step={1}
                  aria-invalid={!!errors.initialStock} {...register('initialStock')} />
              </Field>
            )}
          </div>
        </div>
      </div>

      <DialogFooter className="m-0 px-6">
        <DialogClose render={<Button type="button" variant="outline" />}>{t('products.form.cancel')}</DialogClose>
        <Button type="submit" disabled={saving || (!!product && !isDirty && !imageChanged)}>
          {saving ? t('products.form.saving') : product ? t('products.form.save') : t('products.form.create')}
        </Button>
      </DialogFooter>
    </form>
  )
}

// Whether a typed VAT (percent text) equals the category's default; empty never does.
function sameRate(percent: string, category: Category) {
  return percent.trim() !== '' && Number(percent) === toPercent(category.defaultTaxRate!)
}

function Section({ title, columns = 2, children }: { title: string; columns?: 2 | 3; children: ReactNode }) {
  return (
    <section className="grid gap-4">
      <h3 className="text-xs font-semibold tracking-wide text-muted-foreground uppercase">{title}</h3>
      <div className={cn('grid gap-4 sm:grid-cols-2', columns === 3 && 'lg:grid-cols-3')}>{children}</div>
    </section>
  )
}

// What the customer pays per unit, with the checkout's rounding ($0.00 until a valid price is typed);
// only a preview, the server has the final say.
function PriceWithVat({ salePrice, taxRate }: { salePrice: string; taxRate: string }) {
  const { t } = useTranslation()
  const price = Number(salePrice)
  const rate = Number(taxRate) / 100
  const total = withTax(salePrice.trim() !== '' && price >= 0 ? price : 0, rate >= 0 ? rate : 0)
  return (
    <div className="grid content-start gap-2">
      <span className="text-sm font-medium">{t('products.form.priceWithVat')}</span>
      <output htmlFor="salePrice taxRate" aria-live="polite"
        className="flex h-8 items-center rounded-lg bg-primary/10 px-2.5 text-base font-semibold text-primary tabular-nums">
        {formatMoney(total)}
      </output>
      <span className="text-xs text-muted-foreground">{t('products.form.priceWithVatHint')}</span>
    </div>
  )
}
