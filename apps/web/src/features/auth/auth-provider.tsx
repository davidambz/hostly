import { useQueryClient } from '@tanstack/react-query'
import { type ReactNode, useCallback, useEffect, useMemo, useState } from 'react'

import { refreshSession } from '@/lib/api/client'
import { onAccessTokenChange, setAccessToken } from '@/lib/api/session'

import * as authApi from './api'
import {
  AccountCreatedError,
  AuthContext,
  type AuthState,
  RESUME_RETRY_DELAYS_MS,
} from './auth-context'

const ANONYMOUS: AuthState = { status: 'anonymous', user: null }

const wait = (ms: number) => new Promise((resolve) => setTimeout(resolve, ms))

/**
 * Asks the API who is logged in, from the refresh cookie. Resolves the user, or null when
 * there is no session; throws when the API couldn't answer (429, 5xx, offline).
 */
async function resumeOnce(): Promise<authApi.User | null> {
  const token = await refreshSession()
  return token ? authApi.fetchMe() : null
}

/**
 * Knows who is logged in. On start it resumes the session from the refresh cookie,
 * retrying a few times when the API can't answer, and only then says `unavailable` (never
 * "logged out" for a session that may still be good). Whenever the session ends it goes
 * back to anonymous and drops every cached query, so no data outlives the session.
 */
export function AuthProvider({ children }: { children: ReactNode }) {
  const queryClient = useQueryClient()
  const [state, setState] = useState<AuthState>({ status: 'loading', user: null })
  const [attempt, setAttempt] = useState(0)

  useEffect(() => {
    // Read through a function: the cleanup flips it while the loop is awaiting.
    let active = true
    const isActive = () => active
    const resume = async () => {
      for (const delay of [0, ...RESUME_RETRY_DELAYS_MS]) {
        if (delay) await wait(delay)
        if (!isActive()) return
        try {
          const user = await resumeOnce()
          if (isActive()) setState(user ? { status: 'authenticated', user } : ANONYMOUS)
          return
        } catch {
          // Try again, then give up below.
        }
      }
      if (isActive()) setState({ status: 'unavailable', user: null })
    }
    void resume()
    return () => {
      active = false
    }
  }, [attempt])

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
      try {
        await login({ email: input.email, password: input.password })
      } catch {
        throw new AccountCreatedError(input.email)
      }
    },
    [login],
  )

  const logout = useCallback(() => {
    // Leave right away; telling the API is best-effort and needn't hold the user up.
    setAccessToken(null)
    void authApi.logout()
  }, [])

  const retry = useCallback(() => {
    setState({ status: 'loading', user: null })
    setAttempt((value) => value + 1)
  }, [])

  const value = useMemo(
    () => ({ ...state, login, register, logout, retry }),
    [state, login, register, logout, retry],
  )

  return <AuthContext value={value}>{children}</AuthContext>
}
