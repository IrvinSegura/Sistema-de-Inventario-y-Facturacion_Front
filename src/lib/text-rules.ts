import type { UseFormRegisterReturn } from 'react-hook-form'

// Same character rules as the API (common/validation/TextRules), so a value accepted here is never
// rejected there for its characters.

// Codes such as a SKU, checked after uppercasing: letters, digits, '.', '-' and '_'.
export const CODE = /^[A-Z0-9][A-Z0-9._-]*$/
// Product and category names: letters in any language, digits, spaces and common punctuation.
export const LABEL = /^[\p{L}\p{N}][\p{L}\p{M}\p{N} .,'&()/%+#-]*$/u
// People's names: letters, spaces, apostrophes, dots and hyphens.
export const PERSON_NAME = /^\p{L}[\p{L}\p{M} .'-]*$/u

// Characters dropped while typing, so the field never holds something the rule would reject.
export const NOT_CODE_CHAR = /[^A-Za-z0-9._-]/g
export const NOT_DIGIT = /\D/g
export const NOT_LABEL_CHAR = /[^\p{L}\p{M}\p{N} .,'&()/%+#-]/gu
export const NOT_PERSON_NAME_CHAR = /[^\p{L}\p{M} .'-]/gu
export const NOT_PHONE_CHAR = /[^\d\s()+-]/g

// Wraps a react-hook-form field so typed or pasted characters outside the rule are removed
// (and the value optionally transformed, e.g. uppercased) before the form sees them.
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
      if (clean !== input.value) {
        input.value = clean
      }
      return field.onChange(event)
    },
  }
}
