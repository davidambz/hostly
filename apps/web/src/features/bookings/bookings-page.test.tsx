import { screen, waitFor, within } from '@testing-library/react'
import userEvent from '@testing-library/user-event'
import { http, HttpResponse } from 'msw'
import { afterEach, beforeEach, describe, expect, it, vi } from 'vitest'

import { routes } from '@/app/routes'
import { nth } from '@/test/nth'
import { renderRoute } from '@/test/render'
import { apiError, loggedInHandlers, server, url } from '@/test/server'

import type { Booking } from './api'

const casa = { id: '018f0000-0000-7000-8000-0000000000a1', name: 'Casa da Praia' }
const ape = { id: '018f0000-0000-7000-8000-0000000000a2', name: 'Apê Centro' }
const carlos = { id: '018f0000-0000-7000-8000-0000000000b1', name: 'Carlos Lima' }

function property(ref: { id: string; name: string }) {
  return {
    ...ref,
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
    createdAt: '2026-10-31T12:00:00.000Z',
    updatedAt: '2026-10-31T12:00:00.000Z',
  }
}

function makeBooking(overrides: Partial<Booking> = {}): Booking {
  return {
    id: '018f0000-0000-7000-8000-0000000000c1',
    property: casa,
    broker: null,
    guestName: 'Rafael Mendes',
    checkIn: '2026-11-10',
    checkOut: '2026-11-13',
    nights: 3,
    nightlyRate: 45000,
    cleaningFee: 15000,
    discount: 0,
    amountPaid: 50000,
    brokerCommissionBps: 0,
    financials: {
      grossLodging: 135000,
      lodging: 135000,
      total: 150000,
      brokerFee: 0,
      net: 150000,
      balanceDue: 100000,
    },
    createdAt: '2026-10-31T12:00:00.000Z',
    updatedAt: '2026-10-31T12:00:00.000Z',
    ...overrides,
  }
}

const rafael = makeBooking()
const pedro = makeBooking({
  id: '018f0000-0000-7000-8000-0000000000c2',
  property: ape,
  broker: carlos,
  guestName: 'Pedro Alves',
  checkIn: '2026-11-20',
  checkOut: '2026-11-24',
  nights: 4,
  brokerCommissionBps: 1000,
  financials: {
    grossLodging: 180000,
    lodging: 180000,
    total: 195000,
    brokerFee: 18000,
    net: 177000,
    balanceDue: 0,
  },
})

/** Serves the properties and brokers, and `bookings` for the calendar (recording queries). */
function serve({
  properties = [casa, ape],
  bookings = [rafael, pedro],
}: { properties?: { id: string; name: string }[]; bookings?: Booking[] } = {}) {
  const calendarQueries: URLSearchParams[] = []
  server.use(
    http.get(url('/properties'), () =>
      HttpResponse.json({
        items: properties.map(property),
        total: properties.length,
        page: 1,
        pageSize: 100,
      }),
    ),
    http.get(url('/brokers'), () =>
      HttpResponse.json({
        items: [
          {
            ...carlos,
            type: 'INDIVIDUAL',
            email: null,
            document: null,
            mobilePhone: null,
            landlinePhone: null,
            createdAt: '2026-10-31T12:00:00.000Z',
            updatedAt: '2026-10-31T12:00:00.000Z',
          },
        ],
        total: 1,
        page: 1,
        pageSize: 100,
      }),
    ),
    http.get(url('/bookings/calendar'), ({ request }) => {
      const query = new URL(request.url).searchParams
      calendarQueries.push(query)
      const propertyId = query.get('propertyId')
      return HttpResponse.json(
        bookings.filter((booking) => !propertyId || booking.property.id === propertyId),
      )
    }),
  )
  return { calendarQueries }
}

