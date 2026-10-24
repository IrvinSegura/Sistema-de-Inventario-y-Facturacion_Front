import { zodResolver } from '@hookform/resolvers/zod'
import { Check, Copy, RefreshCw } from 'lucide-react'
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
import { generateTemporaryPassword } from '@/lib/temporary-password'
import { filtered, NOT_PERSON_NAME_CHAR, NOT_PHONE_CHAR, PERSON_NAME } from '@/lib/text-rules'

import { type UserAccount, useCreateUserAccount, useResetUserPassword, useUpdateUserAccount } from './queries'

const roles: Role[] = ['SELLER', 'SUPERVISOR', 'ADMIN']

// Same limits as the API: name 100 chars, email 150; phone in E.164 once separators are removed.
const NAME_MAX_LENGTH = 100
const EMAIL_MAX_LENGTH = 150
const E164 = /^\+[1-9]\d{7,14}$/

function nameField(t: TFunction) {
  return z.string().trim()
    .min(1, t('users.form.enterName'))
    .max(NAME_MAX_LENGTH, t('validation.maxChars', { count: NAME_MAX_LENGTH }))
    .regex(PERSON_NAME, t('validation.personName'))
}

/** Optional: empty clears it. "+52 (55) 1234-5678" is sent as +525512345678. */
function phoneField(t: TFunction) {
  return z.string()
    .transform((value) => value.replace(/[\s().-]/g, ''))
    .refine((value) => value === '' || E164.test(value), t('users.form.invalidPhone'))
}

function emailField(t: TFunction) {
  return z.email(t('login.invalidEmail')).max(EMAIL_MAX_LENGTH, t('validation.maxChars', { count: EMAIL_MAX_LENGTH }))
}

function createSchema(t: TFunction) {
  return z.object({
    name: nameField(t),
    email: emailField(t),
    password: passwordField(t),
    role: z.enum(roles),
    phone: phoneField(t),
  })
}

function editSchema(t: TFunction) {
  // Email is undefined when its input is disabled (own account); the API then keeps the current one.
  return z.object({ name: nameField(t), email: emailField(t).optional(), role: z.enum(roles), active: z.boolean(), phone: phoneField(t) })
}

/**
 * Server-side field errors (400 with field messages, or a taken email) go next to their inputs and
 * return true; anything else is left for the alert above the form.
 */
function applyServerErrors<T extends Record<string, unknown>>(
  error: unknown, fields: Path<T>[], setError: UseFormSetError<T>, t: TFunction,
): boolean {
  if (!(error instanceof ApiError)) {
    return false
  }
  // The 409 carries no error code, only the API's English message (the one api/errors.ts translates).
  if (error.status === 409 && error.message === 'Email is already registered' && fields.includes('email' as Path<T>)) {
    setError('email' as Path<T>, { message: t('users.form.emailTaken') })
    return true
  }
  // The API's field messages are in English, so the fields get a generic translated one instead.
  const known = Object.entries(error.fieldErrors).filter(([field]) => fields.includes(field as Path<T>))
  known.forEach(([field]) => setError(field as Path<T>, { message: t('validation.invalidValue') }))
  return known.length > 0
}

interface DialogProps {
  open: boolean
  onOpenChange: (open: boolean) => void
}

export function CreateUserDialog({ open, onOpenChange }: DialogProps) {
  const { t } = useTranslation()
  return (
    <Dialog open={open} onOpenChange={onOpenChange}>
      <DialogContent className="sm:max-w-md">
        <DialogHeader>
          <DialogTitle>{t('users.createTitle')}</DialogTitle>
          <DialogDescription>{t('users.createDescription')}</DialogDescription>
        </DialogHeader>
        {/* Mounted only while open, so every opening starts with an empty form. */}
        <CreateUserForm onDone={() => onOpenChange(false)} />
      </DialogContent>
    </Dialog>
  )
}

