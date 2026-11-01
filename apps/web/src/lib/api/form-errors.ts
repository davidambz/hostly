import type { FieldValues, Path, UseFormSetError } from 'react-hook-form'

import { ApiError, errorField } from './errors'

/** Portuguese messages for the API codes a form can run into. */
const MESSAGES: Record<string, string> = {
  INVALID_CREDENTIALS: 'E-mail ou senha incorretos.',
  INVALID_DOCUMENT: 'Documento inválido para o tipo escolhido.',
  INVALID_DATES: 'A saída precisa ser depois da entrada, em até 365 noites.',
  DISCOUNT_EXCEEDS_LODGING: 'O desconto passa do valor das diárias.',
  PAYMENT_EXCEEDS_TOTAL: 'O valor pago passa do total.',
  COMMISSION_WITHOUT_BROKER: 'Comissão só com intermediador.',
  PROPERTY_NOT_FOUND: 'Este imóvel não existe mais.',
  BROKER_NOT_FOUND: 'Este intermediador não existe mais.',
  BOOKING_NOT_FOUND: 'Esta reserva não existe mais.',
  EMAIL_TAKEN: 'Este e-mail já tem uma conta.',
  CPF_TAKEN: 'Este CPF já tem uma conta.',
  TOO_MANY_REQUESTS: 'Muitas tentativas. Espere um minuto e tente de novo.',
}

const GENERIC = 'Algo deu errado. Tente de novo em instantes.'
const REJECTED = 'Não foi possível concluir. Confira os dados e tente de novo.'
const INVALID_FIELD = 'Valor inválido.'
const OFFLINE = 'Não foi possível falar com o servidor. Confira sua conexão.'

/** The message to show for any error thrown by an API call. */
export function errorMessage(error: unknown): string {
  if (error instanceof ApiError) {
    // API messages are in English; the UI only shows Portuguese ones.
    return MESSAGES[error.code] ?? (error.status >= 500 ? GENERIC : REJECTED)
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
 * Puts an API error on the form: each field the API complains about gets the form's
 * Portuguese message for it (API messages are English), a domain error naming a field goes
 * on that field, and anything else becomes a form-level error (`root`).
 */
export function applyApiError<T extends FieldValues>(
  error: unknown,
  setError: UseFormSetError<T>,
  /** The form's fields, each with the message to show when the API rejects it. */
  fields: Partial<Record<Path<T>, string>>,
): void {
  const known = new Set<string>(Object.keys(fields))
  const messageFor = (path: string) => fields[path as Path<T>] ?? INVALID_FIELD
  if (error instanceof ApiError) {
    if (error.code === 'VALIDATION_ERROR' && isIssueList(error.details)) {
      const issues = error.details.filter((issue) => known.has(issue.path))
      for (const issue of issues) {
        setError(issue.path as Path<T>, { type: 'server', message: messageFor(issue.path) })
      }
      if (issues.length > 0) return
    }
    const field = errorField(error)
    if (field !== undefined && known.has(field)) {
      setError(field as Path<T>, { type: 'server', message: errorMessage(error) })
      return
    }
  }
  setError('root', { type: 'server', message: errorMessage(error) })
}
