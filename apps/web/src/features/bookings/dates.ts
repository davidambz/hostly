import {
  addDays,
  addMonths,
  differenceInCalendarDays,
  eachDayOfInterval,
  endOfMonth,
  endOfWeek,
  format,
  isSameMonth,
  isSameYear,
  parseISO,
  startOfMonth,
  startOfWeek,
} from 'date-fns'
import { ptBR } from 'date-fns/locale'

/** The business time zone: "today" is today in Brazil, wherever the browser is. */
const TIME_ZONE = 'America/Sao_Paulo'

/** Dates travel as `YYYY-MM-DD`; this reads one as a local date (no time-zone shift). */
export function parseDate(date: string): Date {
  return parseISO(date)
}

export function toISODate(date: Date): string {
  return format(date, 'yyyy-MM-dd')
}

export function todayISO(now = new Date()): string {
  // en-CA formats as YYYY-MM-DD.
  return new Intl.DateTimeFormat('en-CA', { timeZone: TIME_ZONE }).format(now)
}

export function addDaysISO(date: string, days: number): string {
  return toISODate(addDays(parseDate(date), days))
}

/** The same day `months` months away, or that month's last day when it is shorter. */
export function addMonthsISO(date: string, months: number): string {
  return toISODate(addMonths(parseDate(date), months))
}

export function nightsBetween(checkIn: string, checkOut: string): number {
  return differenceInCalendarDays(parseDate(checkOut), parseDate(checkIn))
}

export function nightsLabel(nights: number): string {
  return nights === 1 ? '1 noite' : `${nights} noites`
}

/** `2026-11-12`, `2026-11-15` → `12 – 15 nov 2026`; across months and years as needed. */
export function formatStay(checkIn: string, checkOut: string): string {
  const start = parseDate(checkIn)
  const end = parseDate(checkOut)
  if (!isSameYear(start, end)) {
    return `${format(start, 'd MMM yyyy', { locale: ptBR })} – ${format(end, 'd MMM yyyy', { locale: ptBR })}`
  }
  if (!isSameMonth(start, end)) {
    return `${format(start, 'd MMM', { locale: ptBR })} – ${format(end, 'd MMM yyyy', { locale: ptBR })}`
  }
  return `${format(start, 'd')} – ${format(end, 'd MMM yyyy', { locale: ptBR })}`
}

/** `2026-11-12` → `12/11`. */
export function formatShortDate(date: string): string {
  return format(parseDate(date), 'dd/MM')
}

/** `2026-11-12` → `12 de novembro de 2026`, for screen readers. */
export function formatLongDate(date: string): string {
  return format(parseDate(date), "d 'de' MMMM 'de' yyyy", { locale: ptBR })
}

/** `novembro de 2026`. */
export function formatMonth(date: string): string {
  return format(parseDate(date), "MMMM 'de' yyyy", { locale: ptBR })
}

/** The 7 weekday names, Sunday first. */
export const WEEKDAYS = ['dom', 'seg', 'ter', 'qua', 'qui', 'sex', 'sáb'] as const

/** The weeks (Sunday to Saturday) that show the month of `date`, as `YYYY-MM-DD` days. */
export function monthWeeks(date: string): string[][] {
  const day = parseDate(date)
  const days = eachDayOfInterval({
    start: startOfWeek(startOfMonth(day)),
    end: endOfWeek(endOfMonth(day)),
  }).map(toISODate)
  const weeks: string[][] = []
  for (let i = 0; i < days.length; i += 7) weeks.push(days.slice(i, i + 7))
  return weeks
}

/** The week (Sunday to Saturday) of `date`. */
export function weekDays(date: string): string[] {
  const day = parseDate(date)
  return eachDayOfInterval({ start: startOfWeek(day), end: endOfWeek(day) }).map(toISODate)
}

export function isSameMonthISO(a: string, b: string): boolean {
  return isSameMonth(parseDate(a), parseDate(b))
}

/** `YYYY-MM-DD`, or null for anything else (a hand-edited URL, say). */
export function validDateOrNull(value: string | null): string | null {
  if (value === null || !/^\d{4}-\d{2}-\d{2}$/.test(value)) return null
  return Number.isNaN(parseDate(value).getTime()) ? null : value
}