function CreateUserForm({ onDone }: { onDone: () => void }) {
  const { t } = useTranslation()
  const createUserAccount = useCreateUserAccount()
  const schema = useMemo(() => createSchema(t), [t])
  const { register, handleSubmit, setError, control, formState: { errors } } = useForm({
    resolver: zodResolver(schema),
    defaultValues: { name: '', email: '', password: '', role: 'SELLER' as Role, phone: '' },
  })
  const role = useWatch({ control, name: 'role' })

  const onSubmit = handleSubmit((values) =>
    createUserAccount.mutate(values, {
      onSuccess: (account) => {
        showSuccess(t('users.createdTitle'), t('users.created', { name: account.name }))
        onDone()
      },
      onError: (error) => {
        if (applyServerErrors(error, ['name', 'email', 'password', 'role', 'phone'], setError, t)) {
          // Clears the mutation error so the alert doesn't repeat what the fields already show.
          createUserAccount.reset()
        }
      },
    }))

  return (
    <form onSubmit={onSubmit} className="grid gap-4" noValidate>
      {createUserAccount.isError && <ErrorAlert message={errorMessage(createUserAccount.error)} />}
      <Field id="name" label={t('users.form.name')} error={errors.name}>
        <Input id="name" autoComplete="off" autoFocus maxLength={NAME_MAX_LENGTH}
          aria-invalid={!!errors.name} {...filtered(register('name'), NOT_PERSON_NAME_CHAR)} />
      </Field>
      <Field id="email" label={t('users.form.email')} error={errors.email}>
        <Input id="email" type="email" autoComplete="off" maxLength={EMAIL_MAX_LENGTH}
          aria-invalid={!!errors.email} {...register('email')} />
      </Field>
      <Field id="password" label={t('users.form.password')} error={errors.password}
        hint={t('users.form.passwordHint', { count: PASSWORD_MIN_LENGTH })}>
        <PasswordInput id="password" autoComplete="new-password"
          aria-invalid={!!errors.password} {...register('password')} />
      </Field>
      <Field id="role" label={t('users.form.role')} error={errors.role} hint={t(`users.roleDescriptions.${role}`)}>
        <Controller control={control} name="role" render={({ field }) => (
          <Select id="role" value={field.value} onValueChange={field.onChange} options={roleOptions(t)} />
        )} />
      </Field>
      <Field id="phone" label={t('users.form.phone')} error={errors.phone} hint={t('users.form.phoneHint')}>
        <Input id="phone" type="tel" autoComplete="off" placeholder="+52 55 1234 5678"
          aria-invalid={!!errors.phone} {...filtered(register('phone'), NOT_PHONE_CHAR)} />
      </Field>
      <DialogFooter>
        <DialogClose render={<Button type="button" variant="outline" />}>{t('users.form.cancel')}</DialogClose>
        <Button type="submit" disabled={createUserAccount.isPending}>
          {createUserAccount.isPending ? t('users.form.saving') : t('users.form.create')}
        </Button>
      </DialogFooter>
    </form>
  )
}

/**
 * On the user's own account (currentUserId) the role and active status are locked; another admin has
 * to change them.
 */
export function EditUserDialog({ account, currentUserId, onOpenChange }: {
  account: UserAccount | null
  currentUserId: number
  onOpenChange: (open: boolean) => void
}) {
  const { t } = useTranslation()
  // Keeps the last account on screen while the dialog animates out.
  const [shown, setShown] = useState(account)
  if (account && account !== shown) {
    setShown(account)
  }
  return (
    <Dialog open={!!account} onOpenChange={onOpenChange}>
      <DialogContent className="sm:max-w-md">
        <DialogHeader>
          <DialogTitle>{t('users.editTitle')}</DialogTitle>
          <DialogDescription>{shown?.email}</DialogDescription>
        </DialogHeader>
        {shown && <EditUserForm account={shown} isSelf={shown.id === currentUserId} onDone={() => onOpenChange(false)} />}
      </DialogContent>
    </Dialog>
  )
}

