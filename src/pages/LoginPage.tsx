import { zodResolver } from '@hookform/resolvers/zod'
import { LoaderCircle, Store } from 'lucide-react'
import { useMemo } from 'react'
import { useForm } from 'react-hook-form'
import { useTranslation } from 'react-i18next'
import { Link, Navigate, useLocation, useNavigate } from 'react-router'
import { z } from 'zod'

import { errorMessage } from '@/api/errors'
import { useAuth } from '@/auth/auth-context'
import { PasswordInput } from '@/components/PasswordInput'
import { Alert, AlertDescription } from '@/components/ui/alert'
import { Button } from '@/components/ui/button'
import { Input } from '@/components/ui/input'
import { Label } from '@/components/ui/label'
import { AuthHeading, AuthLayout } from '@/pages/auth/AuthLayout'

type LoginForm = { email: string; password: string }

// Where the user was going (RequireAuth) and the email to prefill (back from a password reset).
interface LoginState {
  from?: string
  email?: string
}

export function LoginPage() {
  const { t } = useTranslation()
  // t changes with the language, so validation messages follow it.
  const loginSchema = useMemo(() => z.object({
    email: z.email(t('login.invalidEmail')),
    password: z.string().min(1, t('login.enterPassword')),
  }), [t])
  const { state, login } = useAuth()
  const navigate = useNavigate()
  const locationState = useLocation().state as LoginState | null
  const from = locationState?.from ?? '/'
  const {
    register,
    handleSubmit,
    setError,
    getValues,
    formState: { errors, isSubmitting },
  } = useForm<LoginForm>({
    resolver: zodResolver(loginSchema),
    defaultValues: { email: locationState?.email ?? '', password: '' },
  })

  if (state.status === 'signed-in') {
    return <Navigate to={from} replace />
  }

  const onSubmit = handleSubmit(async ({ email, password }) => {
    try {
      await login(email, password)
      navigate(from, { replace: true })
    } catch (error) {
      setError('root', { message: errorMessage(error) })
    }
  })

  return (
    <AuthLayout>
      <AuthHeading icon={<Store />} title={t('login.title')} description={t('login.subtitle')} />
      <form onSubmit={onSubmit} className="grid gap-5" noValidate>
        {errors.root && (
          <Alert variant="destructive">
            <AlertDescription>{errors.root.message}</AlertDescription>
          </Alert>
        )}
        <div className="grid gap-2">
          <Label htmlFor="email">{t('login.email')}</Label>
          <Input id="email" type="email" autoComplete="username" autoFocus={!locationState?.email}
            placeholder={t('login.emailPlaceholder')} className="h-10"
            aria-invalid={!!errors.email} {...register('email')} />
          {errors.email && <p className="text-sm text-destructive">{errors.email.message}</p>}
        </div>
        <div className="grid gap-2">
          <div className="flex items-center justify-between gap-2">
            <Label htmlFor="password">{t('login.password')}</Label>
            {/* Carries the typed email over, so it doesn't have to be written twice. */}
            <Link to="/forgot-password"
              onClick={(event) => {
                event.preventDefault()
                navigate('/forgot-password', { state: { email: getValues('email') } })
              }}
              className="rounded-sm text-sm font-medium text-muted-foreground underline-offset-4 outline-none hover:text-foreground hover:underline focus-visible:ring-3 focus-visible:ring-ring/50">
              {t('login.forgotPassword')}
            </Link>
          </div>
          <PasswordInput id="password" autoComplete="current-password" autoFocus={!!locationState?.email}
            className="h-10" aria-invalid={!!errors.password} {...register('password')} />
          {errors.password && <p className="text-sm text-destructive">{errors.password.message}</p>}
        </div>
        <Button type="submit" size="lg" className="h-10" disabled={isSubmitting}>
          {isSubmitting && <LoaderCircle className="animate-spin" />}
          {isSubmitting ? t('login.signingIn') : t('login.signIn')}
        </Button>
      </form>
      <p className="mt-8 text-center text-sm text-muted-foreground">{t('login.accountsHint')}</p>
    </AuthLayout>
  )
}
