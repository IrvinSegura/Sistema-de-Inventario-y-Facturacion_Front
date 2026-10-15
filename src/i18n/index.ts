import i18n, { type ParseKeys } from 'i18next'
import LanguageDetector from 'i18next-browser-languagedetector'
import { initReactI18next } from 'react-i18next'

import { en } from './locales/en'
import { es } from './locales/es'

export const languages = ['en', 'es'] as const
export type Language = (typeof languages)[number]

declare module 'i18next' {
  interface CustomTypeOptions {
    resources: { translation: typeof en }
  }
}

void i18n
  .use(LanguageDetector)
  .use(initReactI18next)
  .init({
    resources: { en: { translation: en }, es: { translation: es } },
    supportedLngs: languages,
    // es-MX, es-ES... -> es.
    nonExplicitSupportedLngs: true,
    load: 'languageOnly',
    fallbackLng: 'en',
    // React already escapes rendered text.
    interpolation: { escapeValue: false },
    detection: {
      order: ['localStorage', 'navigator'],
      lookupLocalStorage: 'inventory.language',
      caches: ['localStorage'],
    },
  })

// Screen readers and the browser's spell checker follow <html lang>; the tab title is translated too.
function syncDocument() {
  document.documentElement.lang = i18n.resolvedLanguage ?? 'en'
  document.title = i18n.t('app.name')
}
i18n.on('languageChanged', syncDocument)
syncDocument()

// Any translation key, for keys kept in data (menus, tables) instead of written inline.
export type MessageKey = ParseKeys

export function currentLanguage(): Language {
  return i18n.resolvedLanguage === 'es' ? 'es' : 'en'
}

// Dates and times follow the language; money always uses the store's currency format (MXN).
export function dateLocale(language: string): string {
  return language.startsWith('es') ? 'es-MX' : 'en-US'
}

export default i18n
