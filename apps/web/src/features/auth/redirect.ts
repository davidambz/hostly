/** Where a logged-in user lands by default: the bookings. */
export const APP_HOME = '/reservas'

/**
 * Where to go after logging in: a path of this app, never another site. Resolved the way
 * the browser would, so tricks like `//evil.com` or `/\evil.com` (a backslash counts as a
 * slash) end up on the bookings instead.
 */
export function safeRedirect(target: string | null): string {
  if (!target?.startsWith('/')) return APP_HOME
  try {
    const url = new URL(target, window.location.origin)
    if (url.origin !== window.location.origin) return APP_HOME
    return `${url.pathname}${url.search}${url.hash}`
  } catch {
    return APP_HOME
  }
}
