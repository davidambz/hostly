import { format } from 'date-fns'
import { ptBR } from 'date-fns/locale'

import { parseDate, todayISO } from '@/features/bookings/dates'
import { formatBRL } from '@/lib/money'

import type { MonthlyReport } from './api'
import { formatOccupancy } from './report-format'

const compactBRL = new Intl.NumberFormat('pt-BR', {
  style: 'currency',
  currency: 'BRL',
  notation: 'compact',
  maximumFractionDigits: 1,
})

/** `R$ 12 mil`, for an axis. */
export const axisBRL = (cents: number) => compactBRL.format(cents / 100).replace(/\s/g, ' ')

const monthOf = (month: string) => parseDate(`${month}-01`)
export const shortMonth = (month: string) => format(monthOf(month), 'MMM', { locale: ptBR })
export const longMonth = (month: string) => format(monthOf(month), 'MMMM', { locale: ptBR })

/** The year in the URL (`?ano=2026`), or this one. */
export function yearFromSearch(params: URLSearchParams, today = todayISO()): number {
  const year = Number(params.get('ano'))
  return Number.isInteger(year) && year >= 2000 && year <= 2100 ? year : Number(today.slice(0, 4))
}

/** The fullest month and the one with the best daily rate, to plan the season's prices. */
export function seasonHighlights(report: MonthlyReport): string | null {
  const sold = report.months.filter((month) => month.nightsSold > 0)
  if (sold.length === 0) return null
  const fullest = sold.reduce((best, month) =>
    month.occupancyBps > best.occupancyBps ? month : best,
  )
  const priciest = sold.reduce((best, month) =>
    (month.averageDailyRate ?? 0) > (best.averageDailyRate ?? 0) ? month : best,
  )
  return (
    `Mês mais cheio: ${longMonth(fullest.month)} (${formatOccupancy(fullest.occupancyBps)}). ` +
    `Maior diária média: ${longMonth(priciest.month)} (${formatBRL(priciest.averageDailyRate ?? 0)}).`
  )
}