/** Answers POST /bookings/quote like the API, recording the bodies. */
function serveQuote() {
  const bodies: Record<string, number | string | null>[] = []
  server.use(
    http.post(url('/bookings/quote'), async ({ request }) => {
      const body = (await request.json()) as Record<string, number>
      bodies.push(body)
      const nights =
        (Date.parse(String(body.checkOut)) - Date.parse(String(body.checkIn))) / 86_400_000
      const gross = nights * (body.nightlyRate ?? 0)
      const lodging = gross - (body.discount ?? 0)
      const total = lodging + (body.cleaningFee ?? 0)
      const brokerFee = Math.round((lodging * (body.brokerCommissionBps ?? 0)) / 10_000)
      return HttpResponse.json({
        grossLodging: gross,
        lodging,
        total,
        brokerFee,
        net: total - brokerFee,
        balanceDue: total - (body.amountPaid ?? 0),
      })
    }),
  )
  return bodies
}

async function openPage(path = '/reservas?data=2026-11-15') {
  const user = userEvent.setup()
  const view = renderRoute(routes, path)
  // The first render also loads the page's code: give it time.
  await screen.findByRole('heading', { name: 'Reservas', level: 1 }, { timeout: 5000 })
  return { user, ...view }
}

const day = (date: string) =>
  screen.findByRole('button', { name: `Nova reserva com entrada em ${date}` })

beforeEach(() => {
  server.use(...loggedInHandlers)
})

afterEach(() => {
  vi.useRealTimers()
})

