import type { ChartMonth } from '@/features/reports/month-chart'

/**
 * A made-up season for a beach house in Santa Catarina, this year and last: the shape a
 * real one has (full in summer, a winter-holiday bump in July), not anyone's real numbers.
 */
const MONTHS = [
  ['jan', 'janeiro', 31, 9_400, 65_000, 8_800],
  ['fev', 'fevereiro', 28, 8_200, 60_000, 7_600],
  ['mar', 'março', 31, 4_500, 38_000, 4_400],
  ['abr', 'abril', 30, 3_000, 32_000, 3_300],
  ['mai', 'maio', 31, 2_300, 30_000, 2_000],
  ['jun', 'junho', 30, 2_700, 30_000, 2_300],
  ['jul', 'julho', 31, 4_800, 42_000, 4_100],
  ['ago', 'agosto', 31, 2_900, 30_000, 2_600],
  ['set', 'setembro', 30, 3_000, 32_000, 3_200],
  ['out', 'outubro', 31, 3_500, 34_000, 3_100],
  ['nov', 'novembro', 30, 4_200, 38_000, 3_900],
  ['dez', 'dezembro', 31, 7_000, 56_000, 6_400],
] as const

/** Last year's rates, a little lower. */
const LAST_YEAR_RATE = 0.92

const nightsOf = (days: number, occupancyBps: number) => Math.round((days * occupancyBps) / 10_000)

export const DEMO_YEAR = 2027

export function demoMonths(measure: 'revenue' | 'occupancy'): ChartMonth[] {
  return MONTHS.map(([label, name, days, occupancy, rate, lastOccupancy]) => ({
    label,
    name,
    value: measure === 'occupancy' ? occupancy : nightsOf(days, occupancy) * rate,
    compare:
      measure === 'occupancy'
        ? lastOccupancy
        : nightsOf(days, lastOccupancy) * Math.round(rate * LAST_YEAR_RATE),
  }))
}

/** The year's totals: nights, occupancy, revenue and the average daily rate. */
export function demoYear() {
  let nights = 0
  let days = 0
  let revenue = 0
  for (const [, , monthDays, occupancy, rate] of MONTHS) {
    const sold = nightsOf(monthDays, occupancy)
    nights += sold
    days += monthDays
    revenue += sold * rate
  }
  return {
    nights,
    days,
    occupancyBps: Math.round((nights * 10_000) / days),
    revenue,
    averageDailyRate: Math.round(revenue / nights),
  }
}
