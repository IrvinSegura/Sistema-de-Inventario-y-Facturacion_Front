import { useTranslation } from 'react-i18next'

import { useSellers } from '@/features/users/queries'

export interface SellerOption {
  id: number
  name: string
}

/**
 * Every seller account for managers' seller filters (supervisors too: GET /sellers isn't admin-only),
 * whether or not they sold in the period; inactive ones are labelled, for past records. `enabled` is
 * false where only sellers look, since they see just their own records.
 */
export function useSellerOptions(enabled = true): SellerOption[] {
  const { t } = useTranslation()
  const sellers = useSellers(enabled)
  return (sellers.data ?? []).map((seller) => ({
    id: seller.id!,
    name: seller.active ? seller.name! : t('sales.filters.inactiveSeller', { name: seller.name }),
  }))
}
