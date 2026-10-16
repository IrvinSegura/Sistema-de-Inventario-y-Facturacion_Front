import { zodResolver } from '@hookform/resolvers/zod'
import type { TFunction } from 'i18next'
import { useMemo, useState } from 'react'
import { Controller, type Path, useForm, type UseFormSetError, useWatch } from 'react-hook-form'
import { useTranslation } from 'react-i18next'
import { z } from 'zod'

import { ApiError, errorMessage } from '@/api/errors'
import type { Role } from '@/auth/auth-context'
import { ErrorAlert } from '@/components/ErrorAlert'
import { FormField as Field } from '@/components/FormField'
import { PasswordInput } from '@/components/PasswordInput'
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
import { passwordField, PASSWORD_MIN_LENGTH } from '@/lib/password'
import { showSuccess } from '@/lib/success-popup'
import { filtered, NOT_PERSON_NAME_CHAR, NOT_PHONE_CHAR, PERSON_NAME } from '@/lib/text-rules'

import { type Seller, useCreateSeller, useUpdateSeller } from './queries'

const roles: Role[] = ['SELLER', 'SUPERVISOR', 'ADMIN']

// Same limits as the API: name 100 chars, email 150; phone in E.164 once separators are removed.
const NAME_MAX_LENGTH = 100
const EMAIL_MAX_LENGTH = 150
const E164 = /^\+[1-9]\d{7,14}$/

function nameField(t: TFunction) {
  return z.string().trim()
    .min(1, t('sellers.form.enterName'))
    .max(NAME_MAX_LENGTH, t('validation.maxChars', { count: NAME_MAX_LENGTH }))
    .regex(PERSON_NAME, t('validation.personName'))
}

// Optional: empty clears it. "+52 (55) 1234-5678" is sent as +525512345678.
function phoneField(t: TFunction) {
  return z.string()
    .transform((value) => value.replace(/[\s().-]/g, ''))
    .refine((value) => value === '' || E164.test(value), t('sellers.form.invalidPhone'))
}

function createSchema(t: TFunction) {
  return z.object({
    name: nameField(t),
    email: z.email(t('login.invalidEmail')).max(EMAIL_MAX_LENGTH, t('validation.maxChars', { count: EMAIL_MAX_LENGTH })),
    password: passwordField(t),
    role: z.enum(roles),
    phone: phoneField(t),
  })
}

function editSchema(t: TFunction) {
  return z.object({ name: nameField(t), role: z.enum(roles), active: z.boolean(), phone: phoneField(t) })
}

// Server-side field errors (400 with field messages, or a taken email) go next to their inputs and
// return true; anything else is left for the alert above the form.
function applyServerErrors<T extends Record<string, unknown>>(
  error: unknown, fields: Path<T>[], setError: UseFormSetError<T>, t: TFunction,
): boolean {
  if (!(error instanceof ApiError)) {
    return false
  }
  if (error.status === 409 && error.message === 'Email is already registered' && fields.includes('email' as Path<T>)) {
    setError('email' as Path<T>, { message: t('sellers.form.emailTaken') })
    return true
  }
  const known = Object.entries(error.fieldErrors).filter(([field]) => fields.includes(field as Path<T>))
  known.forEach(([field]) => setError(field as Path<T>, { message: t('validation.invalidValue') }))
  return known.length > 0
}

interface DialogProps {
  open: boolean
  onOpenChange: (open: boolean) => void
}

export function CreateSellerDialog({ open, onOpenChange }: DialogProps) {
  const { t } = useTranslation()
  return (
    <Dialog open={open} onOpenChange={onOpenChange}>
      <DialogContent className="sm:max-w-md">
        <DialogHeader>
          <DialogTitle>{t('sellers.createTitle')}</DialogTitle>
          <DialogDescription>{t('sellers.createDescription')}</DialogDescription>
        </DialogHeader>
        {/* Mounted only while open, so every opening starts with an empty form. */}
        <CreateSellerForm onDone={() => onOpenChange(false)} />
      </DialogContent>
    </Dialog>
  )
}

function CreateSellerForm({ onDone }: { onDone: () => void }) {
  const { t } = useTranslation()
  const createSeller = useCreateSeller()
  const schema = useMemo(() => createSchema(t), [t])
  const { register, handleSubmit, setError, control, formState: { errors } } = useForm({
    resolver: zodResolver(schema),
    defaultValues: { name: '', email: '', password: '', role: 'SELLER' as Role, phone: '' },
  })
  const role = useWatch({ control, name: 'role' })

  const onSubmit = handleSubmit((values) =>
    createSeller.mutate(values, {
      onSuccess: (seller) => {
        showSuccess(t('sellers.createdTitle'), t('sellers.created', { name: seller.name }))
        onDone()
      },
      onError: (error) => {
        if (applyServerErrors(error, ['name', 'email', 'password', 'role', 'phone'], setError, t)) {
          createSeller.reset()
        }
      },
    }))

  return (
    <form onSubmit={onSubmit} className="grid gap-4" noValidate>
      {createSeller.isError && <ErrorAlert message={errorMessage(createSeller.error)} />}
      <Field id="name" label={t('sellers.form.name')} error={errors.name}>
        <Input id="name" autoComplete="off" autoFocus maxLength={NAME_MAX_LENGTH}
          aria-invalid={!!errors.name} {...filtered(register('name'), NOT_PERSON_NAME_CHAR)} />
      </Field>
      <Field id="email" label={t('sellers.form.email')} error={errors.email}>
        <Input id="email" type="email" autoComplete="off" maxLength={EMAIL_MAX_LENGTH}
          aria-invalid={!!errors.email} {...register('email')} />
      </Field>
      <Field id="password" label={t('sellers.form.password')} error={errors.password}
        hint={t('sellers.form.passwordHint', { count: PASSWORD_MIN_LENGTH })}>
        <PasswordInput id="password" autoComplete="new-password"
          aria-invalid={!!errors.password} {...register('password')} />
      </Field>
      <Field id="role" label={t('sellers.form.role')} error={errors.role} hint={t(`sellers.roleDescriptions.${role}`)}>
        <Controller control={control} name="role" render={({ field }) => (
          <Select id="role" value={field.value} onValueChange={field.onChange} options={roleOptions(t)} />
        )} />
      </Field>
      <Field id="phone" label={t('sellers.form.phone')} error={errors.phone} hint={t('sellers.form.phoneHint')}>
        <Input id="phone" type="tel" autoComplete="off" placeholder="+52 55 1234 5678"
          aria-invalid={!!errors.phone} {...filtered(register('phone'), NOT_PHONE_CHAR)} />
      </Field>
      <DialogFooter>
        <DialogClose render={<Button type="button" variant="outline" />}>{t('sellers.form.cancel')}</DialogClose>
        <Button type="submit" disabled={createSeller.isPending}>
          {createSeller.isPending ? t('sellers.form.saving') : t('sellers.form.create')}
        </Button>
      </DialogFooter>
    </form>
  )
}