function EditUserForm({ account, isSelf, onDone }: { account: UserAccount; isSelf: boolean; onDone: () => void }) {
  const { t } = useTranslation()
  const updateUserAccount = useUpdateUserAccount()
  const schema = useMemo(() => editSchema(t), [t])
  const { register, handleSubmit, setError, control, formState: { errors, isDirty } } = useForm({
    resolver: zodResolver(schema),
    defaultValues: {
      name: account.name!, email: account.email!, role: account.role!, active: account.active!, phone: account.phone ?? '',
    },
  })
  const role = useWatch({ control, name: 'role' })

  const onSubmit = handleSubmit((values) =>
    updateUserAccount.mutate({ id: account.id!, ...values }, {
      onSuccess: (updated) => {
        showSuccess(t('users.updatedTitle'), t('users.updated', { name: updated.name }))
        onDone()
      },
      onError: (error) => {
        if (applyServerErrors(error, ['name', 'email', 'phone'], setError, t)) {
          updateUserAccount.reset()
        }
      },
    }))

  return (
    <form onSubmit={onSubmit} className="grid gap-4" noValidate>
      {updateUserAccount.isError && <ErrorAlert message={errorMessage(updateUserAccount.error)} />}
      <Field id="edit-name" label={t('users.form.name')} error={errors.name}>
        <Input id="edit-name" autoComplete="off" autoFocus maxLength={NAME_MAX_LENGTH}
          aria-invalid={!!errors.name} {...filtered(register('name'), NOT_PERSON_NAME_CHAR)} />
      </Field>
      {/* Like the role: this session keeps the email it signed in with, so another admin changes yours. */}
      <Field id="edit-email" label={t('users.form.email')} error={errors.email}
        hint={isSelf ? t('users.form.selfEmailHint') : t('users.form.emailHint')}>
        <Input id="edit-email" type="email" autoComplete="off" maxLength={EMAIL_MAX_LENGTH} disabled={isSelf}
          aria-invalid={!!errors.email} {...register('email')} />
      </Field>
      {/* Changing your own role or status would end your session; another admin has to do it. */}
      <Field id="edit-role" label={t('users.form.role')} error={errors.role}
        hint={isSelf ? t('users.form.selfHint') : `${t(`users.roleDescriptions.${role}`)} ${t('users.form.sessionsHint')}`}>
        <Controller control={control} name="role" render={({ field }) => (
          <Select id="edit-role" value={field.value} onValueChange={field.onChange} disabled={isSelf} options={roleOptions(t)} />
        )} />
      </Field>
      <Field id="edit-phone" label={t('users.form.phone')} error={errors.phone} hint={t('users.form.phoneHint')}>
        <Input id="edit-phone" type="tel" autoComplete="off" placeholder="+52 55 1234 5678"
          aria-invalid={!!errors.phone} {...filtered(register('phone'), NOT_PHONE_CHAR)} />
      </Field>
      <label className="flex items-start gap-3 rounded-lg border p-3 has-disabled:opacity-60">
        <input type="checkbox" className="mt-0.5 size-4 accent-primary" disabled={isSelf} {...register('active')} />
        <span className="grid gap-0.5">
          <span className="text-sm font-medium">{t('users.form.active')}</span>
          <span className="text-xs text-muted-foreground">{t('users.form.activeHint')}</span>
        </span>
      </label>
      <DialogFooter>
        <DialogClose render={<Button type="button" variant="outline" />}>{t('users.form.cancel')}</DialogClose>
        <Button type="submit" disabled={!isDirty || updateUserAccount.isPending}>
          {updateUserAccount.isPending ? t('users.form.saving') : t('users.form.save')}
        </Button>
      </DialogFooter>
    </form>
  )
}

/**
 * Sets a temporary password for someone who lost theirs (not for the admin's own account). It proposes
 * a random one, and once saved shows it to copy: the user changes it at their next login.
 */
