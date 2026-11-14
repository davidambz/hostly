import { Link, NavLink, Outlet, useNavigation } from 'react-router'

import { NAV_ITEMS } from '@/app/navigation'
import { Brand } from '@/components/brand'
import { ModeToggle } from '@/components/theme/mode-toggle'
import { cn } from '@/lib/utils'

import { UserMenu } from './user-menu'

/** A thin bar at the top while the next page's code or data loads. */
function NavigationProgress() {
  const navigation = useNavigation()
  if (navigation.state === 'idle') return null
  return (
    <div
      role="progressbar"
      aria-label="Carregando página"
      className="bg-bar-active/20 fixed inset-x-0 top-0 z-50 h-0.5 overflow-hidden"
    >
      <div className="bg-bar-active h-full w-1/3 animate-[progress_1s_ease-in-out_infinite]" />
    </div>
  )
}

/**
 * The sections as tabs on the top bar. On a phone they drop to their own row under the brand,
 * scrolling sideways if they ever outgrow it.
 */
function SectionTabs() {
  return (
    <nav
      aria-label="Principal"
      className="order-last -mx-4 flex w-[calc(100%+2rem)] overflow-x-auto px-2 md:order-none md:mx-0 md:h-full md:w-auto md:px-0"
    >
      {NAV_ITEMS.map(({ title, to, icon: Icon }) => (
        <NavLink
          key={to}
          to={to}
          end={false}
          className={({ isActive }) =>
            cn(
              'relative inline-flex h-11 shrink-0 items-center gap-2 px-3 text-sm font-medium transition-colors md:h-full',
              'focus-visible:ring-bar-active outline-none focus-visible:ring-2 focus-visible:ring-inset',
              'after:bg-bar-active after:absolute after:inset-x-3 after:bottom-0 after:h-0.5 after:origin-left after:transition-transform after:duration-500 after:ease-(--ease-out-expo)',
              isActive
                ? 'text-bar-foreground after:scale-x-100'
                : 'text-bar-muted hover:text-bar-foreground after:scale-x-0',
            )
          }
        >
          <Icon className="size-4" aria-hidden />
          {title}
        </NavLink>
      ))}
    </nav>
  )
}

/** The logged-in app: the top bar with the sections, and the page under it. */
export function AppLayout() {
  return (
    <div className="flex min-h-svh flex-col">
      <NavigationProgress />
      <header className="bg-bar text-bar-foreground border-bar-border sticky top-0 z-20 border-b">
        <div className="mx-auto flex max-w-7xl flex-wrap items-center gap-x-6 px-4 md:h-14 md:flex-nowrap md:px-8">
          {/* A plain Link: the brand is not a section, so it is never "current". */}
          <Link
            to="/reservas"
            aria-label="Hostly, ir para o início"
            className="focus-visible:ring-bar-active flex h-14 items-center rounded-md outline-none focus-visible:ring-2"
          >
            <Brand inverted />
          </Link>
          <SectionTabs />
          <div className="ml-auto flex items-center gap-1">
            <ModeToggle className="text-bar-foreground hover:bg-bar-accent hover:text-bar-foreground" />
            <UserMenu />
          </div>
        </div>
      </header>
      <main
        id="conteudo"
        className="mx-auto w-full max-w-7xl flex-1 space-y-6 px-4 py-6 md:px-8 md:py-8"
      >
        <Outlet />
      </main>
    </div>
  )
}
