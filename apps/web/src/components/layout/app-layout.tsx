import { Outlet, useNavigation } from 'react-router'

import { useRouteTitle } from '@/app/route-title'
import {
  Breadcrumb,
  BreadcrumbItem,
  BreadcrumbList,
  BreadcrumbPage,
} from '@/components/ui/breadcrumb'
import { Separator } from '@/components/ui/separator'
import { SidebarInset, SidebarProvider, SidebarTrigger } from '@/components/ui/sidebar'

import { AppSidebar } from './app-sidebar'
import { readSidebarOpen } from './sidebar-state'

/** A thin bar at the top while the next page's code or data loads. */
function NavigationProgress() {
  const navigation = useNavigation()
  if (navigation.state === 'idle') return null
  return (
    <div
      role="progressbar"
      aria-label="Carregando página"
      className="bg-primary/20 fixed inset-x-0 top-0 z-50 h-0.5 overflow-hidden"
    >
      <div className="bg-primary h-full w-1/3 animate-[progress_1s_ease-in-out_infinite]" />
    </div>
  )
}

/** The logged-in app: sidebar, header, and the page in the middle. */
export function AppLayout() {
  const title = useRouteTitle()

  return (
    <SidebarProvider defaultOpen={readSidebarOpen()}>
      <NavigationProgress />
      <AppSidebar />
      <SidebarInset>
        <header className="bg-background/80 sticky top-0 z-10 flex h-14 shrink-0 items-center gap-2 border-b px-4 backdrop-blur">
          <SidebarTrigger className="-ml-1" aria-label="Alternar menu" />
          <Separator orientation="vertical" className="mr-2 data-[orientation=vertical]:h-4" />
          {title && (
            <Breadcrumb>
              <BreadcrumbList>
                <BreadcrumbItem>
                  <BreadcrumbPage>{title}</BreadcrumbPage>
                </BreadcrumbItem>
              </BreadcrumbList>
            </Breadcrumb>
          )}
        </header>
        <main id="conteudo" className="mx-auto w-full max-w-6xl flex-1 space-y-6 p-4 md:p-8">
          <Outlet />
        </main>
      </SidebarInset>
    </SidebarProvider>
  )
}
