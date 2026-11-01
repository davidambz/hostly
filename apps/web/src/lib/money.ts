import { onlyDigits } from '@/lib/validation/brazil'

/** The API's highest amount: R$ 10 million, in cents. */
export const MAX_CENTS = 1_000_000_000

const brl = new Intl.NumberFormat('pt-BR', { style: 'currency', currency: 'BRL' })

/** `123456` → `R$ 1.234,56`, with a plain space (Intl puts a no-break space). */
export function formatBRL(cents: number): string {
  return brl.format(cents / 100).replace(/\s/g, ' ')
}

/**
 * Money as it is typed: every digit pushes the others left, cents first, like a cash
 * register (`1` → `R$ 0,01`, `1234` → `R$ 12,34`). Blank stays blank.
 */
export function maskMoney(value: string): string {
  const digits = onlyDigits(value)
  if (digits === '') return ''
  const cents = Number(digits.replace(/^0+/, '').slice(0, String(MAX_CENTS).length) || '0')
  return formatBRL(Math.min(cents, MAX_CENTS))
}

/** The cents of a masked amount, or null when it is blank. */
export function parseMoney(value: string): number | null {
  const digits = onlyDigits(value)
  return digits === '' ? null : Number(digits)
}

/** `1050` basis points → `10,5` (for a percent field). */
export function bpsToPercent(bps: number): string {
  return (bps / 100).toString().replace('.', ',')
}

/** A percent as typed (`10,5`) → basis points (`1050`), or null when it is blank. */
export function percentToBps(value: string): number | null {
  const trimmed = value.trim()
  const percent = Number(trimmed.replace(',', '.'))
  if (trimmed === '' || !Number.isFinite(percent)) return null
  return Math.round(percent * 100)
}

/** Keeps a percent typeable: digits and one comma, at most 3 + 2 digits. */
export function maskPercent(value: string): string {
  const [whole = '', ...rest] = value
    .replace(/\./g, ',')
    .replace(/[^\d,]/g, '')
    .split(',')
  const integer = whole.slice(0, 3)
  return rest.length === 0 ? integer : `${integer},${rest.join('').slice(0, 2)}`
}

/** `1050` → `10,5%`. */
export function formatPercent(bps: number): string {
  return `${bpsToPercent(bps)}%`
}
