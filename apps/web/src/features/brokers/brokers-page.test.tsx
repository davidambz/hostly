import { screen, waitFor, within } from '@testing-library/react'
import userEvent from '@testing-library/user-event'
import { http, HttpResponse } from 'msw'
import { beforeEach, describe, expect, it } from 'vitest'

import { routes } from '@/test/app-routes'
import { nth } from '@/test/nth'
import { renderRoute } from '@/test/render'
import { apiError, loggedInHandlers, server, url } from '@/test/server'

import type { Broker } from './api'

function makeBroker(overrides: Partial<Broker> = {}): Broker {
  return {
    id: '018f0000-0000-7000-8000-0000000000b1',
    type: 'INDIVIDUAL',
    name: 'Maria Corretora',
    email: 'maria@corretora.com',
    document: '52998224725',
    mobilePhone: '48999990000',
    landlinePhone: null,
    createdAt: '2026-10-31T12:00:00.000Z',
    updatedAt: '2026-10-31T12:00:00.000Z',
    ...overrides,
  }
}

const person = makeBroker()
const company = makeBroker({
  id: '018f0000-0000-7000-8000-0000000000b2',
  type: 'COMPANY',
  name: 'Imobiliária Litoral',
  email: null,
  document: '12ABC34501DE35',
  mobilePhone: null,
  landlinePhone: '4833334444',
})

/** Serves `items` from GET /brokers, recording each query string. */
function serveBrokers(items: Broker[], total = items.length) {
  const queries: URLSearchParams[] = []
  server.use(
    http.get(url('/brokers'), ({ request }) => {
      queries.push(new URL(request.url).searchParams)
      return HttpResponse.json({ items, total, page: 1, pageSize: 20 })
    }),
  )
  return queries
}

/** Records the JSON body of `method path` and answers with `reply`. */
function captureBody(method: 'post' | 'patch', path: string, reply: Broker) {
  const sent: { body?: unknown } = {}
  server.use(
    http[method](url(path), async ({ request }) => {
      sent.body = await request.json()
      return HttpResponse.json(reply, { status: method === 'post' ? 201 : 200 })
    }),
  )
  return sent
}

async function openPage(path = '/intermediadores') {
  const user = userEvent.setup()
  const view = renderRoute(routes, path)
  await screen.findByRole('heading', { name: 'Intermediadores', level: 1 })
  return { user, ...view }
}

async function openNew(user: ReturnType<typeof userEvent.setup>) {
  await user.click(nth(await screen.findAllByRole('button', { name: 'Novo intermediador' }), 0))
  return screen.findByRole('dialog', { name: 'Novo intermediador' })
}

async function openActions(user: ReturnType<typeof userEvent.setup>, name: string, action: string) {
  await user.click(await screen.findByRole('button', { name: `Ações de ${name}` }))
  await user.click(await screen.findByRole('menuitem', { name: action }))
}

beforeEach(() => {
  server.use(...loggedInHandlers)
})

