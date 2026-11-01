import { ChevronsUpDown, LogOut, Monitor, Moon, Sun } from 'lucide-react'

import type { Theme } from '@/components/theme/theme-context'
import { useTheme } from '@/components/theme/theme-context'
import { Avatar, AvatarFallback } from '@/components/ui/avatar'
import {
  DropdownMenu,
  DropdownMenuContent,
  DropdownMenuItem,
  DropdownMenuLabel,
  DropdownMenuRadioGroup,
  DropdownMenuRadioItem,
  DropdownMenuSeparator,
  DropdownMenuSub,
  DropdownMenuSubContent,
  DropdownMenuSubTrigger,
  DropdownMenuTrigger,
} from '@/components/ui/dropdown-menu'
import { SidebarMenu, SidebarMenuButton, SidebarMenuItem } from '@/components/ui/sidebar'
import { useAuth } from '@/features/auth/auth-context'

import { initials } from './initials'

const THEMES: { value: Theme; label: string; Icon: typeof Sun }[] = [
  { value: 'light', label: 'Claro', Icon: Sun },
  { value: 'dark', label: 'Escuro', Icon: Moon },
  { value: 'system', label: 'Sistema', Icon: Monitor },
]

/** The logged-in user at the bottom of the sidebar: theme and logout. */
export function UserMenu() {
  const { user, logout } = useAuth()
  const { theme, setTheme } = useTheme()
  if (!user) return null

  return (
    <SidebarMenu>
      <SidebarMenuItem>
        <DropdownMenu>
          <DropdownMenuTrigger asChild>
            <SidebarMenuButton size="lg" aria-label={`Conta de ${user.name}`}>
              <Avatar className="size-8 rounded-lg">
                <AvatarFallback className="bg-sidebar-primary text-sidebar-primary-foreground rounded-lg text-xs font-semibold">
                  {initials(user.name)}
                </AvatarFallback>
              </Avatar>
              <div className="grid flex-1 text-left text-sm leading-tight">
                <span className="truncate font-medium">{user.name}</span>
                <span className="truncate text-xs opacity-70">{user.email}</span>
              </div>
              <ChevronsUpDown className="ml-auto size-4" aria-hidden />
            </SidebarMenuButton>
          </DropdownMenuTrigger>
          <DropdownMenuContent
            side="top"
            align="start"
            className="w-(--radix-dropdown-menu-trigger-width) min-w-56"
          >
            <DropdownMenuLabel className="font-normal">
              <p className="font-medium">{user.name}</p>
              <p className="text-muted-foreground text-xs">{user.email}</p>
            </DropdownMenuLabel>
            <DropdownMenuSeparator />
            <DropdownMenuSub>
              <DropdownMenuSubTrigger>Tema</DropdownMenuSubTrigger>
              <DropdownMenuSubContent>
                <DropdownMenuRadioGroup
                  value={theme}
                  onValueChange={(value) => {
                    setTheme(value as Theme)
                  }}
                >
                  {THEMES.map(({ value, label, Icon }) => (
                    <DropdownMenuRadioItem key={value} value={value}>
                      <Icon className="size-4" />
                      {label}
                    </DropdownMenuRadioItem>
                  ))}
                </DropdownMenuRadioGroup>
              </DropdownMenuSubContent>
            </DropdownMenuSub>
            <DropdownMenuSeparator />
            <DropdownMenuItem onSelect={logout}>
              <LogOut className="size-4" />
              Sair
            </DropdownMenuItem>
          </DropdownMenuContent>
        </DropdownMenu>
      </SidebarMenuItem>
    </SidebarMenu>
  )
}
