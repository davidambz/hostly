import { screen, within } from '@testing-library/react'
import userEvent from '@testing-library/user-event'
import { http, HttpResponse } from 'msw'
import { describe, expect, it, vi } from 'vitest'

vi.mock('@/lib/navigate', () => ({ leaveTo: vi.fn() }))

import { routes } from '@/test/app-routes'
import { nth } from '@/test/nth'
import { renderRoute } from '@/test/render'
import { freePlan, loggedInHandlers, server, url } from '@/test/server'

import type { MyGrant, Plan } from './api'
import { leaveTo } from '@/lib/navigate'

import { grantLabel, periodPrices, sourceLabel, subscriptionLabel, usageLabel } from './plan-labels'

function serve(plan: ReturnType<typeof freePlan>, properties: { id: string; name: string }[] = []) {
  server.use(...loggedInHandlers)
  server.use(
    http.get(url('/me/plan'), () => HttpResponse.json(plan)),
    http.get(url('/properties'), () =>
      HttpResponse.json({
        items: properties.map((property) => ({
          ...property,
          type: 'HOUSE',
          zipCode: null,
          state: null,
          city: null,
          neighborhood: null,
          street: null,
          number: null,
          complement: null,
          building: null,
          block: null,
          unit: null,
          defaultNightlyRate: null,
          defaultCleaningFee: null,
          createdAt: '',
          updatedAt: '',
        })),
        total: properties.length,
        page: 1,
        pageSize: 20,
      }),
    ),
  )
}

const casa = { id: '018f0000-0000-7000-8000-0000000000a1', name: 'Casa da Praia' }

describe('property limit', () => {
  it('says the plan is full instead of opening the new-property form', async () => {
    serve(freePlan({ full: true }), [casa])
    const user = userEvent.setup()
    const { router } = renderRoute(routes, '/imoveis')

    await user.click(await screen.findByRole('button', { name: 'Novo imóvel' }, { timeout: 5000 }))

    const dialog = await screen.findByRole('alertdialog', {
      name: 'Seu plano não tem espaço para mais imóveis',
    })
    expect(dialog).toHaveTextContent('O Free permite 1 imóvel.')
    expect(screen.queryByRole('dialog', { name: 'Novo imóvel' })).not.toBeInTheDocument()
    await user.click(within(dialog).getByRole('link', { name: 'Ver meu plano' }))
    expect(await screen.findByRole('heading', { level: 1, name: 'Meu plano' })).toBeInTheDocument()
    expect(router.state.location.pathname).toBe('/plano')
  })

  it('opens the form while there is room', async () => {
    serve(freePlan())
    const user = userEvent.setup()
    renderRoute(routes, '/imoveis')

    await user.click(
      nth(await screen.findAllByRole('button', { name: 'Novo imóvel' }, { timeout: 5000 }), 0),
    )

    expect(await screen.findByRole('dialog', { name: 'Novo imóvel' })).toBeInTheDocument()
  })
})

describe('plan page', () => {
  it('shows the plan and what is used', async () => {
    serve(freePlan({ full: true }))
    renderRoute(routes, '/plano')

    const plan = await screen.findByRole('region', { name: 'Free' }, { timeout: 5000 })
    expect(plan).toHaveTextContent('1 de 1 imóvel')
    expect(plan).toHaveTextContent('Você chegou ao limite do seu plano.')
  })

  it('is in the user menu', async () => {
    serve(freePlan())
    const user = userEvent.setup()
    renderRoute(routes, '/reservas')

    await user.click(await screen.findByRole('button', { name: 'Conta de Ana Souza' }))

    expect(await screen.findByRole('menuitem', { name: 'Meu plano' })).toHaveAttribute(
      'href',
      '/plano',
    )
  })
})

describe('plan labels', () => {
  const premium: ReturnType<typeof freePlan> = {
    ...freePlan(),
    plan: { ...freePlan().plan, code: 'premium', name: 'Premium', maxProperties: null },
    source: 'GRANT',
    propertyCount: 3,
  }

  it.each([
    [freePlan({ full: true }), '1 de 1 imóvel'],
    [premium, '3 imóveis, sem limite'],
  ])('describes the usage', (plan, label) => {
    expect(usageLabel(plan)).toBe(label)
  })

  it('names a courtesy and its end', () => {
    expect(sourceLabel({ ...premium, endsAt: null })).toBe('Cortesia, para sempre.')
    expect(sourceLabel({ ...premium, endsAt: '2027-03-10T12:00:00.000Z' })).toBe(
      'Cortesia até 10/03/2027.',
    )
    expect(sourceLabel(freePlan())).toBeNull()
  })
})

