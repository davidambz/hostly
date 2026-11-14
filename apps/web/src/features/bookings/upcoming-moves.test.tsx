import { screen, within } from '@testing-library/react'
import userEvent from '@testing-library/user-event'
import { http, HttpResponse } from 'msw'
import { describe, expect, it, vi } from 'vitest'

import { nth } from '@/test/nth'
import { renderWithProviders } from '@/test/render'
import { loggedInHandlers, server, url } from '@/test/server'

import type { Booking } from './api'
import { propertyColors } from './property-colors'
import { UpcomingMoves } from './upcoming-moves'

const casa = { id: '018f0000-0000-7000-8000-0000000000a1', name: 'Casa da Praia' }

function booking(id: string, guestName: string, checkIn: string, checkOut: string, due: number) {
  return {
    id,
    property: casa,
    broker: null,
    guestName,
    checkIn,
    checkOut,
    nights: 1,
    nightlyRate: 10000,
    cleaningFee: 0,
    discount: 0,
    amountPaid: 0,
    brokerCommissionBps: 0,
    financials: {
      grossLodging: 0,
      lodging: 0,
      total: 0,
      brokerFee: 0,
      net: 0,
      balanceDue: due,
    },
    createdAt: '2026-10-31T12:00:00.000Z',
    updatedAt: '2026-10-31T12:00:00.000Z',
  } satisfies Booking
}

function serveCalendar(bookings: Booking[]) {
  const queries: URLSearchParams[] = []
  // Logged in, with this calendar answering ahead of the default one.
  server.use(...loggedInHandlers)
  server.use(
    http.get(url('/bookings/calendar'), ({ request }) => {
      queries.push(new URL(request.url).searchParams)
      return HttpResponse.json(bookings)
    }),
  )
  return queries
}

describe('UpcomingMoves', () => {
  it('lists who arrives and who leaves, with what is still due from arriving guests', async () => {
    const queries = serveCalendar([
      booking('b1', 'Ana Ribeiro', '2027-01-05', '2027-01-10', 50000),
      booking('b2', 'Bruno Tavares', '2027-01-10', '2027-01-12', 30000),
    ])
    const onOpen = vi.fn()
    const user = userEvent.setup()
    renderWithProviders(
      <UpcomingMoves
        today="2027-01-10"
        colors={propertyColors([casa.id])}
        onOpenBooking={onOpen}
      />,
    )

    const list = await screen.findByRole('list')
    const rows = within(list).getAllByRole('button')
    expect(rows.map((row) => row.textContent)).toEqual([
      'HojeChegaBruno Tavares · Casa da Praiafalta R$ 300,00',
      'HojeSaiAna Ribeiro · Casa da Praia',
      'ter, 12 janSaiBruno Tavares · Casa da Praia',
    ])
    // From yesterday, so a stay leaving today is in.
    expect(Object.fromEntries(queries[0] ?? [])).toEqual({ from: '2027-01-09', to: '2027-01-17' })

    await user.click(nth(rows, 0))
    expect(onOpen).toHaveBeenCalledWith(expect.objectContaining({ id: 'b2' }))
  })

  it('says when nobody arrives or leaves', async () => {
    serveCalendar([])
    renderWithProviders(
      <UpcomingMoves today="2027-01-10" colors={new Map()} onOpenBooking={vi.fn()} />,
    )

    expect(
      await screen.findByText('Ninguém chega nem sai nos próximos 7 dias.'),
    ).toBeInTheDocument()
  })
})
