import { screen, within } from '@testing-library/react'
import userEvent from '@testing-library/user-event'
import { http, HttpResponse } from 'msw'
import { describe, expect, it } from 'vitest'

import { routes } from '@/test/app-routes'
import { nth } from '@/test/nth'
import { renderRoute } from '@/test/render'
import { freePlan, loggedInHandlers, server, url } from '@/test/server'

import { sourceLabel, usageLabel } from './plan-labels'

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
