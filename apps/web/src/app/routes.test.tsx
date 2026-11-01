import { screen } from '@testing-library/react'
import userEvent from '@testing-library/user-event'
import { describe, expect, it } from 'vitest'

import { renderRoute } from '@/test/render'

import { routes } from './routes'

describe('routes', () => {
  it('shows the home page at /', () => {
    renderRoute(routes, '/')

    expect(screen.getByRole('heading', { name: 'Hostly' })).toBeInTheDocument()
    expect(screen.getByRole('button', { name: 'Alterar tema' })).toBeInTheDocument()
  })

  it('shows a 404 page for unknown paths, with a way back', async () => {
    const user = userEvent.setup()
    const { router } = renderRoute(routes, '/nada/aqui')

    expect(screen.getByRole('heading', { name: 'Página não encontrada' })).toBeInTheDocument()

    await user.click(screen.getByRole('link', { name: 'Voltar ao início' }))

    expect(router.state.location.pathname).toBe('/')
  })
})
