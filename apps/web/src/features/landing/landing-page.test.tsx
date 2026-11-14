import { screen, within } from '@testing-library/react'
import userEvent from '@testing-library/user-event'
import { http, HttpResponse } from 'msw'
import { afterEach, describe, expect, it } from 'vitest'

import { THEME_STORAGE_KEY } from '@/components/theme/theme-context'
import { renderRoute, renderWithProviders } from '@/test/render'
import { server, url } from '@/test/server'

import { LandingPage, REPOSITORY_URL } from './landing-page'
import { SCREENS } from './screens'
import { signupPath } from './signup-path'

afterEach(() => {
  localStorage.clear()
  document.documentElement.classList.remove('dark')
})

function renderPage() {
  return renderWithProviders(<LandingPage />)
}

const screenshot = () => within(screen.getByRole('tabpanel')).getByRole('img')

describe('LandingPage', () => {
  it('says what Hostly is and leads to the signup and the login', () => {
    renderPage()

    expect(
      screen.getByRole('heading', { level: 1, name: 'Cada noite de cada imóvel, no lugar certo.' }),
    ).toBeInTheDocument()
    const signups = screen.getAllByRole('link', { name: 'Criar conta' })
    expect(signups).toHaveLength(2)
    for (const link of signups) expect(link).toHaveAttribute('href', '/cadastro')
    for (const link of screen.getAllByRole('link', { name: 'Entrar' })) {
      expect(link).toHaveAttribute('href', '/login')
    }
  })

  it('charts the property the visitor names and takes it to the signup', async () => {
    const user = userEvent.setup()
    const { router } = renderRoute([
      { path: '/', element: <LandingPage /> },
      { path: '/cadastro', element: <p>cadastro</p> },
    ])

    const wall = await screen.findByRole('img', { name: /calendário de janeiro/ })
    expect(wall).not.toHaveAccessibleName(/Casa Azul/)
    await user.type(screen.getByLabelText('Comece pelo nome do seu imóvel'), 'Casa Azul')

    expect(wall).toHaveAccessibleName(/e de Casa Azul/)
    expect(
      screen.getByRole('button', { name: 'Casa Azul: 6 noites em janeiro' }),
    ).toBeInTheDocument()
    expect(screen.getByText('Casa Azul · sua 1ª reserva')).toBeInTheDocument()
    // The closing call to action carries the name too.
    expect(screen.getAllByRole('link', { name: 'Criar conta' }).at(-1)).toHaveAttribute(
      'href',
      signupPath('Casa Azul'),
    )

    await user.click(screen.getByRole('button', { name: 'Criar conta' }))

    expect(router.state.location.pathname).toBe('/cadastro')
    expect(new URLSearchParams(router.state.location.search).get('redirect')).toBe(
      '/imoveis?novo=Casa+Azul',
    )
  })

  it('goes to a plain signup when no name was typed', async () => {
    const user = userEvent.setup()
    const { router } = renderRoute([
      { path: '/', element: <LandingPage /> },
      { path: '/cadastro', element: <p>cadastro</p> },
    ])

    await user.click(await screen.findByRole('button', { name: 'Criar conta' }))

    expect(router.state.location.pathname).toBe('/cadastro')
    expect(router.state.location.search).toBe('')
  })

  it.each([
    ['', '/cadastro'],
    ['   ', '/cadastro'],
    [' Chalé & Cia ', '/cadastro?redirect=%2Fimoveis%3Fnovo%3DChal%25C3%25A9%2B%2526%2BCia'],
  ])('builds the signup path for %j', (name, path) => {
    expect(signupPath(name)).toBe(path)
  })

  it('lights up one property on the chart from its sounding', async () => {
    const user = userEvent.setup()
    renderPage()

    const legend = screen.getByRole('list', { name: 'Imóveis do exemplo' })
    await user.hover(
      within(legend).getByRole('button', { name: 'Casa da Praia: 19 noites em janeiro' }),
    )

    expect(
      within(legend).getByRole('button', { name: 'Casa da Praia: 19 noites em janeiro' }),
    ).toHaveAttribute('aria-pressed', 'true')
    const bands = (guest: string) => screen.getAllByText(guest)
    // Other properties' stays fade; Casa da Praia's stay lit, in every week they cross.
    for (const band of bands('Juliana Prado')) expect(band).toHaveClass('opacity-20')
    for (const band of bands('Carlos Menezes')) expect(band).not.toHaveClass('opacity-20')

    await user.unhover(
      within(legend).getByRole('button', { name: 'Casa da Praia: 19 noites em janeiro' }),
    )
    for (const band of bands('Juliana Prado')) expect(band).not.toHaveClass('opacity-20')

    await user.tab()
    expect(
      within(legend)
        .getAllByRole('button')
        .some((b) => b.getAttribute('aria-pressed') === 'true'),
    ).toBe(false)
  })

  it('works the booking math the way the app does', async () => {
    const user = userEvent.setup()
    renderPage()

    const money = screen.getByRole('region', { name: 'A conta de cada reserva, feita na hora' })
    // 7 nights × R$ 450 + R$ 180 cleaning; 10% over the nights only; half paid.
    expect(within(money).getByText('R$ 3.330,00')).toBeInTheDocument()
    expect(within(money).getByText('− R$ 315,00')).toBeInTheDocument()
    expect(within(money).getByText('R$ 1.665,00', { selector: 'dd.font-wide' })).toBeInTheDocument()

    await user.click(within(money).getByRole('button', { name: 'Uma noite a mais' }))
    await user.click(within(money).getByRole('radio', { name: 'Direto' }))
    await user.click(within(money).getByRole('checkbox'))

    // 8 × 450 + 180 = 3.780, no commission, nothing paid.
    expect(within(money).getAllByText('R$ 3.780,00')).toHaveLength(3)
    expect(within(money).queryByText(/Comissão \(/)).not.toBeInTheDocument()
    expect(within(money).getByText('R$ 0,00')).toBeInTheDocument()
  })

  it('keeps the nights between 1 and 30', async () => {
    const user = userEvent.setup()
    renderPage()

    const less = screen.getByRole('button', { name: 'Uma noite a menos' })
    for (let i = 0; i < 6; i++) await user.click(less)
    expect(less).toBeDisabled()

    const more = screen.getByRole('button', { name: 'Uma noite a mais' })
    for (let i = 0; i < 29; i++) await user.click(more)
    expect(more).toBeDisabled()
  })

  it('opens on the calendar and shows each screen from its tab', async () => {
    const user = userEvent.setup()
    renderPage()

    const tabs = within(screen.getByRole('tablist', { name: 'Telas do Hostly' })).getAllByRole(
      'tab',
    )
    expect(tabs.map((tab) => tab.textContent)).toEqual(SCREENS.map((item) => item.label))
    expect(tabs[0]).toHaveAttribute('aria-selected', 'true')
    expect(screenshot()).toHaveAccessibleName(SCREENS[0]?.alt)

    await user.click(screen.getByRole('tab', { name: 'Reserva' }))

    expect(screen.getByRole('tab', { name: 'Reserva' })).toHaveAttribute('aria-selected', 'true')
    const panel = screen.getByRole('tabpanel')
    expect(within(panel).getByRole('img')).toHaveAccessibleName(/resumo/)
    expect(within(panel).getByText('O resumo da reserva se faz sozinho')).toBeInTheDocument()
  })

  it('moves between the screens with the arrow keys', async () => {
    const user = userEvent.setup()
    renderPage()

    await user.click(screen.getByRole('tab', { name: 'Calendário' }))
    await user.keyboard('{ArrowRight}')

    expect(screen.getByRole('tab', { name: 'Lista' })).toHaveFocus()
    expect(screen.getByRole('tab', { name: 'Lista' })).toHaveAttribute('aria-selected', 'true')
  })

  it('shows the light captures in the light theme and the dark ones in the dark theme', () => {
    localStorage.setItem(THEME_STORAGE_KEY, 'light')
    const { unmount } = renderPage()
    expect(screenshot().getAttribute('src')).toContain('calendar-light')
    unmount()

    localStorage.setItem(THEME_STORAGE_KEY, 'dark')
    renderPage()
    expect(screenshot().getAttribute('src')).toContain('calendar-dark')
  })

  it('marks the captures as made-up data', () => {
    renderPage()

    expect(screen.getByText('Telas reais do Hostly, com dados fictícios.')).toBeInTheDocument()
  })

  it('links to the repository', () => {
    renderPage()

    const link = screen.getByRole('link', { name: 'Código no GitHub' })
    expect(link).toHaveAttribute('href', REPOSITORY_URL)
    expect(link).toHaveAttribute('target', '_blank')
    expect(link).toHaveAttribute('rel', 'noreferrer')
  })
})

describe('LandingPage, what came later', () => {
  const plans = [
    {
      id: '018f0000-0000-7000-8000-0000000000f1',
      code: 'free',
      name: 'Free',
      description: 'Para começar.',
      active: true,
      maxProperties: 1,
      monthlyPrice: null,
      semiannualPrice: null,
      annualPrice: null,
      createdAt: '',
      updatedAt: '',
    },
    {
      id: '018f0000-0000-7000-8000-0000000000f2',
      code: 'premium',
      name: 'Premium',
      description: 'Imóveis ilimitados.',
      active: true,
      maxProperties: null,
      monthlyPrice: 3990,
      semiannualPrice: null,
      annualPrice: 38300,
      createdAt: '',
      updatedAt: '',
    },
  ]

  it('shows the plans with the prices the API gives, not made-up ones', async () => {
    server.use(http.get(url('/plans'), () => HttpResponse.json(plans)))
    renderPage()

    const list = await screen.findByRole('list', { name: 'Planos' })
    const free = within(list).getByRole('listitem', { name: 'Free' })
    expect(free).toHaveTextContent('1 imóvel')
    expect(free).toHaveTextContent('De graça')
    const premium = within(list).getByRole('listitem', { name: 'Premium' })
    expect(premium).toHaveTextContent('Imóveis sem limite')
    expect(premium).toHaveTextContent('R$ 39,90por mês')
    expect(premium).toHaveTextContent('R$ 383,00por ano')
    expect(premium).not.toHaveTextContent('semestre')
    expect(within(premium).getByRole('link', { name: 'Criar conta e assinar' })).toHaveAttribute(
      'href',
      '/cadastro',
    )
  })

  it('shows no price at all when the plans can not be read', async () => {
    server.use(
      http.get(url('/plans'), () =>
        HttpResponse.json({ statusCode: 404, code: 'NOT_FOUND', message: 'x' }, { status: 404 }),
      ),
    )
    renderPage()

    expect(await screen.findByText(/Os planos aparecem aqui/)).toBeInTheDocument()
    expect(screen.queryByRole('list', { name: 'Planos' })).not.toBeInTheDocument()
  })

  it('draws the year report and switches it to occupancy', async () => {
    server.use(http.get(url('/plans'), () => HttpResponse.json(plans)))
    const user = userEvent.setup()
    renderPage()

    const section = screen.getByRole('region', { name: 'Como cada imóvel vai, mês a mês' })
    expect(within(section).getByRole('img', { name: /Receita por mês, 2027/ })).toBeInTheDocument()
    expect(section).toHaveTextContent('Ocupação no ano46,3%')
    await user.click(within(section).getByRole('radio', { name: 'Ocupação' }))

    expect(within(section).getByRole('img', { name: /Ocupação por mês, 2027/ })).toBeInTheDocument()
  })

  it('lists what else comes with the app', () => {
    renderPage()

    const section = screen.getByRole('region', { name: 'E o que mais vem junto' })
    expect(within(section).getByText('Pagamentos da reserva')).toBeInTheDocument()
    expect(within(section).getByRole('link', { name: 'no GitHub' })).toHaveAttribute(
      'href',
      REPOSITORY_URL,
    )
  })
})
