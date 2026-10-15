import { useMutation } from '@tanstack/react-query'

import { api, type Schemas, unwrap } from '@/api/client'

export type Product = Schemas['ProductResponse']
export type Sale = Schemas['SaleResponse']
export type PaymentMethod = Schemas['CreateSaleRequest']['paymentMethod']

export function findProductByBarcode(barcode: string): Promise<Product> {
  return unwrap(api.GET('/api/v1/products/barcode/{barcode}', { params: { path: { barcode } } }))
}

export interface SaleInput {
  idempotencyKey: string
  paymentMethod: PaymentMethod
  items: { productId: number; quantity: number }[]
}

// The key is generated once per checkout and reused on retries, so a double click or a lost
// response never charges twice: the API returns the sale it already recorded.
export function useRecordSale() {
  return useMutation({
    mutationFn: ({ idempotencyKey, paymentMethod, items }: SaleInput) =>
      unwrap(api.POST('/api/v1/sales', {
        params: { header: { 'Idempotency-Key': idempotencyKey } },
        body: { paymentMethod, items },
      })),
  })
}
