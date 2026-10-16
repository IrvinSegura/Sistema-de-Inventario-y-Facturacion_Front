import { useMutation } from '@tanstack/react-query'

import { api, type Schemas, unwrap } from '@/api/client'
import { currentLanguage } from '@/i18n'

export type ResetChannel = Schemas['PasswordResetCodeRequest']['channel']

// Public endpoints: they answer the same whether or not the account exists.
export function useRequestResetCode() {
  return useMutation({
    mutationFn: ({ email, channel }: { email: string; channel: ResetChannel }) =>
      unwrap(api.POST('/api/v1/auth/password-reset/code', {
        body: { email, channel, language: currentLanguage() },
      })),
  })
}

export function useResetPassword() {
  return useMutation({
    mutationFn: (body: Schemas['ResetPasswordRequest']) =>
      unwrap(api.POST('/api/v1/auth/password-reset', { body })),
  })
}
