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
  if (!response.ok) {
    setAccessToken(null)
    return null
  }
  const { accessToken } = (await response.json()) as { accessToken: string }
  setAccessToken(accessToken)
  return accessToken
}

let inFlight: Promise<string | null> | null = null

/**
 * Gets a new access token from the refresh cookie, or null (and logs out) if the session
 * is gone. Concurrent callers share one request: rotating the cookie twice at once would
 * look like token theft to the API.
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
 * fetch for the API client: sends the access token, and when it has expired, refreshes
 * the session once and replays the request.
 */
export async function authFetch(request: Request): Promise<Response> {
  // The original is kept unread so the body can be sent again on retry.
  const response = await fetch(withToken(request.clone(), getAccessToken()))
  if (response.status !== 401 || (await errorCode(response)) !== 'TOKEN_EXPIRED') {
    return response
  }
  const token = await refreshSession()
  return token ? fetch(withToken(request, token)) : response
}

/** Typed client for the Hostly API, generated from its OpenAPI contract. */
export const api = createClient<paths>({
  baseUrl: API_URL,
  credentials: 'include',
  fetch: authFetch,
})
