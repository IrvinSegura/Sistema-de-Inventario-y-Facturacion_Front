import { useTranslation } from 'react-i18next'

import { useUser } from '@/auth/auth-context'
import { dateLocale } from '@/i18n'

import type { ReportMeta } from './excel'

// Labels and author every Excel report shares, in the current language.
export function useReportMeta(): ReportMeta {
  const { t, i18n } = useTranslation()
  const user = useUser()
  return {
    storeName: t('app.name'),
    author: user.name,
    generatedLabel: t('excel.generated'),
    generatedByLabel: t('excel.generatedBy'),
    pageLabel: t('excel.page'),
    emptyLabel: t('excel.empty'),
    totalLabel: t('excel.total'),
    locale: dateLocale(i18n.language),
  }
}
