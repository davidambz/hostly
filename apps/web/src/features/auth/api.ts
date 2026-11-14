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

export interface ProfileInput {
  name?: string
  email?: string
}

export async function updateProfile(input: ProfileInput): Promise<User> {
  return unwrap(await api.PATCH('/me', { body: input }))
}

export interface PasswordChange {
  currentPassword: string
  newPassword: string
}

/** Changes the password; the API ends every other session, keeping this one. */
export async function changePassword(input: PasswordChange): Promise<void> {
  unwrap(await api.POST('/auth/password', { body: input }))
}

/** Ends every session of the account but this one. */
export async function logoutOthers(): Promise<void> {
  unwrap(await api.POST('/auth/logout-others'))
}