describe('calendar', () => {
  it('shows the stays of the month as bars, colored by property', async () => {
    const { calendarQueries } = serve()
    await openPage()

    expect(await screen.findByRole('heading', { name: 'novembro de 2026' })).toBeInTheDocument()
    const bar = await screen.findByRole('button', {
      name: 'Rafael Mendes, Casa da Praia, 10 – 13 nov 2026',
    })
    expect(bar).toHaveClass('bg-sky-600')
    // Nov 20–24 crosses a week: a bar in each
    const pedroBars = screen.getAllByRole('button', {
      name: 'Pedro Alves, Apê Centro, 20 – 24 nov 2026',
    })
    expect(pedroBars).toHaveLength(2)
    expect(nth(pedroBars, 0)).toHaveClass('bg-emerald-600', 'rounded-r-none')
    expect(nth(pedroBars, 1)).toHaveClass('rounded-l-none')
    // the whole grid: Nov 1 (a Sunday) to Dec 5, one request
    expect(Object.fromEntries(nth(calendarQueries, 0))).toEqual({
      from: '2026-11-01',
      to: '2026-12-06',
    })
    const legend = screen.getByRole('list', { name: 'Cores dos imóveis' })
    expect(
      within(legend)
        .getAllByRole('listitem')
        .map((item) => item.textContent),
    ).toEqual(['Casa da Praia', 'Apê Centro'])
  })

  it('moves between months and back to today through the URL', async () => {
    const { calendarQueries } = serve()
    const { user, router } = await openPage()
    await screen.findByRole('heading', { name: 'novembro de 2026' })

    await user.click(screen.getByRole('button', { name: 'Próximo mês' }))

    expect(await screen.findByRole('heading', { name: 'dezembro de 2026' })).toBeInTheDocument()
    expect(router.state.location.search).toBe('?data=2026-12-15')
    await waitFor(() => {
      expect(nth(calendarQueries, calendarQueries.length - 1).get('from')).toBe('2026-11-29')
    })
    await user.click(screen.getByRole('button', { name: 'Mês anterior' }))
    await user.click(screen.getByRole('button', { name: 'Mês anterior' }))
    expect(await screen.findByRole('heading', { name: 'outubro de 2026' })).toBeInTheDocument()
    await user.click(screen.getByRole('button', { name: 'Hoje' }))
    expect(router.state.location.search).toBe('')
  })

  it('shows a week with the property names, and pages by week', async () => {
    serve()
    const { user, router } = await openPage('/reservas?data=2026-11-11')

    await user.click(await screen.findByRole('radio', { name: 'Semana' }))

    expect(await screen.findByRole('heading', { name: '8 – 14 nov 2026' })).toBeInTheDocument()
    expect(router.state.location.search).toBe('?data=2026-11-11&visao=semana')
    expect(await screen.findByText('· Casa da Praia')).toBeInTheDocument()
    expect(screen.queryByText(/Pedro Alves/)).not.toBeInTheDocument()
    await user.click(screen.getByRole('button', { name: 'Próxima semana' }))
    expect(await screen.findByRole('heading', { name: '15 – 21 nov 2026' })).toBeInTheDocument()
  })

  it('sends a full day to the week view with "+N"', async () => {
    const crowd = ['A', 'B', 'C', 'D'].map((name, index) =>
      makeBooking({
        id: `018f0000-0000-7000-8000-00000000010${index}`,
        guestName: name,
        property: index % 2 ? ape : casa,
        checkIn: '2026-11-03',
        checkOut: '2026-11-04',
      }),
    )
    serve({ bookings: crowd })
    const { user } = await openPage()

    await user.click(await screen.findByRole('button', { name: '+1 reserva' }))

    expect(await screen.findByRole('heading', { name: '1 – 7 nov 2026' })).toBeInTheDocument()
    expect(screen.getAllByRole('button', { name: /^[ABCD], / })).toHaveLength(4)
  })

  it('filters by property through the URL, and hides the legend', async () => {
    const { calendarQueries } = serve()
    const { user, router } = await openPage()
    await screen.findByText('Rafael Mendes')

    await user.selectOptions(screen.getByLabelText('Imóvel'), 'Apê Centro')

    await waitFor(() => {
      expect(screen.queryByText('Rafael Mendes')).not.toBeInTheDocument()
    })
    // Nov 20–24 crosses a week: a bar in each
    expect(screen.getAllByText('Pedro Alves')).toHaveLength(2)
    expect(router.state.location.search).toContain(`imovel=${ape.id}`)
    expect(nth(calendarQueries, calendarQueries.length - 1).get('propertyId')).toBe(ape.id)
    expect(screen.queryByRole('list', { name: 'Cores dos imóveis' })).not.toBeInTheDocument()
  })

  it('ignores a filter for a property that is not there', async () => {
    const { calendarQueries } = serve()
    await openPage('/reservas?data=2026-11-15&imovel=nope')

    expect(await screen.findByText('Rafael Mendes')).toBeInTheDocument()
    expect(screen.getByLabelText('Imóvel')).toHaveValue('')
    expect(calendarQueries.every((query) => !query.has('propertyId'))).toBe(true)
  })

  it('shows an error and retries', async () => {
    serve()
    server.use(http.get(url('/bookings/calendar'), () => apiError(400, 'VALIDATION_ERROR')))
    const { user } = await openPage()

    const retry = await screen.findByRole('button', { name: 'Tentar de novo' })
    serve()
    await user.click(retry)

    expect(await screen.findByText('Rafael Mendes')).toBeInTheDocument()
  })

  it('sends to the properties first when there are none', async () => {
    serve({ properties: [], bookings: [] })
    await openPage()

    expect(await screen.findByText('Cadastre um imóvel primeiro')).toBeInTheDocument()
    expect(screen.getByRole('link', { name: 'Ir para imóveis' })).toHaveAttribute(
      'href',
      '/imoveis',
    )
    expect(screen.getByRole('button', { name: 'Nova reserva' })).toBeDisabled()
  })
})

