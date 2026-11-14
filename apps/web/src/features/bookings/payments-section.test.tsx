import { screen, waitFor, within } from '@testing-library/react'
import userEvent from '@testing-library/user-event'
import { http, HttpResponse } from 'msw'
import { beforeEach, describe, expect, it, vi } from 'vitest'

import { renderWithProviders } from '@/test/render'
import { apiError, loggedInHandlers, server, url } from '@/test/server'

import type { Payment } from './api'
import { todayISO } from './dates'
import { PaymentsSection } from './payments-section'

const BOOKING = '018f0000-0000-7000-8000-0000000000c1'

const deposit: Payment = {
  id: '018f0000-0000-7000-8000-0000000000d1',
  amount: 100000,
  paidOn: '2026-11-02',
  note: 'Sinal',
  createdAt: '2026-11-02T12:00:00.000Z',
}

/** Serves the booking's payments, keeping what is recorded and deleted. */
function servePayments(initial: Payment[] = [deposit]) {
  let payments = [...initial]
  const posted: unknown[] = []
  server.use(...loggedInHandlers)
  server.use(
    http.get(url(`/bookings/${BOOKING}/payments`), () => HttpResponse.json(payments)),
    http.post(url(`/bookings/${BOOKING}/payments`), async ({ request }) => {
      const body = (await request.json()) as { amount: number; paidOn: string; note: string | null }
      posted.push(body)
      const payment = { ...body, id: `p${String(payments.length)}`, createdAt: '' }
      payments = [...payments, payment]
      return HttpResponse.json(payment, { status: 201 })
    }),
    http.delete(url(`/bookings/${BOOKING}/payments/:paymentId`), ({ params }) => {
      payments = payments.filter((payment) => payment.id !== params.paymentId)
      return new HttpResponse(null, { status: 204 })
    }),
  )
  return { posted }
}

function renderSection(due: number | null = 230000) {
  const onPaidChange = vi.fn()
  const user = userEvent.setup()
  renderWithProviders(<PaymentsSection bookingId={BOOKING} due={due} onPaidChange={onPaidChange} />)
  return { user, onPaidChange }
}

beforeEach(() => {
  server.use(...loggedInHandlers)
})

describe('PaymentsSection', () => {
  it('lists the payments and tells the form what was paid', async () => {
    servePayments()
    const { onPaidChange } = renderSection()

    const list = await screen.findByRole('list')
    expect(within(list).getByText('R$ 1.000,00')).toBeInTheDocument()
    expect(within(list).getByText('Sinal')).toBeInTheDocument()
    expect(within(list).getByText('02/11')).toBeInTheDocument()
    await waitFor(() => {
      expect(onPaidChange).toHaveBeenLastCalledWith(100000)
    })
  })

  it('records a payment with its day and note', async () => {
    const { posted } = servePayments()
    const { user, onPaidChange } = renderSection()
    const group = await screen.findByRole('group', { name: 'Registrar pagamento' })

    expect(within(group).getByRole('button', { name: 'Registrar' })).toBeDisabled()
    await user.type(within(group).getByLabelText('Valor'), '50000')
    await user.clear(within(group).getByLabelText('Dia'))
    await user.type(within(group).getByLabelText('Dia'), '2026-11-10')
    await user.type(within(group).getByLabelText('Observação'), 'Pix')
    await user.click(within(group).getByRole('button', { name: 'Registrar' }))

    expect(await screen.findByText('Pagamento registrado.')).toBeInTheDocument()
    expect(posted).toEqual([{ amount: 50000, paidOn: '2026-11-10', note: 'Pix' }])
    await waitFor(() => {
      expect(onPaidChange).toHaveBeenLastCalledWith(150000)
    })
    expect(within(group).getByLabelText('Valor')).toHaveValue('')
  })

  it('settles what is due today in one click', async () => {
    const { posted } = servePayments()
    const { user } = renderSection(230000)

    await user.click(await screen.findByRole('button', { name: 'Quitar R$ 2.300,00' }))

    expect(await screen.findByText('Reserva quitada.')).toBeInTheDocument()
    expect(posted).toEqual([{ amount: 230000, paidOn: todayISO(), note: 'Restante' }])
  })

  it('offers no settling when nothing is due', async () => {
    servePayments()
    renderSection(0)

    await screen.findByRole('list')
    expect(screen.queryByRole('button', { name: /^Quitar/ })).not.toBeInTheDocument()
  })

  it('deletes a payment', async () => {
    servePayments()
    const { user, onPaidChange } = renderSection()

    await user.click(
      await screen.findByRole('button', { name: 'Excluir o pagamento de R$ 1.000,00 de 02/11' }),
    )

    expect(await screen.findByText('Nenhum pagamento ainda.')).toBeInTheDocument()
    await waitFor(() => {
      expect(onPaidChange).toHaveBeenLastCalledWith(0)
    })
  })

  it('says why a payment was refused', async () => {
    servePayments([])
    server.use(
      http.post(url(`/bookings/${BOOKING}/payments`), () =>
        apiError(400, 'PAYMENT_EXCEEDS_BALANCE', { field: 'amount' }),
      ),
    )
    const { user } = renderSection()
    const group = await screen.findByRole('group', { name: 'Registrar pagamento' })

    await user.type(within(group).getByLabelText('Valor'), '99999999')
    await user.click(within(group).getByRole('button', { name: 'Registrar' }))

    expect(await screen.findByText('O pagamento passa do que falta receber.')).toBeInTheDocument()
  })
})
