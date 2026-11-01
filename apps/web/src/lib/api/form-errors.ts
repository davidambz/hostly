import type { FieldValues, Path, UseFormSetError } from 'react-hook-form'

import { ApiError } from './errors'

/** Portuguese messages for the API codes a form can run into. */
const MESSAGES: Record<string, string> = {
  INVALID_CREDENTIALS: 'E-mail ou senha incorretos.',
  EMAIL_TAKEN: 'Este e-mail já tem uma conta.',
  CPF_TAKEN: 'Este CPF já tem uma conta.',
  TOO_MANY_REQUESTS: 'Muitas tentativas. Espere um minuto e tente de novo.',
}

const GENERIC = 'Algo deu errado. Tente de novo em instantes.'
const OFFLINE = 'Não foi possível falar com o servidor. Confira sua conexão.'

/** The message to show for any error thrown by an API call. */
export function errorMessage(error: unknown): string {
  if (error instanceof ApiError) {
    return MESSAGES[error.code] ?? (error.status >= 500 ? GENERIC : error.message)
  }
  return error instanceof TypeError ? OFFLINE : GENERIC
}

interface Issue {
  path: string
  message: string
}

function isIssueList(details: unknown): details is Issue[] {
  return Array.isArray(details) && details.every((d) => typeof (d as Issue).path === 'string')
}

/**
 * Puts an API error on the form: each field the API complains about gets its message
 * (when the form has that field), anything else becomes a form-level error (`root`).
 */
export function applyApiError<T extends FieldValues>(
  error: unknown,
  setError: UseFormSetError<T>,
  fields: readonly Path<T>[],
): void {
  const known = new Set<string>(fields)
  if (error instanceof ApiError) {
    if (error.code === 'VALIDATION_ERROR' && isIssueList(error.details)) {
      const issues = error.details.filter((issue) => known.has(issue.path))
      for (const issue of issues) {
        setError(issue.path as Path<T>, { type: 'server', message: issue.message })
      }
      if (issues.length > 0) return
    }
    const field = (error.details as { field?: unknown } | undefined)?.field
    if (typeof field === 'string' && known.has(field)) {
      setError(field as Path<T>, { type: 'server', message: errorMessage(error) })
      return
    }
  }
  setError('root', { type: 'server', message: errorMessage(error) })
}
