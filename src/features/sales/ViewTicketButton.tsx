import { Eye } from 'lucide-react'
import { useTranslation } from 'react-i18next'

import { Button } from '@/components/ui/button'

/** The eye icon at the end of a ticket row; the label names the ticket for screen readers. */
export function ViewTicketButton({ saleNumber, onClick }: { saleNumber?: number; onClick: () => void }) {
  const { t } = useTranslation()
  return (
    <Button variant="ghost" size="icon" aria-label={t('drawer.viewTicket', { number: saleNumber })} onClick={onClick}>
      <Eye />
    </Button>
  )
}
