import { SIDEBAR_COOKIE_NAME } from '@/components/ui/sidebar'

/** Whether the sidebar was left open, from the cookie the sidebar itself writes. */
export function readSidebarOpen(cookie = document.cookie): boolean {
  const value = cookie
    .split('; ')
    .find((entry) => entry.startsWith(`${SIDEBAR_COOKIE_NAME}=`))
    ?.split('=')[1]
  return value !== 'false'
}
