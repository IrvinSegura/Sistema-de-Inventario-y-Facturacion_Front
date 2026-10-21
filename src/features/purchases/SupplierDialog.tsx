import { zodResolver } from '@hookform/resolvers/zod'
import type { TFunction } from 'i18next'
import { Truck } from 'lucide-react'
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
import { showSuccess } from '@/lib/success-popup'
import {
  filtered,
  NOT_PHONE_CHAR,
  NOT_TAX_ID_CHAR,
  PHONE,
  PHONE_MAX_LENGTH,
  TAX_ID,
  TAX_ID_MAX_LENGTH,
} from '@/lib/text-rules'

import { type Supplier, useCreateSupplier, useUpdateSupplier } from './queries'

// Same limits as the API (CreateSupplierRequest / UpdateSupplierRequest, @TaxId, @Phone).
const NAME_MAX_LENGTH = 150
const EMAIL_MAX_LENGTH = 150
const ADDRESS_MAX_LENGTH = 255

// API field names that have an input here; the form uses the same names, so they map one to one.
const fields = ['name', 'taxId', 'email', 'phone', 'address'] as const

function supplierSchema(t: TFunction) {
  return z.object({
    name: z.string().trim()
      .min(1, t('suppliers.form.enterName'))
      .max(NAME_MAX_LENGTH, t('validation.maxChars', { count: NAME_MAX_LENGTH })),
    taxId: z.string().trim().toUpperCase()
      .refine((value) => value === '' || TAX_ID.test(value), t('customers.form.invalidTaxId')),
    email: z.string().trim()
      .max(EMAIL_MAX_LENGTH, t('validation.maxChars', { count: EMAIL_MAX_LENGTH }))
      .pipe(z.union([z.literal(''), z.email(t('login.invalidEmail'))])),
    phone: z.string().trim()
      .refine((value) => value === '' || PHONE.test(value), t('customers.form.invalidPhone')),
    address: z.string().trim().max(ADDRESS_MAX_LENGTH, t('validation.maxChars', { count: ADDRESS_MAX_LENGTH })),
    active: z.boolean(),
  })
}

/**
 * Creates or edits a supplier. open: null closed, 'new' to create, a supplier to edit it. onCreated
 * gets the new supplier (edits don't call it).
 */
export function SupplierDialog({ open, onOpenChange, onCreated }: {
  open: Supplier | 'new' | null
  onOpenChange: (open: boolean) => void
  onCreated?: (supplier: Supplier) => void
}) {
  const { t } = useTranslation()
  // Keeps the last content on screen while the dialog animates out.
  const [shown, setShown] = useState(open)
  if (open && open !== shown) {
    setShown(open)
  }
  const supplier = shown === 'new' ? undefined : shown ?? undefined
  return (
    <Dialog open={!!open} onOpenChange={onOpenChange}>
      <DialogContent className="sm:max-w-lg">
        <DialogHeader className="flex-row items-center gap-3">
          <span className="flex size-10 shrink-0 items-center justify-center rounded-lg bg-primary/10 text-primary">
            <Truck className="size-5" />
          </span>
          <span className="grid min-w-0 gap-1">
            <DialogTitle className="text-lg">{supplier ? t('suppliers.editTitle') : t('suppliers.createTitle')}</DialogTitle>
            <DialogDescription className="truncate">{supplier ? supplier.name : t('suppliers.createDescription')}</DialogDescription>
          </span>
        </DialogHeader>
        {/* Keyed so every opening starts from the supplier's current data (or empty). */}
        {shown && <SupplierForm key={supplier?.id ?? 'new'} supplier={supplier} onCreated={onCreated}
          onDone={() => onOpenChange(false)} />}
      </DialogContent>
    </Dialog>
  )
}

