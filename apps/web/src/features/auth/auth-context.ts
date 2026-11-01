import { createContext, useContext } from 'react'

import type { Credentials, RegisterInput, User } from './api'

export type AuthState =
  | { status: 'loading'; user: null }
  | { status: 'anonymous'; user: null }
  | { status: 'authenticated'; user: User }

export type AuthContextValue = AuthState & {
  login: (credentials: Credentials) => Promise<void>
  /** Creates the account and logs straight in. */
  register: (input: RegisterInput) => Promise<void>
  logout: () => Promise<void>
}

export const AuthContext = createContext<AuthContextValue | undefined>(undefined)

export function useAuth(): AuthContextValue {
  const context = useContext(AuthContext)
  if (!context) {
    throw new Error('useAuth must be used inside <AuthProvider>')
  }
  return context
}
