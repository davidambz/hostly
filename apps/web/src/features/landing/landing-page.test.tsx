import { screen, within } from '@testing-library/react'
import userEvent from '@testing-library/user-event'
import { afterEach, beforeEach, describe, expect, it, vi } from 'vitest'

import { THEME_STORAGE_KEY } from '@/components/theme/theme-context'
import { renderWithProviders } from '@/test/render'

import { LandingPage, REPOSITORY_URL } from './landing-page'
import { SCREENS } from './screens'

const scrollIntoView = vi.fn()

beforeEach(() => {
  // jsdom doesn't lay out, so it has no scrolling.
  Element.prototype.scrollIntoView = scrollIntoView
})

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
    expect(signups.length).toBeGreaterThanOrEqual(2)
    for (const link of signups) expect(link).toHaveAttribute('href', '/cadastro')
    expect(screen.getByRole('link', { name: 'Entrar' })).toHaveAttribute('href', '/login')
    expect(screen.getByRole('link', { name: 'Já tenho conta' })).toHaveAttribute('href', '/login')
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

  it('takes each feature to its screen in the tour', async () => {
    const user = userEvent.setup()
    renderPage()

    const features = screen.getByRole('list')
    expect(
      within(features)
        .getAllByRole('heading', { level: 3 })
        .map((h) => h.textContent),
    ).toEqual([
      'Calendário de reservas',
      'Imóveis',
      'Intermediadores e comissão',
      'Resumo financeiro de cada reserva',
    ])

    await user.click(screen.getByRole('button', { name: 'Ver a tela: Intermediadores e comissão' }))

    expect(screen.getByRole('tab', { name: 'Intermediadores' })).toHaveAttribute(
      'aria-selected',
      'true',
    )
    expect(scrollIntoView).toHaveBeenCalledWith({ behavior: 'smooth', block: 'start' })
  })

  it('jumps to the tour without animation when the visitor prefers less motion', async () => {
    const user = userEvent.setup()
    vi.spyOn(window, 'matchMedia').mockImplementation(
      (query) =>
        ({
          matches: query === '(prefers-reduced-motion: reduce)',
          media: query,
          addEventListener: vi.fn(),
          removeEventListener: vi.fn(),
        }) as unknown as MediaQueryList,
    )
    renderPage()

    await user.click(screen.getByRole('button', { name: 'Ver a tela: Imóveis' }))

    expect(scrollIntoView).toHaveBeenLastCalledWith({ behavior: 'auto', block: 'start' })
  })

  it('links to the repository', () => {
    renderPage()

    const link = screen.getByRole('link', { name: 'Código no GitHub' })
    expect(link).toHaveAttribute('href', REPOSITORY_URL)
    expect(link).toHaveAttribute('target', '_blank')
    expect(link).toHaveAttribute('rel', 'noreferrer')
  })
})