function plan(overrides: Partial<Plan>): Plan {
  return {
    id: '018f0000-0000-7000-8000-0000000000f1',
    code: 'free',
    name: 'Free',
    description: 'Para começar: um imóvel, de graça, sem prazo.',
    active: true,
    maxProperties: 1,
    monthlyPrice: null,
    semiannualPrice: null,
    annualPrice: null,
    createdAt: '',
    updatedAt: '',
    ...overrides,
  }
}

const premium = plan({
  id: '018f0000-0000-7000-8000-0000000000f2',
  code: 'premium',
  name: 'Premium',
  description: 'Imóveis ilimitados.',
  maxProperties: null,
  monthlyPrice: 3990,
  annualPrice: 38300,
})

const lifetime: MyGrant = {
  id: '018f0000-0000-7000-8000-0000000000a1',
  plan: { name: 'Premium' },
  duration: 'LIFETIME',
  startsAt: '2026-11-14T12:00:00.000Z',
  endsAt: null,
  revokedAt: null,
  inForce: true,
}

describe('plans on the plan page', () => {
  it('shows each plan with its prices, marking the current one', async () => {
    serve(freePlan())
    server.use(
      http.get(url('/plans'), () => HttpResponse.json([plan({}), premium])),
      http.get(url('/me/grants'), () => HttpResponse.json([])),
    )
    renderRoute(routes, '/plano')

    const list = await screen.findByRole('region', { name: 'Planos' }, { timeout: 5000 })
    const free = await within(list).findByRole('listitem', { name: 'Free' })
    expect(free).toHaveTextContent('Seu plano')
    expect(free).toHaveTextContent('De graça')
    const paid = within(list).getByRole('listitem', { name: 'Premium' })
    expect(paid).toHaveTextContent('Imóveis ilimitados')
    expect(paid).toHaveTextContent('R$ 39,90 por mês')
    expect(paid).toHaveTextContent('R$ 383,00 por ano')
    expect(paid).not.toHaveTextContent('por semestre')
    expect(within(paid).getByRole('button', { name: 'Assinar · R$ 39,90 por mês' })).toBeEnabled()
    expect(within(paid).getByRole('button', { name: 'Assinar · R$ 383,00 por ano' })).toBeEnabled()
    expect(within(free).queryByRole('button')).not.toBeInTheDocument()
    expect(screen.queryByRole('region', { name: 'Cortesias' })).not.toBeInTheDocument()
  })

  it('lists the courtesy plans received', async () => {
    serve({ ...freePlan(), source: 'GRANT', plan: { ...freePlan().plan, name: 'Premium' } })
    server.use(
      http.get(url('/plans'), () => HttpResponse.json([plan({}), premium])),
      http.get(url('/me/grants'), () =>
        HttpResponse.json([
          lifetime,
          {
            ...lifetime,
            id: '018f0000-0000-7000-8000-0000000000a2',
            duration: 'ONE_MONTH',
            startsAt: '2026-01-01T12:00:00.000Z',
            endsAt: '2026-02-01T12:00:00.000Z',
            inForce: false,
          },
        ]),
      ),
    )
    renderRoute(routes, '/plano')

    const grants = await screen.findByRole('region', { name: 'Cortesias' }, { timeout: 5000 })
    expect(
      within(grants)
        .getAllByRole('listitem')
        .map((item) => item.textContent),
    ).toEqual([
      'Premium, vitalícia, desde 14/11/2026Em vigor',
      'Premium por 1 mês, de 01/01/2026 a 01/02/2026Terminou',
    ])
  })
})

describe('plan helpers', () => {
  it('lists only the periods with a price', () => {
    expect(periodPrices(premium)).toEqual([
      { period: 'MONTHLY', label: 'por mês', price: 3990 },
      { period: 'ANNUAL', label: 'por ano', price: 38300 },
    ])
    expect(periodPrices(plan({}))).toEqual([])
  })

  it('describes a grant', () => {
    expect(grantLabel(lifetime)).toBe('Premium, vitalícia, desde 14/11/2026')
  })
})

