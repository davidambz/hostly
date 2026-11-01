import { screen } from '@testing-library/react'
import userEvent from '@testing-library/user-event'
import { http, HttpResponse } from 'msw'
import { describe, expect, it, vi } from 'vitest'

import { renderRoute } from '@/test/render'
import { loggedInHandlers, server, url } from '@/test/server'

import { RESUME_RETRY_DELAYS_MS } from '@/features/auth/auth-context'

import { routes } from './routes'

describe('routes', () => {
  it('shows the home page to an anonymous visitor at /', async () => {
    const { router } = renderRoute(routes, '/')

    expect(
      await screen.findByRole('heading', { level: 1, name: /Cada noite de cada imóvel/ }),
    ).toBeInTheDocument()
    expect(router.state.location.pathname).toBe('/')
    expect(document.title).toBe('Reservas de temporada organizadas · Hostly')
  })

  it('shows the home page even when the API is unreachable', async () => {
    vi.useFakeTimers({ shouldAdvanceTime: true })
    server.use(http.post(url('/auth/refresh'), () => HttpResponse.error()))

    renderRoute(routes, '/')
    for (const delay of RESUME_RETRY_DELAYS_MS) await vi.advanceTimersByTimeAsync(delay)

    expect(
      await screen.findByRole('heading', { level: 1, name: /Cada noite de cada imóvel/ }),
    ).toBeInTheDocument()
    vi.useRealTimers()
  })

  it('sends a logged-in user from / to the bookings', async () => {
    server.use(...loggedInHandlers)

    const { router } = renderRoute(routes, '/')

    expect(await screen.findByRole('heading', { level: 1, name: 'Reservas' })).toBeInTheDocument()
    expect(router.state.location.pathname).toBe('/reservas')
  })

  it('still sends an anonymous visitor from an app page to the login, and back after it', async () => {
    const { router } = renderRoute(routes, '/imoveis')

    expect(await screen.findByRole('heading', { name: 'Entrar' })).toBeInTheDocument()
    expect(router.state.location.search).toBe('?redirect=%2Fimoveis')
  })

  it('shows a 404 page for unknown paths, with a way back', async () => {
    const user = userEvent.setup()
    const { router } = renderRoute(routes, '/nada/aqui')

    expect(screen.getByRole('heading', { name: 'Página não encontrada' })).toBeInTheDocument()

    await user.click(screen.getByRole('link', { name: 'Voltar ao início' }))

    // An anonymous visitor lands on the home page.
    await screen.findByRole('heading', { level: 1, name: /Cada noite de cada imóvel/ })
    expect(router.state.location.pathname).toBe('/')
  })
})
