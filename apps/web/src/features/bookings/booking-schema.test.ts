import { describe, expect, it } from 'vitest'

import type { Booking } from './api'
import {
  bookingFormSchema,
  emptyBookingForm,
  toBookingInput,
  toFormValues,
  toQuoteInput,
} from './booking-schema'

const filled = emptyBookingForm({
  propertyId: 'p1',
  checkIn: '2026-11-10',
  checkOut: '2026-11-13',
})
const valid = { ...filled, guestName: 'Rafael', nightlyRate: 'R$ 450,00' }

const parse = (values: Partial<typeof valid>) =>
  bookingFormSchema.safeParse({ ...valid, ...values })
const firstIssue = (values: Partial<typeof valid>) => parse(values).error?.issues[0]

describe('bookingFormSchema', () => {
  it('accepts a booking with a property, a guest, dates and a nightly rate', () => {
    expect(parse({}).success).toBe(true)
  })

  it.each([
    ['no property', { propertyId: '' }, 'propertyId', 'Escolha o imóvel.'],
    ['no guest', { guestName: ' ' }, 'guestName', 'Informe o hóspede.'],
    ['no nightly rate', { nightlyRate: '' }, 'nightlyRate', 'Informe a diária.'],
    ['no dates', { checkIn: '', checkOut: '' }, 'checkIn', 'Escolha as datas de entrada e saída.'],
    [
      'a check-out before the check-in',
      { checkOut: '2026-11-09' },
      'checkIn',
      'A saída precisa ser depois da entrada.',
    ],
    [
      'more than 365 nights',
      { checkOut: '2027-11-11' },
      'checkIn',
      'Uma reserva tem no máximo 365 noites.',
    ],
    // 3 nights × R$ 450 = R$ 1.350
    [
      'a discount above the nights',
      { discount: 'R$ 1.350,01' },
      'discount',
      'O desconto passa do valor das diárias.',
    ],
    [
      'a payment above the total',
      { amountPaid: 'R$ 1.350,01' },
      'amountPaid',
      'O valor pago passa do total.',
    ],
    [
      'a commission above 100%',
      { brokerId: 'b1', brokerCommissionBps: '100,01' },
      'brokerCommissionBps',
      'No máximo 100%.',
    ],
  ])('rejects %s', (_case, values, path, message) => {
    expect(firstIssue(values)).toMatchObject({ path: [path], message })
  })

  it('counts the cleaning fee in what can be paid', () => {
    expect(parse({ cleaningFee: 'R$ 150,00', amountPaid: 'R$ 1.500,00' }).success).toBe(true)
  })

  it('accepts a discount equal to the nights', () => {
    expect(parse({ discount: 'R$ 1.350,00' }).success).toBe(true)
  })
})

describe('toBookingInput', () => {
  it('turns the masks into cents and basis points', () => {
    const values = bookingFormSchema.parse({
      ...valid,
      brokerId: 'b1',
      cleaningFee: 'R$ 150,00',
      discount: 'R$ 50,00',
      amountPaid: 'R$ 500,00',
      brokerCommissionBps: '10,5',
    })

    expect(toBookingInput(values)).toEqual({
      propertyId: 'p1',
      brokerId: 'b1',
      guestName: 'Rafael',
      checkIn: '2026-11-10',
      checkOut: '2026-11-13',
      nightlyRate: 45000,
      cleaningFee: 15000,
      discount: 5000,
      amountPaid: 50000,
      brokerCommissionBps: 1050,
    })
  })

  it('sends blanks as zero and no broker as null, without a commission', () => {
    const values = bookingFormSchema.parse({ ...valid, brokerCommissionBps: '10' })

    expect(toBookingInput(values)).toMatchObject({
      brokerId: null,
      cleaningFee: 0,
      discount: 0,
      amountPaid: 0,
      brokerCommissionBps: 0,
    })
  })
})

describe('toQuoteInput', () => {
  it('is null until there are dates and a nightly rate', () => {
    expect(toQuoteInput(filled)).toBeNull()
    expect(toQuoteInput({ ...valid, checkOut: '' })).toBeNull()
    expect(toQuoteInput({ ...valid, checkOut: '2026-11-10' })).toBeNull()
  })

  it('has the money and the dates', () => {
    expect(toQuoteInput({ ...valid, brokerId: 'b1', brokerCommissionBps: '10' })).toEqual({
      brokerId: 'b1',
      checkIn: '2026-11-10',
      checkOut: '2026-11-13',
      nightlyRate: 45000,
      cleaningFee: 0,
      discount: 0,
      amountPaid: 0,
      brokerCommissionBps: 1000,
    })
  })
})

describe('toFormValues', () => {
  const booking: Booking = {
    id: 'k1',
    property: { id: 'p1', name: 'Casa' },
    broker: { id: 'b1', name: 'Carlos' },
    guestName: 'Rafael',
    checkIn: '2026-11-10',
    checkOut: '2026-11-13',
    nights: 3,
    nightlyRate: 45000,
    cleaningFee: 0,
    discount: 5000,
    amountPaid: 0,
    brokerCommissionBps: 1050,
    financials: { grossLodging: 0, lodging: 0, total: 0, brokerFee: 0, net: 0, balanceDue: 0 },
    createdAt: '',
    updatedAt: '',
  }

  it('masks the money and leaves zeros blank', () => {
    expect(toFormValues(booking)).toEqual({
      propertyId: 'p1',
      brokerId: 'b1',
      guestName: 'Rafael',
      checkIn: '2026-11-10',
      checkOut: '2026-11-13',
      nightlyRate: 'R$ 450,00',
      cleaningFee: '',
      discount: 'R$ 50,00',
      amountPaid: '',
      brokerCommissionBps: '10,5',
    })
  })

  it('round-trips through the form unchanged', () => {
    const input = toBookingInput(bookingFormSchema.parse(toFormValues(booking)))

    expect(input).toMatchObject({ nightlyRate: 45000, discount: 5000, brokerCommissionBps: 1050 })
  })

  it('has no broker and no commission when there is none', () => {
    expect(toFormValues({ ...booking, broker: null, brokerCommissionBps: 0 })).toMatchObject({
      brokerId: '',
      brokerCommissionBps: '',
    })
  })
})
