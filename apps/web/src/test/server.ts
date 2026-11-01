import { http, HttpResponse } from 'msw'
import { setupServer } from 'msw/node'

import { API_URL } from '@/lib/api/client'

export const url = (path: string) => `${API_URL}${path}`

export const testUser = {
  id: '018f0000-0000-7000-8000-000000000001',
  name: 'Ana Souza',
  email: 'ana@hostly.dev',
  cpf: '52998224725',
  phone: '48999990000',
  createdAt: '2026-10-31T12:00:00.000Z',
}

export function apiError(status: number, code: string, details?: unknown) {
  return HttpResponse.json({ statusCode: status, code, message: code, details }, { status })
}

/** By default nobody is logged in: the refresh cookie is missing. */
export const defaultHandlers = [
  http.post(url('/auth/refresh'), () => apiError(401, 'INVALID_REFRESH_TOKEN')),
  http.post(url('/auth/logout'), () => new HttpResponse(null, { status: 204 })),
]

/** Handlers for a session that resumes from the refresh cookie as `testUser`. */
export const loggedInHandlers = [
  http.post(url('/auth/refresh'), () =>
    HttpResponse.json({ accessToken: 'token', tokenType: 'Bearer', expiresIn: 900 }),
  ),
  http.get(url('/me'), () => HttpResponse.json(testUser)),
  // Logging in lands on the bookings page: by default the account is empty.
  ...['/properties', '/brokers', '/bookings'].map((path) =>
    http.get(url(path), () => HttpResponse.json({ items: [], total: 0, page: 1, pageSize: 20 })),
  ),
  http.get(url('/bookings/calendar'), () => HttpResponse.json([])),
]

export const server = setupServer(...defaultHandlers)