export function ResetPasswordDialog({ account, onOpenChange }: {
  account: UserAccount | null
  onOpenChange: (open: boolean) => void
}) {
  const { t } = useTranslation()
  // Keeps the last account on screen while the dialog animates out.
  const [shown, setShown] = useState(account)
  if (account && account !== shown) {
    setShown(account)
  }
  return (
    <Dialog open={!!account} onOpenChange={onOpenChange}>
      <DialogContent className="sm:max-w-md">
        <DialogHeader>
          <DialogTitle>{t('users.reset.title', { name: shown?.name })}</DialogTitle>
          <DialogDescription>{t('users.reset.description')}</DialogDescription>
        </DialogHeader>
        {/* Keyed by account, so every opening starts with a fresh password and no previous result. */}
        {shown && <ResetPasswordForm key={shown.id} account={shown} onDone={() => onOpenChange(false)} />}
      </DialogContent>
    </Dialog>
  )
}

function ResetPasswordForm({ account, onDone }: { account: UserAccount; onDone: () => void }) {
  const { t } = useTranslation()
  const resetUserPassword = useResetUserPassword()
  const [saved, setSaved] = useState<string | null>(null)
  const [copied, setCopied] = useState(false)
  const schema = useMemo(() => z.object({ temporaryPassword: passwordField(t) }), [t])
  const { register, handleSubmit, setValue, formState: { errors } } = useForm({
    resolver: zodResolver(schema),
    defaultValues: { temporaryPassword: generateTemporaryPassword() },
  })

  const onSubmit = handleSubmit(({ temporaryPassword }) =>
    resetUserPassword.mutate({ id: account.id!, temporaryPassword }, { onSuccess: () => setSaved(temporaryPassword) }))

  // The clipboard needs HTTPS (or localhost); without it the password stays on screen to select by hand.
  async function copy(password: string) {
    try {
      await navigator.clipboard.writeText(password)
      setCopied(true)
    } catch {
      setCopied(false)
    }
  }

  if (saved) {
    return (
      <div className="grid gap-4">
        <p className="text-sm">{t('users.reset.saved', { name: account.name })}</p>
        <div className="flex items-center gap-2 rounded-lg border bg-muted/50 p-3">
          <code className="flex-1 font-mono text-lg tracking-wider select-all">{saved}</code>
          {'clipboard' in navigator && (
            <Button type="button" variant="outline" size="sm" onClick={() => void copy(saved)}>
              {copied ? <Check /> : <Copy />}
              {copied ? t('users.reset.copied') : t('users.reset.copy')}
            </Button>
          )}
        </div>
        <DialogFooter>
          <Button onClick={onDone}>{t('users.reset.close')}</Button>
        </DialogFooter>
      </div>
    )
  }

  return (
    <form onSubmit={onSubmit} className="grid gap-4" noValidate>
      {resetUserPassword.isError && <ErrorAlert message={errorMessage(resetUserPassword.error)} />}
      <Field id="temporary-password" label={t('users.reset.password')} error={errors.temporaryPassword}
        hint={t('users.reset.hint', { count: PASSWORD_MIN_LENGTH })}>
        <div className="flex gap-2">
          {/* Plain text: the admin has to read it to the user. */}
          <Input id="temporary-password" autoComplete="off" spellCheck={false} className="font-mono"
            aria-invalid={!!errors.temporaryPassword} {...register('temporaryPassword')} />
          <Button type="button" variant="outline" size="icon" aria-label={t('users.reset.generate')}
            title={t('users.reset.generate')}
            onClick={() => setValue('temporaryPassword', generateTemporaryPassword(), { shouldValidate: true })}>
            <RefreshCw />
          </Button>
        </div>
      </Field>
      <DialogFooter>
        <DialogClose render={<Button type="button" variant="outline" />}>{t('users.form.cancel')}</DialogClose>
        <Button type="submit" disabled={resetUserPassword.isPending}>
          {resetUserPassword.isPending ? t('users.form.saving') : t('users.reset.save')}
        </Button>
      </DialogFooter>
    </form>
  )
}

function roleOptions(t: TFunction) {
  return roles.map((role) => ({ value: role, label: t(`app.roles.${role}`) }))
}
