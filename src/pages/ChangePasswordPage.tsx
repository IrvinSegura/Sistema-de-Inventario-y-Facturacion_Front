import { zodResolver } from '@hookform/resolvers/zod'
import type { TFunction } from 'i18next'
import { ArrowLeft, KeyRound, LogOut } from 'lucide-react'
import { useMemo, useState } from 'react'
import { useForm } from 'react-hook-form'
import { useTranslation } from 'react-i18next'
import { Link, useNavigate } from 'react-router'
import { z } from 'zod'

import { ApiError, errorMessage } from '@/api/errors'
import { useAuth, useUser } from '@/auth/auth-context'
import { ErrorAlert } from '@/components/ErrorAlert'
import { PasswordInput } from '@/components/PasswordInput'
import { Button } from '@/components/ui/button'
import { Label } from '@/components/ui/label'
import { passwordField, PASSWORD_MIN_LENGTH } from '@/lib/password'
import { showSuccess } from '@/lib/success-popup'
import { AuthHeading, AuthLayout } from '@/pages/auth/AuthLayout'

function changeSchema(t: TFunction) {
  return z.object({
    currentPassword: z.string().min(1, t('changePassword.enterCurrent')),
    newPassword: passwordField(t),
    confirmPassword: z.string(),
  })
    .refine((values) => values.newPassword !== values.currentPassword, {
      path: ['newPassword'],
      message: t('changePassword.sameAsCurrent'),
    })
    .refine((values) => values.newPassword === values.confirmPassword, {
      path: ['confirmPassword'],
      message: t('passwordReset.passwordsDontMatch'),
    })
}

/**
 * The signed-in user's password change. A user with a temporary password an admin set is held here
 * (RequireAuth) until they choose their own; anyone else comes from the account menu and can go back.
 */
export function ChangePasswordPage() {
  const { t } = useTranslation()
  const navigate = useNavigate()
  const { changePassword, logout } = useAuth()
  const { passwordChangeRequired: required } = useUser()
  const [failure, setFailure] = useState<unknown>(null)
  const schema = useMemo(() => changeSchema(t), [t])
  const { register, handleSubmit, setError, formState: { errors, isSubmitting } } = useForm({
    resolver: zodResolver(schema),
    defaultValues: { currentPassword: '', newPassword: '', confirmPassword: '' },
  })

  const onSubmit = handleSubmit(async ({ currentPassword, newPassword }) => {
    setFailure(null)
    try {
      await changePassword(currentPassword, newPassword)
      showSuccess(t('changePassword.doneTitle'), t('changePassword.done'))
      void navigate('/', { replace: true })
    } catch (error) {
      if (error instanceof ApiError && error.message === 'Current password is incorrect') {
        setError('currentPassword', { message: t('apiErrors.wrongCurrentPassword') })
      } else if (error instanceof ApiError && error.message === 'New password must differ from the current one') {
        setError('newPassword', { message: t('changePassword.sameAsCurrent') })
      } else if (error instanceof ApiError && error.fieldErrors.newPassword) {
        setError('newPassword', { message: t('validation.invalidValue') })
      } else {
        setFailure(error)
      }
    }
  })

  return (
    <AuthLayout>
      <AuthHeading icon={<KeyRound />} title={t(required ? 'changePassword.requiredTitle' : 'changePassword.title')}
        description={t(required ? 'changePassword.requiredDescription' : 'changePassword.description')} />
      <form onSubmit={onSubmit} className="grid gap-5" noValidate>
        {failure !== null && <ErrorAlert message={errorMessage(failure)} />}
        <div className="grid gap-2">
          <Label htmlFor="current-password">
            {t(required ? 'changePassword.temporaryPassword' : 'changePassword.currentPassword')}
          </Label>
          <PasswordInput id="current-password" autoComplete="current-password" className="h-10" autoFocus
            aria-invalid={!!errors.currentPassword} {...register('currentPassword')} />
          {errors.currentPassword && <p className="text-sm text-destructive">{errors.currentPassword.message}</p>}
        </div>
        <div className="grid gap-2">
          <Label htmlFor="new-password">{t('passwordReset.newPassword')}</Label>
          <PasswordInput id="new-password" autoComplete="new-password" className="h-10"
            aria-invalid={!!errors.newPassword} {...register('newPassword')} />
          {errors.newPassword
            ? <p className="text-sm text-destructive">{errors.newPassword.message}</p>
            : <p className="text-sm text-muted-foreground">{t('passwordReset.passwordHint', { count: PASSWORD_MIN_LENGTH })}</p>}
        </div>
        <div className="grid gap-2">
          <Label htmlFor="confirm-password">{t('passwordReset.confirmPassword')}</Label>
          <PasswordInput id="confirm-password" autoComplete="new-password" className="h-10"
            aria-invalid={!!errors.confirmPassword} {...register('confirmPassword')} />
          {errors.confirmPassword && <p className="text-sm text-destructive">{errors.confirmPassword.message}</p>}
        </div>
        <Button type="submit" size="lg" className="h-10" disabled={isSubmitting}>
          {isSubmitting ? t('changePassword.saving') : t('changePassword.save')}
        </Button>
        {/* Held here, the only way out is signing out; otherwise back to where they were. */}
        {required ? (
          <Button type="button" variant="ghost" className="mx-auto" onClick={() => void logout()}>
            <LogOut />
            {t('app.signOut')}
          </Button>
        ) : (
          <Link to="/"
            className="mx-auto flex items-center gap-1.5 rounded-sm text-sm font-medium text-muted-foreground outline-none hover:text-foreground focus-visible:ring-3 focus-visible:ring-ring/50">
            <ArrowLeft className="size-4" />
            {t('changePassword.back')}
          </Link>
        )}
      </form>
    </AuthLayout>
  )
}
