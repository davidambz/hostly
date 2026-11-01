import { describe, expect, it, vi } from 'vitest'

import { ApiError } from './errors'
import { applyApiError, errorMessage } from './form-errors'

describe('applyApiError', () => {
  const fields = ['email', 'phone'] as const

  it('puts each known validation issue on its field', () => {
    const setError = vi.fn()
    const error = new ApiError(400, {
      code: 'VALIDATION_ERROR',
      details: [
        { path: 'email', message: 'bad email' },
        { path: 'phone', message: 'bad phone' },
      ],
    })

    applyApiError(error, setError, fields)

    expect(setError).toHaveBeenCalledWith('email', { type: 'server', message: 'bad email' })
    expect(setError).toHaveBeenCalledWith('phone', { type: 'server', message: 'bad phone' })
    expect(setError).not.toHaveBeenCalledWith('root', expect.anything())
  })

  it('falls back to a form error when no issue matches a field', () => {
    const setError = vi.fn()

    applyApiError(
      new ApiError(400, {
        code: 'VALIDATION_ERROR',
        message: 'Bad',
        details: [{ path: 'other', message: 'x' }],
      }),
      setError,
      fields,
    )

    expect(setError).toHaveBeenCalledWith('root', { type: 'server', message: 'Bad' })
  })

  it('puts a domain error naming a field on that field, in Portuguese', () => {
    const setError = vi.fn()

    applyApiError(
      new ApiError(409, { code: 'EMAIL_TAKEN', details: { field: 'email' } }),
      setError,
      fields,
    )

    expect(setError).toHaveBeenCalledWith('email', {
      type: 'server',
      message: 'Este e-mail já tem uma conta.',
    })
  })

  it('makes anything else a form error', () => {
    const setError = vi.fn()

    applyApiError(new TypeError('Failed to fetch'), setError, fields)

    expect(setError).toHaveBeenCalledWith('root', {
      type: 'server',
      message: 'Não foi possível falar com o servidor. Confira sua conexão.',
    })
  })
})

describe('errorMessage', () => {
  it.each([
    [new ApiError(401, { code: 'INVALID_CREDENTIALS' }), 'E-mail ou senha incorretos.'],
    [new ApiError(404, { code: 'X', message: 'Not here' }), 'Not here'],
    [new ApiError(502, undefined), 'Algo deu errado. Tente de novo em instantes.'],
    [new Error('boom'), 'Algo deu errado. Tente de novo em instantes.'],
  ])('%o → %s', (error, message) => {
    expect(errorMessage(error)).toBe(message)
  })
})
