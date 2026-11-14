/** `6250` basis points → `62,5%`. */
export function formatOccupancy(bps: number): string {
  return `${(Math.round(bps / 10) / 10).toLocaleString('pt-BR')}%`
}

/** `3.5` → `3,5 noites`; a dash without bookings. */
export function formatStay(nights: number | null): string {
  if (nights === null) return '–'
  return `${nights.toLocaleString('pt-BR')} ${nights === 1 ? 'noite' : 'noites'}`
}

export interface Change {
  direction: 'up' | 'down' | 'same'
  text: string
}

/**
 * How a figure moved: in percent for money, in percentage points for occupancy (`points`,
 * both in basis points). A dash when there is nothing to compare with.
 */
export function change(now: number | null, before: number | null, points = false): Change {
  if (now === null || before === null) return { direction: 'same', text: '–' }
  const direction = now > before ? 'up' : now < before ? 'down' : 'same'
  const sign = direction === 'up' ? '+' : direction === 'down' ? '−' : ''
  if (points) {
    const value = Math.round(Math.abs(now - before) / 10) / 10
    return { direction, text: `${sign}${value.toLocaleString('pt-BR')} p.p.` }
  }
  if (before === 0) return { direction, text: now === 0 ? '0%' : 'novo' }
  const value = Math.round((Math.abs(now - before) / Math.abs(before)) * 1000) / 10
  return { direction, text: `${sign}${value.toLocaleString('pt-BR')}%` }
}

/**
 * Axis ticks from zero: a clean step (1, 2 or 5 times a power of ten) and at most five
 * ticks, the last one at or above `max`.
 */
export function niceTicks(max: number): number[] {
  if (max <= 0) return [0, 1]
  const power = 10 ** Math.floor(Math.log10(max / 4))
  const step =
    [1, 2, 5, 10].map((factor) => factor * power).find((size) => max / size <= 4) ?? 10 * power
  return Array.from({ length: Math.ceil(max / step - 1e-9) + 1 }, (_, index) => index * step)
}