describe('brokers list', () => {
  it('lists the brokers with type, masked document and contact', async () => {
    serveBrokers([person, company])
    await openPage()

    const rows = within(await screen.findByRole('table', { name: 'Intermediadores' })).getAllByRole(
      'row',
    )
    expect(rows).toHaveLength(3)
    const [personRow, companyRow] = [nth(rows, 1), nth(rows, 2)]
    expect(within(personRow).getByText('PF')).toHaveAttribute('title', 'Pessoa física')
    expect(within(personRow).getByText('529.982.247-25')).toBeInTheDocument()
    expect(within(personRow).getByText('maria@corretora.com')).toBeInTheDocument()
    expect(within(personRow).getByText('(48) 99999-0000')).toBeInTheDocument()
    expect(within(companyRow).getByText('PJ')).toBeInTheDocument()
    expect(within(companyRow).getByText('12.ABC.345/01DE-35')).toBeInTheDocument()
    expect(within(companyRow).getByText('(48) 3333-4444')).toBeInTheDocument()
  })

  it('invites to create the first one when there are none', async () => {
    serveBrokers([])
    await openPage()

    expect(await screen.findByText('Nenhum intermediador ainda')).toBeInTheDocument()
    expect(screen.queryByRole('searchbox')).not.toBeInTheDocument()
  })

  it('searches by name through the URL', async () => {
    serveBrokers([person])
    const { user, router } = await openPage()
    await screen.findByText('Maria Corretora')

    const queries = serveBrokers([], 0)
    await user.type(screen.getByRole('searchbox', { name: 'Buscar intermediador' }), 'joão')

    expect(await screen.findByText('Nenhum intermediador com "joão" no nome.')).toBeInTheDocument()
    expect(router.state.location.search).toBe('?q=jo%C3%A3o')
    expect(nth(queries, 0).get('search')).toBe('joão')
  })

  it('keeps the search box while clearing a search that found nothing', async () => {
    serveBrokers([], 0)
    const { user } = await openPage('/intermediadores?q=zzz')
    await screen.findByText('Nada encontrado')

    let release: () => void = () => undefined
    const gate = new Promise<void>((resolve) => {
      release = resolve
    })
    server.use(
      http.get(url('/brokers'), async () => {
        await gate
        return HttpResponse.json({ items: [person], total: 1, page: 1, pageSize: 20 })
      }),
    )
    await user.click(screen.getByRole('button', { name: 'Limpar busca' }))

    expect(screen.getByRole('searchbox')).toBeInTheDocument()
    expect(screen.queryByText('Nenhum intermediador ainda')).not.toBeInTheDocument()
    release()
    expect(await screen.findByText('Maria Corretora')).toBeInTheDocument()
  })

  it('reads the page from the URL and pages', async () => {
    const queries = serveBrokers([person], 45)
    const { user, router } = await openPage('/intermediadores?page=2')

    expect(await screen.findByText('Página 2 de 3')).toBeInTheDocument()
    expect(nth(queries, 0).get('page')).toBe('2')
    await user.click(screen.getByRole('button', { name: 'Próxima' }))
    await waitFor(() => {
      expect(router.state.location.search).toBe('?page=3')
    })
  })

  it('goes back to the last page when the current one ends up empty', async () => {
    server.use(
      http.get(url('/brokers'), ({ request }) =>
        HttpResponse.json(
          new URL(request.url).searchParams.get('page') === '3'
            ? { items: [], total: 40, page: 3, pageSize: 20 }
            : { items: [person], total: 40, page: 2, pageSize: 20 },
        ),
      ),
    )
    const { router } = await openPage('/intermediadores?page=3')

    expect(await screen.findByText('Maria Corretora')).toBeInTheDocument()
    expect(router.state.location.search).toBe('?page=2')
  })

  it('shows a client error without retrying', async () => {
    let calls = 0
    server.use(
      http.get(url('/brokers'), () => {
        calls++
        return apiError(400, 'VALIDATION_ERROR')
      }),
    )
    await openPage()

    expect(
      await screen.findByText('Não foi possível concluir. Confira os dados e tente de novo.'),
    ).toBeInTheDocument()
    expect(calls).toBe(1)
  })
})

