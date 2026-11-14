import { screen, within } from '@testing-library/react'
import userEvent from '@testing-library/user-event'
import { http, HttpResponse } from 'msw'
import { describe, expect, it, vi } from 'vitest'

import { renderWithProviders } from '@/test/render'
import { loggedInHandlers, server, url } from '@/test/server'

import { FIRST_STEPS_HIDDEN_KEY, FirstSteps } from './first-steps'

function serveBookingTotals(total: number) {
  server.use(...loggedInHandlers)
  server.use(
    http.get(url('/bookings'), () =>
      HttpResponse.json({ items: [], total, page: 1, pageSize: 20 }),
    ),
  )
}

describe('FirstSteps', () => {
  it('guides an account with nothing yet, from the property on', async () => {
    serveBookingTotals(0)
    renderWithProviders(<FirstSteps hasProperty={false} onNewBooking={vi.fn()} />)

    const steps = await screen.findByRole('region', { name: 'Primeiros passos' })
    const items = within(steps).getAllByRole('listitem')
    expect(items).toHaveLength(3)
    expect(within(steps).getByRole('link', { name: 'Ir para imóveis' })).toHaveAttribute(
      'href',
      '/imoveis',
    )
    // No property yet: nothing to book.
    expect(within(steps).queryByRole('button', { name: 'Nova reserva' })).not.toBeInTheDocument()
  })

  it('marks the property done and starts the first booking', async () => {
    serveBookingTotals(0)
    const onNewBooking = vi.fn()
    const user = userEvent.setup()
    renderWithProviders(<FirstSteps hasProperty onNewBooking={onNewBooking} />)

    const steps = await screen.findByRole('region', { name: 'Primeiros passos' })
    expect(within(steps).getByLabelText('Feito')).toBeInTheDocument()
    expect(within(steps).queryByRole('link', { name: 'Ir para imóveis' })).not.toBeInTheDocument()

    await user.click(within(steps).getByRole('button', { name: 'Nova reserva' }))
    expect(onNewBooking).toHaveBeenCalled()
  })

  it('stays hidden once hidden, showing the fallback instead', async () => {
    serveBookingTotals(0)
    const user = userEvent.setup()
    const { unmount } = renderWithProviders(
      <FirstSteps hasProperty onNewBooking={vi.fn()} fallback={<p>sem passos</p>} />,
    )

    await user.click(await screen.findByRole('button', { name: 'Esconder' }))
    expect(screen.getByText('sem passos')).toBeInTheDocument()
    expect(localStorage.getItem(FIRST_STEPS_HIDDEN_KEY)).toBe('1')
    unmount()

    renderWithProviders(<FirstSteps hasProperty onNewBooking={vi.fn()} />)
    expect(screen.queryByRole('region', { name: 'Primeiros passos' })).not.toBeInTheDocument()
  })

  it('is gone once the account has a booking', async () => {
    serveBookingTotals(1)
    renderWithProviders(
      <FirstSteps hasProperty onNewBooking={vi.fn()} fallback={<p>sem passos</p>} />,
    )

    expect(await screen.findByText('sem passos')).toBeInTheDocument()
    expect(screen.queryByRole('region', { name: 'Primeiros passos' })).not.toBeInTheDocument()
  })
})
