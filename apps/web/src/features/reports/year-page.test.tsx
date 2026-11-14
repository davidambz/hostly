import { fireEvent, screen, within } from '@testing-library/react'
import userEvent from '@testing-library/user-event'
import { http, HttpResponse } from 'msw'

import { routes } from '@/test/app-routes'
import { renderRoute } from '@/test/render'
import { loggedInHandlers, server, url } from '@/test/server'

import type { MonthlyReport, ReportFigures } from './api'
import { niceTicks } from './report-format'
import { seasonHighlights, yearFromSearch } from './year'

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

function monthly(year: number, busy: Record<number, Partial<ReportFigures>> = {}): MonthlyReport {
  return {
    year,
    months: Array.from({ length: 12 }, (_, index) => ({
      month: `${String(year)}-${String(index + 1).padStart(2, '0')}`,
      ...figures(busy[index]),
    })),
    total: figures({ nightsAvailable: 365, nightsSold: 30, revenue: 900_000, net: 800_000 }),
  }
}

const casa = { id: '018f0000-0000-7000-8000-0000000000a1', name: 'Casa da Praia' }

function serve(report: (year: number, propertyId: string | null) => MonthlyReport) {
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
    http.get(url('/reports/monthly'), ({ request }) => {
      const query = new URL(request.url).searchParams
      const year = Number(query.get('year'))
      asked.push(`${String(year)}:${query.get('propertyId') ?? 'all'}`)
      return HttpResponse.json(report(year, query.get('propertyId')))
    }),
  )
  return asked
}

const january = { nightsSold: 25, occupancyBps: 8_065, revenue: 750_000, averageDailyRate: 28_000 }
const july = { nightsSold: 10, occupancyBps: 3_226, revenue: 300_000, averageDailyRate: 30_000 }

describe('year page', () => {
  it('charts the months against last year and lists them', async () => {
    serve((year) =>
      year === 2026
        ? monthly(year, { 0: january, 6: july })
        : monthly(year, { 0: { revenue: 500_000 } }),
    )
    renderRoute(routes, '/relatorios/ano?ano=2026')

    const table = await screen.findByRole('table', { name: 'Mês a mês em 2026' }, { timeout: 5000 })
    expect(screen.getByRole('img', { name: /Receita por mês, 2026/ })).toBeInTheDocument()
    expect(screen.getByRole('img', { name: /Ocupação por mês, 2026/ })).toBeInTheDocument()
    expect(
      screen.getByText('Mês mais cheio: janeiro (80,7%). Maior diária média: julho (R$ 300,00).'),
    ).toBeInTheDocument()
    const rows = within(table).getAllByRole('row')
    const firstMonth = rows[1]
    if (!firstMonth) throw new Error('no January row')
    expect(firstMonth).toHaveTextContent('janeiro25 de 3180,7%R$ 7.500,00R$ 280,00')
    expect(await within(firstMonth).findByText('R$ 5.000,00')).toBeInTheDocument()
    expect(rows[13]).toHaveTextContent('2026')
  })

  it('shows both years of a month on hover', async () => {
    serve((year) => monthly(year, year === 2026 ? { 0: january } : { 0: { revenue: 500_000 } }))
    renderRoute(routes, '/relatorios/ano?ano=2026')
    const chart = await screen.findByRole('img', { name: /Receita por mês/ }, { timeout: 5000 })
    await screen.findByText('R$ 5.000,00')

    const slot = chart.querySelectorAll('rect')[0]
    if (!slot) throw new Error('no month slot')
    fireEvent.mouseEnter(slot)

    const tooltip = await screen.findByRole('status')
    expect(tooltip).toHaveTextContent('janeiro')
    expect(tooltip).toHaveTextContent('2026R$ 7.500,00')
    expect(tooltip).toHaveTextContent('2025R$ 5.000,00')
  })

  it('moves between years and narrows to a property', async () => {
    const asked = serve((year) => monthly(year))
    const user = userEvent.setup()
    const { router } = renderRoute(routes, '/relatorios/ano?ano=2026')
    await screen.findByRole('table', { name: 'Mês a mês em 2026' }, { timeout: 5000 })

    await user.click(screen.getByRole('button', { name: 'Ano anterior' }))
    await screen.findByRole('table', { name: 'Mês a mês em 2025' })
    await user.selectOptions(screen.getByLabelText('Imóvel'), casa.id)

    await vi.waitFor(() => {
      expect(asked).toContain(`2025:${casa.id}`)
    })
    expect(asked).toContain(`2024:${casa.id}`)
    expect(router.state.location.search).toBe(`?ano=2025&imovel=${casa.id}`)
  })

  it('is a tab of the reports', async () => {
    serve((year) => monthly(year))
    const user = userEvent.setup()
    const { router } = renderRoute(routes, '/relatorios/ano?ano=2026')

    await user.click(await screen.findByRole('link', { name: 'Desempenho' }, { timeout: 5000 }))

    expect(router.state.location.pathname).toBe('/relatorios')
  })
})

describe('year helpers', () => {
  it('reads the year from the URL, or this one', () => {
    expect(yearFromSearch(new URLSearchParams('ano=2024'), '2026-12-01')).toBe(2024)
    expect(yearFromSearch(new URLSearchParams('ano=abc'), '2026-12-01')).toBe(2026)
    expect(yearFromSearch(new URLSearchParams(''), '2026-12-01')).toBe(2026)
  })

  it('has no highlights for a year without nights', () => {
    expect(seasonHighlights(monthly(2026))).toBeNull()
  })

  it('picks clean axis ticks', () => {
    expect(niceTicks(0)).toEqual([0, 1])
    expect(niceTicks(330_000)).toEqual([0, 100_000, 200_000, 300_000, 400_000])
    expect(niceTicks(7_400)).toEqual([0, 2_000, 4_000, 6_000, 8_000])
    expect(niceTicks(1_000)).toEqual([0, 500, 1_000])
    expect(niceTicks(45_000)).toEqual([0, 20_000, 40_000, 60_000])
  })
})