describe('creating a broker', () => {
  it('creates a person with a masked CPF and phones', async () => {
    serveBrokers([])
    const sent = captureBody('post', '/brokers', person)
    const { user } = await openPage()

    const sheet = await openNew(user)
    await user.type(within(sheet).getByLabelText('Nome'), 'Maria Corretora')
    await user.type(within(sheet).getByLabelText('CPF'), '52998224725')
    expect(within(sheet).getByLabelText('CPF')).toHaveValue('529.982.247-25')
    await user.type(within(sheet).getByLabelText('E-mail'), 'Maria@Corretora.com')
    await user.type(within(sheet).getByLabelText('Celular'), '48999990000')
    expect(within(sheet).getByLabelText('Celular')).toHaveValue('(48) 99999-0000')
    serveBrokers([person])
    await user.click(within(sheet).getByRole('button', { name: 'Cadastrar intermediador' }))

    expect(await screen.findByText('Intermediador cadastrado.')).toBeInTheDocument()
    expect(sent.body).toEqual({
      type: 'INDIVIDUAL',
      name: 'Maria Corretora',
      email: 'maria@corretora.com',
      document: '52998224725',
      mobilePhone: '48999990000',
      landlinePhone: null,
    })
    expect(await screen.findByText('Maria Corretora')).toBeInTheDocument()
  })

  it('creates a company with an alphanumeric CNPJ', async () => {
    serveBrokers([])
    const sent = captureBody('post', '/brokers', company)
    const { user } = await openPage()

    const sheet = await openNew(user)
    await user.click(within(sheet).getByRole('radio', { name: 'Pessoa jurídica' }))
    await user.type(within(sheet).getByLabelText('Nome'), 'Imobiliária Litoral')
    await user.type(within(sheet).getByLabelText('CNPJ'), '12abc34501de35')
    expect(within(sheet).getByLabelText('CNPJ')).toHaveValue('12.ABC.345/01DE-35')
    await user.type(within(sheet).getByLabelText('Telefone fixo'), '4833334444')
    await user.click(within(sheet).getByRole('button', { name: 'Cadastrar intermediador' }))

    await waitFor(() => {
      expect(sent.body).toMatchObject({
        type: 'COMPANY',
        document: '12ABC34501DE35',
        landlinePhone: '4833334444',
        mobilePhone: null,
      })
    })
  })

  it('re-masks the document when the type changes', async () => {
    serveBrokers([])
    const { user } = await openPage()

    const sheet = await openNew(user)
    await user.click(within(sheet).getByRole('radio', { name: 'Pessoa jurídica' }))
    await user.type(within(sheet).getByLabelText('CNPJ'), '11222333000181')
    await user.click(within(sheet).getByRole('radio', { name: 'Pessoa física' }))

    expect(within(sheet).getByLabelText('CPF')).toHaveValue('112.223.330-00')
  })

  it('keeps an alphanumeric CNPJ through a switch to person and back', async () => {
    serveBrokers([])
    const { user } = await openPage()

    const sheet = await openNew(user)
    await user.click(within(sheet).getByRole('radio', { name: 'Pessoa jurídica' }))
    await user.type(within(sheet).getByLabelText('CNPJ'), '12abc34501de35')
    await user.click(within(sheet).getByRole('radio', { name: 'Pessoa física' }))
    await user.click(within(sheet).getByRole('radio', { name: 'Pessoa jurídica' }))

    expect(within(sheet).getByLabelText('CNPJ')).toHaveValue('12.ABC.345/01DE-35')
  })

  it('checks the document again after the type changes', async () => {
    serveBrokers([])
    const { user } = await openPage()

    const sheet = await openNew(user)
    await user.type(within(sheet).getByLabelText('Nome'), 'Litoral')
    await user.type(within(sheet).getByLabelText('CPF'), '11111111111')
    await user.click(within(sheet).getByRole('button', { name: 'Cadastrar intermediador' }))
    expect(await within(sheet).findByText('CPF inválido.')).toBeInTheDocument()

    await user.click(within(sheet).getByRole('radio', { name: 'Pessoa jurídica' }))

    expect(await within(sheet).findByText('CNPJ inválido.')).toBeInTheDocument()
    expect(within(sheet).queryByText('CPF inválido.')).not.toBeInTheDocument()
  })

  it('checks the document against the type before sending', async () => {
    serveBrokers([])
    let posted = false
    server.use(
      http.post(url('/brokers'), () => {
        posted = true
        return HttpResponse.json(person, { status: 201 })
      }),
    )
    const { user } = await openPage()

    const sheet = await openNew(user)
    await user.type(within(sheet).getByLabelText('Nome'), 'Maria')
    await user.type(within(sheet).getByLabelText('CPF'), '11111111111')
    await user.type(within(sheet).getByLabelText('Celular'), '4833334444')
    await user.click(within(sheet).getByRole('button', { name: 'Cadastrar intermediador' }))

    expect(await within(sheet).findByText('CPF inválido.')).toBeInTheDocument()
    expect(within(sheet).getByText('Celular inválido.')).toBeInTheDocument()
    expect(posted).toBe(false)
  })

  it('puts the API document error on the document field', async () => {
    serveBrokers([])
    server.use(
      http.post(url('/brokers'), () =>
        apiError(400, 'INVALID_DOCUMENT', { field: 'document', type: 'INDIVIDUAL' }),
      ),
    )
    const { user } = await openPage()

    const sheet = await openNew(user)
    await user.type(within(sheet).getByLabelText('Nome'), 'Maria')
    await user.type(within(sheet).getByLabelText('CPF'), '52998224725')
    await user.click(within(sheet).getByRole('button', { name: 'Cadastrar intermediador' }))

    expect(await within(sheet).findByLabelText('CPF')).toHaveAccessibleDescription(
      'Documento inválido para o tipo escolhido.',
    )
  })
})

