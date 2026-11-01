import { act, screen, waitFor } from '@testing-library/react'
import userEvent from '@testing-library/user-event'
import { http, HttpResponse } from 'msw'
import { describe, expect, it, vi } from 'vitest'

import { routes } from '@/app/routes'
import { getAccessToken, setAccessToken } from '@/lib/api/session'
import { renderRoute } from '@/test/render'
import { apiError, loggedInHandlers, server, testUser, url } from '@/test/server'

import { RESUME_RETRY_DELAYS_MS } from './auth-context'
import { safeRedirect } from './redirect'

describe('session', () => {
  it('resumes from the refresh cookie on start', async () => {
    server.use(...loggedInHandlers)

    renderRoute(routes, '/')

    expect(await screen.findByRole('heading', { name: 'Olá, Ana' })).toBeInTheDocument()
    expect(getAccessToken()).toBe('token')
  })

  it('keeps a session through a brief API hiccup instead of logging out', async () => {
    vi.useFakeTimers({ shouldAdvanceTime: true })
    let attempts = 0
    server.use(
      http.post(url('/auth/refresh'), () =>
        ++attempts === 1
          ? apiError(429, 'TOO_MANY_REQUESTS')
          : HttpResponse.json({ accessToken: 'token', tokenType: 'Bearer', expiresIn: 900 }),
      ),
      http.get(url('/me'), () => HttpResponse.json(testUser)),
    )

    renderRoute(routes, '/')
    await vi.advanceTimersByTimeAsync(RESUME_RETRY_DELAYS_MS[0] ?? 0)

    expect(await screen.findByRole('heading', { name: 'Olá, Ana' })).toBeInTheDocument()
    expect(attempts).toBe(2)
    vi.useRealTimers()
  })

  it('says the server is unreachable after a few tries, and resumes on demand', async () => {
    vi.useFakeTimers({ shouldAdvanceTime: true })
    const user = userEvent.setup({ advanceTimers: (ms) => vi.advanceTimersByTime(ms) })
    let up = false
    server.use(
      http.post(url('/auth/refresh'), () =>
        up
          ? HttpResponse.json({ accessToken: 'token', tokenType: 'Bearer', expiresIn: 900 })
          : HttpResponse.error(),
      ),
      http.get(url('/me'), () => HttpResponse.json(testUser)),
    )
    const { router } = renderRoute(routes, '/')

    for (const delay of RESUME_RETRY_DELAYS_MS) await vi.advanceTimersByTimeAsync(delay)

    expect(
      await screen.findByRole('heading', { name: 'Não foi possível conectar' }),
    ).toBeInTheDocument()
    expect(router.state.location.pathname).toBe('/')

    up = true
    await user.click(screen.getByRole('button', { name: 'Tentar de novo' }))

    expect(await screen.findByRole('heading', { name: 'Olá, Ana' })).toBeInTheDocument()
    vi.useRealTimers()
  })

  it('shows a spinner while resuming', () => {
    server.use(http.post(url('/auth/refresh'), () => new Promise<never>(() => undefined)))

    renderRoute(routes, '/')

    expect(screen.getByRole('status')).toHaveTextContent('Carregando')
  })

  it('logs out: revokes the session and goes back to the login', async () => {
    const user = userEvent.setup()
    let revoked = false
    server.use(
      ...loggedInHandlers,
      http.post(url('/auth/logout'), () => {
        revoked = true
        return new HttpResponse(null, { status: 204 })
      }),
    )
    const { router } = renderRoute(routes, '/')

    await user.click(await screen.findByRole('button', { name: 'Sair' }))

    expect(await screen.findByRole('heading', { name: 'Entrar' })).toBeInTheDocument()
    expect(revoked).toBe(true)
    expect(getAccessToken()).toBeNull()
    expect(router.state.location.pathname).toBe('/login')
  })

  it('still logs out locally when the API is down', async () => {
    const user = userEvent.setup()
    server.use(
      ...loggedInHandlers,
      http.post(url('/auth/logout'), () => HttpResponse.error()),
    )
    renderRoute(routes, '/')

    await user.click(await screen.findByRole('button', { name: 'Sair' }))

    expect(await screen.findByRole('heading', { name: 'Entrar' })).toBeInTheDocument()
  })

  it('goes back to the login when the session ends on its own', async () => {
    server.use(...loggedInHandlers)
    renderRoute(routes, '/')
    await screen.findByRole('heading', { name: 'Olá, Ana' })

    act(() => {
      setAccessToken(null)
    })

    expect(await screen.findByRole('heading', { name: 'Entrar' })).toBeInTheDocument()
  })
})

