import { screen } from '@testing-library/react'
import userEvent from '@testing-library/user-event'
import { describe, expect, it, vi } from 'vitest'

import { reloadPage } from '@/lib/browser'
import { renderRoute } from '@/test/render'

import { RouteErrorPage } from './route-error-page'

vi.mock('@/lib/browser', () => ({ reloadPage: vi.fn() }))

function Broken(): never {
  throw new Error('render failed')
}

describe('RouteErrorPage', () => {
  it('replaces a page that fails to render, offering a reload', async () => {
    vi.spyOn(console, 'error').mockImplementation(() => undefined)

    renderRoute([{ path: '/', element: <Broken />, errorElement: <RouteErrorPage /> }])

    expect(screen.getByRole('heading', { name: 'Algo deu errado' })).toBeInTheDocument()
    await userEvent.click(screen.getByRole('button', { name: 'Recarregar' }))
    expect(reloadPage).toHaveBeenCalled()
  })

  it('says "not found" for a 404 response', () => {
    vi.spyOn(console, 'error').mockImplementation(() => undefined)

    renderRoute([
      {
        path: '/',
        loader: () => {
          // eslint-disable-next-line @typescript-eslint/only-throw-error
          throw new Response('', { status: 404 })
        },
        element: <p>never</p>,
        errorElement: <RouteErrorPage />,
      },
    ])

    return expect(
      screen.findByRole('heading', { name: 'Página não encontrada' }),
    ).resolves.toBeInTheDocument()
  })
})
