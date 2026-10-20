import { useUser } from '@/auth/auth-context'
import { type DayRange, daysInRange } from '@/features/dashboard/days'
import { useAllUserAccounts } from '@/features/users/queries'

import { MAX_REPORT_DAYS, useSalesSummary } from './queries'

export interface SellerOption {
  id: number
  name: string
}

// Sellers to filter by: admins list every seller account; supervisors (who can't list accounts)
// get the ones who sold in the period, from the report (none for periods longer than it covers).
export function useSellerOptions(range: DayRange, enabled = true): SellerOption[] {
  const user = useUser()
  const isAdmin = user.role === 'ADMIN'
  const accounts = useAllUserAccounts(isAdmin)
  const periodSellers = useSalesSummary(range, null, enabled && !isAdmin && daysInRange(range) <= MAX_REPORT_DAYS)
  return isAdmin
    ? (accounts.data ?? []).filter((account) => account.role === 'SELLER').map((account) => ({ id: account.id!, name: account.name! }))
    : (periodSellers.data?.bySeller ?? []).map((seller) => ({ id: seller.sellerId!, name: seller.name! }))
}
