import { CalendarDays } from 'lucide-react'
import { NavLink, useLocation } from 'react-router'

import { NAV_ITEMS } from '@/app/navigation'
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

export function AppSidebar() {
  const { pathname } = useLocation()
  const { isMobile, setOpenMobile } = useSidebar()

  return (
    <Sidebar collapsible="icon">
      <SidebarHeader>
        <SidebarMenu>
          <SidebarMenuItem>
            <SidebarMenuButton size="lg" asChild tooltip="Hostly">
              <NavLink to="/reservas">
                <span className="bg-sidebar-primary text-sidebar-primary-foreground flex size-8 shrink-0 items-center justify-center rounded-lg">
                  <CalendarDays className="size-4" aria-hidden />
                </span>
                <span className="text-base font-semibold">Hostly</span>
              </NavLink>
            </SidebarMenuButton>
          </SidebarMenuItem>
        </SidebarMenu>
      </SidebarHeader>
      <SidebarContent>
        <SidebarGroup>
          <SidebarGroupContent>
            <nav aria-label="Principal">
              <SidebarMenu>
                {NAV_ITEMS.map(({ title, to, icon: Icon }) => {
                  const active = pathname === to || pathname.startsWith(`${to}/`)
                  return (
                    <SidebarMenuItem key={to}>
                      <SidebarMenuButton asChild isActive={active} tooltip={title}>
                        <NavLink
                          to={to}
                          aria-current={active ? 'page' : undefined}
                          onClick={() => {
                            // The mobile drawer closes once a section is picked.
                            if (isMobile) setOpenMobile(false)
                          }}
                        >
                          <Icon aria-hidden />
                          <span>{title}</span>
                        </NavLink>
                      </SidebarMenuButton>
                    </SidebarMenuItem>
                  )
                })}
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
