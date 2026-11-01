import { api } from '@/lib/api/client'
import { unwrap } from '@/lib/api/errors'
import type { components } from '@/lib/api/schema'

export type User = components['schemas']['User']

export interface Credentials {
  email: string
  password: string
}

export interface RegisterInput extends Credentials {
  name: string
  cpf: string
  phone: string
}

export async function login(credentials: Credentials) {
  return unwrap(await api.POST('/auth/login', { body: credentials }))
}

export async function register(input: RegisterInput): Promise<User> {
  return unwrap(await api.POST('/auth/register', { body: input }))
}

export async function fetchMe(): Promise<User> {
  return unwrap(await api.GET('/me'))
}

/**
 * Revokes the session server-side. Best-effort: the client has already forgotten it, so
 * failures (offline, API down) are ignored.
 */
export async function logout(): Promise<void> {
  try {
    await api.POST('/auth/logout')
  } catch {
    // Nothing to do: the local session is already gone.
  }
}
