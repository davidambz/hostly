import { screen, waitFor, within } from '@testing-library/react'
import userEvent from '@testing-library/user-event'
import { http, HttpResponse } from 'msw'
import { describe, expect, it } from 'vitest'

import { routes } from '@/test/app-routes'
import { renderRoute } from '@/test/render'
import { loggedInHandlers, server, testUser, url } from '@/test/server'

import type { AdminUser } from './api'

const free = { id: '018f0000-0000-7000-8000-0000000000f1', code: 'free', name: 'Free' }

const me: AdminUser = {
  id: testUser.id,
  name: testUser.name,
  email: testUser.email,
  isAdmin: true,
  createdAt: testUser.createdAt,
  propertyCount: 1,
  plan: free,
  planSource: 'FREE',
  grant: null,
}
const carlos: AdminUser = {
  id: '018f0000-0000-7000-8000-000000000002',
  name: 'Carlos Lima',
  email: 'carlos@hostly.dev',
  isAdmin: false,
  createdAt: '2026-11-01T12:00:00.000Z',
  propertyCount: 3,
  plan: free,
  planSource: 'FREE',
  grant: null,
}

/** Logged in as an administrator, with the accounts the backoffice lists. */
function serveAdmin(users: AdminUser[] = [carlos, me]) {
  const queries: URLSearchParams[] = []
  const patches: { id: string; body: unknown }[] = []
  server.use(...loggedInHandlers)
  server.use(
    http.get(url('/me'), () => HttpResponse.json({ ...testUser, isAdmin: true })),
    http.get(url('/admin/users'), ({ request }) => {
      const query = new URL(request.url).searchParams
      queries.push(query)
      const search = query.get('search')?.toLowerCase() ?? ''
      const items = users.filter((user) => user.name.toLowerCase().includes(search))
      return HttpResponse.json({ items, total: items.length, page: 1, pageSize: 20 })
    }),
    http.patch(url('/admin/users/:id/admin'), async ({ params, request }) => {
      patches.push({ id: String(params.id), body: await request.json() })
      return new HttpResponse(null, { status: 204 })
    }),
  )
  return { queries, patches }
}

async function openPage(path = '/admin/usuarios') {
  const user = userEvent.setup()
  const view = renderRoute(routes, path)
  await screen.findByRole('heading', { level: 1, name: 'Administração' }, { timeout: 5000 })
  return { user, ...view }
}

describe('backoffice', () => {
  it('is not there for a user who is not an administrator', async () => {
    server.use(...loggedInHandlers)
    const { router } = renderRoute(routes, '/admin/usuarios')

    expect(await screen.findByRole('heading', { level: 1, name: 'Reservas' })).toBeInTheDocument()
    expect(router.state.location.pathname).toBe('/reservas')
    expect(
      within(screen.getByRole('navigation', { name: 'Principal' })).queryByRole('link', {
        name: 'Administração',
      }),
    ).not.toBeInTheDocument()
  })

  it('lists the accounts for an administrator, with the backoffice in the top bar', async () => {
    serveAdmin()
    const { router } = await openPage('/admin/usuarios')

    expect(router.state.location.pathname).toBe('/admin/usuarios')
    expect(
      within(screen.getByRole('navigation', { name: 'Principal' })).getByRole('link', {
        name: 'Administração',
      }),
    ).toHaveAttribute('aria-current', 'page')
    const table = await screen.findByRole('table', { name: 'Contas' })
    const rows = within(table).getAllByRole('row').slice(1)
    expect(rows.map((row) => row.textContent)).toEqual([
      expect.stringContaining('Carlos Limacarlos@hostly.dev3Free'),
      expect.stringContaining('Ana SouzaAdminana@hostly.dev1Free'),
    ])
  })

  it('searches the accounts', async () => {
    const { queries } = serveAdmin()
    const { user } = await openPage()

    await user.type(await screen.findByRole('searchbox', { name: 'Buscar conta' }), 'carlos')

    await waitFor(() => {
      expect(queries.at(-1)?.get('search')).toBe('carlos')
    })
    expect(await screen.findByText('Carlos Lima')).toBeInTheDocument()
  })

  it('makes someone an administrator, after asking, but offers nothing on your own account', async () => {
    const { patches } = serveAdmin()
    const { user } = await openPage()

    expect(await screen.findByText('Carlos Lima')).toBeInTheDocument()
    await user.click(screen.getByRole('button', { name: 'Ações de Ana Souza' }))
    expect(await screen.findByRole('menuitem', { name: 'Plano e concessões' })).toBeInTheDocument()
    expect(screen.queryByRole('menuitem', { name: /administrador/ })).not.toBeInTheDocument()
    await user.keyboard('{Escape}')

    await user.click(screen.getByRole('button', { name: 'Ações de Carlos Lima' }))
    await user.click(await screen.findByRole('menuitem', { name: 'Tornar administrador' }))
    const dialog = await screen.findByRole('alertdialog', { name: 'Tornar administrador?' })
    await user.click(within(dialog).getByRole('button', { name: 'Tornar administrador' }))

    expect(await screen.findByText('Carlos Lima agora é administrador.')).toBeInTheDocument()
    expect(patches).toEqual([{ id: carlos.id, body: { isAdmin: true } }])
  })
})
