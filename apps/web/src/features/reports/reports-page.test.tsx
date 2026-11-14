import { fireEvent, screen, within } from '@testing-library/react'
import userEvent from '@testing-library/user-event'
import { http, HttpResponse } from 'msw'

vi.mock('@/features/bookings/export-csv', async (original) => ({
  ...(await original<object>()),
  downloadFile: vi.fn(),
}))

import { routes } from '@/test/app-routes'
import { renderRoute } from '@/test/render'
import { loggedInHandlers, server, url } from '@/test/server'

import { downloadFile } from '@/features/bookings/export-csv'

import type { PerformanceReport, ReportFigures } from './api'
import { performanceCsv } from './report-csv'

function figures(overrides: Partial<ReportFigures> = {}): ReportFigures {
  return {
    nightsAvailable: 31,
    nightsSold: 0,
    occupancyBps: 0,
    lodging: 0,
    cleaning: 0,
    revenue: 0,
    brokerFees: 0,
    net: 0,
    averageDailyRate: null,
    revpar: 0,
    bookings: 0,
    averageStay: null,
    ...overrides,
  }
}

const casa = figures({
  nightsSold: 20,
  occupancyBps: 6_452,
  lodging: 400_000,
  cleaning: 30_000,
  revenue: 430_000,
  brokerFees: 40_000,
  net: 390_000,
  averageDailyRate: 20_000,
  revpar: 12_903,
  bookings: 4,
  averageStay: 5,
})

function report(from: string, to: string, total: Partial<ReportFigures> = {}): PerformanceReport {
  return {
    from,
    to,
    days: 31,
    properties: [
      { id: '018f0000-0000-7000-8000-0000000000a1', name: 'Casa da Praia', ...casa },
      { id: '018f0000-0000-7000-8000-0000000000a2', name: 'Apartamento Centro', ...figures() },
    ],
    total: figures({ ...casa, nightsAvailable: 62, occupancyBps: 3_226, revpar: 6_452, ...total }),
  }
}

function serve(reports: (from: string, to: string) => PerformanceReport) {
  const asked: string[] = []
  server.use(...loggedInHandlers)
  server.use(
    http.get(url('/reports/performance'), ({ request }) => {
      const query = new URL(request.url).searchParams
      const from = query.get('from') ?? ''
      const to = query.get('to') ?? ''
      asked.push(`${from}/${to}`)
      return HttpResponse.json(reports(from, to))
    }),
  )
  return asked
}

