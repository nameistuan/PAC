import { format, parseISO, startOfDay } from 'date-fns'

/**
 * Returns the current date as a local ISO string (YYYY-MM-DD).
 */
export function getTodayISO(): string {
  return format(new Date(), 'yyyy-MM-dd')
}

/**
 * Parses a YYYY-MM-DD string into a standard Date object at 12:00:00 (Local).
 */
export function parseISOString(dateStr: string | null | undefined): Date {
  if (!dateStr) return startOfDay(new Date())
  return parseISO(dateStr.includes('T') ? dateStr : `${dateStr}T12:00:00`)
}
