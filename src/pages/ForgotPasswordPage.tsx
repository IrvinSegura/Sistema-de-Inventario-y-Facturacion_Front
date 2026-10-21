import { zodResolver } from '@hookform/resolvers/zod'
import type { TFunction } from 'i18next'
import { ArrowLeft, CircleCheck, KeyRound, LoaderCircle, Mail, MessageSquare, ShieldCheck } from 'lucide-react'
import { type ReactNode, useEffect, useMemo, useState } from 'react'
import { useForm, useWatch } from 'react-hook-form'
import { Trans, useTranslation } from 'react-i18next'
import { Link, Navigate, useLocation, useNavigate } from 'react-router'
import { z } from 'zod'

import { ApiError, errorMessage } from '@/api/errors'
import { useAuth } from '@/auth/auth-context'
import { type ResetChannel, useRequestResetCode, useResetPassword } from '@/auth/password-reset'
import { OtpInput } from '@/components/OtpInput'
import { PasswordInput } from '@/components/PasswordInput'
import { Alert, AlertDescription } from '@/components/ui/alert'
import { Button } from '@/components/ui/button'
import { Input } from '@/components/ui/input'
import { Label } from '@/components/ui/label'
import { passwordField, PASSWORD_MIN_LENGTH } from '@/lib/password'
import { cn } from '@/lib/utils'
import { AuthHeading, AuthLayout } from '@/pages/auth/AuthLayout'

// Same as the API: a new code can be asked for a minute after the previous one.
const RESEND_SECONDS = 60
const CODE_LENGTH = 6

type Step =
  | { name: 'request' }
  | { name: 'verify'; email: string; channel: ResetChannel; sentAt: number }
  | { name: 'done'; email: string }

/** Forgotten password in three steps: where to send the code, the code plus a new password, done. */
export function ForgotPasswordPage() {
  const { state } = useAuth()
  const initialEmail = (useLocation().state as { email?: string } | null)?.email ?? ''
  const [step, setStep] = useState<Step>({ name: 'request' })
  const [email, setEmail] = useState(initialEmail)
  const [channel, setChannel] = useState<ResetChannel>('EMAIL')

  if (state.status === 'signed-in') {
    return <Navigate to="/" replace />
  }

  return (
    <AuthLayout>
      {step.name === 'request' && (
        <RequestStep email={email} channel={channel}
          onSent={(sentTo, sentBy) => {
            setEmail(sentTo)
            setChannel(sentBy)
            setStep({ name: 'verify', email: sentTo, channel: sentBy, sentAt: Date.now() })
          }} />
      )}
      {step.name === 'verify' && (
        <VerifyStep email={step.email} channel={step.channel} sentAt={step.sentAt}
          onResent={() => setStep({ ...step, sentAt: Date.now() })}
          onChangeMethod={() => setStep({ name: 'request' })}
          onDone={() => setStep({ name: 'done', email: step.email })} />
      )}
      {step.name === 'done' && <DoneStep email={step.email} />}
    </AuthLayout>
  )
}

function RequestStep({ email, channel: initialChannel, onSent }: {
  email: string
  channel: ResetChannel
  onSent: (email: string, channel: ResetChannel) => void
}) {
  const { t } = useTranslation()
  const requestCode = useRequestResetCode()
  const [channel, setChannel] = useState(initialChannel)
  const schema = useMemo(() => z.object({ email: z.email(t('login.invalidEmail')) }), [t])
  const { register, handleSubmit, formState: { errors } } = useForm({
    resolver: zodResolver(schema),
    defaultValues: { email },
  })

  const onSubmit = handleSubmit((values) =>
    requestCode.mutate({ email: values.email, channel }, { onSuccess: () => onSent(values.email, channel) }))

  return (
    <>
      <AuthHeading icon={<KeyRound className="size-5" />} title={t('passwordReset.title')}
        description={t('passwordReset.description')} />
      <form onSubmit={onSubmit} className="grid gap-5" noValidate>
        {requestCode.isError && (
          <Alert variant="destructive">
            <AlertDescription>{errorMessage(requestCode.error)}</AlertDescription>
          </Alert>
        )}
        <div className="grid gap-2">
          <Label htmlFor="reset-email">{t('login.email')}</Label>
          <Input id="reset-email" type="email" autoComplete="username" autoFocus className="h-10"
            placeholder={t('login.emailPlaceholder')} aria-invalid={!!errors.email} {...register('email')} />
          {errors.email && <p className="text-sm text-destructive">{errors.email.message}</p>}
        </div>
        <fieldset className="grid gap-2">
          <legend className="mb-2 text-sm font-medium">{t('passwordReset.channel')}</legend>
          <div className="grid grid-cols-2 gap-3">
            <ChannelOption value="EMAIL" selected={channel} onSelect={setChannel}
              icon={<Mail className="size-4" />} label={t('passwordReset.channels.EMAIL')}
              hint={t('passwordReset.channelHints.EMAIL')} />
            <ChannelOption value="SMS" selected={channel} onSelect={setChannel}
              icon={<MessageSquare className="size-4" />} label={t('passwordReset.channels.SMS')}
              hint={t('passwordReset.channelHints.SMS')} />
          </div>
        </fieldset>
        <Button type="submit" size="lg" className="h-10" disabled={requestCode.isPending}>
          {requestCode.isPending && <LoaderCircle className="animate-spin" />}
          {t(requestCode.isPending ? 'passwordReset.sending' : 'passwordReset.sendCode')}
        </Button>
        <BackToLogin email={email} />
      </form>
    </>
  )
}

