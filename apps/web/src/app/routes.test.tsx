import { screen } from '@testing-library/react'
import userEvent from '@testing-library/user-event'
import { describe, expect, it } from 'vitest'

import { renderRoute } from '@/test/render'
import { loggedInHandlers, server } from '@/test/server'

import { routes } from './routes'

describe('routes', () => {
  it('sends an anonymous visitor from / to the login, remembering where they were going', async () => {
    const { router } = renderRoute(routes, '/')

    expect(await screen.findByRole('heading', { name: 'Entrar' })).toBeInTheDocument()
    expect(router.state.location.pathname).toBe('/login')
    expect(router.state.location.search).toBe('?redirect=%2F')
  })

  it('shows the app to a logged-in user', async () => {
    server.use(...loggedInHandlers)

    renderRoute(routes, '/')

    expect(await screen.findByRole('heading', { name: 'Olá, Ana' })).toBeInTheDocument()
  })

  it('shows a 404 page for unknown paths, with a way back', async () => {
    const user = userEvent.setup()
    const { router } = renderRoute(routes, '/nada/aqui')

    expect(screen.getByRole('heading', { name: 'Página não encontrada' })).toBeInTheDocument()

    await user.click(screen.getByRole('link', { name: 'Voltar ao início' }))

    expect(router.state.location.pathname).not.toBe('/nada/aqui')
  })
})
