import { zodResolver } from '@hookform/resolvers/zod'
import type { TFunction } from 'i18next'
import { Tags } from 'lucide-react'
import { useMemo, useState } from 'react'
import { useForm } from 'react-hook-form'
import { useTranslation } from 'react-i18next'
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
import { fromPercent, toPercent } from '@/features/products/tax-rate'
import { showSuccess } from '@/lib/success-popup'
import { filtered, LABEL, NOT_LABEL_CHAR } from '@/lib/text-rules'

import type { LabeledCategory } from './category-labels'
import { type Category, useCreateCategory, useUpdateCategory } from './queries'

// Same limits as the API (CreateCategoryRequest / UpdateCategoryRequest).
const NAME_MAX_LENGTH = 100
const DESCRIPTION_MAX_LENGTH = 255
// With a tolerance, because value * 100 can miss the integer by a hair (0.07 * 100 is 7.000000000000001).
const TWO_DECIMALS = (value: number) => Math.abs(value * 100 - Math.round(value * 100)) < 1e-6

function categorySchema(t: TFunction) {
  return z.object({
    name: z.string().trim()
      .min(1, t('categories.form.enterName'))
      .max(NAME_MAX_LENGTH, t('validation.maxChars', { count: NAME_MAX_LENGTH }))
      .regex(LABEL, t('products.form.invalidName')),
    description: z.string().trim().max(DESCRIPTION_MAX_LENGTH, t('validation.maxChars', { count: DESCRIPTION_MAX_LENGTH })),
    defaultTaxRate: z.string().trim().min(1, t('products.form.invalidTaxRate')).pipe(z.coerce
      .number<string>({ error: t('products.form.invalidTaxRate') })
      .min(0, t('products.form.invalidTaxRate'))
      .max(99.99, t('products.form.invalidTaxRate'))
      .refine(TWO_DECIMALS, t('products.form.invalidTaxRate'))),
    active: z.boolean(),
  })
}

/** Creates or edits a category. open: null closed, 'new' to create, a category to edit it. */
export function CategoryDialog({ open, onOpenChange }: { open: LabeledCategory | 'new' | null; onOpenChange: (open: boolean) => void }) {
  const { t } = useTranslation()
  // Keeps the last content on screen while the dialog animates out.
  const [shown, setShown] = useState(open)
  if (open && open !== shown) {
    setShown(open)
  }
  const category = shown === 'new' ? undefined : shown ?? undefined
  return (
    <Dialog open={!!open} onOpenChange={onOpenChange}>
      <DialogContent className="sm:max-w-lg">
        <DialogHeader className="flex-row items-center gap-3">
          <span className="flex size-10 shrink-0 items-center justify-center rounded-lg bg-primary/10 text-primary">
            <Tags className="size-5" />
          </span>
          <span className="grid min-w-0 gap-1">
            <DialogTitle className="text-lg">{category ? t('categories.editTitle') : t('categories.createTitle')}</DialogTitle>
            <DialogDescription className="truncate">{category ? category.label : t('categories.createDescription')}</DialogDescription>
          </span>
        </DialogHeader>
        {/* Keyed so every opening starts from the category's current data (or empty). */}
        {shown && <CategoryForm key={category?.id ?? 'new'} category={category} onDone={() => onOpenChange(false)} />}
      </DialogContent>
    </Dialog>
  )
}

function CategoryForm({ category, onDone }: { category?: LabeledCategory; onDone: () => void }) {
  const { t } = useTranslation()
  const createCategory = useCreateCategory()
  const updateCategory = useUpdateCategory()
  const mutation = category ? updateCategory : createCategory
  const schema = useMemo(() => categorySchema(t), [t])
  const { register, handleSubmit, setError, formState: { errors, isDirty } } = useForm({
    resolver: zodResolver(schema),
    defaultValues: {
      name: category?.label ?? '',
      description: category?.descriptionLabel ?? '',
      defaultTaxRate: category ? String(toPercent(category.defaultTaxRate!)) : '0',
      active: category?.active ?? true,
    },
  })

  const onError = (error: unknown) => {
    // A taken name goes next to the input; anything else stays in the alert above the form.
    if (error instanceof ApiError && error.message === 'Category name already exists') {
      setError('name', { message: t('categories.form.nameTaken') })
      mutation.reset()
    }
  }

  const onSubmit = handleSubmit((values) => {
    // A default category shown translated keeps its stored (English) text unless it was edited, so
    // it still shows in whichever language is chosen.
    const body = {
      name: category && values.name === category.label ? category.name! : values.name,
      description: category && values.description === (category.descriptionLabel ?? '')
        ? category.description
        : values.description || undefined,
      defaultTaxRate: fromPercent(values.defaultTaxRate),
    }
    const onSuccess = (saved: Category) => {
      showSuccess(t(category ? 'categories.updatedTitle' : 'categories.createdTitle'), saved.name)
      onDone()
    }
    if (category) {
      updateCategory.mutate({ id: category.id!, ...body, active: values.active, version: category.version! }, { onSuccess, onError })
    } else {
      createCategory.mutate(body, { onSuccess, onError })
    }
  })

  return (
    <form onSubmit={onSubmit} className="grid gap-4" noValidate>
      {mutation.isError && <ErrorAlert message={errorMessage(mutation.error)} />}
      <Field id="category-name" label={t('categories.form.name')} error={errors.name}>
        <Input id="category-name" autoComplete="off" autoFocus maxLength={NAME_MAX_LENGTH}
          aria-invalid={!!errors.name} {...filtered(register('name'), NOT_LABEL_CHAR)} />
      </Field>
      <Field id="category-description" label={t('categories.form.description')} error={errors.description}>
        <Textarea id="category-description" maxLength={DESCRIPTION_MAX_LENGTH}
          aria-invalid={!!errors.description} {...register('description')} />
      </Field>
      <Field id="category-tax" label={t('categories.form.defaultTaxRate')} error={errors.defaultTaxRate}
        hint={t('categories.form.defaultTaxRateHint')}>
        <Input id="category-tax" type="number" inputMode="decimal" min={0} max={99.99} step="0.01"
          aria-invalid={!!errors.defaultTaxRate} {...register('defaultTaxRate')} />
      </Field>
      {category && (
        <label className="flex items-start gap-3 rounded-lg border p-3">
          <input type="checkbox" className="mt-0.5 size-4 accent-primary" {...register('active')} />
          <span className="grid gap-0.5">
            <span className="text-sm font-medium">{t('categories.form.active')}</span>
            <span className="text-xs text-muted-foreground">{t('categories.form.activeHint')}</span>
          </span>
        </label>
      )}
      <DialogFooter>
        <DialogClose render={<Button type="button" variant="outline" />}>{t('products.form.cancel')}</DialogClose>
        <Button type="submit" disabled={mutation.isPending || (!!category && !isDirty)}>
          {mutation.isPending ? t('products.form.saving') : category ? t('products.form.save') : t('categories.form.create')}
        </Button>
      </DialogFooter>
    </form>
  )
}