function SupplierForm({ supplier, onCreated, onDone }: {
  supplier?: Supplier
  onCreated?: (supplier: Supplier) => void
  onDone: () => void
}) {
  const { t } = useTranslation()
  const createSupplier = useCreateSupplier()
  const updateSupplier = useUpdateSupplier()
  const mutation = supplier ? updateSupplier : createSupplier
  const schema = useMemo(() => supplierSchema(t), [t])
  const { register, handleSubmit, setError, formState: { errors, isDirty } } = useForm({
    resolver: zodResolver(schema),
    defaultValues: {
      name: supplier?.name ?? '',
      taxId: supplier?.taxId ?? '',
      email: supplier?.email ?? '',
      phone: supplier?.phone ?? '',
      address: supplier?.address ?? '',
      active: supplier?.active ?? true,
    },
  })

  // A taken tax ID or the API's field errors go next to their inputs; anything else stays in the alert.
  const onError = (error: unknown) => {
    if (!(error instanceof ApiError)) {
      return
    }
    // The API's exact message; keep it in step with the server.
    if (error.message === 'Tax ID already exists') {
      setError('taxId', { message: t('suppliers.form.taxIdTaken') })
      mutation.reset()
      return
    }
    const known = fields.filter((field) => field in error.fieldErrors)
    known.forEach((field) => setError(field, { message: t('validation.invalidValue') }))
    if (known.length > 0) {
      mutation.reset()
    }
  }

  const onSubmit = handleSubmit((values) => {
    // Blank optional fields are sent as missing, so the API stores (or clears them to) null.
    const body = {
      name: values.name,
      taxId: values.taxId || undefined,
      email: values.email || undefined,
      phone: values.phone || undefined,
      address: values.address || undefined,
    }
    const onSuccess = (saved: Supplier) => {
      showSuccess(t(supplier ? 'suppliers.updatedTitle' : 'suppliers.createdTitle'), saved.name)
      if (!supplier) {
        onCreated?.(saved)
      }
      onDone()
    }
    if (supplier) {
      updateSupplier.mutate({ id: supplier.id!, ...body, active: values.active, version: supplier.version! }, { onSuccess, onError })
    } else {
      createSupplier.mutate(body, { onSuccess, onError })
    }
  })

  return (
    <form onSubmit={onSubmit} className="grid gap-4" noValidate>
      {mutation.isError && <ErrorAlert message={errorMessage(mutation.error)} />}
      <Field id="supplier-name" label={t('suppliers.form.name')} error={errors.name} hint={t('suppliers.form.nameHint')}>
        <Input id="supplier-name" autoComplete="off" autoFocus maxLength={NAME_MAX_LENGTH}
          aria-invalid={!!errors.name} {...register('name')} />
      </Field>
      <Field id="supplier-tax-id" label={t('suppliers.form.taxId')} error={errors.taxId} hint={t('suppliers.form.taxIdHint')}>
        <Input id="supplier-tax-id" autoComplete="off" maxLength={TAX_ID_MAX_LENGTH} placeholder="ABC010203XY1"
          className="font-mono uppercase" aria-invalid={!!errors.taxId}
          {...filtered(register('taxId'), NOT_TAX_ID_CHAR, (value) => value.toUpperCase())} />
      </Field>
      <div className="grid gap-4 sm:grid-cols-2">
        <Field id="supplier-phone" label={t('suppliers.form.phone')} error={errors.phone}>
          <Input id="supplier-phone" type="tel" autoComplete="off" maxLength={PHONE_MAX_LENGTH} placeholder="55 1234 5678"
            aria-invalid={!!errors.phone} {...filtered(register('phone'), NOT_PHONE_CHAR)} />
        </Field>
        <Field id="supplier-email" label={t('suppliers.form.email')} error={errors.email}>
          <Input id="supplier-email" type="email" autoComplete="off" maxLength={EMAIL_MAX_LENGTH}
            aria-invalid={!!errors.email} {...register('email')} />
        </Field>
      </div>
      <Field id="supplier-address" label={t('suppliers.form.address')} error={errors.address}>
        <Textarea id="supplier-address" maxLength={ADDRESS_MAX_LENGTH}
          aria-invalid={!!errors.address} {...register('address')} />
      </Field>
      {/* Edit only: the create request has no active flag, so new suppliers start active. */}
      {supplier && (
        <label className="flex items-start gap-3 rounded-lg border p-3">
          <input type="checkbox" className="mt-0.5 size-4 accent-primary" {...register('active')} />
          <span className="grid gap-0.5">
            <span className="text-sm font-medium">{t('suppliers.form.active')}</span>
            <span className="text-xs text-muted-foreground">{t('suppliers.form.activeHint')}</span>
          </span>
        </label>
      )}
      <DialogFooter>
        <DialogClose render={<Button type="button" variant="outline" />}>{t('suppliers.form.cancel')}</DialogClose>
        <Button type="submit" disabled={(supplier && !isDirty) || mutation.isPending}>
          {mutation.isPending ? t('suppliers.form.saving') : supplier ? t('suppliers.form.save') : t('suppliers.form.create')}
        </Button>
      </DialogFooter>
    </form>
  )
}