describe('subscribing', () => {
  it('sends the user to Stripe for the chosen period', async () => {
    serve(freePlan())
    const bodies: unknown[] = []
    server.use(
      http.get(url('/plans'), () => HttpResponse.json([plan({}), premium])),
      http.get(url('/me/grants'), () => HttpResponse.json([])),
      http.post(url('/billing/checkout'), async ({ request }) => {
        bodies.push(await request.json())
        return HttpResponse.json({ url: 'https://checkout.stripe.com/c/pay/cs_test_1' })
      }),
    )
    const user = userEvent.setup()
    renderRoute(routes, '/plano')

    await user.click(
      await screen.findByRole('button', { name: 'Assinar · R$ 383,00 por ano' }, { timeout: 5000 }),
    )

    await vi.waitFor(() => {
      expect(leaveTo).toHaveBeenCalledWith('https://checkout.stripe.com/c/pay/cs_test_1')
    })
    expect(bodies).toEqual([{ planId: premium.id, period: 'ANNUAL' }])
  })

  it('says it is confirming after Stripe, then that it is done', async () => {
    let paid = false
    serve(freePlan())
    server.use(
      http.get(url('/plans'), () => HttpResponse.json([plan({}), premium])),
      http.get(url('/me/grants'), () => HttpResponse.json([])),
      http.get(url('/me/plan'), () =>
        HttpResponse.json(
          paid
            ? {
                ...freePlan(),
                source: 'SUBSCRIPTION',
                plan: {
                  ...freePlan().plan,
                  id: premium.id,
                  code: 'premium',
                  name: 'Premium',
                  maxProperties: null,
                },
                subscription: {
                  period: 'MONTHLY',
                  currentPeriodEnd: '2026-12-14T12:00:00.000Z',
                  cancelAtPeriodEnd: false,
                },
              }
            : freePlan(),
        ),
      ),
    )
    const { router } = renderRoute(routes, '/plano?assinatura=confirmando')

    expect(
      await screen.findByText(/A Stripe está confirmando/, {}, { timeout: 5000 }),
    ).toBeInTheDocument()
    paid = true

    expect(
      await screen.findByText('Assinatura confirmada. Bom proveito!', {}, { timeout: 8000 }),
    ).toBeInTheDocument()
    expect(
      screen.getByText('Assinatura mensal. Próxima cobrança em 14/12/2026.'),
    ).toBeInTheDocument()
    expect(router.state.location.search).toBe('')
  }, 15_000)

  it('describes a cancelled renewal', () => {
    expect(
      subscriptionLabel({
        ...freePlan(),
        source: 'SUBSCRIPTION',
        subscription: {
          period: 'ANNUAL',
          currentPeriodEnd: '2027-11-14T12:00:00.000Z',
          cancelAtPeriodEnd: true,
        },
      }),
    ).toBe('Assinatura anual. Renovação cancelada: vale até 14/11/2027.')
    expect(subscriptionLabel(freePlan())).toBeNull()
  })
})

