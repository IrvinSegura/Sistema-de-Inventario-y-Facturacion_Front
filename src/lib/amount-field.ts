import type { TFunction } from 'i18next'
import { z } from 'zod'

import { formatMoney } from './money'

// Money typed in a form: up to 2 decimals, from 0 to max; messages in the current language.
// Input is the field's raw value; pass string to pipe it after a string check.
export function amountField<Input = unknown>(t: TFunction, max: number) {
  return z.coerce
    .number<Input>({ error: t('validation.enterAmount') })
    .min(0, t('validation.minZero'))
    .max(max, t('validation.atMost', { amount: formatMoney(max) }))
    // Tolerance: 0.1 * 100 is 10.000000000000002 in floating point.
    .refine((value) => Math.abs(value * 100 - Math.round(value * 100)) < 1e-6, t('validation.twoDecimals'))
}
