import { zodResolver } from '@hookform/resolvers/zod'
import type { TFunction } from 'i18next'
import { Contact } from 'lucide-react'
import { useMemo, useState } from 'react'
import { Controller, useForm, useWatch } from 'react-hook-form'
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
import { Select } from '@/components/ui/select'
import { showSuccess } from '@/lib/success-popup'
import { filtered, NOT_DIGIT, NOT_PHONE_CHAR } from '@/lib/text-rules'

import { type Customer, useCreateCustomer, useUpdateCustomer } from './queries'
import { isCompanyTaxId, isTaxRegimeCode, regimeAppliesTo, TAX_REGIMES } from './tax-regimes'

// Same limits and rules as the API (CreateCustomerRequest / UpdateCustomerRequest, @TaxId, @Phone,
// and CustomerService's fiscal data rule).
const NAME_MAX_LENGTH = 150
const EMAIL_MAX_LENGTH = 150
const PHONE_MAX_LENGTH = 20
const ADDRESS_MAX_LENGTH = 255
const TAX_ID_MAX_LENGTH = 13
// Mexican RFC: 3 letters (company) or 4 (person), a date and a 3-character check code.
const TAX_ID = /^[A-ZÑ&]{3,4}\d{6}[A-Z0-9]{3}$/
const NOT_TAX_ID_CHAR = /[^A-Za-zÑñ&0-9]/g
// At least 7 digits; digits, spaces, +, - and parentheses only.
const PHONE = /^(?=(?:\D*\d){7})[0-9+()\- ]{7,20}$/
const POSTAL_CODE = /^\d{5}$/

const fields = ['name', 'taxId', 'email', 'phone', 'address', 'fiscalPostalCode', 'taxRegime'] as const

function customerSchema(t: TFunction) {
  return z.object({
    name: z.string().trim()
      .min(1, t('customers.form.enterName'))
      .max(NAME_MAX_LENGTH, t('validation.maxChars', { count: NAME_MAX_LENGTH })),
    taxId: z.string().trim().toUpperCase()
      .refine((value) => value === '' || TAX_ID.test(value), t('customers.form.invalidTaxId')),
    fiscalPostalCode: z.string().trim()
      .refine((value) => value === '' || POSTAL_CODE.test(value), t('customers.form.invalidPostalCode')),
    taxRegime: z.string(),
    email: z.string().trim()
      .max(EMAIL_MAX_LENGTH, t('validation.maxChars', { count: EMAIL_MAX_LENGTH }))
      .pipe(z.union([z.literal(''), z.email(t('login.invalidEmail'))])),
    phone: z.string().trim()
      .refine((value) => value === '' || PHONE.test(value), t('customers.form.invalidPhone')),
    address: z.string().trim().max(ADDRESS_MAX_LENGTH, t('validation.maxChars', { count: ADDRESS_MAX_LENGTH })),
    active: z.boolean(),
  }).superRefine(({ taxId, fiscalPostalCode, taxRegime }, context) => {
    // An invoice needs all three, so they go together or not at all (like the API).
    if (taxId === '' && fiscalPostalCode === '' && taxRegime === '') {
      return
    }
    const missing = (path: 'taxId' | 'fiscalPostalCode' | 'taxRegime', message: string) =>
      context.addIssue({ code: 'custom', path: [path], message })
    if (taxId === '') {
      missing('taxId', t('customers.form.taxIdRequired'))
    }
    if (fiscalPostalCode === '') {
      missing('fiscalPostalCode', t('customers.form.postalCodeRequired'))
    }
    if (taxRegime === '') {
      missing('taxRegime', t('customers.form.taxRegimeRequired'))
    } else if (TAX_ID.test(taxId) && isTaxRegimeCode(taxRegime) && !regimeAppliesTo(taxRegime, taxId)) {
      missing('taxRegime', t(isCompanyTaxId(taxId) ? 'customers.form.regimeNotForCompanies' : 'customers.form.regimeNotForIndividuals'))
    }
  })
}

