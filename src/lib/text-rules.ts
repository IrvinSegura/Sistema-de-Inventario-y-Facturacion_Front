/**
 * Same character rules as the API (common/validation/TextRules), so a value accepted here is never
 * rejected there for its characters.
 */

import type { UseFormRegisterReturn } from 'react-hook-form'

/** Codes such as a SKU, checked after uppercasing: letters, digits, '.', '-' and '_'; no leading symbol. */
export const CODE = /^[A-Z0-9][A-Z0-9._-]*$/
/**
 * Product and category names: letters in any language, digits, spaces and common punctuation; no
 * leading symbol.
 */
export const LABEL = /^[\p{L}\p{N}][\p{L}\p{M}\p{N} .,'&()/%+#-]*$/u
/** People's names: letters, spaces, apostrophes, dots and hyphens, starting with a letter. */
export const PERSON_NAME = /^\p{L}[\p{L}\p{M} .'-]*$/u
/** Free-text reasons (cancellations, stock adjustments): VARCHAR(255) columns in the API. */
export const REASON_MAX_LENGTH = 255

// Characters dropped while typing, so the field never holds something the rule would reject.
export const NOT_CODE_CHAR = /[^A-Za-z0-9._-]/g
export const NOT_DIGIT = /\D/g
export const NOT_LABEL_CHAR = /[^\p{L}\p{M}\p{N} .,'&()/%+#-]/gu
export const NOT_PERSON_NAME_CHAR = /[^\p{L}\p{M} .'-]/gu
export const NOT_PHONE_CHAR = /[^\d\s()+-]/g

/** Mexican RFC (@TaxId): 3 letters (company) or 4 (person), a date and a 3-character check code, in uppercase. */
export const TAX_ID = /^[A-ZÑ&]{3,4}\d{6}[A-Z0-9]{3}$/
export const TAX_ID_MAX_LENGTH = 13
export const NOT_TAX_ID_CHAR = /[^A-Za-zÑñ&0-9]/g
/** Phones (@Phone): at least 7 digits; digits, spaces, +, - and parentheses only, 20 characters at most. */
export const PHONE = /^(?=(?:\D*\d){7})[0-9+()\- ]{7,20}$/
export const PHONE_MAX_LENGTH = 20

/**
 * Wraps a react-hook-form field so typed or pasted characters outside the rule are removed
 * (and the value optionally transformed, e.g. uppercased) before the form sees them.
 *
 * @param disallowed a global pattern of the characters to drop, such as NOT_CODE_CHAR
 */
export function filtered(
  field: UseFormRegisterReturn,
  disallowed: RegExp,
  transform: (value: string) => string = (value) => value,
): UseFormRegisterReturn {
  return {
    ...field,
    onChange: (event) => {
      const input = event.target as HTMLInputElement
      const clean = transform(input.value.replace(disallowed, ''))
      // Written back only when something changed: assigning value moves the caret to the end.
      if (clean !== input.value) {
        input.value = clean
      }
      return field.onChange(event)
    },
  }
}
