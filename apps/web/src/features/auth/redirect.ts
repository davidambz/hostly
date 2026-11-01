/** Where to go after logging in: only same-app paths, never another site (`//evil.com`). */
export function safeRedirect(target: string | null): string {
  return target?.startsWith('/') && !target.startsWith('//') ? target : '/'
}
