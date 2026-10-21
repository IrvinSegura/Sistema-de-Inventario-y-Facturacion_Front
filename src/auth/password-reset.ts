import { useMutation } from '@tanstack/react-query'

import { api, type Schemas, unwrap } from '@/api/client'
import { currentLanguage } from '@/i18n'

export type ResetChannel = Schemas['PasswordResetCodeRequest']['channel']

/**
 * Sends a reset code by email or SMS, in the current language. Public endpoint: it answers the same
 * whether or not the account exists, so success doesn't mean a code was sent.
 */
export function useRequestResetCode() {
  return useMutation({
    mutationFn: ({ email, channel }: { email: string; channel: ResetChannel }) =>
      unwrap(api.POST('/api/v1/auth/password-reset/code', {
        body: { email, channel, language: currentLanguage() },
      })),
  })
}

/**
 * Sets a new password with the code and signs the account out of every session. Public too: a wrong,
 * expired or used code answers 400 'Invalid or expired code'; an invalid new password comes back as a
 * field error.
 */
export function useResetPassword() {
  return useMutation({
    mutationFn: (body: Schemas['ResetPasswordRequest']) =>
      unwrap(api.POST('/api/v1/auth/password-reset', { body })),
  })
}
