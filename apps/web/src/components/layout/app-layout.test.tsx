import { screen, waitFor, within } from '@testing-library/react'
import userEvent from '@testing-library/user-event'
import { describe, expect, it } from 'vitest'

import { routes } from '@/app/routes'
import { THEME_STORAGE_KEY } from '@/components/theme/theme-context'
import { renderRoute } from '@/test/render'
import { loggedInHandlers, server } from '@/test/server'

import { initials } from './initials'

async function renderApp(path = '/reservas') {
  server.use(...loggedInHandlers)
  const rendered = renderRoute(routes, path)
  await screen.findByRole('navigation', { name: 'Principal' })
  return rendered
}

describe('app layout', () => {
  it('sends / to the bookings', async () => {
    const { router } = await renderApp('/')

    await waitFor(() => {
      expect(router.state.location.pathname).toBe('/reservas')
    })
    expect(await screen.findByRole('heading', { level: 1, name: 'Reservas' })).toBeInTheDocument()
  })

  it('lists the sections in the sidebar and marks the current one', async () => {
    await renderApp('/imoveis')

    const nav = screen.getByRole('navigation', { name: 'Principal' })
    const links = within(nav).getAllByRole('link')
    expect(links.map((link) => link.textContent)).toEqual([
      'Reservas',
      'Imóveis',
      'Intermediadores',
    ])
    expect(within(nav).getByRole('link', { name: 'Imóveis' })).toHaveAttribute(
      'aria-current',
      'page',
    )
    expect(within(nav).getByRole('link', { name: 'Reservas' })).not.toHaveAttribute('aria-current')
  })

  it('navigates between sections, updating the breadcrumb and the tab title', async () => {
    const user = userEvent.setup()
    const { router } = await renderApp('/reservas')

    await user.click(
      within(screen.getByRole('navigation', { name: 'Principal' })).getByRole('link', {
        name: 'Intermediadores',
      }),
    )

    expect(
      await screen.findByRole('heading', { level: 1, name: 'Intermediadores' }),
    ).toBeInTheDocument()
    expect(router.state.location.pathname).toBe('/intermediadores')
    expect(
      within(screen.getByRole('navigation', { name: 'breadcrumb' })).getByText('Intermediadores'),
    ).toBeInTheDocument()
    await waitFor(() => {
      expect(document.title).toBe('Intermediadores · Hostly')
    })
  })

  it('collapses and expands the sidebar', async () => {
    const user = userEvent.setup()
    const { container } = await renderApp()
    const sidebar = () => container.querySelector('[data-slot="sidebar"][data-state]')

    expect(sidebar()).toHaveAttribute('data-state', 'expanded')
    await user.click(screen.getByRole('button', { name: 'Alternar menu' }))
    expect(sidebar()).toHaveAttribute('data-state', 'collapsed')
    await user.click(screen.getByRole('button', { name: 'Alternar menu' }))
    expect(sidebar()).toHaveAttribute('data-state', 'expanded')
  })

  it('shows who is logged in, and switches the theme from the user menu', async () => {
    const user = userEvent.setup()
    await renderApp()

    await user.click(screen.getByRole('button', { name: 'Conta de Ana Souza' }))
    expect(screen.getByText('ana@hostly.dev', { selector: 'p' })).toBeInTheDocument()

    // Through the keyboard, as Radix submenus are meant to be driven.
    screen.getByRole('menuitem', { name: 'Tema' }).focus()
    await user.keyboard('{ArrowRight}')
    const dark = await screen.findByRole('menuitemradio', { name: 'Escuro' })
    dark.focus()
    await user.keyboard('{Enter}')

    expect(document.documentElement).toHaveClass('dark')
    expect(localStorage.getItem(THEME_STORAGE_KEY)).toBe('dark')
  })

  it('shows the user initials', async () => {
    await renderApp()

    expect(
      within(screen.getByRole('button', { name: 'Conta de Ana Souza' })).getByText('AS'),
    ).toBeInTheDocument()
  })
})

describe('initials', () => {
  it.each([
    ['Ana Souza', 'AS'],
    ['Ana', 'A'],
    ['  ana   maria de souza ', 'AS'],
    ['', ''],
  ])('%j → %j', (name, expected) => {
    expect(initials(name)).toBe(expected)
  })
})
