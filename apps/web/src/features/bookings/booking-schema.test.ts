import { describe, expect, it } from 'vitest'

import type { Booking } from './api'
import {
  type BookingDefaults,
  bookingFormSchema,
  defaultsToFill,
  emptyBookingForm,
  newBookingForm,
  toBookingInput,
  toFormValues,
  toQuoteInput,
  whatsAppLink,
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
      guestPhone: null,
      notes: null,
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
    guestPhone: '48999990000',
    notes: 'Chegam tarde.',
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
      guestPhone: '(48) 99999-0000',
      notes: 'Chegam tarde.',
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

describe('booking defaults', () => {
  const defaults: BookingDefaults = {
    properties: new Map([
      ['casa', { nightlyRate: 45000, cleaningFee: 18000 }],
      ['ape', { nightlyRate: 30000, cleaningFee: null }],
      ['bare', { nightlyRate: null, cleaningFee: null }],
    ]),
    brokers: new Map([
      ['maria', 1000],
      ['joao', null],
    ]),
  }

  it("starts a new booking with its property's rate and cleaning fee", () => {
    expect(newBookingForm({ propertyId: 'casa' }, defaults)).toMatchObject({
      nightlyRate: 'R$ 450,00',
      cleaningFee: 'R$ 180,00',
    })
  })

  it('starts blank without a property, or for one with no defaults', () => {
    expect(newBookingForm({}, defaults)).toMatchObject({ nightlyRate: '', cleaningFee: '' })
    expect(newBookingForm({ propertyId: 'bare' }, defaults)).toMatchObject({ nightlyRate: '' })
  })

  it('swaps the defaults of the property it replaces, keeping what the user typed', () => {
    const values = { ...emptyBookingForm(), nightlyRate: 'R$ 450,00', cleaningFee: 'R$ 99,00' }

    expect(
      defaultsToFill(values, defaults, { field: 'propertyId', previousId: 'casa', nextId: 'ape' }),
    ).toEqual({ nightlyRate: 'R$ 300,00' })
  })

  it('leaves a typed rate alone', () => {
    const values = { ...emptyBookingForm(), nightlyRate: 'R$ 500,00' }

    expect(
      defaultsToFill(values, defaults, { field: 'propertyId', previousId: '', nextId: 'casa' }),
    ).toEqual({ cleaningFee: 'R$ 180,00' })
  })

  it("fills the broker's commission, and swaps it for the next broker's", () => {
    const blank = emptyBookingForm()
    expect(
      defaultsToFill(blank, defaults, { field: 'brokerId', previousId: '', nextId: 'maria' }),
    ).toEqual({ brokerCommissionBps: '10' })

    // João has no default: Maria's stays, as it may be what the user wants.
    const withMaria = { ...blank, brokerCommissionBps: '10' }
    expect(
      defaultsToFill(withMaria, defaults, {
        field: 'brokerId',
        previousId: 'maria',
        nextId: 'joao',
      }),
    ).toEqual({})
  })
})

describe('guest contact', () => {
  it('accepts a mobile or a landline, masked or not, and refuses anything else', () => {
    expect(parse({ guestPhone: '(48) 99999-0000' }).success).toBe(true)
    expect(parse({ guestPhone: '4833334444' }).success).toBe(true)
    expect(firstIssue({ guestPhone: '9999-0000' })?.message).toBe('Telefone inválido.')
  })

  it('refuses notes past 2000 characters', () => {
    expect(firstIssue({ notes: 'x'.repeat(2001) })?.message).toBe('Observações longas demais.')
  })

  it('sends the phone as digits and blank notes as nothing', () => {
    const parsed = bookingFormSchema.parse({ ...valid, guestPhone: '(48) 99999-0000', notes: '  ' })

    expect(toBookingInput(parsed)).toMatchObject({ guestPhone: '48999990000', notes: null })
  })

  it('links only a mobile to WhatsApp', () => {
    expect(whatsAppLink('(48) 99999-0000')).toBe('https://wa.me/5548999990000')
    expect(whatsAppLink('(48) 3333-4444')).toBeNull()
    expect(whatsAppLink('')).toBeNull()
  })
})
