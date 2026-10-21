import { LoaderCircle } from 'lucide-react'
import { useTranslation } from 'react-i18next'

/** Spinner for a section of a page (the full-screen one is for the app's first load). */
export function LoadingBlock() {
  const { t } = useTranslation()
  return (
    <div className="flex h-64 items-center justify-center" role="status" aria-label={t('app.loading')}>
      <LoaderCircle className="size-6 animate-spin text-muted-foreground" />
    </div>
  )
}
