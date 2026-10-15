import { useTranslation } from 'react-i18next'

import { Alert, AlertDescription, AlertTitle } from '@/components/ui/alert'

export function ErrorAlert({ message }: { message: string }) {
  const { t } = useTranslation()
  return (
    <Alert variant="destructive">
      <AlertTitle>{t('errors.title')}</AlertTitle>
      <AlertDescription>{message}</AlertDescription>
    </Alert>
  )
}
