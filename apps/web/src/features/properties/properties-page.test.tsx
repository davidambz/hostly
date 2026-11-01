import { screen, waitFor, within } from '@testing-library/react'
import userEvent from '@testing-library/user-event'
import { http, HttpResponse } from 'msw'
import { beforeEach, describe, expect, it } from 'vitest'

import { routes } from '@/app/routes'
import { VIACEP_URL } from '@/lib/viacep'
import { renderRoute } from '@/test/render'
import { apiError, loggedInHandlers, server, url } from '@/test/server'

import type { Property } from './api'

function makeProperty(overrides: Partial<Property> = {}): Property {
  return {
    id: '018f0000-0000-7000-8000-0000000000a1',
    name: 'Casa da Praia',
    type: 'HOUSE',
    zipCode: '88053700',
    state: 'SC',
    city: 'Florianópolis',
    neighborhood: 'Jurerê',
    street: 'Avenida dos Búzios',
    number: '100',
    complement: null,
    building: null,
    block: null,
    unit: null,
    createdAt: '2026-10-31T12:00:00.000Z',
    updatedAt: '2026-10-31T12:00:00.000Z',
    ...overrides,
  }
}

const house = makeProperty()
const apartment = makeProperty({
  id: '018f0000-0000-7000-8000-0000000000a2',
  name: 'Apê Centro',
  type: 'APARTMENT',
  building: 'Mar Azul',
  unit: '1204',
})

/** Serves `items` from GET /properties, recording each query string. */
function serveProperties(items: Property[], total = items.length) {
  const queries: URLSearchParams[] = []
  server.use(
    http.get(url('/properties'), ({ request }) => {
      queries.push(new URL(request.url).searchParams)
      return HttpResponse.json({ items, total, page: 1, pageSize: 20 })
    }),
  )
  return queries
}

/** The `index`th item, failing the test when there is none. */
function nth<T>(items: T[], index: number): T {
  const item = items[index]
  if (item === undefined) throw new Error(`no item at ${index}`)
  return item
}

async function openPage(path = '/imoveis') {
  const user = userEvent.setup()
  const view = renderRoute(routes, path)
  await screen.findByRole('heading', { name: 'Imóveis', level: 1 })
  return { user, ...view }
}

async function openActions(user: ReturnType<typeof userEvent.setup>, name: string, action: string) {
  await user.click(await screen.findByRole('button', { name: `Ações de ${name}` }))
  await user.click(await screen.findByRole('menuitem', { name: action }))
}

beforeEach(() => {
  server.use(...loggedInHandlers)
})

describe('properties list', () => {
  it('lists the properties with their address and type', async () => {
    serveProperties([house, apartment])
    await openPage()

    const table = await screen.findByRole('table', { name: 'Imóveis' })
    const rows = within(table).getAllByRole('row')
    expect(rows).toHaveLength(3)
    expect(within(nth(rows, 1)).getByText('Casa da Praia')).toBeInTheDocument()
    expect(within(nth(rows, 1)).getByText('Casa')).toBeInTheDocument()
    expect(within(nth(rows, 1)).getByText('Avenida dos Búzios, 100 · Jurerê')).toBeInTheDocument()
    expect(within(nth(rows, 1)).getByText('Florianópolis/SC')).toBeInTheDocument()
    expect(within(nth(rows, 2)).getByText('Apartamento')).toBeInTheDocument()
    expect(within(nth(rows, 2)).getByText('Mar Azul · Unidade 1204')).toBeInTheDocument()
  })

  it('invites to create the first one when there are none', async () => {
    serveProperties([])
    await openPage()

    expect(await screen.findByText('Nenhum imóvel ainda')).toBeInTheDocument()
    expect(screen.queryByRole('searchbox')).not.toBeInTheDocument()
    expect(screen.getAllByRole('button', { name: 'Novo imóvel' })).toHaveLength(2)
  })

  it('searches by name through the URL and says when nothing matches', async () => {
    const queries = serveProperties([house])
    const { user, router } = await openPage()
    await screen.findByText('Casa da Praia')

    serveProperties([], 0)
    await user.type(screen.getByRole('searchbox', { name: 'Buscar imóvel' }), 'chalé')

    expect(await screen.findByText('Nada encontrado')).toBeInTheDocument()
    expect(screen.getByText('Nenhum imóvel com "chalé" no nome.')).toBeInTheDocument()
    expect(router.state.location.search).toBe('?q=chal%C3%A9')
    expect(queries[0]?.has('search')).toBe(false)
  })

  it('reads the search and page from the URL', async () => {
    const queries = serveProperties([house], 45)
    await openPage('/imoveis?q=casa&page=2')

    expect(await screen.findByText('Página 2 de 3')).toBeInTheDocument()
    expect(screen.getByRole('searchbox')).toHaveValue('casa')
    expect(Object.fromEntries(nth(queries, 0))).toEqual({
      page: '2',
      pageSize: '20',
      search: 'casa',
    })
  })

  it('pages through the URL', async () => {
    serveProperties([house], 45)
    const { user, router } = await openPage()

    await user.click(await screen.findByRole('button', { name: 'Próxima' }))

    await waitFor(() => {
      expect(router.state.location.search).toBe('?page=2')
    })
    expect(await screen.findByText('Página 2 de 3')).toBeInTheDocument()
  })

  // Server errors are retried twice (1 s, then 2 s) before the page gives up.
  it('shows the error and retries', { timeout: 10_000 }, async () => {
    server.use(http.get(url('/properties'), () => apiError(500, 'INTERNAL_SERVER_ERROR')))
    const { user } = await openPage()

    const retry = await screen.findByRole('button', { name: 'Tentar de novo' }, { timeout: 6000 })
    serveProperties([house])
    await user.click(retry)

    expect(await screen.findByText('Casa da Praia')).toBeInTheDocument()
  })

  it('links to the bookings of a property', async () => {
    serveProperties([house])
    const { user, router } = await openPage()

    await openActions(user, house.name, 'Ver reservas')

    await waitFor(() => {
      expect(router.state.location.pathname).toBe('/reservas')
    })
    expect(router.state.location.search).toBe(`?imovel=${house.id}`)
  })
})

