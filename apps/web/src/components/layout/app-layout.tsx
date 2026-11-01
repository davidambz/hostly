import { Suspense, useEffect } from 'react'
import { Outlet, useMatches } from 'react-router'

import { isRouteHandle } from '@/app/navigation'
import { LoadingState } from '@/components/states'
import {
  Breadcrumb,
  BreadcrumbItem,
  BreadcrumbList,
  BreadcrumbPage,
} from '@/components/ui/breadcrumb'
import { Separator } from '@/components/ui/separator'
import { SidebarInset, SidebarProvider, SidebarTrigger } from '@/components/ui/sidebar'

import { AppSidebar } from './app-sidebar'

/** The title of the deepest route that has one, for the breadcrumb and the browser tab. */
function usePageTitle(): string | undefined {
  const matches = useMatches()
  const title = [...matches].reverse().find((match) => isRouteHandle(match.handle))?.handle
  const text = isRouteHandle(title) ? title.title : undefined

  useEffect(() => {
    document.title = text ? `${text} · Hostly` : 'Hostly'
  }, [text])

  return text
}

/** The logged-in app: sidebar, header, and the page in the middle. */
export function AppLayout() {
  const title = usePageTitle()

  return (
    <SidebarProvider>
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
          <Suspense fallback={<LoadingState />}>
            <Outlet />
          </Suspense>
        </main>
      </SidebarInset>
    </SidebarProvider>
  )
}
