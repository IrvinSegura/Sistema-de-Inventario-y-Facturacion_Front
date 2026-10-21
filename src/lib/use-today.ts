import { useEffect, useState } from 'react'

import { todayDay } from '@/features/dashboard/days'

const CHECK_EVERY_MS = 60_000

/**
 * Today in the store, updated when the day changes: a screen left open overnight moves on to the
 * new day. Checked every minute and whenever the tab is shown again (timers sleep with the computer).
 */
export function useToday(): string {
  const [today, setToday] = useState(todayDay)

  useEffect(() => {
    const check = () => setToday(todayDay())
    const timer = window.setInterval(check, CHECK_EVERY_MS)
    document.addEventListener('visibilitychange', check)
    return () => {
      window.clearInterval(timer)
      document.removeEventListener('visibilitychange', check)
    }
  }, [])

  return today
}
