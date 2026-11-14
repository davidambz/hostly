import { z } from 'zod'

import {
  isValidLandlinePhone,
  isValidMobilePhone,
  maskPhone,
  normalizePhone,
} from '@hostly/validation'

import { bpsToPercent, formatBRL, parseMoney, percentToBps } from '@/lib/money'

import type { Booking, BookingInput, QuoteInput } from './api'
import { nightsBetween } from './dates'

const isPhone = (digits: string) => isValidMobilePhone(digits) || isValidLandlinePhone(digits)

/** A WhatsApp link for a guest's mobile phone as typed, or null when it isn't a mobile. */
export function whatsAppLink(phone: string): string | null {
  const digits = normalizePhone(phone)
  return isValidMobilePhone(digits) ? `https://wa.me/55${digits}` : null
}

/** Longest stay the API accepts. */
export const MAX_NIGHTS = 365

/**
 * Every field as typed: amounts masked (`R$ 1.234,56`), the commission as a percent
 * (`10,5`). Names follow the API, so its errors land on the right field.
 */
export const bookingFormSchema = z
  .object({
    propertyId: z.string().min(1, 'Escolha o imóvel.'),
    brokerId: z.string(),
    guestName: z.string().trim().min(1, 'Informe o hóspede.').max(255, 'Nome longo demais.'),
    guestPhone: z
      .string()
      .trim()
      .refine((value) => value === '' || isPhone(normalizePhone(value)), 'Telefone inválido.'),
    notes: z.string().trim().max(2000, 'Observações longas demais.'),
    checkIn: z.string(),
    checkOut: z.string(),
    nightlyRate: z.string().refine((value) => parseMoney(value) !== null, 'Informe a diária.'),
    cleaningFee: z.string(),
    discount: z.string(),
    amountPaid: z.string(),
    brokerCommissionBps: z.string(),
  })
  .superRefine((values, ctx) => {
    const issue = (path: keyof typeof values, message: string) => {
      ctx.addIssue({ code: 'custom', path: [path], message })
    }
    const commission = percentToBps(values.brokerCommissionBps) ?? 0
    if (commission > 10_000) issue('brokerCommissionBps', 'No máximo 100%.')

    if (values.checkIn === '' || values.checkOut === '') {
      issue('checkIn', 'Escolha as datas de entrada e saída.')
      return
    }
    const nights = nightsBetween(values.checkIn, values.checkOut)
    if (nights < 1) {
      issue('checkIn', 'A saída precisa ser depois da entrada.')
      return
    }
    if (nights > MAX_NIGHTS) {
      issue('checkIn', `Uma reserva tem no máximo ${MAX_NIGHTS} noites.`)
      return
    }

    // The same rules the API checks, so the user hears about them before saving.
    const lodging = nights * (parseMoney(values.nightlyRate) ?? 0)
    const discount = parseMoney(values.discount) ?? 0
    if (discount > lodging) issue('discount', 'O desconto passa do valor das diárias.')
    const total = lodging - discount + (parseMoney(values.cleaningFee) ?? 0)
    if ((parseMoney(values.amountPaid) ?? 0) > total && discount <= lodging) {
      issue('amountPaid', 'O valor pago passa do total.')
    }
  })

export type BookingFormValues = z.input<typeof bookingFormSchema>

export function emptyBookingForm(
  defaults: Partial<Pick<BookingFormValues, 'propertyId' | 'checkIn' | 'checkOut'>> = {},
): BookingFormValues {
  return {
    propertyId: '',
    brokerId: '',
    guestName: '',
    guestPhone: '',
    notes: '',
    checkIn: '',
    checkOut: '',
    nightlyRate: '',
    cleaningFee: '',
    discount: '',
    amountPaid: '',
    brokerCommissionBps: '',
    ...defaults,
  }
}

const money = (cents: number) => (cents === 0 ? '' : formatBRL(cents))

export function toFormValues(booking: Booking): BookingFormValues {
  return {
    propertyId: booking.property.id,
    brokerId: booking.broker?.id ?? '',
    guestName: booking.guestName,
    guestPhone: booking.guestPhone ? maskPhone(booking.guestPhone) : '',
    notes: booking.notes ?? '',
    checkIn: booking.checkIn,
    checkOut: booking.checkOut,
    nightlyRate: formatBRL(booking.nightlyRate),
    cleaningFee: money(booking.cleaningFee),
    discount: money(booking.discount),
    amountPaid: money(booking.amountPaid),
    brokerCommissionBps:
      booking.brokerCommissionBps === 0 ? '' : bpsToPercent(booking.brokerCommissionBps),
  }
}