describe('picking days on the calendar', () => {
  it('starts a one-night booking from a click on a free day', async () => {
    serve()
    const { user } = await openPage()

    await user.click(await day('5 de novembro de 2026'))

    const sheet = await screen.findByRole('dialog', { name: 'Nova reserva' })
    expect(within(sheet).getByRole('button', { name: /^Datas/ })).toHaveTextContent(
      '5 – 6 nov 2026 · 1 noite',
    )
  })

  it('starts a booking on the days dragged across', async () => {
    serve()
    const { user } = await openPage()

    await user.pointer([
      { keys: '[MouseLeft>]', target: await day('16 de novembro de 2026') },
      { target: await day('17 de novembro de 2026') },
      { target: await day('18 de novembro de 2026') },
      { keys: '[/MouseLeft]' },
    ])

    const sheet = await screen.findByRole('dialog', { name: 'Nova reserva' })
    expect(within(sheet).getByRole('button', { name: /^Datas/ })).toHaveTextContent(
      '16 – 19 nov 2026 · 3 noites',
    )
  })

  it('works backwards too', async () => {
    serve()
    const { user } = await openPage()

    await user.pointer([
      { keys: '[MouseLeft>]', target: await day('18 de novembro de 2026') },
      { target: await day('16 de novembro de 2026') },
      { keys: '[/MouseLeft]' },
    ])

    expect(
      within(await screen.findByRole('dialog')).getByRole('button', { name: /^Datas/ }),
    ).toHaveTextContent('16 – 19 nov 2026')
  })

  it('works from the keyboard', async () => {
    serve()
    const { user } = await openPage()

    ;(await day('5 de novembro de 2026')).focus()
    await user.keyboard('{Enter}')

    expect(await screen.findByRole('dialog', { name: 'Nova reserva' })).toBeInTheDocument()
  })

  it('starts on the property filtered on', async () => {
    serve()
    const { user } = await openPage(`/reservas?data=2026-11-15&imovel=${ape.id}`)

    await user.click(await day('5 de novembro de 2026'))

    expect(within(await screen.findByRole('dialog')).getByLabelText('Imóvel')).toHaveValue(ape.id)
  })
})

