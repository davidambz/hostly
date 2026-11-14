import { screen, within } from '@testing-library/react'
import { http, HttpResponse } from 'msw'
import { describe, expect, it } from 'vitest'

import { routes } from '@/test/app-routes'
import { renderRoute } from '@/test/render'
import { loggedInHandlers, server, testUser, url } from '@/test/server'

import type { AdminDashboard } from './api'

const data: AdminDashboard = {
  users: { total: 12, new: 3 },
  byPlan: [
    { id: '018f0000-0000-7000-8000-0000000000f1', code: 'free', name: 'Free', users: 10 },
    { id: '018f0000-0000-7000-8000-0000000000f2', code: 'premium', name: 'Premium', users: 2 },
  ],
  bySource: { free: 10, grant: 2 },
  grantsEndingSoon: [
    {
      grantId: '018f0000-0000-7000-8000-0000000000a1',
      user: { id: '018f0000-0000-7000-8000-000000000002', name: 'Carlos Lima', email: 'c@h.dev' },
      plan: { name: 'Premium' },
      endsAt: '2026-12-01T12:00:00.000Z',
    },
  ],
  usage: { properties: 40, bookings: 310 },
}

function serve(body: AdminDashboard = data) {
  server.use(...loggedInHandlers)
  server.use(
    http.get(url('/me'), () => HttpResponse.json({ ...testUser, isAdmin: true })),
    http.get(url('/admin/dashboard'), () => HttpResponse.json(body)),
  )
}

describe('backoffice dashboard', () => {
  it('opens at /admin with the figures, the plans and the grants ending soon', async () => {
    serve()
    renderRoute(routes, '/admin')

    expect(await screen.findByText('Novas em 30 dias', {}, { timeout: 5000 })).toBeInTheDocument()
    expect(screen.getByRole('link', { name: 'Painel' })).toHaveAttribute('aria-current', 'page')
    expect(screen.getByText('310')).toBeInTheDocument()
    const plans = screen.getByRole('region', { name: 'Contas por plano' })
    expect(
      within(plans)
        .getAllByRole('listitem')
        .map((item) => item.textContent),
    ).toEqual(['Free10', 'Premium2'])
    expect(plans).toHaveTextContent('2 contas com plano de cortesia.')
    expect(
      screen.getByRole('region', { name: 'Cortesias que vencem em 30 dias' }),
    ).toHaveTextContent('Carlos Lima · Premiumaté 01/12/2026')
  })

  it('says when no grant ends soon', async () => {
    serve({ ...data, grantsEndingSoon: [], bySource: { free: 12, grant: 1 } })
    renderRoute(routes, '/admin')

    expect(
      await screen.findByText(
        'Nenhuma cortesia vence nos próximos 30 dias.',
        {},
        { timeout: 5000 },
      ),
    ).toBeInTheDocument()
    expect(screen.getByText('1 conta com plano de cortesia.')).toBeInTheDocument()
  })
})