// open: null closed, 'new' to create, a customer to edit it. onCreated gets the new customer.
export function CustomerDialog({ open, onOpenChange, onCreated }: {
  open: Customer | 'new' | null
  onOpenChange: (open: boolean) => void
  onCreated?: (customer: Customer) => void
}) {
  const { t } = useTranslation()
  // Keeps the last content on screen while the dialog animates out.
  const [shown, setShown] = useState(open)
  if (open && open !== shown) {
    setShown(open)
  }
  const customer = shown === 'new' ? undefined : shown ?? undefined
  return (
    <Dialog open={!!open} onOpenChange={onOpenChange}>
      <DialogContent className="sm:max-w-lg">
        <DialogHeader className="flex-row items-center gap-3">
          <span className="flex size-10 shrink-0 items-center justify-center rounded-lg bg-primary/10 text-primary">
            <Contact className="size-5" />
          </span>
          <span className="grid min-w-0 gap-1">
            <DialogTitle className="text-lg">{customer ? t('customers.editTitle') : t('customers.createTitle')}</DialogTitle>
            <DialogDescription className="truncate">{customer ? customer.name : t('customers.createDescription')}</DialogDescription>
          </span>
        </DialogHeader>
        {/* Keyed so every opening starts from the customer's current data (or empty). */}
        {shown && <CustomerForm key={customer?.id ?? 'new'} customer={customer} onCreated={onCreated}
          onDone={() => onOpenChange(false)} />}
      </DialogContent>
    </Dialog>
  )
}

