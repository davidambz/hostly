import { screen, within } from '@testing-library/react'
import userEvent from '@testing-library/user-event'
import { http, HttpResponse } from 'msw'

vi.mock('@/lib/download', () => ({ downloadFile: vi.fn() }))

import { routes } from '@/test/app-routes'
import { renderRoute } from '@/test/render'
import { loggedInHandlers, server, url } from '@/test/server'

import { downloadFile } from '@/lib/download'

import type { BrokersReport } from './api'
import { commissionsCsv } from './report-csv'

const casa = { id: '018f0000-0000-7000-8000-0000000000a1', name: 'Casa da Praia' }

const report: BrokersReport = {
  from: '2026-12-01',
  to: '2027-01-01',
  brokers: [
    {
      id: '018f0000-0000-7000-8000-0000000000b1',
      name: 'Imobiliária Mar',
      bookings: 2,
      nights: 7,
      lodging: 120_000,
      averageCommissionBps: 1_083,
      fees: 13_000,
      items: [
        {
          bookingId: '018f0000-0000-7000-8000-0000000000c1',
          guestName: 'Caio',
          propertyName: 'Studio',
          checkIn: '2026-12-05',
          checkOut: '2026-12-07',
          nights: 2,
          lodging: 20_000,
          commissionBps: 1_500,
          fee: 3_000,
        },
        {
          bookingId: '018f0000-0000-7000-8000-0000000000c2',
          guestName: 'Bia; "VIP"',
          propertyName: 'Casa da Praia',
          checkIn: '2026-12-28',
          checkOut: '2027-01-02',
          nights: 5,
          lodging: 100_000,
          commissionBps: 1_000,
          fee: 10_000,
        },
      ],
    },
  ],
  channels: [
    {
      brokerId: '018f0000-0000-7000-8000-0000000000b1',
      name: 'Imobiliária Mar',
      bookings: 2,
      nights: 6,
      revenue: 100_000,
      brokerFees: 11_000,
      net: 89_000,
      shareBps: 6_667,
    },
    {
      brokerId: null,
      name: null,
      bookings: 1,
      nights: 4,
      revenue: 50_000,
      brokerFees: 0,
      net: 50_000,
      shareBps: 3_333,
    },
  ],
}

function serve(answer: BrokersReport = report) {
  const asked: string[] = []
  server.use(...loggedInHandlers)
  server.use(
    http.get(url('/properties'), () =>
      HttpResponse.json({
        items: [{ ...casa, type: 'HOUSE', createdAt: '', updatedAt: '' }],
        total: 1,
        page: 1,
        pageSize: 100,
      }),
    ),
    http.get(url('/reports/brokers'), ({ request }) => {
      asked.push(new URL(request.url).search)
      return HttpResponse.json(answer)
    }),
  )
  return asked
}

describe('commissions and channels page', () => {
  it('lists what to pay each broker, booking by booking', async () => {
    serve()
    renderRoute(routes, '/relatorios/comissoes?inicio=2026-12-01')

    const commissions = await screen.findByRole(
      'region',
      { name: 'Comissões a pagar' },
      { timeout: 5000 },
    )
    expect(commissions).toHaveTextContent('R$ 130,00no total')
    const broker = within(commissions).getByRole('article', { name: 'Imobiliária Mar' })
    expect(broker).toHaveTextContent('2 reservas, 7 noites, comissão média 10,83% · R$ 130,00')
    const rows = within(broker).getAllByRole('row')
    expect(rows[1]).toHaveTextContent('CaioStudio05/12/2026 a 07/12/2026R$ 200,0015%R$ 30,00')
  })

  it('splits the revenue by channel, direct bookings included', async () => {
    serve()
    renderRoute(routes, '/relatorios/comissoes?inicio=2026-12-01')

    const table = await screen.findByRole('table', { name: 'Canais' }, { timeout: 5000 })
    const rows = within(table).getAllByRole('row')
    expect(rows[1]).toHaveTextContent('Imobiliária Mar26R$ 1.000,0066,7%R$ 110,00R$ 890,00')
    expect(rows[2]).toHaveTextContent('Reserva direta')
    expect(rows[3]).toHaveTextContent('Total310R$ 1.500,00')
  })

  it('narrows to a property and exports the commissions', async () => {
    const asked = serve()
    const user = userEvent.setup()
    renderRoute(routes, '/relatorios/comissoes?inicio=2026-12-01')
    await screen.findByRole('region', { name: 'Comissões a pagar' }, { timeout: 5000 })

    await user.selectOptions(screen.getByLabelText('Imóvel'), casa.id)
    await vi.waitFor(() => {
      expect(asked).toContain(`?from=2026-12-01&to=2027-01-01&propertyId=${casa.id}`)
    })
    await user.click(screen.getByRole('button', { name: 'Exportar comissões' }))

    expect(downloadFile).toHaveBeenCalledWith(
      'hostly-comissoes-2026-12-01-a-2026-12-31.csv',
      commissionsCsv(report),
    )
  })

  it('says when no broker brought a booking', async () => {
    serve({ ...report, brokers: [], channels: [] })
    renderRoute(routes, '/relatorios/comissoes')

    expect(
      await screen.findByText('Nenhuma comissão no período', {}, { timeout: 5000 }),
    ).toBeInTheDocument()
    expect(screen.queryByRole('table', { name: 'Canais' })).not.toBeInTheDocument()
    expect(screen.getByRole('button', { name: 'Exportar comissões' })).toBeDisabled()
  })
})

describe('commissionsCsv', () => {
  it('writes one line per booking, quoting what needs it', () => {
    const lines = commissionsCsv(report).split('\r\n')

    expect(lines[0]).toBe(
      '﻿Intermediador;Hóspede;Imóvel;Entrada;Saída;Noites;Hospedagem;Comissão (%);Comissão',
    )
    expect(lines[1]).toBe('Imobiliária Mar;Caio;Studio;05/12/2026;07/12/2026;2;200,00;15,00;30,00')
    expect(lines[2]).toBe(
      'Imobiliária Mar;"Bia; ""VIP""";Casa da Praia;28/12/2026;02/01/2027;5;1000,00;10,00;100,00',
    )
  })
})
