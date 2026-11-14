import { Link, NavLink, useMatch } from 'react-router'

import { NAV_ITEMS, type NavItem } from '@/app/navigation'
import { BrandMark } from '@/components/brand'
import {
  Sidebar,
  SidebarContent,
  SidebarFooter,
  SidebarGroup,
  SidebarGroupContent,
  SidebarHeader,
  SidebarMenu,
  SidebarMenuButton,
  SidebarMenuItem,
  SidebarRail,
  useSidebar,
} from '@/components/ui/sidebar'

import { UserMenu } from './user-menu'

/** Closes the mobile drawer once something in it is picked. */
function useCloseOnMobile() {
  const { isMobile, setOpenMobile } = useSidebar()
  return () => {
    if (isMobile) setOpenMobile(false)
  }
}

function NavEntry({ title, to, icon: Icon }: NavItem) {
  // The section stays highlighted on its sub-pages too (e.g. /imoveis/123).
  const active = useMatch({ path: to, end: false }) !== null
  const close = useCloseOnMobile()

  return (
    <SidebarMenuItem>
      <SidebarMenuButton asChild isActive={active} tooltip={title}>
        <NavLink to={to} end={false} onClick={close}>
          <Icon aria-hidden />
          <span>{title}</span>
        </NavLink>
      </SidebarMenuButton>
    </SidebarMenuItem>
  )
}

export function AppSidebar() {
  const close = useCloseOnMobile()

  return (
    <Sidebar collapsible="icon">
      <SidebarHeader>
        <SidebarMenu>
          <SidebarMenuItem>
            <SidebarMenuButton size="lg" asChild tooltip="Hostly">
              {/* A plain Link: the brand is not a section, so it is never "current". */}
              <Link to="/reservas" onClick={close} aria-label="Hostly, ir para o início">
                <BrandMark inverted className="size-8 text-lg" />
                <span className="font-display text-xl tracking-tight">Hostly</span>
              </Link>
            </SidebarMenuButton>
          </SidebarMenuItem>
        </SidebarMenu>
      </SidebarHeader>
      <SidebarContent>
        <SidebarGroup>
          <SidebarGroupContent>
            <nav aria-label="Principal">
              <SidebarMenu>
                {NAV_ITEMS.map((item) => (
                  <NavEntry key={item.to} {...item} />
                ))}
              </SidebarMenu>
            </nav>
          </SidebarGroupContent>
        </SidebarGroup>
      </SidebarContent>
      <SidebarFooter>
        <UserMenu />
      </SidebarFooter>
      <SidebarRail />
    </Sidebar>
  )
}