describe('editing a broker', () => {
  it('starts from its values and saves the changes', async () => {
    serveBrokers([company])
    const sent = captureBody('patch', `/brokers/${company.id}`, {
      ...company,
      email: 'novo@litoral.com',
    })
    const { user } = await openPage()

    await openActions(user, company.name, 'Editar')
    const sheet = await screen.findByRole('dialog', { name: 'Editar intermediador' })
    expect(within(sheet).getByRole('radio', { name: 'Pessoa jurídica' })).toBeChecked()
    expect(within(sheet).getByLabelText('CNPJ')).toHaveValue('12.ABC.345/01DE-35')
    expect(within(sheet).getByLabelText('Telefone fixo')).toHaveValue('(48) 3333-4444')
    await user.type(within(sheet).getByLabelText('E-mail'), 'novo@litoral.com')
    await user.click(within(sheet).getByRole('button', { name: 'Salvar' }))

    expect(await screen.findByText('Intermediador atualizado.')).toBeInTheDocument()
    expect(sent.body).toMatchObject({ email: 'novo@litoral.com', document: '12ABC34501DE35' })
  })
})

describe('deleting a broker', () => {
  it('asks first, then deletes', async () => {
    serveBrokers([person])
    let deleted = false
    server.use(
      http.delete(url(`/brokers/${person.id}`), () => {
        deleted = true
        return new HttpResponse(null, { status: 204 })
      }),
    )
    const { user } = await openPage()

    await openActions(user, person.name, 'Excluir')
    const dialog = await screen.findByRole('alertdialog', { name: 'Excluir intermediador?' })
    expect(
      within(dialog).getByText('"Maria Corretora" será excluído. Isso não pode ser desfeito.'),
    ).toBeInTheDocument()
    serveBrokers([])
    await user.click(within(dialog).getByRole('button', { name: 'Excluir' }))

    expect(await screen.findByText('"Maria Corretora" foi excluído.')).toBeInTheDocument()
    expect(deleted).toBe(true)
  })

  it('explains that a broker in bookings cannot be deleted', async () => {
    serveBrokers([person])
    server.use(
      http.delete(url(`/brokers/${person.id}`), () => apiError(409, 'BROKER_HAS_BOOKINGS')),
    )
    const { user } = await openPage()

    await openActions(user, person.name, 'Excluir')
    await user.click(
      within(await screen.findByRole('alertdialog')).getByRole('button', { name: 'Excluir' }),
    )

    expect(
      await screen.findByText(
        '"Maria Corretora" está em reservas. Tire-o das reservas antes de excluir.',
      ),
    ).toBeInTheDocument()
    expect(screen.getByText('Maria Corretora')).toBeInTheDocument()
  })
})
