import { zodResolver } from '@hookform/resolvers/zod'
import type { TFunction } from 'i18next'
import { type ComponentProps, type ReactNode, useMemo, useState } from 'react'
import { type FieldError, type Path, useForm, type UseFormSetError } from 'react-hook-form'
import { useTranslation } from 'react-i18next'
import { toast } from 'sonner'
import { z } from 'zod'

import { ApiError, errorMessage } from '@/api/errors'
import type { Role } from '@/auth/auth-context'
import { ErrorAlert } from '@/components/ErrorAlert'
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
import { Label } from '@/components/ui/label'

import { type Seller, useCreateSeller, useUpdateSeller } from './queries'

const roles: Role[] = ['SELLER', 'ADMIN']

// Same limits as the API: name 100 chars, email 150, password 8 chars to 72 bytes (BCrypt).
const NAME_MAX_LENGTH = 100
const EMAIL_MAX_LENGTH = 150
const PASSWORD_MIN_LENGTH = 8
const PASSWORD_MAX_BYTES = 72

function nameField(t: TFunction) {
  return z.string().trim()
    .min(1, t('sellers.form.enterName'))
    .max(NAME_MAX_LENGTH, t('validation.maxChars', { count: NAME_MAX_LENGTH }))
}

function createSchema(t: TFunction) {
  return z.object({
    name: nameField(t),
    email: z.email(t('login.invalidEmail')).max(EMAIL_MAX_LENGTH, t('validation.maxChars', { count: EMAIL_MAX_LENGTH })),
    password: z.string()
      .min(PASSWORD_MIN_LENGTH, t('sellers.form.passwordTooShort', { count: PASSWORD_MIN_LENGTH }))
      .refine((value) => new TextEncoder().encode(value).length <= PASSWORD_MAX_BYTES, t('sellers.form.passwordTooLong')),
    role: z.enum(roles),
  })
}

function editSchema(t: TFunction) {
  return z.object({ name: nameField(t), role: z.enum(roles), active: z.boolean() })
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
  known.forEach(([field, message]) => setError(field as Path<T>, { message }))
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
  const { register, handleSubmit, setError, formState: { errors } } = useForm({
    resolver: zodResolver(schema),
    defaultValues: { name: '', email: '', password: '', role: 'SELLER' as Role },
  })

  const onSubmit = handleSubmit((values) =>
    createSeller.mutate(values, {
      onSuccess: (seller) => {
        toast.success(t('sellers.created', { name: seller.name }))
        onDone()
      },
      onError: (error) => {
        if (applyServerErrors(error, ['name', 'email', 'password', 'role'], setError, t)) {
          createSeller.reset()
        }
      },
    }))

  return (
    <form onSubmit={onSubmit} className="grid gap-4" noValidate>
      {createSeller.isError && <ErrorAlert message={errorMessage(createSeller.error)} />}
      <Field id="name" label={t('sellers.form.name')} error={errors.name}>
        <Input id="name" autoComplete="off" autoFocus maxLength={NAME_MAX_LENGTH}
          aria-invalid={!!errors.name} {...register('name')} />
      </Field>
      <Field id="email" label={t('sellers.form.email')} error={errors.email}>
        <Input id="email" type="email" autoComplete="off" maxLength={EMAIL_MAX_LENGTH}
          aria-invalid={!!errors.email} {...register('email')} />
      </Field>
      <Field id="password" label={t('sellers.form.password')} error={errors.password}
        hint={t('sellers.form.passwordHint', { count: PASSWORD_MIN_LENGTH })}>
        <Input id="password" type="password" autoComplete="new-password"
          aria-invalid={!!errors.password} {...register('password')} />
      </Field>
      <Field id="role" label={t('sellers.form.role')} error={errors.role}>
        <RoleSelect id="role" {...register('role')} />
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
  const { register, handleSubmit, setError, formState: { errors, isDirty } } = useForm({
    resolver: zodResolver(schema),
    defaultValues: { name: seller.name!, role: seller.role!, active: seller.active! },
  })

  const onSubmit = handleSubmit((values) =>
    updateSeller.mutate({ id: seller.id!, ...values }, {
      onSuccess: (updated) => {
        toast.success(t('sellers.updated', { name: updated.name }))
        onDone()
      },
      onError: (error) => {
        if (applyServerErrors(error, ['name'], setError, t)) {
          updateSeller.reset()
        }
      },
    }))

  return (
    <form onSubmit={onSubmit} className="grid gap-4" noValidate>
      {updateSeller.isError && <ErrorAlert message={errorMessage(updateSeller.error)} />}
      <Field id="edit-name" label={t('sellers.form.name')} error={errors.name}>
        <Input id="edit-name" autoComplete="off" autoFocus maxLength={NAME_MAX_LENGTH}
          aria-invalid={!!errors.name} {...register('name')} />
      </Field>
      {/* Changing your own role or status would end your session; another admin has to do it. */}
      <Field id="edit-role" label={t('sellers.form.role')} error={errors.role}
        hint={isSelf ? t('sellers.form.selfHint') : t('sellers.form.sessionsHint')}>
        <RoleSelect id="edit-role" disabled={isSelf} {...register('role')} />
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

function Field({ id, label, hint, error, children }: {
  id: string
  label: string
  hint?: string
  error?: FieldError
  children: ReactNode
}) {
  return (
    <div className="grid gap-2">
      <Label htmlFor={id}>{label}</Label>
      {children}
      {error
        ? <p className="text-sm text-destructive">{error.message}</p>
        : hint && <p className="text-xs text-muted-foreground">{hint}</p>}
    </div>
  )
}

function RoleSelect(props: ComponentProps<'select'>) {
  const { t } = useTranslation()
  return (
    <select {...props}
      className="h-8 w-full rounded-lg border border-input bg-transparent px-2 text-sm outline-none focus-visible:border-ring focus-visible:ring-3 focus-visible:ring-ring/50 disabled:cursor-not-allowed disabled:opacity-50 dark:bg-input/30 [&>option]:bg-popover [&>option]:text-popover-foreground">
      {roles.map((role) => <option key={role} value={role}>{t(`app.roles.${role}`)}</option>)}
    </select>
  )
}
