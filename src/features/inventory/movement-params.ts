import { type DayRange, lastDaysRange } from '@/lib/days'
import { compactParams, readOption, readPositiveInt, readRange } from '@/lib/search-params'

import type { MovementType } from './queries'

export const MOVEMENT_TYPES: MovementType[] = ['PURCHASE', 'SALE', 'SALE_CANCELLATION', 'ADJUSTMENT']
/** Without a product the API lists one type of movement across the store, over at most this many days. */
// One under the API's 366: it measures the span in hours, and a year across the end of daylight
// saving time is an hour longer.
export const MAX_STORE_WIDE_DAYS = 365
/** Days the ledger shows when it needs dates and the URL has none. */
export const DEFAULT_RANGE_DAYS = 30

/** What the movements URL carries: a product, a type and a range, each optional. */
export interface MovementParams {
  productId: number | null
  type: MovementType | null
  range: DayRange | null
}

/**
 * The movements page's filters from its URL. Without a product but with a type it lists the whole
 * store, which needs dates: up to MAX_STORE_WIDE_DAYS from the URL, else the last DEFAULT_RANGE_DAYS.
 * `chosen` is what the URL says, before that default.
 */
export function readMovementParams(params: URLSearchParams, today: string) {
  const productId = readPositiveInt(params.get('productId'))
  const type = readOption(params.get('type'), MOVEMENT_TYPES)
  const storeWide = productId === null && type !== null
  const chosenRange = readRange(params, today, storeWide ? MAX_STORE_WIDE_DAYS : undefined)
  const range = chosenRange ?? (storeWide ? lastDaysRange(DEFAULT_RANGE_DAYS, today) : null)
  return { productId, type, storeWide, range, chosen: { productId, type, range: chosenRange } satisfies MovementParams }
}

export function movementParams({ productId, type, range }: Partial<MovementParams>): URLSearchParams {
  return compactParams({ productId, type, from: range?.from, to: range?.to })
}

/** A link to the movements page already filtered: a product's ledger, or e.g. today's adjustments. */
export function movementsLink(filters: Partial<MovementParams>): string {
  const query = movementParams(filters).toString()
  return query ? `/inventory/movements?${query}` : '/inventory/movements'
}