function ChannelOption({ value, selected, onSelect, icon, label, hint }: {
  value: ResetChannel
  selected: ResetChannel
  onSelect: (channel: ResetChannel) => void
  icon: ReactNode
  label: string
  hint: string
}) {
  const checked = value === selected
  return (
    <label className={cn(
      'relative grid cursor-pointer gap-1.5 rounded-xl border p-3.5 transition-colors',
      'has-focus-visible:ring-3 has-focus-visible:ring-ring/50',
      checked ? 'border-foreground bg-muted/50' : 'hover:bg-muted/40',
    )}>
      <input type="radio" name="channel" value={value} checked={checked} onChange={() => onSelect(value)}
        className="sr-only" />
      <span className="flex items-center gap-2 text-sm font-medium">
        {icon}
        {label}
      </span>
      <span className="text-xs text-muted-foreground">{hint}</span>
      <span aria-hidden className={cn(
        'absolute top-3.5 right-3.5 size-4 rounded-full border transition-colors',
        checked ? 'border-[5px] border-foreground' : 'border-input',
      )} />
    </label>
  )
}

function verifySchema(t: TFunction) {
  return z.object({
    code: z.string().regex(/^\d{6}$/, t('passwordReset.enterCode')),
    newPassword: passwordField(t),
    confirmPassword: z.string(),
  }).refine((values) => values.newPassword === values.confirmPassword, {
    path: ['confirmPassword'],
    message: t('passwordReset.passwordsDontMatch'),
  })
}