describe('login', () => {
  async function fill(email: string, password: string) {
    const user = userEvent.setup()
    await user.type(await screen.findByLabelText('E-mail'), email)
    await user.type(screen.getByLabelText('Senha'), password)
    await user.click(screen.getByRole('button', { name: 'Entrar' }))
    return user
  }

  it('logs in and goes where the user was headed', async () => {
    let sent: unknown
    server.use(
      http.post(url('/auth/login'), async ({ request }) => {
        sent = await request.json()
        return HttpResponse.json({
          accessToken: 'fresh',
          tokenType: 'Bearer',
          expiresIn: 900,
          user: testUser,
        })
      }),
    )
    const { router } = renderRoute(routes, '/login?redirect=%2Fimoveis%3Fpage%3D2')

    await fill('ana@hostly.dev', 'hostly123')

    await waitFor(() => {
      expect(router.state.location.pathname).toBe('/imoveis')
    })
    expect(router.state.location.search).toBe('?page=2')
    expect(sent).toEqual({ email: 'ana@hostly.dev', password: 'hostly123' })
    expect(getAccessToken()).toBe('fresh')
  })

  it('validates before calling the API', async () => {
    const user = userEvent.setup()
    renderRoute(routes, '/login')

    await user.click(await screen.findByRole('button', { name: 'Entrar' }))

    expect(screen.getByText('Informe seu e-mail.')).toBeInTheDocument()
    expect(screen.getByText('Informe sua senha.')).toBeInTheDocument()
    expect(screen.getByLabelText('E-mail')).toHaveAttribute('aria-invalid', 'true')
  })

  it('rejects an invalid e-mail', async () => {
    renderRoute(routes, '/login')

    await fill('ana@', 'x')

    expect(await screen.findByText('E-mail inválido.')).toBeInTheDocument()
  })

  it.each([
    [
      'wrong credentials',
      () => apiError(401, 'INVALID_CREDENTIALS'),
      'E-mail ou senha incorretos.',
    ],
    [
      'too many attempts',
      () => apiError(429, 'TOO_MANY_REQUESTS'),
      'Muitas tentativas. Espere um minuto e tente de novo.',
    ],
    [
      'a server error',
      () => apiError(500, 'INTERNAL_SERVER_ERROR'),
      'Algo deu errado. Tente de novo em instantes.',
    ],
    [
      'no connection',
      () => HttpResponse.error(),
      'Não foi possível falar com o servidor. Confira sua conexão.',
    ],
  ])('explains %s', async (_case, reply, message) => {
    server.use(http.post(url('/auth/login'), reply))
    renderRoute(routes, '/login')

    await fill('ana@hostly.dev', 'errada')

    expect(await screen.findByRole('alert')).toHaveTextContent(message)
    expect(screen.getByRole('heading', { name: 'Entrar' })).toBeInTheDocument()
  })

  it('shows and hides the password', async () => {
    const user = userEvent.setup()
    renderRoute(routes, '/login')
    const password = await screen.findByLabelText('Senha')

    await user.click(screen.getByRole('button', { name: 'Mostrar senha' }))
    expect(password).toHaveAttribute('type', 'text')

    await user.click(screen.getByRole('button', { name: 'Esconder senha' }))
    expect(password).toHaveAttribute('type', 'password')
  })

  it('keeps the redirect when going to the signup', async () => {
    renderRoute(routes, '/login?redirect=%2Freservas')

    expect(await screen.findByRole('link', { name: 'Cadastre-se' })).toHaveAttribute(
      'href',
      '/cadastro?redirect=%2Freservas',
    )
  })

  it('sends a logged-in user on to the app', async () => {
    server.use(...loggedInHandlers)
    const { router } = renderRoute(routes, '/login')

    await waitFor(() => {
      expect(router.state.location.pathname).toBe('/')
    })
  })
})

