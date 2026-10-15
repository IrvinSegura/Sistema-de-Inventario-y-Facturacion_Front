import { LoaderCircle } from 'lucide-react'
import { useTranslation } from 'react-i18next'

export function FullPageSpinner() {
  const { t } = useTranslation()
  return (
    <div className="flex min-h-svh items-center justify-center" role="status" aria-label={t('app.loading')}>
      <LoaderCircle className="size-6 animate-spin text-muted-foreground" />
    </div>
  )
}
