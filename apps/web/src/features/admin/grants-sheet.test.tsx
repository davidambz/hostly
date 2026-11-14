import { screen, within } from '@testing-library/react'
import userEvent from '@testing-library/user-event'
import { http, HttpResponse } from 'msw'
import { describe, expect, it } from 'vitest'

import { routes } from '@/test/app-routes'
import { renderRoute } from '@/test/render'
import { loggedInHandlers, server, testUser, url } from '@/test/server'

import type { AdminUser, Plan, PlanGrant } from './api'

const freePlan = { id: '018f0000-0000-7000-8000-0000000000f1', code: 'free', name: 'Free' }
const premiumPlan = { id: '018f0000-0000-7000-8000-0000000000f2', code: 'premium', name: 'Premium' }

const carlos: AdminUser = {
  id: '018f0000-0000-7000-8000-000000000002',
  name: 'Carlos Lima',
  email: 'carlos@hostly.dev',
  isAdmin: false,
  createdAt: '2026-11-01T12:00:00.000Z',
  propertyCount: 3,
  plan: freePlan,
  planSource: 'FREE',
  grant: null,
}

function plan(base: typeof freePlan, overrides: Partial<Plan> = {}): Plan {
  return {
    ...base,
    description: null,
    active: true,
    maxProperties: null,
    monthlyPrice: null,
    semiannualPrice: null,
    annualPrice: null,
    createdAt: '',
    updatedAt: '',
    ...overrides,
  }
}

const inForce: PlanGrant = {
  id: '018f0000-0000-7000-8000-0000000000a9',
  plan: premiumPlan,
  duration: 'ONE_YEAR',
  startsAt: '2026-11-14T10:00:00.000Z',
  endsAt: '2027-11-14T10:00:00.000Z',
  reason: 'Parceiro',
  revokedAt: null,
  inForce: true,
  grantedBy: { id: testUser.id, name: testUser.name },
  events: [
    {
      action: 'GRANTED',
      plan: premiumPlan,
      endsAt: '2027-11-14T10:00:00.000Z',
      duration: 'ONE_YEAR',
      reason: 'Parceiro',
      at: '2026-11-14T10:00:00.000Z',
      actor: { id: testUser.id, name: testUser.name },
    },
  ],
}

function serve(grants: PlanGrant[] = []) {
  const sent: { url: string; body: unknown }[] = []
  const record = async ({ request }: { request: Request }) => {
    sent.push({ url: new URL(request.url).pathname, body: await request.json() })
    return HttpResponse.json(inForce)
  }
  server.use(...loggedInHandlers)
  server.use(
    http.get(url('/me'), () => HttpResponse.json({ ...testUser, isAdmin: true })),
    http.get(url('/admin/users'), () =>
      HttpResponse.json({ items: [carlos], total: 1, page: 1, pageSize: 20 }),
    ),
    http.get(url('/admin/plans'), () =>
      HttpResponse.json([plan(freePlan, { maxProperties: 1 }), plan(premiumPlan)]),
    ),
    http.get(url('/admin/users/:id/grants'), () => HttpResponse.json(grants)),
    http.post(url('/admin/users/:id/grants'), record),
    http.post(url('/admin/grants/:id/renew'), record),
    http.patch(url('/admin/grants/:id/plan'), record),
    http.post(url('/admin/grants/:id/revoke'), record),
  )
  return { sent }
}

async function openSheet() {
  const user = userEvent.setup()
  renderRoute(routes, '/admin/usuarios')
  await user.click(
    await screen.findByRole('button', { name: 'Ações de Carlos Lima' }, { timeout: 5000 }),
  )
  await user.click(await screen.findByRole('menuitem', { name: 'Plano e concessões' }))
  const sheet = await screen.findByRole('dialog', { name: 'Plano de Carlos Lima' })
  return { user, sheet }
}

describe('grants in the backoffice', () => {
  it('gives a plan for a chosen time, with a reason', async () => {
    const { sent } = serve()
    const { user, sheet } = await openSheet()

    const form = await within(sheet).findByRole('region', { name: 'Conceder plano' })
    // Free is never offered: granting it is revoking.
    expect(within(form).queryByRole('option', { name: 'Free' })).not.toBeInTheDocument()
    await user.selectOptions(within(form).getByLabelText('Plano'), 'Premium')
    await user.click(within(form).getByRole('radio', { name: 'Vitalício' }))
    await user.type(within(form).getByLabelText('Motivo'), 'Sócio')
    await user.click(within(form).getByRole('button', { name: 'Conceder' }))

    expect(await screen.findByText('Plano concedido a Carlos Lima.')).toBeInTheDocument()
    expect(sent).toEqual([
      {
        url: `/admin/users/${carlos.id}/grants`,
        body: { planId: premiumPlan.id, duration: 'LIFETIME', reason: 'Sócio' },
      },
    ])
    expect(within(sheet).getByText('Nenhuma concessão até hoje.')).toBeInTheDocument()
  })

  it('shows the grant in force with its history, and renews it', async () => {
    const { sent } = serve([inForce])
    const { user, sheet } = await openSheet()

    const current = await within(sheet).findByRole('region', { name: 'Concessão em vigor' })
    expect(current).toHaveTextContent('Premiumaté 14/11/2027')
    const history = within(sheet).getByRole('region', { name: 'Histórico' })
    expect(history).toHaveTextContent('Concedido: Premium, até 14/11/2027')
    expect(history).toHaveTextContent('Ana Souza')

    await user.click(within(current).getByRole('button', { name: 'Renovar' }))
    await user.click(within(current).getByRole('radio', { name: '6 meses' }))
    await user.type(within(current).getByLabelText('Motivo'), 'Mais um semestre')
    await user.click(within(current).getByRole('button', { name: 'Renovar' }))

    expect(await screen.findByText('Concessão renovada.')).toBeInTheDocument()
    expect(sent).toEqual([
      {
        url: `/admin/grants/${inForce.id}/renew`,
        body: { duration: 'SIX_MONTHS', reason: 'Mais um semestre' },
      },
    ])
  })

  it('revokes the grant in force', async () => {
    const { sent } = serve([inForce])
    const { user, sheet } = await openSheet()

    const current = await within(sheet).findByRole('region', { name: 'Concessão em vigor' })
    await user.click(within(current).getByRole('button', { name: 'Revogar' }))
    const revoke = within(current).getByRole('button', { name: 'Revogar' })
    expect(revoke).toBeDisabled()
    await user.type(within(current).getByLabelText('Motivo'), 'Encerrou a parceria')
    await user.click(revoke)

    expect(await screen.findByText('Concessão revogada.')).toBeInTheDocument()
    expect(sent).toEqual([
      { url: `/admin/grants/${inForce.id}/revoke`, body: { reason: 'Encerrou a parceria' } },
    ])
  })
})