function VerifyStep({ email, channel, sentAt, onResent, onChangeMethod, onDone }: {
  email: string
  channel: ResetChannel
  sentAt: number
  onResent: () => void
  onChangeMethod: () => void
  onDone: () => void
}) {
  const { t } = useTranslation()
  const resetPassword = useResetPassword()
  const requestCode = useRequestResetCode()
  const secondsLeft = useCountdown(sentAt, RESEND_SECONDS)
  const schema = useMemo(() => verifySchema(t), [t])
  const { register, handleSubmit, setValue, setError, control, formState: { errors } } = useForm({
    resolver: zodResolver(schema),
    defaultValues: { code: '', newPassword: '', confirmPassword: '' },
  })
  const code = useWatch({ control, name: 'code' })

  const onSubmit = handleSubmit(({ code: typedCode, newPassword }) =>
    resetPassword.mutate({ email, code: typedCode, newPassword }, {
      onSuccess: onDone,
      onError: (error) => {
        // A wrong code is shown under the boxes and cleared, so the next try starts fresh.
        if (error instanceof ApiError && error.status === 400 && error.message === 'Invalid or expired code') {
          setValue('code', '')
          setError('code', { message: t('apiErrors.invalidResetCode') })
          resetPassword.reset()
        } else if (error instanceof ApiError && error.fieldErrors.newPassword) {
          setError('newPassword', { message: t('validation.invalidValue') })
          resetPassword.reset()
        }
      },
    }))

  return (
    <>
      {/* The API's codes last 10 minutes; keep `minutes` in step with it. */}
      <AuthHeading icon={<ShieldCheck className="size-5" />} title={t(`passwordReset.checkTitle.${channel}`)}
        description={
          <Trans i18nKey={`passwordReset.checkDescription.${channel}`} values={{ email, minutes: 10 }}
            components={{ strong: <strong className="font-medium text-foreground" /> }} />
        } />
      <form onSubmit={onSubmit} className="grid gap-5" noValidate>
        {resetPassword.isError && (
          <Alert variant="destructive">
            <AlertDescription>{errorMessage(resetPassword.error)}</AlertDescription>
          </Alert>
        )}
        <div className="grid gap-2">
          <Label>{t('passwordReset.code')}</Label>
          <OtpInput label={t('passwordReset.code')} value={code} length={CODE_LENGTH} autoFocus
            invalid={!!errors.code}
            onChange={(value) => setValue('code', value, { shouldValidate: value.length === CODE_LENGTH })} />
          {errors.code && <p className="text-sm text-destructive">{errors.code.message}</p>}
          <p className="text-xs text-muted-foreground">
            {secondsLeft > 0 ? (
              t('passwordReset.resendIn', { count: secondsLeft })
            ) : (
              <button type="button" disabled={requestCode.isPending}
                onClick={() => requestCode.mutate({ email, channel }, { onSuccess: onResent })}
                className="rounded-sm font-medium text-foreground underline-offset-4 outline-none hover:underline focus-visible:ring-3 focus-visible:ring-ring/50 disabled:opacity-50">
                {t('passwordReset.resend')}
              </button>
            )}
            {' · '}
            <button type="button" onClick={onChangeMethod}
              className="rounded-sm font-medium text-foreground underline-offset-4 outline-none hover:underline focus-visible:ring-3 focus-visible:ring-ring/50">
              {t('passwordReset.changeMethod')}
            </button>
          </p>
        </div>
        <div className="grid gap-2">
          <Label htmlFor="new-password">{t('passwordReset.newPassword')}</Label>
          <PasswordInput id="new-password" autoComplete="new-password" className="h-10"
            aria-invalid={!!errors.newPassword} {...register('newPassword')} />
          {errors.newPassword
            ? <p className="text-sm text-destructive">{errors.newPassword.message}</p>
            : <p className="text-xs text-muted-foreground">{t('passwordReset.passwordHint', { count: PASSWORD_MIN_LENGTH })}</p>}
        </div>
        <div className="grid gap-2">
          <Label htmlFor="confirm-password">{t('passwordReset.confirmPassword')}</Label>
          <PasswordInput id="confirm-password" autoComplete="new-password" className="h-10"
            aria-invalid={!!errors.confirmPassword} {...register('confirmPassword')} />
          {errors.confirmPassword && <p className="text-sm text-destructive">{errors.confirmPassword.message}</p>}
        </div>
        <Button type="submit" size="lg" className="h-10" disabled={resetPassword.isPending}>
          {resetPassword.isPending && <LoaderCircle className="animate-spin" />}
          {t(resetPassword.isPending ? 'passwordReset.saving' : 'passwordReset.save')}
        </Button>
        <BackToLogin email={email} />
      </form>
    </>
  )
}

function DoneStep({ email }: { email: string }) {
  const { t } = useTranslation()
  const navigate = useNavigate()

  return (
    <>
      <AuthHeading icon={<CircleCheck className="size-5" />} title={t('passwordReset.doneTitle')}
        description={t('passwordReset.doneDescription')} />
      <Button size="lg" className="h-10" autoFocus onClick={() => navigate('/login', { state: { email } })}>
        {t('passwordReset.goToLogin')}
      </Button>
    </>
  )
}

function BackToLogin({ email }: { email: string }) {
  const { t } = useTranslation()
  return (
    <Link to="/login" state={{ email }}
      className="mx-auto flex items-center gap-1.5 rounded-sm text-sm font-medium text-muted-foreground outline-none hover:text-foreground focus-visible:ring-3 focus-visible:ring-ring/50">
      <ArrowLeft className="size-4" />
      {t('passwordReset.backToLogin')}
    </Link>
  )
}

/** Seconds left until `seconds` after `since`, ticking once a second until it reaches zero. */
function useCountdown(since: number, seconds: number): number {
  const [now, setNow] = useState(() => Date.now())
  const left = Math.min(seconds, Math.max(0, Math.ceil((since + seconds * 1000 - now) / 1000)))

  useEffect(() => {
    if (left === 0) {
      return
    }
    const timer = window.setTimeout(() => setNow(Date.now()), 1000)
    return () => window.clearTimeout(timer)
  }, [now, left])

  return left
}
