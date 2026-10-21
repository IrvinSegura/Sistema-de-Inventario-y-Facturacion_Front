// Kept out of index.ts, which touches document as it loads, so helpers that only need the locale
// stay importable in plain Node tests.

/** The Intl locale for the screen language (dates, numbers, sorting); money always stays es-MX/MXN. */
export function intlLocale(language: string): string {
  return language.startsWith('es') ? 'es-MX' : 'en-US'
}
