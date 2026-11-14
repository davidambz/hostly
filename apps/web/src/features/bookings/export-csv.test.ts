import { describe, expect, it } from 'vitest'

import type { Booking } from './api'
import { bookingsCsv, csvFileName } from './export-csv'

function booking(overrides: Partial<Booking>): Booking {
  return {
    id: 'k1',
    property: { id: 'p1', name: 'Casa da Praia' },
    broker: null,
    guestName: 'Ana Ribeiro',
    guestPhone: null,
    notes: null,
    checkIn: '2027-01-10',
    checkOut: '2027-01-17',
    nights: 7,
    nightlyRate: 45000,
    cleaningFee: 18000,
    discount: 0,
    amountPaid: 100000,
    brokerCommissionBps: 0,
    financials: {
      grossLodging: 315000,
      lodging: 315000,
      total: 333000,
      brokerFee: 0,
      net: 333000,
      balanceDue: 233000,
    },
    createdAt: '',
    updatedAt: '',
    ...overrides,
  }
}

describe('bookingsCsv', () => {
  it("writes the month's check-ins the way a Brazilian spreadsheet reads them", () => {
    const csv = bookingsCsv('2027-01-01', [
      booking({
        guestName: 'Bruno Tavares',
        checkIn: '2027-01-20',
        guestPhone: '48999990000',
        broker: { id: 'b1', name: 'Paula' },
        notes: 'Chega às 22h; traz "pet"',
      }),
      booking({}),
      // December's: left out.
      booking({ guestName: 'Antiga', checkIn: '2026-12-28' }),
    ])

    const [bom, ...rest] = csv
    expect(bom).toBe('﻿')
    const lines = rest.join('').split('\r\n')
    expect(lines[0]).toBe(
      'Hóspede;Telefone;Imóvel;Intermediador;Entrada;Saída;Noites;Diária;Limpeza;Desconto;Total do hóspede;Recebido;A receber;Comissão;Você recebe;Observações',
    )
    expect(lines[1]).toBe(
      'Ana Ribeiro;;Casa da Praia;;10/01/2027;17/01/2027;7;450,00;180,00;0,00;3330,00;1000,00;2330,00;0,00;3330,00;',
    )
    expect(lines[2]).toBe(
      'Bruno Tavares;(48) 99999-0000;Casa da Praia;Paula;20/01/2027;17/01/2027;7;450,00;180,00;0,00;3330,00;1000,00;2330,00;0,00;3330,00;"Chega às 22h; traz ""pet"""',
    )
    expect(lines).toHaveLength(4)
    expect(lines[3]).toBe('')
  })

  it('is just the header for an empty month', () => {
    expect(bookingsCsv('2027-01-01', []).split('\r\n')).toHaveLength(2)
  })
})

describe('csvFileName', () => {
  it.each([
    [undefined, 'hostly-reservas-2027-01.csv'],
    ['Chalé da Lagoa', 'hostly-reservas-2027-01-chale-da-lagoa.csv'],
  ])('%s → %s', (name, file) => {
    expect(csvFileName('2027-01-14', name)).toBe(file)
  })
})
