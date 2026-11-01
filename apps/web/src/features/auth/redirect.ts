/**
 * Where to go after logging in: a path of this app, never another site. Resolved the way
 * the browser would, so tricks like `//evil.com` or `/\evil.com` (a backslash counts as a
 * slash) end up on the home page instead.
 */
export function safeRedirect(target: string | null): string {
  if (!target?.startsWith('/')) return '/'
  try {
    const url = new URL(target, window.location.origin)
    if (url.origin !== window.location.origin) return '/'
    return `${url.pathname}${url.search}${url.hash}`
  } catch {
    return '/'
  }
}
