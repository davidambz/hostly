import { isValidCep, onlyDigits } from '@hostly/validation'

/** What ViaCEP knows about a CEP, in the shape of our address fields. */
export interface CepAddress {
  state: string
  city: string
  neighborhood: string
  street: string
}

interface ViaCepResponse {
  uf?: string
  localidade?: string
  bairro?: string
  logradouro?: string
  erro?: boolean | string
}

export const VIACEP_URL = 'https://viacep.com.br/ws'

/**
 * Looks up the address of a CEP. Resolves null when the CEP doesn't exist (or is
 * malformed); rejects when ViaCEP can't be reached, so the caller can tell the two apart.
 */
export async function lookupCep(cep: string, signal?: AbortSignal): Promise<CepAddress | null> {
  const digits = onlyDigits(cep)
  if (!isValidCep(digits)) return null
  const response = await fetch(`${VIACEP_URL}/${digits}/json/`, { signal })
  if (!response.ok) {
    if (response.status === 400) return null
    throw new Error(`ViaCEP answered ${response.status}`)
  }
  const body = (await response.json()) as ViaCepResponse
  if (body.erro) return null
  return {
    state: body.uf ?? '',
    city: body.localidade ?? '',
    neighborhood: body.bairro ?? '',
    street: body.logradouro ?? '',
  }
}
