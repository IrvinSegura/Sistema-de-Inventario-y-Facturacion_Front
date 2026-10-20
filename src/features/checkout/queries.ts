import { keepPreviousData, useMutation, useQuery, useQueryClient } from '@tanstack/react-query'

import { api, type Schemas, unwrap } from '@/api/client'
import { customerKeys } from '@/features/customers/queries'

export type Product = Schemas['ProductResponse']
export type Sale = Schemas['SaleResponse']
export type PaymentMethod = Schemas['CreateSaleRequest']['paymentMethod']

// How many matches the customer search shows; a longer list means the search needs more letters.
export const CUSTOMER_MATCHES = 5

export function findProductByBarcode(barcode: string): Promise<Product> {
  return unwrap(api.GET('/api/v1/products/barcode/{barcode}', { params: { path: { barcode } } }))
}

// Active customers by name or tax ID; nothing is requested until something is typed. Kept under
// customerKeys.all so creating or editing a customer refreshes the matches.
export function useCustomerSearch(search: string) {
  return useQuery({
    queryKey: [...customerKeys.all, 'checkout-search', search] as const,
    queryFn: () => unwrap(api.GET('/api/v1/customers', {
      // One extra row in case the walk-in customer matches; it's hidden, since no customer means walk-in.
      params: { query: { search, active: true, page: 0, size: CUSTOMER_MATCHES + 1 } },
    })),
    enabled: search !== '',
    placeholderData: keepPreviousData,
  })
}

export interface SaleInput {
  idempotencyKey: string
  // Missing: the API sells to the walk-in customer.
  customerId?: number
  paymentMethod: PaymentMethod
  items: { productId: number; quantity: number }[]
}

// The key is generated once per checkout and reused on retries, so a double click or a lost
// response never charges twice: the API returns the sale it already recorded.
export function useRecordSale() {
  const queryClient = useQueryClient()
  return useMutation({
    mutationFn: ({ idempotencyKey, customerId, paymentMethod, items }: SaleInput) =>
      unwrap(api.POST('/api/v1/sales', {
        params: { header: { 'Idempotency-Key': idempotencyKey } },
        body: { customerId, paymentMethod, items },
      })),
    // The sale changes stock, the drawer's tickets and every report.
    onSuccess: () => {
      void queryClient.invalidateQueries({ queryKey: ['sales'] })
      void queryClient.invalidateQueries({ queryKey: ['sale-reports'] })
      void queryClient.invalidateQueries({ queryKey: ['products'] })
      void queryClient.invalidateQueries({ queryKey: ['stock-reports'] })
      void queryClient.invalidateQueries({ queryKey: ['inventory-movements'] })
    },
  })
}
