import { createContext, useContext } from 'react'

import type { Credentials, RegisterInput, User } from './api'

export type AuthState =
  | { status: 'loading'; user: null }
  | { status: 'anonymous'; user: null }
  /** The API couldn't be reached to resume the session; it may still be valid. */
  | { status: 'unavailable'; user: null }
  | { status: 'authenticated'; user: User }

export type AuthContextValue = AuthState & {
  login: (credentials: Credentials) => Promise<void>
  /**
   * Creates the account and logs straight in. Throws AccountCreatedError when the account
   * was created but the login after it failed.
   */
  register: (input: RegisterInput) => Promise<void>
  logout: () => void
  /** Tries to resume the session again, after `unavailable`. */
  retry: () => void
}

/** Waits between automatic attempts to resume a session the API couldn't confirm. */
export const RESUME_RETRY_DELAYS_MS = [1000, 3000]

/** The signup worked but logging in right after it didn't: the user should just log in. */
export class AccountCreatedError extends Error {
  constructor(readonly email: string) {
    super('Account created, but logging in failed')
    this.name = 'AccountCreatedError'
  }
}

export const AuthContext = createContext<AuthContextValue | undefined>(undefined)

export function useAuth(): AuthContextValue {
  const context = useContext(AuthContext)
  if (!context) {
    throw new Error('useAuth must be used inside <AuthProvider>')
  }
  return context
}
