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