export function EditSellerDialog({ seller, currentUserId, onOpenChange }: {
  seller: Seller | null
  currentUserId: number
  onOpenChange: (open: boolean) => void
}) {
  const { t } = useTranslation()
  // Keeps the last seller on screen while the dialog animates out.
  const [shown, setShown] = useState(seller)
  if (seller && seller !== shown) {
    setShown(seller)
  }
  return (
    <Dialog open={!!seller} onOpenChange={onOpenChange}>
      <DialogContent className="sm:max-w-md">
        <DialogHeader>
          <DialogTitle>{t('sellers.editTitle')}</DialogTitle>
          <DialogDescription>{shown?.email}</DialogDescription>
        </DialogHeader>
        {shown && <EditSellerForm seller={shown} isSelf={shown.id === currentUserId} onDone={() => onOpenChange(false)} />}
      </DialogContent>
    </Dialog>
  )
}

function EditSellerForm({ seller, isSelf, onDone }: { seller: Seller; isSelf: boolean; onDone: () => void }) {
  const { t } = useTranslation()
  const updateSeller = useUpdateSeller()
  const schema = useMemo(() => editSchema(t), [t])
  const { register, handleSubmit, setError, control, formState: { errors, isDirty } } = useForm({
    resolver: zodResolver(schema),
    defaultValues: { name: seller.name!, role: seller.role!, active: seller.active!, phone: seller.phone ?? '' },
  })
  const role = useWatch({ control, name: 'role' })

  const onSubmit = handleSubmit((values) =>
    updateSeller.mutate({ id: seller.id!, ...values }, {
      onSuccess: (updated) => {
        showSuccess(t('sellers.updatedTitle'), t('sellers.updated', { name: updated.name }))
        onDone()
      },
      onError: (error) => {
        if (applyServerErrors(error, ['name', 'phone'], setError, t)) {
          updateSeller.reset()
        }
      },
    }))

  return (
    <form onSubmit={onSubmit} className="grid gap-4" noValidate>
      {updateSeller.isError && <ErrorAlert message={errorMessage(updateSeller.error)} />}
      <Field id="edit-name" label={t('sellers.form.name')} error={errors.name}>
        <Input id="edit-name" autoComplete="off" autoFocus maxLength={NAME_MAX_LENGTH}
          aria-invalid={!!errors.name} {...filtered(register('name'), NOT_PERSON_NAME_CHAR)} />
      </Field>
      {/* Changing your own role or status would end your session; another admin has to do it. */}
      <Field id="edit-role" label={t('sellers.form.role')} error={errors.role}
        hint={isSelf ? t('sellers.form.selfHint') : `${t(`sellers.roleDescriptions.${role}`)} ${t('sellers.form.sessionsHint')}`}>
        <Controller control={control} name="role" render={({ field }) => (
          <Select id="edit-role" value={field.value} onValueChange={field.onChange} disabled={isSelf} options={roleOptions(t)} />
        )} />
      </Field>
      <Field id="edit-phone" label={t('sellers.form.phone')} error={errors.phone} hint={t('sellers.form.phoneHint')}>
        <Input id="edit-phone" type="tel" autoComplete="off" placeholder="+52 55 1234 5678"
          aria-invalid={!!errors.phone} {...filtered(register('phone'), NOT_PHONE_CHAR)} />
      </Field>
      <label className="flex items-start gap-3 rounded-lg border p-3 has-disabled:opacity-60">
        <input type="checkbox" className="mt-0.5 size-4 accent-primary" disabled={isSelf} {...register('active')} />
        <span className="grid gap-0.5">
          <span className="text-sm font-medium">{t('sellers.form.active')}</span>
          <span className="text-xs text-muted-foreground">{t('sellers.form.activeHint')}</span>
        </span>
      </label>
      <DialogFooter>
        <DialogClose render={<Button type="button" variant="outline" />}>{t('sellers.form.cancel')}</DialogClose>
        <Button type="submit" disabled={!isDirty || updateSeller.isPending}>
          {updateSeller.isPending ? t('sellers.form.saving') : t('sellers.form.save')}
        </Button>
      </DialogFooter>
    </form>
  )
}

function roleOptions(t: TFunction) {
  return roles.map((role) => ({ value: role, label: t(`app.roles.${role}`) }))
}
