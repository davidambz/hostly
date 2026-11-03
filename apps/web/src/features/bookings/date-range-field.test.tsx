import { screen, waitFor } from '@testing-library/react'
import userEvent from '@testing-library/user-event'
import { http, HttpResponse } from 'msw'
import { useState } from 'react'
import { describe, expect, it, vi } from 'vitest'

import { renderWithProviders } from '@/test/render'
import { server, url } from '@/test/server'

import { DateRangeField } from './date-range-field'
import { firstConflict, occupiedNights } from './occupied-nights'

/** Ana stays 12 → 15 Nov 2026 (nights of the 12th, 13th and 14th) in property p1. */
const ana = {
  id: 'b1',
  guestName: 'Ana Souza',
  checkIn: '2026-11-12',
  checkOut: '2026-11-15',
  property: { id: 'p1', name: 'Casa da Praia' },
}

function serveTaken() {
  const queries: URLSearchParams[] = []
  server.use(
    http.get(url('/bookings/calendar'), ({ request }) => {
      queries.push(new URL(request.url).searchParams)
      return HttpResponse.json([ana])
    }),
  )
  return queries
}

function Field({
  onChange,
  propertyId = 'p1',
  exceptBookingId,
}: {
  onChange: (range: { checkIn: string; checkOut: string }) => void
  propertyId?: string
  exceptBookingId?: string
}) {
  const [range, setRange] = useState({ checkIn: '', checkOut: '' })
  return (
    <DateRangeField
      {...range}
      propertyId={propertyId}
      exceptBookingId={exceptBookingId}
      fallbackMonth="2026-11-20"
      onChange={(next) => {
        setRange(next)
        onChange(next)
      }}
    />
  )
}

const day = (date: string) => {
  const cell = document.querySelector(`[data-day="${date}"]`)
  if (!(cell instanceof HTMLElement)) throw new Error(`no day ${date}`)
  return cell
}
const dayButton = (date: string) => {
  const button = day(date).querySelector('button')
  if (!button) throw new Error(`no button on ${date}`)
  return button
}

async function open(props: Partial<Parameters<typeof Field>[0]> = {}) {
  const user = userEvent.setup()
  const onChange = vi.fn()
  renderWithProviders(<Field onChange={onChange} {...props} />)
  await user.click(screen.getByRole('button', { name: 'Datas' }))
  return { user, onChange }
}

describe('DateRangeField', () => {
  it('opens on the month being looked at and strikes the property’s taken nights', async () => {
    const queries = serveTaken()
    await open()

    await waitFor(() => {
      expect(day('2026-11-12')).toHaveClass('line-through')
    })
    expect(day('2026-11-14')).toHaveClass('line-through')
    // Check-out day is free for the next guest.
    expect(day('2026-11-15')).not.toHaveClass('line-through')
    expect(
      screen.getByText('Noites riscadas já estão reservadas neste imóvel.'),
    ).toBeInTheDocument()
    expect(Object.fromEntries(queries[0] ?? [])).toEqual({
      from: '2026-11-01',
      to: '2027-01-01',
      propertyId: 'p1',
    })
  })

  it('refuses a check-in on a taken night', async () => {
    serveTaken()
    const { user, onChange } = await open()
    await waitFor(() => {
      expect(day('2026-11-13')).toHaveClass('line-through')
    })

    await user.click(dayButton('2026-11-13'))

    expect(screen.getByRole('alert')).toHaveTextContent('já é de Ana Souza')
    expect(onChange).not.toHaveBeenCalled()
  })

  it('refuses a stay that runs over a booking, keeping the check-in', async () => {
    serveTaken()
    const { user, onChange } = await open()
    await waitFor(() => {
      expect(day('2026-11-12')).toHaveClass('line-through')
    })

    await user.click(dayButton('2026-11-10'))
    await user.click(dayButton('2026-11-17'))

    expect(screen.getByRole('alert')).toHaveTextContent('passam pela reserva de Ana Souza')
    expect(onChange).toHaveBeenLastCalledWith({ checkIn: '2026-11-10', checkOut: '' })
    expect(screen.getByRole('button', { name: 'Datas' })).toHaveTextContent(
      'Escolha a entrada e a saída',
    )
  })

  it('takes a check-out on the day another guest checks in', async () => {
    serveTaken()
    const { user, onChange } = await open()
    await waitFor(() => {
      expect(day('2026-11-12')).toHaveClass('line-through')
    })

    await user.click(dayButton('2026-11-10'))
    await user.click(dayButton('2026-11-12'))

    expect(onChange).toHaveBeenLastCalledWith({ checkIn: '2026-11-10', checkOut: '2026-11-12' })
    expect(screen.queryByRole('alert')).not.toBeInTheDocument()
    expect(screen.getByRole('button', { name: 'Datas' })).toHaveTextContent('2 noites')
  })

  it('does not count the booking being edited against itself', async () => {
    const queries = serveTaken()
    const { user, onChange } = await open({ exceptBookingId: 'b1' })
    await waitFor(() => {
      expect(queries).toHaveLength(1)
    })

    expect(day('2026-11-13')).not.toHaveClass('line-through')
    await user.click(dayButton('2026-11-13'))
    expect(onChange).toHaveBeenLastCalledWith({ checkIn: '2026-11-13', checkOut: '' })
  })

  it('asks for the property first, without looking anything up', async () => {
    const queries = serveTaken()
    await open({ propertyId: '' })

    expect(
      screen.getByText('Escolha o imóvel para ver as noites já reservadas.'),
    ).toBeInTheDocument()
    expect(queries).toHaveLength(0)
  })
})

describe('occupied nights', () => {
  it('takes the check-in night up to the night before check-out', () => {
    const nights = occupiedNights([ana] as never)

    expect([...nights.keys()]).toEqual(['2026-11-12', '2026-11-13', '2026-11-14'])
    expect(firstConflict(nights, '2026-11-10', '2026-11-12')).toBeUndefined()
    expect(firstConflict(nights, '2026-11-15', '2026-11-18')).toBeUndefined()
    expect(firstConflict(nights, '2026-11-11', '2026-11-13')).toEqual({
      night: '2026-11-12',
      guest: 'Ana Souza',
    })
  })
})
