import type { TFunction } from 'i18next'
import { z } from 'zod'

import { formatMoney } from './money'

/**
 * Money typed in a form: up to 2 decimals, from 0 to max; messages in the current language.
 * Input is the field's raw value; pass string to pipe it after a string check.
 */
export function amountField<Input = unknown>(t: TFunction, max: number) {
  return z.coerce
    .number<Input>({ error: t('validation.enterAmount') })
    .min(0, t('validation.minZero'))
    .max(max, t('validation.atMost', { amount: formatMoney(max) }))
    // With a tolerance, because value * 100 can miss the integer by a hair (0.07 * 100 is 7.000000000000001).
    .refine((value) => Math.abs(value * 100 - Math.round(value * 100)) < 1e-6, t('validation.twoDecimals'))
}
