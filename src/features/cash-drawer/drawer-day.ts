import { todayDay } from '@/lib/days'

/**
 * A drawer left open from a previous day: the API rejects sales until it is closed and today's is opened.
 */
export function isFromPastDay(businessDate: string | undefined, today = todayDay()): boolean {
  // ISO days (YYYY-MM-DD) order correctly as plain strings.
  return !!businessDate && businessDate < today
}
