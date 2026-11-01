/**
 * The access token lives only in memory: never in localStorage, where any injected script
 * could read it. A reload starts without one and gets a fresh one from the refresh cookie.
 */

type Listener = (token: string | null) => void

let accessToken: string | null = null
const listeners = new Set<Listener>()

export function getAccessToken(): string | null {
  return accessToken
}

export function setAccessToken(token: string | null) {
  accessToken = token
  for (const listener of listeners) {
    listener(token)
  }
}

/** Calls `listener` whenever the token changes (null = logged out). Returns an unsubscribe. */
export function onAccessTokenChange(listener: Listener): () => void {
  listeners.add(listener)
  return () => {
    listeners.delete(listener)
  }
}
