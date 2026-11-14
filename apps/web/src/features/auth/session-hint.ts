import { readStored, removeStored, writeStored } from '@/lib/local-store'

/**
 * Whether this browser was logged in last time, so the public home page can wait for the
 * session to resume instead of flashing before the app takes over. Only a hint: the
 * refresh cookie decides, and a stale hint just costs a moment of loading.
 */
export const SESSION_HINT_KEY = 'hostly-had-session'

export function hadSession(): boolean {
  return readStored(SESSION_HINT_KEY) === '1'
}

export function rememberSession(loggedIn: boolean): void {
  if (loggedIn) writeStored(SESSION_HINT_KEY, '1')
  else removeStored(SESSION_HINT_KEY)
}
