import { screen, waitFor, within } from '@testing-library/react'
import userEvent from '@testing-library/user-event'
import { http, HttpResponse } from 'msw'
import { describe, expect, it } from 'vitest'

import { routes } from '@/test/app-routes'
import { renderRoute } from '@/test/render'
import { apiError, loggedInHandlers, server, testUser, url } from '@/test/server'

import type { Plan } from './api'
import { propertyLimitLabel, toPlanInput } from './plan-schema'

function plan(overrides: Partial<Plan>): Plan {
  return {
    id: '018f0000-0000-7000-8000-0000000000f1',
    code: null,
    name: 'Plano',
    description: null,
    active: true,
    maxProperties: null,
    monthlyPrice: null,
    semiannualPrice: null,
    annualPrice: null,
    createdAt: '2026-11-14T12:00:00.000Z',
    updatedAt: '2026-11-14T12:00:00.000Z',
    ...overrides,
  }
}

const free = plan({ code: 'free', name: 'Free', maxProperties: 1, description: 'Um imóvel.' })
const premium = plan({
  id: '018f0000-0000-7000-8000-0000000000f2',
  code: 'premium',
  name: 'Premium',
  monthlyPrice: 3990,
  annualPrice: 38300,
})

function serveAdmin() {
  const posts: unknown[] = []
  const patches: { id: string; body: unknown }[] = []
  server.use(...loggedInHandlers)
  server.use(
    http.get(url('/me'), () => HttpResponse.json({ ...testUser, isAdmin: true })),
    http.get(url('/admin/plans'), () => HttpResponse.json([free, premium])),
    http.post(url('/admin/plans'), async ({ request }) => {
      const body = await request.json()
      posts.push(body)
      return HttpResponse.json(plan(body as Partial<Plan>), { status: 201 })
    }),
    http.patch(url('/admin/plans/:id'), async ({ params, request }) => {
      const body = await request.json()
      patches.push({ id: String(params.id), body })
      return HttpResponse.json({ ...premium, ...(body as Partial<Plan>) })
    }),
  )
  return { posts, patches }
}

async function openPage() {
  const user = userEvent.setup()
  renderRoute(routes, '/admin/planos')
  await screen.findByRole('table', { name: 'Planos' }, { timeout: 5000 })
  return { user }
}

describe('plans in the backoffice', () => {
  it('lists each plan with its limit and prices', async () => {
    serveAdmin()
    await openPage()

    const rows = within(screen.getByRole('table', { name: 'Planos' }))
      .getAllByRole('row')
      .slice(1)
    expect(rows.map((row) => row.textContent)).toEqual([
      'FreeUm imóvel.1 imóvel———',
      'PremiumIlimitadosR$ 39,90—R$ 383,00',
    ])
  })

  it('creates a plan', async () => {
    const { posts } = serveAdmin()
    const { user } = await openPage()

    await user.click(screen.getByRole('button', { name: 'Novo plano' }))
    const sheet = await screen.findByRole('dialog', { name: 'Novo plano' })
    await user.type(within(sheet).getByLabelText('Nome'), 'Pro 5')
    await user.type(within(sheet).getByLabelText('Limite de imóveis'), '5')
    await user.type(within(sheet).getByLabelText('Mensal'), '2990')
    await user.click(within(sheet).getByRole('button', { name: 'Criar plano' }))

    expect(await screen.findByText('Plano criado.')).toBeInTheDocument()
    expect(posts).toEqual([
      {
        name: 'Pro 5',
        description: null,
        maxProperties: 5,
        monthlyPrice: 2990,
        semiannualPrice: null,
        annualPrice: null,
      },
    ])
  })

  it('edits Free without offering prices', async () => {
    const { patches } = serveAdmin()
    const { user } = await openPage()

    await user.click(screen.getByRole('button', { name: 'Ações de Free' }))
    await user.click(await screen.findByRole('menuitem', { name: 'Editar' }))
    const sheet = await screen.findByRole('dialog', { name: 'Editar plano' })
    expect(within(sheet).queryByLabelText('Mensal')).not.toBeInTheDocument()
    expect(within(sheet).getByText('O plano Free é sempre de graça.')).toBeInTheDocument()
    await user.click(within(sheet).getByRole('button', { name: 'Salvar' }))

    await waitFor(() => {
      expect(patches).toHaveLength(1)
    })
    expect(patches[0]?.body).not.toHaveProperty('monthlyPrice')
    // Free can't be taken off sale.
    await user.click(screen.getByRole('button', { name: 'Ações de Free' }))
    expect(screen.queryByRole('menuitem', { name: 'Tirar de venda' })).not.toBeInTheDocument()
  })

  it('takes a plan off sale', async () => {
    const { patches } = serveAdmin()
    const { user } = await openPage()

    await user.click(screen.getByRole('button', { name: 'Ações de Premium' }))
    await user.click(await screen.findByRole('menuitem', { name: 'Tirar de venda' }))

    expect(await screen.findByText('Premium saiu de venda.')).toBeInTheDocument()
    expect(patches).toEqual([{ id: premium.id, body: { active: false } }])
  })

  it('shows on its field a rule the API enforces', async () => {
    serveAdmin()
    server.use(
      http.post(url('/admin/plans'), () =>
        apiError(400, 'VALIDATION_ERROR', [{ path: 'maxProperties', message: 'x' }]),
      ),
    )
    const { user } = await openPage()

    await user.click(screen.getByRole('button', { name: 'Novo plano' }))
    const sheet = await screen.findByRole('dialog', { name: 'Novo plano' })
    await user.type(within(sheet).getByLabelText('Nome'), 'X')
    await user.click(within(sheet).getByRole('button', { name: 'Criar plano' }))

    expect(await within(sheet).findByText('Limite inválido.')).toBeInTheDocument()
  })
})

describe('plan form helpers', () => {
  it('reads blanks as no limit and no price', () => {
    expect(
      toPlanInput({
        name: 'X',
        description: '',
        maxProperties: '',
        monthlyPrice: 'R$ 10,00',
        semiannualPrice: '',
        annualPrice: '',
      }),
    ).toEqual({
      name: 'X',
      description: null,
      maxProperties: null,
      monthlyPrice: 1000,
      semiannualPrice: null,
      annualPrice: null,
    })
  })

  it.each([
    [null, 'Ilimitados'],
    [1, '1 imóvel'],
    [5, '5 imóveis'],
  ])('labels a limit of %s as %s', (limit, label) => {
    expect(propertyLimitLabel(limit)).toBe(label)
  })
})
