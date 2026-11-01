import { screen, waitFor, within } from '@testing-library/react'
import userEvent from '@testing-library/user-event'
import { describe, expect, it, vi } from 'vitest'

import { routes } from '@/app/routes'
import { THEME_STORAGE_KEY } from '@/components/theme/theme-context'
import { renderRoute } from '@/test/render'
import { loggedInHandlers, server } from '@/test/server'

import { RequireAuth } from '@/features/auth/guards'
import { RouteErrorPage } from '@/pages/route-error-page'

import { AppLayout } from './app-layout'
import { initials } from './initials'
import { readSidebarOpen } from './sidebar-state'

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

describe('readSidebarOpen', () => {
  it.each([
    ['', true],
    ['sidebar_state=true', true],
    ['other=1; sidebar_state=false; x=2', false],
    ['sidebar_state=false', false],
  ])('%j → %o', (cookie, open) => {
    expect(readSidebarOpen(cookie)).toBe(open)
  })
})

describe('layout behavior', () => {
  it('starts collapsed when the sidebar was left collapsed', async () => {
    document.cookie = 'sidebar_state=false; path=/'
    const { container } = await renderApp()

    expect(container.querySelector('[data-slot="sidebar"][data-state]')).toHaveAttribute(
      'data-state',
      'collapsed',
    )
    document.cookie = 'sidebar_state=; max-age=0; path=/'
  })

  it('ignores Ctrl+B while typing in a field, and toggles the sidebar otherwise', async () => {
    const user = userEvent.setup()
    const { container } = await renderApp()
    const state = () =>
      container.querySelector('[data-slot="sidebar"][data-state]')?.getAttribute('data-state')
    const input = document.createElement('input')
    document.body.append(input)

    input.focus()
    await user.keyboard('{Control>}b{/Control}')
    expect(state()).toBe('expanded')

    input.blur()
    await user.keyboard('{Control>}b{/Control}')
    expect(state()).toBe('collapsed')
    input.remove()
  })

  it('keeps the sidebar when a page fails, showing the error inside the layout', async () => {
    vi.spyOn(console, 'error').mockImplementation(() => undefined)
    server.use(...loggedInHandlers)
    function Broken(): never {
      throw new Error('boom')
    }
    const layoutRoutes = [
      {
        element: <AppLayout />,
        children: [
          {
            errorElement: <RouteErrorPage inline />,
            children: [{ path: '/', element: <Broken /> }],
          },
        ],
      },
    ]

    renderRoute([{ element: <RequireAuth />, children: layoutRoutes }])

    expect(await screen.findByRole('heading', { name: 'Algo deu errado' })).toBeInTheDocument()
    expect(screen.getByRole('navigation', { name: 'Principal' })).toBeInTheDocument()
  })

  it('shows a progress bar while the next page loads', async () => {
    const user = userEvent.setup()
    server.use(...loggedInHandlers)
    let finish: () => void = () => undefined
    const layoutRoutes = [
      {
        element: <AppLayout />,
        children: [
          { path: '/reservas', element: <h1>Reservas</h1> },
          {
            path: '/imoveis',
            lazy: () =>
              new Promise<{ Component: () => React.ReactNode }>((resolve) => {
                finish = () => {
                  resolve({ Component: () => <h1>Imóveis</h1> })
                }
              }),
          },
        ],
      },
    ]
    renderRoute([{ element: <RequireAuth />, children: layoutRoutes }], '/reservas')

    await user.click(await screen.findByRole('link', { name: 'Imóveis' }))
    expect(screen.getByRole('progressbar', { name: 'Carregando página' })).toBeInTheDocument()

    finish()
    expect(await screen.findByRole('heading', { name: 'Imóveis' })).toBeInTheDocument()
    expect(screen.queryByRole('progressbar')).not.toBeInTheDocument()
  })
})

describe('tab title', () => {
  it.each([
    ['/login', 'Entrar · Hostly'],
    ['/cadastro', 'Criar conta · Hostly'],
    ['/nao-existe', 'Página não encontrada · Hostly'],
  ])('is set on %s, outside the app layout too', async (path, title) => {
    renderRoute(routes, path)

    await waitFor(() => {
      expect(document.title).toBe(title)
    })
  })

  it('follows the user to the login after logging out', async () => {
    const user = userEvent.setup()
    await renderApp('/intermediadores')
    await waitFor(() => {
      expect(document.title).toBe('Intermediadores · Hostly')
    })

    await user.click(screen.getByRole('button', { name: 'Conta de Ana Souza' }))
    await user.click(await screen.findByRole('menuitem', { name: 'Sair' }))

    await waitFor(() => {
      expect(document.title).toBe('Entrar · Hostly')
    })
  })
})
