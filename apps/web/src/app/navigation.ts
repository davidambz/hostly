import { CalendarDays, Home, type LucideIcon, Users } from 'lucide-react'

export interface NavItem {
  title: string
  to: string
  icon: LucideIcon
}

/** The app's sections, in sidebar order. */
export const NAV_ITEMS: NavItem[] = [
  { title: 'Reservas', to: '/reservas', icon: CalendarDays },
  { title: 'Imóveis', to: '/imoveis', icon: Home },
  { title: 'Intermediadores', to: '/intermediadores', icon: Users },
]

/** What a route puts in the breadcrumb and the browser tab (`handle` in the route). */
export interface RouteHandle {
  title: string
}

export function isRouteHandle(handle: unknown): handle is RouteHandle {
  return (
    typeof handle === 'object' &&
    handle !== null &&
    typeof (handle as RouteHandle).title === 'string'
  )
}
