import { screen, waitFor } from '@testing-library/react'
import userEvent from '@testing-library/user-event'
import { http, HttpResponse } from 'msw'
import { describe, expect, it, vi } from 'vitest'

import { renderRoute } from '@/test/render'
import { apiError, loggedInHandlers, server, testUser, url } from '@/test/server'

import { RESUME_RETRY_DELAYS_MS } from '@/features/auth/auth-context'

import { routes } from '@/test/app-routes'

describe('routes', () => {
  it('shows the home page to an anonymous visitor at /', async () => {
    const { router } = renderRoute(routes, '/')

    expect(
      await screen.findByRole('heading', { level: 1, name: /Cada noite de cada imóvel/ }),
    ).toBeInTheDocument()
    expect(router.state.location.pathname).toBe('/')
    expect(document.title).toBe('Reservas de temporada organizadas · Hostly')
  })

  it('shows the home page while the session is still resuming', async () => {
    // Held open until the end: the refresh is shared app-wide, so one left hanging would
    // stall the next tests.
    let answer: () => void = () => undefined
    server.use(
      http.post(
        url('/auth/refresh'),
        () =>
          new Promise<Response>((resolve) => {
            answer = () => {
              resolve(apiError(401, 'INVALID_REFRESH_TOKEN'))
            }
          }),
      ),
    )

    renderRoute(routes, '/')

    try {
      expect(
        await screen.findByRole('heading', { level: 1, name: /Cada noite de cada imóvel/ }),
      ).toBeInTheDocument()
      expect(screen.queryByText('Carregando…')).not.toBeInTheDocument()
    } finally {
      answer()
    }
    // Anonymous after all: the page stays.
    await waitFor(() => {
      expect(screen.getByRole('link', { name: 'Já tenho conta' })).toBeInTheDocument()
    })
  })

  it('keeps the home page up when the API is unreachable, with a way to try again', async () => {
    vi.useFakeTimers({ shouldAdvanceTime: true })
    try {
      let up = false
      server.use(
        http.post(url('/auth/refresh'), () =>
          up
            ? HttpResponse.json({ accessToken: 'token', tokenType: 'Bearer', expiresIn: 900 })
            : HttpResponse.error(),
        ),
        http.get(url('/me'), () => HttpResponse.json(testUser)),
      )
      const user = userEvent.setup({ advanceTimers: (ms) => vi.advanceTimersByTime(ms) })
      const { router } = renderRoute(routes, '/')
      for (const delay of RESUME_RETRY_DELAYS_MS) await vi.advanceTimersByTimeAsync(delay)

      const notice = await screen.findByText(/Não foi possível conectar ao servidor/)
      expect(notice).toHaveAttribute('role', 'status')
      expect(
        screen.getByRole('heading', { level: 1, name: /Cada noite de cada imóvel/ }),
      ).toBeInTheDocument()

      // It was a logged-in user after all: once the API is back, on to the app.
      up = true
      await user.click(screen.getByRole('button', { name: 'Tentar de novo' }))

      expect(await screen.findByRole('heading', { level: 1, name: 'Reservas' })).toBeInTheDocument()
      expect(router.state.location.pathname).toBe('/reservas')
    } finally {
      vi.useRealTimers()
    }
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
