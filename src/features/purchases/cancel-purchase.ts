import { ApiError, INSUFFICIENT_STOCK } from '@/api/errors'

import type { Purchase } from './queries'

type PurchaseLine = NonNullable<Purchase['items']>[number]

/**
 * The line whose units were already sold when the API refused to cancel the purchase (409
 * "Insufficient stock for product: <id>"), so the message can name the product; undefined for any
 * other error.
 */
export function soldOutLine(error: unknown, purchase: Purchase): PurchaseLine | undefined {
  if (!(error instanceof ApiError) || error.status !== 409) {
    return undefined
  }
  const productId = Number(error.message.match(INSUFFICIENT_STOCK)?.[1])
  return purchase.items?.find((line) => line.productId === productId)
}