describe('creating a booking', () => {
  it('shows the quote as the form is filled, and sends cents and basis points', async () => {
    serve()
    const quotes = serveQuote()
    let body: unknown
    server.use(
      http.post(url('/bookings'), async ({ request }) => {
        body = await request.json()
        return HttpResponse.json(rafael, { status: 201 })
      }),
    )
    const { user } = await openPage()

    await user.click(await day('10 de novembro de 2026'))
    const sheet = await screen.findByRole('dialog', { name: 'Nova reserva' })
    const summary = within(sheet).getByRole('region', { name: 'Resumo financeiro' })
    expect(summary).toHaveTextContent('Escolha as datas e a diária para ver os valores.')

    await user.selectOptions(within(sheet).getByLabelText('Imóvel'), 'Casa da Praia')
    await user.type(within(sheet).getByLabelText('Hóspede'), 'Rafael Mendes')
    await user.type(within(sheet).getByLabelText('Diária'), '45000')
    expect(within(sheet).getByLabelText('Diária')).toHaveValue('R$ 450,00')
    await user.type(within(sheet).getByLabelText('Limpeza'), '15000')
    expect(within(sheet).getByLabelText('Comissão (%)')).toBeDisabled()
    await user.selectOptions(within(sheet).getByLabelText('Intermediador'), 'Carlos Lima')
    await user.type(within(sheet).getByLabelText('Comissão (%)'), '10')
    await user.type(within(sheet).getByLabelText('Valor já pago'), '50000')

    await waitFor(() => {
      expect(summary).toHaveTextContent('Você recebe')
    })
    // 1 night × R$ 450 + R$ 150 cleaning = R$ 600; 10% of R$ 450 to the broker
    await waitFor(() => {
      expect(summary).toHaveTextContent('Você recebeR$ 555,00')
    })
    expect(summary).toHaveTextContent('1 noite × R$ 450,00')
    expect(summary).toHaveTextContent('Comissão (10% das diárias)')
    expect(summary).toHaveTextContent('Falta receber')
    // debounced: far fewer quotes than keystrokes
    expect(quotes.length).toBeLessThan(5)

    await user.click(within(sheet).getByRole('button', { name: 'Criar reserva' }))

    expect(await screen.findByText('Reserva criada.')).toBeInTheDocument()
    expect(body).toEqual({
      propertyId: casa.id,
      brokerId: carlos.id,
      guestName: 'Rafael Mendes',
      checkIn: '2026-11-10',
      checkOut: '2026-11-11',
      nightlyRate: 45000,
      cleaningFee: 15000,
      discount: 0,
      amountPaid: 50000,
      brokerCommissionBps: 1000,
    })
  })

  it('picks the dates on the range picker', async () => {
    // Only Date is faked: the picker opens on this month, timers stay real.
    vi.useFakeTimers({ toFake: ['Date'], now: new Date('2026-11-15T12:00:00-03:00') })
    serve()
    serveQuote()
    const { user } = await openPage('/reservas')

    await user.click(await screen.findByRole('button', { name: 'Nova reserva' }))
    const sheet = await screen.findByRole('dialog', { name: 'Nova reserva' })
    const dates = within(sheet).getByRole('button', { name: /^Datas/ })
    expect(dates).toHaveTextContent('Escolha a entrada e a saída')
    await user.click(dates)
    const picker = await waitFor(() => {
      const element = document.querySelector<HTMLElement>('[data-slot="popover-content"]')
      if (!element) throw new Error('no picker')
      return element
    })
    await user.click(nth(within(picker).getAllByRole('button', { name: /\b10 de novembro/i }), 0))
    await user.click(nth(within(picker).getAllByRole('button', { name: /\b12 de novembro/i }), 0))

    await waitFor(() => {
      expect(dates).toHaveTextContent('10 – 12 nov 2026 · 2 noites')
    })
    // it closes once the range is complete
    expect(document.querySelector('[data-slot="popover-content"]')).toBeNull()
    vi.useRealTimers()
  })

  it('validates before sending', async () => {
    serve()
    let posted = false
    server.use(
      http.post(url('/bookings'), () => {
        posted = true
        return HttpResponse.json(rafael, { status: 201 })
      }),
    )
    const { user } = await openPage()

    await user.click(await screen.findByRole('button', { name: 'Nova reserva' }))
    const sheet = await screen.findByRole('dialog')
    await user.click(within(sheet).getByRole('button', { name: 'Criar reserva' }))

    expect(await within(sheet).findByText('Escolha o imóvel.')).toBeInTheDocument()
    expect(within(sheet).getByText('Informe o hóspede.')).toBeInTheDocument()
    expect(within(sheet).getByText('Escolha as datas de entrada e saída.')).toBeInTheDocument()
    expect(within(sheet).getByText('Informe a diária.')).toBeInTheDocument()
    expect(posted).toBe(false)
  })

  it('puts an overlap on the dates, with the dates of the other booking', async () => {
    serve()
    serveQuote()
    server.use(
      http.post(url('/bookings'), () =>
        apiError(409, 'BOOKING_OVERLAP', {
          conflictingBookingId: rafael.id,
          checkIn: '2026-11-10',
          checkOut: '2026-11-13',
        }),
      ),
    )
    const { user } = await openPage()

    await user.click(await day('11 de novembro de 2026'))
    const sheet = await screen.findByRole('dialog')
    await user.selectOptions(within(sheet).getByLabelText('Imóvel'), 'Casa da Praia')
    await user.type(within(sheet).getByLabelText('Hóspede'), 'Conflito')
    await user.type(within(sheet).getByLabelText('Diária'), '10000')
    await user.click(within(sheet).getByRole('button', { name: 'Criar reserva' }))

    expect(
      await within(sheet).findByRole('button', { name: /^Datas/ }),
    ).toHaveAccessibleDescription('O imóvel já está reservado de 10/11 a 13/11.')
  })

  it('puts a rule the API enforces on its field', async () => {
    serve()
    serveQuote()
    server.use(
      http.post(url('/bookings'), () =>
        apiError(400, 'PAYMENT_EXCEEDS_TOTAL', { field: 'amountPaid' }),
      ),
    )
    const { user } = await openPage()

    await user.click(await day('11 de novembro de 2026'))
    const sheet = await screen.findByRole('dialog')
    await user.selectOptions(within(sheet).getByLabelText('Imóvel'), 'Casa da Praia')
    await user.type(within(sheet).getByLabelText('Hóspede'), 'Ana')
    await user.type(within(sheet).getByLabelText('Diária'), '10000')
    await user.click(within(sheet).getByRole('button', { name: 'Criar reserva' }))

    expect(await within(sheet).findByLabelText('Valor já pago')).toHaveAccessibleDescription(
      'O valor pago passa do total.',
    )
  })

  it('clears the commission when the broker is removed', async () => {
    serve()
    serveQuote()
    const { user } = await openPage()

    await user.click(await day('11 de novembro de 2026'))
    const sheet = await screen.findByRole('dialog')
    await user.selectOptions(within(sheet).getByLabelText('Intermediador'), 'Carlos Lima')
    await user.type(within(sheet).getByLabelText('Comissão (%)'), '12,5')
    await user.selectOptions(within(sheet).getByLabelText('Intermediador'), 'Sem intermediador')

    expect(within(sheet).getByLabelText('Comissão (%)')).toHaveValue('')
    expect(within(sheet).getByLabelText('Comissão (%)')).toBeDisabled()
  })
})