function CustomerForm({ customer, onCreated, onDone }: {
  customer?: Customer
  onCreated?: (customer: Customer) => void
  onDone: () => void
}) {
  const { t } = useTranslation()
  const createCustomer = useCreateCustomer()
  const updateCustomer = useUpdateCustomer()
  const mutation = customer ? updateCustomer : createCustomer
  const schema = useMemo(() => customerSchema(t), [t])
  const { register, control, handleSubmit, setError, formState: { errors, isDirty } } = useForm({
    resolver: zodResolver(schema),
    defaultValues: {
      name: customer?.name ?? '',
      taxId: customer?.taxId ?? '',
      fiscalPostalCode: customer?.fiscalPostalCode ?? '',
      taxRegime: customer?.taxRegime ?? '',
      email: customer?.email ?? '',
      phone: customer?.phone ?? '',
      address: customer?.address ?? '',
      active: customer?.active ?? true,
    },
  })
  const taxId = useWatch({ control, name: 'taxId' }).trim().toUpperCase()

  // A taken tax ID or the API's field errors go next to their inputs; anything else stays in the alert.
  const onError = (error: unknown) => {
    if (!(error instanceof ApiError)) {
      return
    }
    if (error.message === 'Tax ID already exists') {
      setError('taxId', { message: t('customers.form.taxIdTaken') })
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
      fiscalPostalCode: values.fiscalPostalCode || undefined,
      taxRegime: values.taxRegime || undefined,
      email: values.email || undefined,
      phone: values.phone || undefined,
      address: values.address || undefined,
    }
    const onSuccess = (saved: Customer) => {
      showSuccess(t(customer ? 'customers.updatedTitle' : 'customers.createdTitle'), saved.name)
      if (!customer) {
        onCreated?.(saved)
      }
      onDone()
    }
    if (customer) {
      updateCustomer.mutate({ id: customer.id!, ...body, active: values.active, version: customer.version! }, { onSuccess, onError })
    } else {
      createCustomer.mutate(body, { onSuccess, onError })
    }
  })

  return (
    <form onSubmit={onSubmit} className="grid gap-4" noValidate>
      {mutation.isError && <ErrorAlert message={errorMessage(mutation.error)} />}
      <Field id="customer-name" label={t('customers.form.name')} error={errors.name} hint={t('customers.form.nameHint')}>
        <Input id="customer-name" autoComplete="off" autoFocus maxLength={NAME_MAX_LENGTH}
          aria-invalid={!!errors.name} {...register('name')} />
      </Field>
      <fieldset className="grid gap-4 rounded-lg border p-3">
        <legend className="px-1 text-sm font-medium">{t('customers.form.fiscalData')}</legend>
        <p className="-mt-2 text-xs text-muted-foreground">{t('customers.form.fiscalDataHint')}</p>
        <div className="grid gap-4 sm:grid-cols-2">
          <Field id="customer-tax-id" label={t('customers.form.taxId')} error={errors.taxId} hint={t('customers.form.taxIdHint')}>
            <Input id="customer-tax-id" autoComplete="off" maxLength={TAX_ID_MAX_LENGTH} placeholder="ABC010203XY1"
              className="font-mono uppercase" aria-invalid={!!errors.taxId}
              {...filtered(register('taxId'), NOT_TAX_ID_CHAR, (value) => value.toUpperCase())} />
          </Field>
          <Field id="customer-postal-code" label={t('customers.form.fiscalPostalCode')} error={errors.fiscalPostalCode}
            hint={t('customers.form.fiscalPostalCodeHint')}>
            <Input id="customer-postal-code" inputMode="numeric" autoComplete="off" maxLength={5} placeholder="06600"
              className="font-mono" aria-invalid={!!errors.fiscalPostalCode}
              {...filtered(register('fiscalPostalCode'), NOT_DIGIT)} />
          </Field>
        </div>
        <Field id="customer-tax-regime" label={t('customers.form.taxRegime')} error={errors.taxRegime}>
          <Controller control={control} name="taxRegime" render={({ field }) => (
            <Select id="customer-tax-regime" value={field.value} onValueChange={field.onChange}
              aria-invalid={!!errors.taxRegime} placeholder={t('customers.form.chooseTaxRegime')}
              options={[
                { value: '', label: t('customers.form.noTaxRegime') },
                // Once the RFC is complete, regimes that don't apply to its kind can't be chosen.
                ...TAX_REGIMES.map(({ code }) => ({
                  value: code,
                  label: `${code} · ${t(`customers.taxRegimes.${code}`)}`,
                  disabled: TAX_ID.test(taxId) && !regimeAppliesTo(code, taxId),
                })),
              ]} />
          )} />
        </Field>
      </fieldset>
      <div className="grid gap-4 sm:grid-cols-2">
        <Field id="customer-phone" label={t('customers.form.phone')} error={errors.phone}>
          <Input id="customer-phone" type="tel" autoComplete="off" maxLength={PHONE_MAX_LENGTH} placeholder="55 1234 5678"
            aria-invalid={!!errors.phone} {...filtered(register('phone'), NOT_PHONE_CHAR)} />
        </Field>
        <Field id="customer-email" label={t('customers.form.email')} error={errors.email}>
          <Input id="customer-email" type="email" autoComplete="off" maxLength={EMAIL_MAX_LENGTH}
            aria-invalid={!!errors.email} {...register('email')} />
        </Field>
      </div>
      <Field id="customer-address" label={t('customers.form.address')} error={errors.address}>
        <Textarea id="customer-address" maxLength={ADDRESS_MAX_LENGTH}
          aria-invalid={!!errors.address} {...register('address')} />
      </Field>
      {customer && (
        <label className="flex items-start gap-3 rounded-lg border p-3">
          <input type="checkbox" className="mt-0.5 size-4 accent-primary" {...register('active')} />
          <span className="grid gap-0.5">
            <span className="text-sm font-medium">{t('customers.form.active')}</span>
            <span className="text-xs text-muted-foreground">{t('customers.form.activeHint')}</span>
          </span>
        </label>
      )}
      <DialogFooter>
        <DialogClose render={<Button type="button" variant="outline" />}>{t('customers.form.cancel')}</DialogClose>
        <Button type="submit" disabled={(customer && !isDirty) || mutation.isPending}>
          {mutation.isPending ? t('customers.form.saving') : customer ? t('customers.form.save') : t('customers.form.create')}
        </Button>
      </DialogFooter>
    </form>
  )
}