describe('signup', () => {
  async function fillSignup(overrides: Partial<Record<string, string>> = {}) {
    const values = {
      Nome: 'Ana Souza',
      'E-mail': 'ana@hostly.dev',
      CPF: '52998224725',
      Telefone: '48999990000',
      Senha: 'hostly123',
      'Confirme a senha': 'hostly123',
      ...overrides,
    }
    const user = userEvent.setup()
    for (const [label, value] of Object.entries(values)) {
      if (value) await user.type(await screen.findByLabelText(label), value)
    }
    await user.click(screen.getByRole('button', { name: 'Criar conta' }))
    return user
  }

  it('masks CPF and phone as the user types', async () => {
    const user = userEvent.setup()
    renderRoute(routes, '/cadastro')

    await user.type(await screen.findByLabelText('CPF'), '52998224725')
    await user.type(screen.getByLabelText('Telefone'), '48999990000')

    expect(screen.getByLabelText('CPF')).toHaveValue('529.982.247-25')
    expect(screen.getByLabelText('Telefone')).toHaveValue('(48) 99999-0000')
  })

  it('creates the account, logs in and opens the app', async () => {
    let sent: unknown
    server.use(
      http.post(url('/auth/register'), async ({ request }) => {
        sent = await request.json()
        return HttpResponse.json(testUser, { status: 201 })
      }),
      http.post(url('/auth/login'), () =>
        HttpResponse.json({
          accessToken: 'fresh',
          tokenType: 'Bearer',
          expiresIn: 900,
          user: testUser,
        }),
      ),
    )
    const { router } = renderRoute(routes, '/cadastro')

    await fillSignup()

    await waitFor(() => {
      expect(router.state.location.pathname).toBe('/')
    })
    expect(sent).toEqual({
      name: 'Ana Souza',
      email: 'ana@hostly.dev',
      cpf: '529.982.247-25',
      phone: '(48) 99999-0000',
      password: 'hostly123',
    })
  })

  it.each([
    ['an invalid CPF', { CPF: '52998224726' }, 'CPF inválido.'],
    ['an invalid phone', { Telefone: '4889999000' }, 'Telefone inválido. Use DDD + número.'],
    [
      'a short password',
      { Senha: 'curta', 'Confirme a senha': 'curta' },
      'A senha precisa de pelo menos 8 caracteres.',
    ],
    ['passwords that differ', { 'Confirme a senha': 'outra123' }, 'As senhas não conferem.'],
  ])('catches %s before calling the API', async (_case, overrides, message) => {
    renderRoute(routes, '/cadastro')

    await fillSignup(overrides)

    expect(await screen.findByText(message)).toBeInTheDocument()
  })

  it.each([
    ['EMAIL_TAKEN', 'email', 'E-mail', 'Este e-mail já tem uma conta.'],
    ['CPF_TAKEN', 'cpf', 'CPF', 'Este CPF já tem uma conta.'],
  ])('shows %s on the %s field', async (code, field, label, message) => {
    server.use(http.post(url('/auth/register'), () => apiError(409, code, { field })))
    renderRoute(routes, '/cadastro')

    await fillSignup()

    await waitFor(() => {
      expect(screen.getByLabelText(label)).toHaveAccessibleDescription(message)
    })
  })

  it('sends the user to the login when the account was created but the automatic login failed', async () => {
    server.use(
      http.post(url('/auth/register'), () => HttpResponse.json(testUser, { status: 201 })),
      http.post(url('/auth/login'), () => apiError(429, 'TOO_MANY_REQUESTS')),
    )
    const { router } = renderRoute(routes, '/cadastro?redirect=%2Freservas')

    await fillSignup()

    expect(await screen.findByRole('status')).toHaveTextContent('Conta criada!')
    expect(router.state.location.pathname).toBe('/login')
    expect(screen.getByLabelText('E-mail')).toHaveValue('ana@hostly.dev')
    expect(new URLSearchParams(router.state.location.search).get('redirect')).toBe('/reservas')
  })

  it('puts API validation messages on their fields, in Portuguese', async () => {
    server.use(
      http.post(url('/auth/register'), () =>
        apiError(400, 'VALIDATION_ERROR', [
          { location: 'body', path: 'phone', message: 'Invalid phone number' },
        ]),
      ),
    )
    renderRoute(routes, '/cadastro')

    await fillSignup()

    await waitFor(() => {
      expect(screen.getByLabelText('Telefone')).toHaveAccessibleDescription(
        'Telefone inválido. Use DDD + número.',
      )
    })
  })
})

describe('safeRedirect', () => {
  it.each([
    ['/reservas?x=1', '/reservas?x=1'],
    [null, '/'],
    ['', '/'],
    ['https://evil.com', '/'],
    ['//evil.com', '/'],
    ['reservas', '/'],
    ['/\\evil.com', '/'],
    ['/\t/evil.com', '/'],
    ['/reservas#hoje', '/reservas#hoje'],
  ])('%j → %j', (target, expected) => {
    expect(safeRedirect(target)).toBe(expected)
  })
})

it('useAuth refuses to be used outside the provider', async () => {
  const { renderHook } = await import('@testing-library/react')
  const { useAuth } = await import('./auth-context')
  vi.spyOn(console, 'error').mockImplementation(() => undefined)

  expect(() => renderHook(() => useAuth())).toThrow('inside <AuthProvider>')
})

it('keeps the redirect when going from the signup to the login', async () => {
  renderRoute(routes, '/cadastro?redirect=%2Freservas')

  expect(await screen.findByRole('link', { name: 'Entrar' })).toHaveAttribute(
    'href',
    '/login?redirect=%2Freservas',
  )
})