describe('managing the subscription', () => {
  const subscribed = (cancelAtPeriodEnd = false) => ({
    ...freePlan(),
    source: 'SUBSCRIPTION' as const,
    plan: {
      ...freePlan().plan,
      id: premium.id,
      code: 'premium',
      name: 'Premium',
      maxProperties: null,
    },
    subscription: {
      period: 'MONTHLY' as const,
      currentPeriodEnd: '2026-12-14T12:00:00.000Z',
      cancelAtPeriodEnd,
    },
  })

  function serveSubscription(cancelled = false) {
    const calls: { path: string; body: unknown }[] = []
    serve(subscribed(cancelled))
    server.use(
      http.get(url('/plans'), () => HttpResponse.json([plan({}), premium])),
      http.get(url('/me/grants'), () => HttpResponse.json([])),
      http.get(url('/billing/payments'), () =>
        HttpResponse.json([
          {
            id: '018f0000-0000-7000-8000-0000000000c1',
            amount: 3990,
            status: 'paid',
            at: '2026-11-14T12:00:00.000Z',
            plan: 'Premium',
            period: 'MONTHLY',
          },
          {
            id: '018f0000-0000-7000-8000-0000000000c2',
            amount: 3990,
            status: 'failed',
            at: '2026-10-14T12:00:00.000Z',
            plan: null,
            period: null,
          },
        ]),
      ),
      http.post(url('/billing/subscription/renewal'), async ({ request }) => {
        calls.push({ path: 'renewal', body: await request.json() })
        return new HttpResponse(null, { status: 204 })
      }),
      http.post(url('/billing/subscription/period'), async ({ request }) => {
        calls.push({ path: 'period', body: await request.json() })
        return new HttpResponse(null, { status: 204 })
      }),
      http.post(url('/billing/portal'), () =>
        HttpResponse.json({ url: 'https://billing.stripe.com/p/session/test_1' }),
      ),
    )
    return calls
  }

  it('lists the charges, paid and failed', async () => {
    serveSubscription()
    renderRoute(routes, '/plano')

    const list = await screen.findByRole('list', { name: 'Pagamentos' }, { timeout: 5000 })
    const items = within(list).getAllByRole('listitem')
    expect(items[0]).toHaveTextContent('14/11/2026')
    expect(items[0]).toHaveTextContent('Premium · mensal')
    expect(items[0]).toHaveTextContent('R$ 39,90')
    expect(items[0]).toHaveTextContent('Pago')
    expect(items[1]).toHaveTextContent('Assinatura')
    expect(items[1]).toHaveTextContent('Falhou')
  })

  it('cancels the renewal after confirming', async () => {
    const calls = serveSubscription()
    const user = userEvent.setup()
    renderRoute(routes, '/plano')

    await user.click(
      await screen.findByRole('button', { name: 'Cancelar renovação' }, { timeout: 5000 }),
    )
    const dialog = await screen.findByRole('alertdialog', { name: 'Cancelar a renovação?' })
    expect(dialog).toHaveTextContent('O plano continua até 14/12/2026')
    await user.click(within(dialog).getByRole('button', { name: 'Cancelar renovação' }))

    await vi.waitFor(() => {
      expect(calls).toEqual([{ path: 'renewal', body: { renew: false } }])
    })
  })

  it('resumes a cancelled renewal, with no period change offered', async () => {
    const calls = serveSubscription(true)
    const user = userEvent.setup()
    renderRoute(routes, '/plano')

    await user.click(
      await screen.findByRole('button', { name: 'Retomar renovação' }, { timeout: 5000 }),
    )

    await vi.waitFor(() => {
      expect(calls).toEqual([{ path: 'renewal', body: { renew: true } }])
    })
    expect(screen.queryByLabelText('Mudar para')).not.toBeInTheDocument()
  })

  it('changes to another priced period', async () => {
    const calls = serveSubscription()
    const user = userEvent.setup()
    renderRoute(routes, '/plano')

    const select = await screen.findByLabelText('Mudar para', {}, { timeout: 5000 })
    expect(
      within(select)
        .getAllByRole('option')
        .map((option) => option.textContent),
    ).toEqual(['Escolha', 'Anual · R$ 383,00 por ano'])
    await user.selectOptions(select, 'ANNUAL')
    await user.click(screen.getByRole('button', { name: 'Mudar' }))

    await vi.waitFor(() => {
      expect(calls).toEqual([{ path: 'period', body: { period: 'ANNUAL' } }])
    })
  })

  it('opens the Stripe portal to update the card', async () => {
    serveSubscription()
    const user = userEvent.setup()
    renderRoute(routes, '/plano')

    await user.click(
      await screen.findByRole(
        'button',
        { name: 'Atualizar forma de pagamento' },
        { timeout: 5000 },
      ),
    )

    await vi.waitFor(() => {
      expect(leaveTo).toHaveBeenCalledWith('https://billing.stripe.com/p/session/test_1')
    })
  })

  it('is not shown without a paid subscription', async () => {
    serve(freePlan())
    server.use(
      http.get(url('/plans'), () => HttpResponse.json([plan({}), premium])),
      http.get(url('/me/grants'), () => HttpResponse.json([])),
    )
    renderRoute(routes, '/plano')

    await screen.findByRole('region', { name: 'Planos' }, { timeout: 5000 })
    expect(screen.queryByRole('region', { name: 'Sua assinatura' })).not.toBeInTheDocument()
  })
})
