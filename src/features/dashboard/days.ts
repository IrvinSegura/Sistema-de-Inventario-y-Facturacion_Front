// Calendar days as yyyy-mm-dd in the browser's time zone, the format the reports use.
export function toDay(date: Date): string {
  const pad = (value: number) => String(value).padStart(2, '0')
  return `${date.getFullYear()}-${pad(date.getMonth() + 1)}-${pad(date.getDate())}`
}

export function addDays(day: string, days: number): string {
  const date = new Date(`${day}T00:00:00`)
  date.setDate(date.getDate() + days)
  return toDay(date)
}

// Midnight of a calendar day in the browser's time zone, as an instant for the list endpoints.
export function startOfDay(day: string): string {
  return new Date(`${day}T00:00:00`).toISOString()
}

export function dayAfter(day: string): string {
  return startOfDay(addDays(day, 1))
}

// Calendar days, both inclusive.
export interface DayRange {
  from: string
  to: string
}