describe('reports page', () => {
  it('shows the totals with their changes and every property', async () => {
    serve((from, to) =>
      from === '2026-12-01'
        ? report(from, to)
        : from === '2026-11-01'
          ? report(from, to, { revenue: 344_000, occupancyBps: 2_226 })
          : report(from, to, { revenue: 430_000, net: 0 }),
    )
    renderRoute(routes, '/relatorios?inicio=2026-12-01')

    const totals = await screen.findByRole(
      'region',
      { name: 'Todos os imóveis' },
      { timeout: 5000 },
    )
    expect(screen.getByRole('heading', { level: 2, name: 'dezembro de 2026' })).toBeInTheDocument()
    expect(totals).toHaveTextContent('20 de 62 noites vendidas, 4 reservas com entrada no período.')
    expect(await within(totals).findByText('+25% vs. período anterior')).toBeInTheDocument()
    expect(within(totals).getByText('+10 p.p. vs. período anterior')).toBeInTheDocument()
    expect(within(totals).getByText('novo vs. ano passado')).toBeInTheDocument()

    const table = screen.getByRole('table', { name: 'Desempenho por imóvel' })
    const rows = within(table).getAllByRole('row')
    expect(rows[1]).toHaveTextContent('Casa da Praia64,5%20 de 314')
    expect(rows[1]).toHaveTextContent('R$ 4.300,00')
    expect(rows[2]).toHaveTextContent('Apartamento Centro0%0 de 310–')
    expect(rows[3]).toHaveTextContent('Total')
  })

  it('moves between periods and asks for the comparisons', async () => {
    const asked = serve(report)
    const user = userEvent.setup()
    const { router } = renderRoute(routes, '/relatorios?inicio=2026-12-01')
    await screen.findByRole('region', { name: 'Todos os imóveis' }, { timeout: 5000 })

    await user.click(screen.getByRole('radio', { name: 'Trimestre' }))
    expect(
      await screen.findByRole('heading', { level: 2, name: '4º trimestre de 2026' }),
    ).toBeInTheDocument()
    await user.click(screen.getByRole('button', { name: 'Período anterior' }))

    expect(
      await screen.findByRole('heading', { level: 2, name: '3º trimestre de 2026' }),
    ).toBeInTheDocument()
    expect(router.state.location.search).toBe('?periodo=trimestre&inicio=2026-07-01')
    expect(asked).toEqual(
      expect.arrayContaining([
        '2026-07-01/2026-10-01',
        '2026-04-01/2026-07-01',
        '2025-07-01/2025-10-01',
      ]),
    )
  })

  it('takes a custom period', async () => {
    const asked = serve(report)
    const user = userEvent.setup()
    renderRoute(routes, '/relatorios?inicio=2026-12-01')
    await screen.findByRole('region', { name: 'Todos os imóveis' }, { timeout: 5000 })

    await user.click(screen.getByRole('radio', { name: 'Personalizado' }))
    const end = await screen.findByLabelText('Até')
    // A date field takes the whole date at once, as a browser's date picker sets it.
    fireEvent.change(end, { target: { value: '2026-12-10' } })

    await vi.waitFor(() => {
      expect(asked).toContain('2026-12-01/2026-12-11')
    })
    expect(asked).toContain('2026-11-21/2026-12-01')
  })

  it('exports the report as a spreadsheet', async () => {
    serve(report)
    const user = userEvent.setup()
    renderRoute(routes, '/relatorios?inicio=2026-12-01')
    await screen.findByRole('region', { name: 'Todos os imóveis' }, { timeout: 5000 })

    await user.click(screen.getByRole('button', { name: 'Exportar planilha' }))

    expect(downloadFile).toHaveBeenCalledWith(
      'hostly-desempenho-2026-12-01-a-2026-12-31.csv',
      performanceCsv(report('2026-12-01', '2027-01-01')),
    )
  })

  it('invites to add a property when there is none', async () => {
    serve((from, to) => ({ ...report(from, to), properties: [] }))
    renderRoute(routes, '/relatorios')

    expect(
      await screen.findByRole('link', { name: 'Cadastrar imóvel' }, { timeout: 5000 }),
    ).toHaveAttribute('href', '/imoveis')
  })

  it('is a tab of the app', async () => {
    serve(report)
    renderRoute(routes, '/reservas')

    expect(
      (await screen.findAllByRole('link', { name: 'Relatórios' }, { timeout: 5000 }))[0],
    ).toHaveAttribute('href', '/relatorios')
  })
})

describe('performanceCsv', () => {
  it('writes one line per property and the total, Brazilian style', () => {
    const lines = performanceCsv(report('2026-12-01', '2027-01-01')).split('\r\n')

    expect(lines[0]).toBe(
      '﻿Imóvel;Ocupação (%);Noites vendidas;Noites disponíveis;Reservas;Estadia média;Hospedagem;Limpeza;Receita;Comissões;Líquido;Diária média;RevPAR',
    )
    expect(lines[1]).toBe(
      'Casa da Praia;64,52;20;31;4;5;4000,00;300,00;4300,00;400,00;3900,00;200,00;129,03',
    )
    expect(lines[2]).toBe('Apartamento Centro;0,00;0;31;0;;0,00;0,00;0,00;0,00;0,00;;0,00')
    expect(lines[3]).toMatch(/^Total;32,26;20;62;/)
  })
})
