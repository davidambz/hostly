import { format } from 'date-fns'

import { maskPhone } from '@hostly/validation'

import type { Booking } from './api'
import { parseDate } from './dates'
import { monthBounds } from './occupancy'

/** Byte-order mark: tells Excel the file is UTF-8, so the accents survive. */
const BOM = String.fromCharCode(0xfeff)

/** The columns, in order, with how each one reads a booking. */
const COLUMNS: [string, (booking: Booking) => string][] = [
  ['Hóspede', (b) => b.guestName],
  ['Telefone', (b) => (b.guestPhone ? maskPhone(b.guestPhone) : '')],
  ['Imóvel', (b) => b.property.name],
  ['Intermediador', (b) => b.broker?.name ?? ''],
  ['Entrada', (b) => date(b.checkIn)],
  ['Saída', (b) => date(b.checkOut)],
  ['Noites', (b) => String(b.nights)],
  ['Diária', (b) => amount(b.nightlyRate)],
  ['Limpeza', (b) => amount(b.cleaningFee)],
  ['Desconto', (b) => amount(b.discount)],
  ['Total do hóspede', (b) => amount(b.financials.total)],
  ['Recebido', (b) => amount(b.amountPaid)],
  ['A receber', (b) => amount(b.financials.balanceDue)],
  ['Comissão', (b) => amount(b.financials.brokerFee)],
  ['Você recebe', (b) => amount(b.financials.net)],
  ['Observações', (b) => b.notes ?? ''],
]

/** `2027-01-10` → `10/01/2027`. */
function date(value: string): string {
  return format(parseDate(value), 'dd/MM/yyyy')
}

/** Cents → `1234,56`: a number a Brazilian spreadsheet reads as such. */
function amount(cents: number): string {
  return (cents / 100).toFixed(2).replace('.', ',')
}

/** Quotes a cell when it holds the separator, a quote or a line break. */
function cell(value: string): string {
  return /[;"\r\n]/.test(value) ? `"${value.replace(/"/g, '""')}"` : value
}

/**
 * The bookings that check in during the month of `month`, as a CSV a Brazilian Excel or
 * LibreOffice opens straight away: `;` between cells, decimal commas, `dd/mm/aaaa` dates,
 * and a byte-order mark so the accents survive. Sorted by check-in.
 */
export function bookingsCsv(month: string, bookings: Booking[]): string {
  const { from, to } = monthBounds(month)
  const rows = bookings
    .filter((booking) => booking.checkIn >= from && booking.checkIn < to)
    .sort((a, b) => a.checkIn.localeCompare(b.checkIn) || a.guestName.localeCompare(b.guestName))
    .map((booking) => COLUMNS.map(([, read]) => cell(read(booking))).join(';'))
  const header = COLUMNS.map(([name]) => name).join(';')
  return `${BOM}${[header, ...rows].join('\r\n')}\r\n`
}

/** `hostly-reservas-2027-01.csv`, or with the property's name when only one is exported. */
export function csvFileName(month: string, propertyName?: string): string {
  const slug = propertyName
    ?.normalize('NFD')
    .replace(/[\u0300-\u036f]/g, '')
    .toLowerCase()
    .replace(/[^a-z0-9]+/g, '-')
    .replace(/^-|-$/g, '')
  return `hostly-reservas-${month.slice(0, 7)}${slug ? `-${slug}` : ''}.csv`
}
