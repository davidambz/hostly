import createClient from 'openapi-fetch'

import { getAccessToken, setAccessToken } from './session'
import type { paths } from './schema'

export const API_URL = import.meta.env.VITE_API_URL ?? 'http://localhost:3333'

/** How long to wait before retrying a refresh that lost a race with another tab. */
const ROTATED_RETRY_DELAY_MS = 300

async function errorCode(response: Response): Promise<string | undefined> {
  try {
    const body = (await response.clone().json()) as { code?: unknown }
    return typeof body.code === 'string' ? body.code : undefined
  } catch {
    return undefined
  }
}

/** The refresh couldn't be done right now (429, 5xx, a garbled answer): try again later. */
export class RefreshUnavailableError extends Error {
  constructor(readonly status: number) {
    super(`Session refresh unavailable (status ${status})`)
    this.name = 'RefreshUnavailableError'
  }
}

function postRefresh() {
  return fetch(`${API_URL}/auth/refresh`, { method: 'POST', credentials: 'include' })
}

async function doRefresh(): Promise<string | null> {
  let response = await postRefresh()
  // Another tab rotated the cookie a moment ago; the browser already has the new one.
  if (response.status === 401 && (await errorCode(response)) === 'REFRESH_TOKEN_ROTATED') {
    await new Promise((resolve) => setTimeout(resolve, ROTATED_RETRY_DELAY_MS))
    response = await postRefresh()
  }
  // Only a 401 means the session is gone; anything else is worth another try later.
  if (response.status === 401) {
    setAccessToken(null)
    return null
  }
  if (!response.ok) {
    throw new RefreshUnavailableError(response.status)
  }
  let accessToken: unknown
  try {
    accessToken = ((await response.json()) as { accessToken?: unknown }).accessToken
  } catch {
    throw new RefreshUnavailableError(response.status)
  }
  if (typeof accessToken !== 'string') {
    throw new RefreshUnavailableError(response.status)
  }
  setAccessToken(accessToken)
  return accessToken
}

let inFlight: Promise<string | null> | null = null

/**
 * Gets a new access token from the refresh cookie. Resolves null (and logs out) when the
 * session is gone; rejects with RefreshUnavailableError when it just couldn't be done now,
 * keeping the session. Concurrent callers share one request: rotating the cookie twice at
 * once would look like token theft to the API.
 */
export function refreshSession(): Promise<string | null> {
  inFlight ??= doRefresh().finally(() => {
    inFlight = null
  })
  return inFlight
}

function withToken(request: Request, token: string | null): Request {
  const next = new Request(request)
  if (token) {
    next.headers.set('Authorization', `Bearer ${token}`)
  }
  return next
}

/**
 * Whether a 401 can be fixed with a fresh access token: the one sent expired, or none was
 * sent at all (after a reload the token is gone, but the refresh cookie may still be good).
 */
function isRecoverable(code: string | undefined, sentToken: string | null) {
  return code === 'TOKEN_EXPIRED' || (code === 'UNAUTHORIZED' && sentToken === null)
}

/**
 * fetch for the API client: sends the access token and, when a 401 can be fixed with a
 * new one, gets it (once, shared) and replays the request.
 */
export async function authFetch(request: Request): Promise<Response> {
  const sentToken = getAccessToken()
  // The original is kept unread so the body can be sent again on retry.
  const response = await fetch(withToken(request.clone(), sentToken))
  if (response.status !== 401 || !isRecoverable(await errorCode(response), sentToken)) {
    return response
  }

  // Someone else already refreshed while this request was out: just use their token.
  const current = getAccessToken()
  if (current !== null && current !== sentToken) {
    return fetch(withToken(request, current))
  }

  let token: string | null
  try {
    token = await refreshSession()
  } catch (error) {
    if (error instanceof RefreshUnavailableError) {
      return response
    }
    throw error
  }
  return token ? fetch(withToken(request, token)) : response
}

/** Typed client for the Hostly API, generated from its OpenAPI contract. */
export const api = createClient<paths>({
  baseUrl: API_URL,
  credentials: 'include',
  fetch: authFetch,
})