describe('editing and deleting a booking', () => {
  it('opens a stay from the calendar and saves the changes', async () => {
    serve()
    serveQuote()
    let body: Record<string, unknown> = {}
    server.use(
      http.patch(url(`/bookings/${pedro.id}`), async ({ request }) => {
        body = (await request.json()) as Record<string, unknown>
        return HttpResponse.json(pedro)
      }),
    )
    const { user } = await openPage()

    await user.click(nth(await screen.findAllByRole('button', { name: /^Pedro Alves, / }), 0))
    const sheet = await screen.findByRole('dialog', { name: 'Editar reserva' })
    expect(within(sheet).getByLabelText('Diária')).toHaveValue('R$ 450,00')
    expect(within(sheet).getByLabelText('Intermediador')).toHaveValue(carlos.id)
    expect(within(sheet).getByLabelText('Comissão (%)')).toHaveValue('10')
    expect(await within(sheet).findByText('R$ 1.770,00', {}, { timeout: 2000 })).toBeInTheDocument()
    await user.clear(within(sheet).getByLabelText('Hóspede'))
    await user.type(within(sheet).getByLabelText('Hóspede'), 'Pedro A.')
    await user.click(within(sheet).getByRole('button', { name: 'Salvar' }))

    expect(await screen.findByText('Reserva atualizada.')).toBeInTheDocument()
    expect(body).toMatchObject({
      guestName: 'Pedro A.',
      brokerId: carlos.id,
      brokerCommissionBps: 1000,
    })
  })

  it('deletes from the panel, after asking', async () => {
    serve()
    serveQuote()
    let deleted = false
    server.use(
      http.delete(url(`/bookings/${rafael.id}`), () => {
        deleted = true
        return new HttpResponse(null, { status: 204 })
      }),
    )
    const { user } = await openPage()

    await user.click(await screen.findByRole('button', { name: /^Rafael Mendes, / }))
    const sheet = await screen.findByRole('dialog', { name: 'Editar reserva' })
    await user.click(within(sheet).getByRole('button', { name: 'Excluir' }))
    const dialog = await screen.findByRole('alertdialog', { name: 'Excluir reserva?' })
    expect(dialog).toHaveTextContent(
      'A reserva de Rafael Mendes em Casa da Praia (10 – 13 nov 2026) será excluída.',
    )
    await user.click(within(dialog).getByRole('button', { name: 'Excluir' }))

    expect(await screen.findByText('A reserva de Rafael Mendes foi excluída.')).toBeInTheDocument()
    expect(deleted).toBe(true)
  })

  it('says when the booking is already gone', async () => {
    serve()
    server.use(http.delete(url(`/bookings/${rafael.id}`), () => apiError(404, 'BOOKING_NOT_FOUND')))
    const { user } = await openPage('/reservas?modo=lista')

    server.use(
      http.get(url('/bookings'), () =>
        HttpResponse.json({ items: [rafael], total: 1, page: 1, pageSize: 20 }),
      ),
    )
    await user.click(
      await screen.findByRole('button', { name: 'Ações da reserva de Rafael Mendes' }),
    )
    await user.click(await screen.findByRole('menuitem', { name: 'Excluir' }))
    await user.click(
      within(await screen.findByRole('alertdialog')).getByRole('button', { name: 'Excluir' }),
    )

    expect(await screen.findByText('Esta reserva não existe mais.')).toBeInTheDocument()
  })
})

