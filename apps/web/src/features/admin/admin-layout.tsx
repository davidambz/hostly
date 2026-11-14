import { NavLink, Navigate, Outlet } from 'react-router'

import { cn } from '@/lib/utils'

import { useAuth } from '../auth/auth-context'

/** The backoffice's sections, in tab order. */
const ADMIN_SECTIONS = [
  { title: 'Usuários', to: '/admin/usuarios' },
  { title: 'Planos', to: '/admin/planos' },
]

/**
 * The backoffice: only for administrators (anyone else goes back to the bookings; the API
 * refuses them too), with its sections as tabs under the page title.
 */
export function AdminLayout() {
  const { user } = useAuth()
  if (!user?.isAdmin) return <Navigate to="/reservas" replace />

  return (
    <>
      <div className="space-y-1">
        <h1 className="font-wide animate-surface text-3xl leading-tight font-bold sm:text-4xl">
          Administração
        </h1>
        <p className="text-muted-foreground text-sm">Contas, planos e concessões do Hostly.</p>
      </div>
      <nav aria-label="Administração" className="flex gap-1 border-b">
        {ADMIN_SECTIONS.map(({ title, to }) => (
          <NavLink
            key={to}
            to={to}
            className={({ isActive }) =>
              cn(
                'focus-visible:ring-ring -mb-px border-b-2 px-3 py-2 text-sm font-medium outline-none focus-visible:ring-2',
                isActive
                  ? 'border-primary text-foreground'
                  : 'text-muted-foreground hover:text-foreground border-transparent',
              )
            }
          >
            {title}
          </NavLink>
        ))}
      </nav>
      <Outlet />
    </>
  )
}
