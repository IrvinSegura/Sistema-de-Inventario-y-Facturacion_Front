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
    // Spanish until the user picks a language, whatever the browser's.
    fallbackLng: 'es',
    // React already escapes rendered text.
    interpolation: { escapeValue: false },
    detection: {
      order: ['localStorage'],
      lookupLocalStorage: 'inventory.language',
      caches: ['localStorage'],
    },
  })

/** Screen readers and the browser's spell checker follow <html lang>; the tab title is translated too. */
function syncDocument() {
  document.documentElement.lang = i18n.resolvedLanguage ?? 'es'
  document.title = i18n.t('app.name')
}
i18n.on('languageChanged', syncDocument)
syncDocument()

/** Any translation key, for keys kept in data (menus, tables) instead of written inline. */
export type MessageKey = ParseKeys

/** The language the screens are shown in; English for anything but Spanish. */
export function currentLanguage(): Language {
  return i18n.resolvedLanguage === 'es' ? 'es' : 'en'
}

export default i18n
