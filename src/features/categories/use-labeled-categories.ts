import { useMemo } from 'react'
import { useTranslation } from 'react-i18next'

import { dateLocale } from '@/i18n'

import { type LabeledCategory, labelCategories } from './category-labels'
import type { Category } from './queries'

/** labelCategories for a component, recomputed when the list or the language changes. */
export function useLabeledCategories(categories: Category[] | undefined): LabeledCategory[] {
  const { t, i18n } = useTranslation()
  return useMemo(
    () => labelCategories(categories ?? [], t, dateLocale(i18n.language)),
    [categories, t, i18n.language],
  )
}
