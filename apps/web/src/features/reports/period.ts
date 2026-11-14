import {
  addMonths,
  addYears,
  differenceInCalendarDays,
  format,
  isValid,
  parseISO,
  startOfMonth,
  startOfQuarter,
  startOfYear,
} from 'date-fns'
import { ptBR } from 'date-fns/locale'

import { addDaysISO, parseDate, todayISO, toISODate } from '@/features/bookings/dates'

export type PeriodKind = 'month' | 'quarter' | 'year' | 'custom'

/** A report's period: `from` included, `to` excluded, both `YYYY-MM-DD`. */
export interface Period {
  kind: PeriodKind
  from: string
  to: string
}

export const PERIOD_KINDS: { kind: PeriodKind; label: string; param: string }[] = [
  { kind: 'month', label: 'Mês', param: 'mes' },
  { kind: 'quarter', label: 'Trimestre', param: 'trimestre' },
  { kind: 'year', label: 'Ano', param: 'ano' },
  { kind: 'custom', label: 'Personalizado', param: 'personalizado' },
]

/** The API's longest period. */
export const MAX_PERIOD_DAYS = 731

const MONTHS: Record<Exclude<PeriodKind, 'custom'>, number> = { month: 1, quarter: 3, year: 12 }

/** The month, quarter or year that holds `date`. */
export function periodOf(kind: Exclude<PeriodKind, 'custom'>, date: string): Period {
  const day = parseDate(date)
  const start =
    kind === 'month'
      ? startOfMonth(day)
      : kind === 'quarter'
        ? startOfQuarter(day)
        : startOfYear(day)
  return { kind, from: toISODate(start), to: toISODate(addMonths(start, MONTHS[kind])) }
}

/** From `first` to `last`, both included. */
export function customPeriod(first: string, last: string): Period {
  return { kind: 'custom', from: first, to: addDaysISO(last, 1) }
}

export function periodDays(period: Period): number {
  return differenceInCalendarDays(parseDate(period.to), parseDate(period.from))
}

/** `steps` periods away: the previous month, quarter, year, or as many days before. */
export function shiftPeriod(period: Period, steps: number): Period {
  if (period.kind === 'custom') {
    const days = periodDays(period) * steps
    return { ...period, from: addDaysISO(period.from, days), to: addDaysISO(period.to, days) }
  }
  const months = MONTHS[period.kind] * steps
  return {
    ...period,
    from: toISODate(addMonths(parseDate(period.from), months)),
    to: toISODate(addMonths(parseDate(period.to), months)),
  }
}

/** The same period, a year earlier. */
export function lastYearOf(period: Period): Period {
  return {
    ...period,
    from: toISODate(addYears(parseDate(period.from), -1)),
    to: toISODate(addYears(parseDate(period.to), -1)),
  }
}

/** `dezembro de 2026`, `4º trimestre de 2026`, `2026`, `01/12/2026 a 15/12/2026`. */
export function periodLabel(period: Period): string {
  const from = parseDate(period.from)
  switch (period.kind) {
    case 'month':
      return format(from, "MMMM 'de' yyyy", { locale: ptBR })
    case 'quarter':
      return `${format(from, 'Q')}º trimestre de ${format(from, 'yyyy')}`
    case 'year':
      return format(from, 'yyyy')
    case 'custom':
      return `${format(from, 'dd/MM/yyyy')} a ${format(parseDate(addDaysISO(period.to, -1)), 'dd/MM/yyyy')}`
  }
}

const isDate = (value: string | null): value is string =>
  value !== null && /^\d{4}-\d{2}-\d{2}$/.test(value) && isValid(parseISO(value))

/**
 * The period in the URL (`?periodo=trimestre&inicio=2026-10-01`, or `inicio` and `fim` for a
 * custom one), or this month when it has none or makes no sense.
 */
export function periodFromSearch(params: URLSearchParams, today = todayISO()): Period {
  const kind = PERIOD_KINDS.find((item) => item.param === params.get('periodo'))?.kind ?? 'month'
  const start = params.get('inicio')
  const end = params.get('fim')
  if (kind === 'custom') {
    if (isDate(start) && isDate(end) && start <= end) {
      const period = customPeriod(start, end)
      if (periodDays(period) <= MAX_PERIOD_DAYS) return period
    }
    return periodOf('month', today)
  }
  return periodOf(kind, isDate(start) ? start : today)
}

/** The URL values for a period, the reverse of `periodFromSearch`. */
export function periodSearch(period: Period): Record<string, string | undefined> {
  const param = PERIOD_KINDS.find((item) => item.kind === period.kind)?.param
  return {
    periodo: period.kind === 'month' ? undefined : param,
    inicio: period.from,
    fim: period.kind === 'custom' ? addDaysISO(period.to, -1) : undefined,
  }
}