describe('creating a property', () => {
  it('fills the address from the CEP and sends only what was filled', async () => {
    serveProperties([])
    server.use(
      http.get(`${VIACEP_URL}/88053700/json/`, () =>
        HttpResponse.json({
          uf: 'SC',
          localidade: 'Florianópolis',
          bairro: 'Jurerê',
          logradouro: 'Avenida dos Búzios',
        }),
      ),
    )
    let body: unknown
    server.use(
      http.post(url('/properties'), async ({ request }) => {
        body = await request.json()
        return HttpResponse.json(house, { status: 201 })
      }),
    )
    const { user } = await openPage()

    await user.click(nth(await screen.findAllByRole('button', { name: 'Novo imóvel' }), 0))
    const sheet = await screen.findByRole('dialog', { name: 'Novo imóvel' })
    await user.type(within(sheet).getByLabelText('Nome'), 'Casa da Praia')
    await user.type(within(sheet).getByLabelText('CEP'), '88053700')

    await waitFor(() => {
      expect(within(sheet).getByLabelText('Rua')).toHaveValue('Avenida dos Búzios')
    })
    expect(within(sheet).getByLabelText('CEP')).toHaveValue('88053-700')
    expect(within(sheet).getByLabelText('Cidade')).toHaveValue('Florianópolis')
    expect(within(sheet).getByLabelText('UF')).toHaveValue('SC')
    await user.type(within(sheet).getByLabelText('Número'), '100')
    serveProperties([house])
    await user.click(within(sheet).getByRole('button', { name: 'Cadastrar imóvel' }))

    expect(await screen.findByText('Imóvel cadastrado.')).toBeInTheDocument()
    expect(body).toEqual({
      name: 'Casa da Praia',
      type: 'HOUSE',
      zipCode: '88053700',
      state: 'SC',
      city: 'Florianópolis',
      neighborhood: 'Jurerê',
      street: 'Avenida dos Búzios',
      number: '100',
      complement: null,
      building: null,
      block: null,
      unit: null,
    })
    await waitFor(() => {
      expect(screen.queryByRole('dialog')).not.toBeInTheDocument()
    })
    expect(await screen.findByText('Casa da Praia')).toBeInTheDocument()
  })

  it.each([
    [
      'not found',
      () => HttpResponse.json({ erro: 'true' }),
      'CEP não encontrado. Preencha o endereço à mão.',
    ],
    ['down', () => new HttpResponse(null, { status: 503 }), /não foi possível buscar o cep/i],
  ])('lets the address be typed by hand when the CEP is %s', async (_case, reply, hint) => {
    serveProperties([])
    server.use(http.get(`${VIACEP_URL}/99999999/json/`, reply))
    const { user } = await openPage()

    await user.click(nth(await screen.findAllByRole('button', { name: 'Novo imóvel' }), 0))
    const sheet = await screen.findByRole('dialog')
    await user.type(within(sheet).getByLabelText('CEP'), '99999999')

    expect(await within(sheet).findByText(hint)).toBeInTheDocument()
    expect(within(sheet).getByLabelText('Rua')).toBeEnabled()
  })

  it('asks the apartment details only for an apartment', async () => {
    serveProperties([])
    let body: Record<string, unknown> = {}
    server.use(
      http.post(url('/properties'), async ({ request }) => {
        body = (await request.json()) as Record<string, unknown>
        return HttpResponse.json(apartment, { status: 201 })
      }),
    )
    const { user } = await openPage()

    await user.click(nth(await screen.findAllByRole('button', { name: 'Novo imóvel' }), 0))
    const sheet = await screen.findByRole('dialog')
    expect(within(sheet).queryByLabelText('Unidade')).not.toBeInTheDocument()
    await user.type(within(sheet).getByLabelText('Nome'), 'Apê Centro')
    await user.click(within(sheet).getByRole('radio', { name: 'Apartamento' }))
    await user.type(within(sheet).getByLabelText('Unidade'), '1204')
    await user.click(within(sheet).getByRole('button', { name: 'Cadastrar imóvel' }))

    await waitFor(() => {
      expect(body).toMatchObject({ type: 'APARTMENT', unit: '1204' })
    })
  })

  it('validates before sending', async () => {
    serveProperties([])
    let posted = false
    server.use(
      http.post(url('/properties'), () => {
        posted = true
        return HttpResponse.json(house, { status: 201 })
      }),
    )
    const { user } = await openPage()

    await user.click(nth(await screen.findAllByRole('button', { name: 'Novo imóvel' }), 0))
    const sheet = await screen.findByRole('dialog')
    await user.click(within(sheet).getByRole('button', { name: 'Cadastrar imóvel' }))

    expect(await within(sheet).findByText('Dê um nome ao imóvel.')).toBeInTheDocument()
    expect(posted).toBe(false)
  })

  it('puts a field the API rejects on that field', async () => {
    serveProperties([])
    server.use(
      http.post(url('/properties'), () =>
        apiError(400, 'VALIDATION_ERROR', [{ path: 'zipCode', message: 'Invalid' }]),
      ),
    )
    const { user } = await openPage()

    await user.click(nth(await screen.findAllByRole('button', { name: 'Novo imóvel' }), 0))
    const sheet = await screen.findByRole('dialog')
    await user.type(within(sheet).getByLabelText('Nome'), 'Casa da Praia')
    await user.click(within(sheet).getByRole('button', { name: 'Cadastrar imóvel' }))

    expect(await within(sheet).findByLabelText('CEP')).toHaveAccessibleDescription(/CEP inválido/)
  })
})