describe('list', () => {
  function serveList(items: Booking[], total = items.length) {
    const queries: URLSearchParams[] = []
    server.use(
      http.get(url('/bookings'), ({ request }) => {
        queries.push(new URL(request.url).searchParams)
        return HttpResponse.json({ items, total, page: 1, pageSize: 20 })
      }),
    )
    return queries
  }

  it('lists the upcoming stays with their money', async () => {
    serve()
    const queries = serveList([rafael, pedro])
    const { user, router } = await openPage('/reservas')

    await user.click(await screen.findByRole('radio', { name: 'Lista' }))

    const table = await screen.findByRole('table', { name: 'Próximas reservas' })
    const rows = within(table).getAllByRole('row')
    expect(rows).toHaveLength(3)
    expect(nth(rows, 1)).toHaveTextContent('Rafael Mendes')
    expect(nth(rows, 1)).toHaveTextContent('10 – 13 nov 2026')
    expect(nth(rows, 1)).toHaveTextContent('3 noites')
    expect(nth(rows, 1)).toHaveTextContent('R$ 1.500,00')
    expect(nth(rows, 1)).toHaveTextContent('R$ 1.000,00')
    expect(nth(rows, 2)).toHaveTextContent('Apê Centro · via Carlos Lima')
    expect(within(nth(rows, 2)).getByText('Quitado')).toBeInTheDocument()
    expect(router.state.location.search).toBe('?modo=lista')
    expect(Object.fromEntries(nth(queries, 0))).toEqual({
      status: 'upcoming',
      page: '1',
      pageSize: '20',
    })
  })

  it('switches to past stays and searches by guest, with the property filter', async () => {
    serve()
    const queries = serveList([rafael])
    const { user, router } = await openPage(`/reservas?modo=lista&imovel=${casa.id}`)
    await screen.findByText('Rafael Mendes')

    await user.click(screen.getByRole('tab', { name: 'Anteriores' }))
    expect(await screen.findByRole('table', { name: 'Reservas anteriores' })).toBeInTheDocument()
    serveList([], 0)
    await user.type(screen.getByRole('searchbox', { name: 'Buscar hóspede' }), 'zé')

    expect(
      await screen.findByText('Nenhuma reserva com "zé" no nome do hóspede.'),
    ).toBeInTheDocument()
    expect(router.state.location.search).toContain('status=anteriores')
    expect(router.state.location.search).toContain('q=z%C3%A9')
    const last = nth(queries, queries.length - 1)
    expect(last.get('status')).toBe('past')
    expect(last.get('propertyId')).toBe(casa.id)
  })

  it('says when there is nothing to show', async () => {
    serve()
    serveList([])
    await openPage('/reservas?modo=lista&status=anteriores')

    expect(await screen.findByText('Nenhuma reserva passada')).toBeInTheDocument()
  })

  it('opens a booking from the guest name', async () => {
    serve()
    serveQuote()
    serveList([rafael])
    const { user } = await openPage('/reservas?modo=lista')

    await user.click(await screen.findByRole('button', { name: 'Rafael Mendes' }))

    expect(await screen.findByRole('dialog', { name: 'Editar reserva' })).toBeInTheDocument()
  })
})
