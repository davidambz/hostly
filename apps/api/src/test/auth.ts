import type { App } from '../app.js'

/** Authorization header for `userId`, signed by the app itself (no login round trip). */
export function authHeader(app: App, userId: string) {
  return { authorization: `Bearer ${app.jwt.sign({ sub: userId })}` }
}
