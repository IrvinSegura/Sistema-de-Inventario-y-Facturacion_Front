import { toDay } from '@/features/dashboard/days'

// A drawer left open from a previous day: the API rejects sales until it is closed and today's is opened.
export function isFromPastDay(businessDate: string | undefined, today = toDay(new Date())): boolean {
  return !!businessDate && businessDate < today
}