/** The money and dates of the form, for a quote; null until there is enough to quote. */
export function toQuoteInput(values: BookingFormValues): QuoteInput | null {
  const nightlyRate = parseMoney(values.nightlyRate)
  if (values.checkIn === '' || values.checkOut === '' || nightlyRate === null) return null
  const nights = nightsBetween(values.checkIn, values.checkOut)
  if (nights < 1 || nights > MAX_NIGHTS) return null
  return {
    brokerId: values.brokerId || null,
    checkIn: values.checkIn,
    checkOut: values.checkOut,
    nightlyRate,
    cleaningFee: parseMoney(values.cleaningFee) ?? 0,
    discount: parseMoney(values.discount) ?? 0,
    amountPaid: parseMoney(values.amountPaid) ?? 0,
    brokerCommissionBps: values.brokerId ? (percentToBps(values.brokerCommissionBps) ?? 0) : 0,
  }
}

/** Valid form values to what the API takes. */
export function toBookingInput(values: z.output<typeof bookingFormSchema>): Required<BookingInput> {
  return {
    propertyId: values.propertyId,
    brokerId: values.brokerId || null,
    guestName: values.guestName,
    guestPhone: values.guestPhone ? normalizePhone(values.guestPhone) : null,
    notes: values.notes || null,
    checkIn: values.checkIn,
    checkOut: values.checkOut,
    nightlyRate: parseMoney(values.nightlyRate) ?? 0,
    cleaningFee: parseMoney(values.cleaningFee) ?? 0,
    discount: parseMoney(values.discount) ?? 0,
    amountPaid: parseMoney(values.amountPaid) ?? 0,
    // A commission needs a broker: dropping the broker drops it too.
    brokerCommissionBps: values.brokerId ? (percentToBps(values.brokerCommissionBps) ?? 0) : 0,
  }
}

/** What a new booking starts with, from its property and its broker. */
export interface BookingDefaults {
  /** Per property id: cents per night and cleaning fee, or null when it has none. */
  properties: Map<string, { nightlyRate: number | null; cleaningFee: number | null }>
  /** Per broker id: the commission in basis points, or null when it has none. */
  brokers: Map<string, number | null>
}

type DefaultField = 'nightlyRate' | 'cleaningFee' | 'brokerCommissionBps'

/**
 * The fields to fill when the property or broker becomes `nextId`: each field still blank,
 * or still holding the default of the one it replaces (`previousId`), takes the new
 * default. Anything the user typed stays.
 */
export function defaultsToFill(
  values: BookingFormValues,
  defaults: BookingDefaults,
  change: { field: 'propertyId' | 'brokerId'; previousId: string; nextId: string },
): Partial<Pick<BookingFormValues, DefaultField>> {
  const fill: Partial<Pick<BookingFormValues, DefaultField>> = {}
  const take = (field: DefaultField, previous: string, next: string) => {
    if (next !== '' && (values[field] === '' || values[field] === previous)) fill[field] = next
  }
  if (change.field === 'propertyId') {
    const before = defaults.properties.get(change.previousId)
    const after = defaults.properties.get(change.nextId)
    take('nightlyRate', amountText(before?.nightlyRate), amountText(after?.nightlyRate))
    take('cleaningFee', amountText(before?.cleaningFee), amountText(after?.cleaningFee))
  } else {
    take(
      'brokerCommissionBps',
      percentText(defaults.brokers.get(change.previousId)),
      percentText(defaults.brokers.get(change.nextId)),
    )
  }
  return fill
}

const amountText = (cents: number | null | undefined) =>
  cents === null || cents === undefined ? '' : formatBRL(cents)
const percentText = (bps: number | null | undefined) =>
  bps === null || bps === undefined ? '' : bpsToPercent(bps)

/** A new booking's first values: the draft, plus its property's defaults when it has one. */
export function newBookingForm(
  draft: Parameters<typeof emptyBookingForm>[0],
  defaults: BookingDefaults,
): BookingFormValues {
  const values = emptyBookingForm(draft)
  return {
    ...values,
    ...defaultsToFill(values, defaults, {
      field: 'propertyId',
      previousId: '',
      nextId: values.propertyId,
    }),
  }
}