describe('editing a property', () => {
  it('starts from its values and saves the changes', async () => {
    serveProperties([apartment])
    let body: Record<string, unknown> = {}
    server.use(
      http.patch(url(`/properties/${apartment.id}`), async ({ request }) => {
        body = (await request.json()) as Record<string, unknown>
        return HttpResponse.json({ ...apartment, name: 'Apê Centro 2' })
      }),
    )
    const { user } = await openPage()

    await openActions(user, apartment.name, 'Editar')
    const sheet = await screen.findByRole('dialog', { name: 'Editar imóvel' })
    expect(within(sheet).getByLabelText('Unidade')).toHaveValue('1204')
    expect(within(sheet).getByLabelText('CEP')).toHaveValue('88053-700')
    await user.clear(within(sheet).getByLabelText('Nome'))
    await user.type(within(sheet).getByLabelText('Nome'), 'Apê Centro 2')
    await user.click(within(sheet).getByRole('button', { name: 'Salvar' }))

    expect(await screen.findByText('Imóvel atualizado.')).toBeInTheDocument()
    expect(body).toMatchObject({ name: 'Apê Centro 2', unit: '1204', building: 'Mar Azul' })
  })
})

describe('deleting a property', () => {
  it('asks first, then deletes', async () => {
    serveProperties([house])
    let deleted = false
    server.use(
      http.delete(url(`/properties/${house.id}`), () => {
        deleted = true
        return new HttpResponse(null, { status: 204 })
      }),
    )
    const { user } = await openPage()

    await openActions(user, house.name, 'Excluir')
    const dialog = await screen.findByRole('alertdialog', { name: 'Excluir imóvel?' })
    expect(deleted).toBe(false)
    serveProperties([])
    await user.click(within(dialog).getByRole('button', { name: 'Excluir' }))

    expect(await screen.findByText('"Casa da Praia" foi excluído.')).toBeInTheDocument()
    expect(deleted).toBe(true)
    expect(await screen.findByText('Nenhum imóvel ainda')).toBeInTheDocument()
  })

  it('does nothing when cancelled', async () => {
    serveProperties([house])
    const { user } = await openPage()

    await openActions(user, house.name, 'Excluir')
    await user.click(await screen.findByRole('button', { name: 'Cancelar' }))

    await waitFor(() => {
      expect(screen.queryByRole('alertdialog')).not.toBeInTheDocument()
    })
    expect(screen.getByText('Casa da Praia')).toBeInTheDocument()
  })

  it('explains that a property with bookings cannot be deleted', async () => {
    serveProperties([house])
    server.use(
      http.delete(url(`/properties/${house.id}`), () => apiError(409, 'PROPERTY_HAS_BOOKINGS')),
    )
    const { user } = await openPage()

    await openActions(user, house.name, 'Excluir')
    await user.click(
      within(await screen.findByRole('alertdialog')).getByRole('button', { name: 'Excluir' }),
    )

    expect(
      await screen.findByText(
        '"Casa da Praia" tem reservas. Exclua as reservas dele antes de excluir o imóvel.',
      ),
    ).toBeInTheDocument()
  })
})

