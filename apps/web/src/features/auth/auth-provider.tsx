import { useQueryClient } from '@tanstack/react-query'
import { type ReactNode, useCallback, useEffect, useMemo, useState } from 'react'

import { refreshSession } from '@/lib/api/client'
import { onAccessTokenChange, setAccessToken } from '@/lib/api/session'

import * as authApi from './api'
import { AuthContext, type AuthState } from './auth-context'

const ANONYMOUS: AuthState = { status: 'anonymous', user: null }

/**
 * Knows who is logged in. On start it tries to resume the session from the refresh
 * cookie; whenever the session ends (logout, or a refresh the API refuses) it goes back
 * to anonymous and drops every cached query, so no data outlives the session.
 */
export function AuthProvider({ children }: { children: ReactNode }) {
  const queryClient = useQueryClient()
  const [state, setState] = useState<AuthState>({ status: 'loading', user: null })

  useEffect(() => {
    let active = true
    const resume = async () => {
      try {
        const token = await refreshSession()
        const user = token ? await authApi.fetchMe() : null
        if (active) setState(user ? { status: 'authenticated', user } : ANONYMOUS)
      } catch {
        // API unreachable: start logged out; logging in will tell the user what's wrong.
        if (active) setState(ANONYMOUS)
      }
    }
    void resume()
    return () => {
      active = false
    }
  }, [])

  useEffect(
    () =>
      onAccessTokenChange((token) => {
        if (token === null) {
          setState(ANONYMOUS)
          queryClient.clear()
        }
      }),
    [queryClient],
  )

  const login = useCallback(async (credentials: authApi.Credentials) => {
    const { accessToken, user } = await authApi.login(credentials)
    setAccessToken(accessToken)
    setState({ status: 'authenticated', user })
  }, [])

  const register = useCallback(
    async (input: authApi.RegisterInput) => {
      await authApi.register(input)
      await login({ email: input.email, password: input.password })
    },
    [login],
  )

  const logout = useCallback(async () => {
    await authApi.logout()
    setAccessToken(null)
  }, [])

  const value = useMemo(
    () => ({ ...state, login, register, logout }),
    [state, login, register, logout],
  )

  return <AuthContext value={value}>{children}</AuthContext>
}
