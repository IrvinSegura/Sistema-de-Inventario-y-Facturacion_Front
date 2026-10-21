import type { TFunction } from 'i18next'
import { z } from 'zod'

// Same limits as the API: at least 8 characters and at most 72 bytes (BCrypt's limit).
export const PASSWORD_MIN_LENGTH = 8
const PASSWORD_MAX_BYTES = 72

/**
 * A password to set, checked like the API does; the upper limit counts UTF-8 bytes, so accented letters
 * take two. Messages in the current language.
 */
export function passwordField(t: TFunction) {
  return z.string()
    .min(PASSWORD_MIN_LENGTH, t('validation.passwordTooShort', { count: PASSWORD_MIN_LENGTH }))
    .refine((value) => new TextEncoder().encode(value).length <= PASSWORD_MAX_BYTES, t('validation.passwordTooLong'))
}
