import { screen, waitFor, within } from '@testing-library/react'
import userEvent from '@testing-library/user-event'
import { http, HttpResponse } from 'msw'
import { beforeEach, describe, expect, it } from 'vitest'

import { routes } from '@/test/app-routes'
import { renderRoute } from '@/test/render'
import { apiError, loggedInHandlers, server, testUser, url } from '@/test/server'

beforeEach(() => {
  server.use(...loggedInHandlers)
})

async function openPage() {
  const user = userEvent.setup()
  const view = renderRoute(routes, '/conta')
  await screen.findByRole('heading', { level: 1, name: 'Conta' }, { timeout: 5000 })
  return { user, ...view }
}

const section = (name: string) => screen.getByRole('region', { name })

describe('account page', () => {
  it('is reached from the user menu', async () => {
    const user = userEvent.setup()
    const { router } = renderRoute(routes, '/reservas')

    await user.click(await screen.findByRole('button', { name: 'Conta de Ana Souza' }))
    await user.click(await screen.findByRole('menuitem', { name: 'Minha conta' }))

    expect(await screen.findByRole('heading', { level: 1, name: 'Conta' })).toBeInTheDocument()
    expect(router.state.location.pathname).toBe('/conta')
  })

  it('saves the name and the e-mail, and shows the new name in the top bar', async () => {
    let sent: unknown = null
    server.use(
      http.patch(url('/me'), async ({ request }) => {
        sent = await request.json()
        return HttpResponse.json({ ...testUser, name: 'Ana Maria Souza' })
      }),
    )
    const { user } = await openPage()
    const profile = section('Seus dados')

    expect(within(profile).getByRole('button', { name: 'Salvar dados' })).toBeDisabled()
    await user.clear(within(profile).getByLabelText('Nome'))
    await user.type(within(profile).getByLabelText('Nome'), 'Ana Maria Souza')
    await user.click(within(profile).getByRole('button', { name: 'Salvar dados' }))

    expect(await screen.findByText('Dados salvos.')).toBeInTheDocument()
    expect(sent).toEqual({ name: 'Ana Maria Souza', email: 'ana@hostly.dev' })
    expect(screen.getByRole('button', { name: 'Conta de Ana Maria Souza' })).toBeInTheDocument()
  })

  it('says when the e-mail belongs to another account', async () => {
    server.use(http.patch(url('/me'), () => apiError(409, 'EMAIL_TAKEN', { field: 'email' })))
    const { user } = await openPage()
    const profile = section('Seus dados')

    await user.clear(within(profile).getByLabelText('E-mail'))
    await user.type(within(profile).getByLabelText('E-mail'), 'carlos@hostly.dev')
    await user.click(within(profile).getByRole('button', { name: 'Salvar dados' }))

    expect(await within(profile).findByText('Este e-mail já tem uma conta.')).toBeInTheDocument()
  })

  it('changes the password', async () => {
    let sent: unknown = null
    server.use(
      http.post(url('/auth/password'), async ({ request }) => {
        sent = await request.json()
        return new HttpResponse(null, { status: 204 })
      }),
    )
    const { user } = await openPage()
    const password = section('Senha')

    await user.type(within(password).getByLabelText('Senha atual'), 'senha antiga')
    await user.type(within(password).getByLabelText('Nova senha'), 'senha nova forte')
    await user.type(within(password).getByLabelText('Confirme a nova senha'), 'senha nova forte')
    await user.click(within(password).getByRole('button', { name: 'Trocar senha' }))

    expect(
      await screen.findByText('Senha trocada. Os outros aparelhos precisam entrar de novo.'),
    ).toBeInTheDocument()
    expect(sent).toEqual({ currentPassword: 'senha antiga', newPassword: 'senha nova forte' })
    expect(within(password).getByLabelText('Senha atual')).toHaveValue('')
  })

  it('checks the new password before sending, and says when the current one is wrong', async () => {
    server.use(
      http.post(url('/auth/password'), () =>
        apiError(400, 'WRONG_PASSWORD', { field: 'currentPassword' }),
      ),
    )
    const { user } = await openPage()
    const password = section('Senha')

    await user.type(within(password).getByLabelText('Senha atual'), 'errada')
    await user.type(within(password).getByLabelText('Nova senha'), 'curta')
    await user.click(within(password).getByRole('button', { name: 'Trocar senha' }))
    expect(
      await within(password).findByText('A senha precisa de pelo menos 8 caracteres.'),
    ).toBeInTheDocument()

    await user.clear(within(password).getByLabelText('Nova senha'))
    await user.type(within(password).getByLabelText('Nova senha'), 'senha nova forte')
    await user.type(within(password).getByLabelText('Confirme a nova senha'), 'senha nova forte')
    await user.click(within(password).getByRole('button', { name: 'Trocar senha' }))

    expect(await within(password).findByText('A senha atual não confere.')).toBeInTheDocument()
  })

  it('logs out the other devices, after asking', async () => {
    let called = false
    server.use(
      http.post(url('/auth/logout-others'), () => {
        called = true
        return new HttpResponse(null, { status: 204 })
      }),
    )
    const { user } = await openPage()

    await user.click(
      within(section('Outros aparelhos')).getByRole('button', {
        name: 'Sair dos outros aparelhos',
      }),
    )
    const dialog = await screen.findByRole('alertdialog', { name: 'Sair dos outros aparelhos?' })
    expect(called).toBe(false)
    await user.click(within(dialog).getByRole('button', { name: 'Sair dos outros' }))

    expect(await screen.findByText('Os outros aparelhos saíram da conta.')).toBeInTheDocument()
    expect(called).toBe(true)
    await waitFor(() => {
      expect(screen.queryByRole('alertdialog')).not.toBeInTheDocument()
    })
  })
})