describe('review regressions', () => {
  it('goes back to the last page when the current one ends up empty', async () => {
    server.use(
      http.get(url('/properties'), ({ request }) => {
        const page = new URL(request.url).searchParams.get('page')
        return HttpResponse.json(
          page === '2'
            ? { items: [], total: 20, page: 2, pageSize: 20 }
            : { items: [house], total: 20, page: 1, pageSize: 20 },
        )
      }),
    )
    const { router } = await openPage('/imoveis?page=2')

    expect(await screen.findByText('Casa da Praia')).toBeInTheDocument()
    expect(router.state.location.search).toBe('')
  })

  it('shows the search of the URL when it changes from outside', async () => {
    serveProperties([house])
    const { router } = await openPage('/imoveis?q=casa')
    expect(await screen.findByRole('searchbox')).toHaveValue('casa')

    await router.navigate('/imoveis')

    await waitFor(() => {
      expect(screen.getByRole('searchbox')).toHaveValue('')
    })
    // and it stays cleared: the old text is not written back after the debounce
    await new Promise((resolve) => setTimeout(resolve, 400))
    expect(router.state.location.search).toBe('')
  })

  it('keeps the street when the CEP covers a whole city', async () => {
    serveProperties([house])
    server.use(
      http.get(`${VIACEP_URL}/88330000/json/`, () =>
        HttpResponse.json({
          uf: 'SC',
          localidade: 'Balneário Camboriú',
          bairro: '',
          logradouro: '',
        }),
      ),
    )
    const { user } = await openPage()

    await openActions(user, house.name, 'Editar')
    const sheet = await screen.findByRole('dialog', { name: 'Editar imóvel' })
    const cep = within(sheet).getByLabelText('CEP')
    await user.clear(cep)
    await user.type(cep, '88330000')

    await waitFor(() => {
      expect(within(sheet).getByLabelText('Cidade')).toHaveValue('Balneário Camboriú')
    })
    expect(within(sheet).getByLabelText('Rua')).toHaveValue('Avenida dos Búzios')
    expect(within(sheet).getByLabelText('Bairro')).toHaveValue('Jurerê')
  })

  it('does not look the CEP up again when typing past its end', async () => {
    serveProperties([])
    let lookups = 0
    server.use(
      http.get(`${VIACEP_URL}/88053700/json/`, () => {
        lookups++
        return HttpResponse.json({
          uf: 'SC',
          localidade: 'Florianópolis',
          bairro: 'Jurerê',
          logradouro: 'Rua A',
        })
      }),
    )
    const { user } = await openPage()

    await user.click(nth(await screen.findAllByRole('button', { name: 'Novo imóvel' }), 0))
    const sheet = await screen.findByRole('dialog')
    await user.type(within(sheet).getByLabelText('CEP'), '88053700')
    await waitFor(() => {
      expect(within(sheet).getByLabelText('Rua')).toHaveValue('Rua A')
    })
    await user.type(within(sheet).getByLabelText('CEP'), '9')

    expect(within(sheet).getByLabelText('CEP')).toHaveValue('88053-700')
    expect(lookups).toBe(1)
  })
})
