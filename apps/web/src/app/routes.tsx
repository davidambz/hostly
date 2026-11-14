import { Navigate, type RouteObject } from 'react-router'

import { AppLayout } from '@/components/layout/app-layout'
import { RequireAuth, RequireGuest, RequireVisitor } from '@/features/auth/guards'
import { NotFoundPage } from '@/pages/not-found-page'
import { RouteErrorPage } from '@/pages/route-error-page'

import { AppLoading, RootLayout } from './root-layout'

import type { RouteHandle } from './navigation'

const handle = (title: string): RouteHandle => ({ title })

export const routes: RouteObject[] = [
  {
    element: <RootLayout />,
    // A full-screen error for anything outside the app layout (which has its own, below).
    errorElement: <RouteErrorPage />,
    hydrateFallbackElement: <AppLoading />,
    children: [
      {
        element: <RequireVisitor />,
        children: [
          {
            path: '/',
            handle: handle('Reservas de temporada organizadas'),
            lazy: async () => ({
              Component: (await import('@/features/landing/landing-page')).LandingPage,
            }),
          },
        ],
      },
      {
        element: <RequireGuest />,
        children: [
          {
            path: '/login',
            handle: handle('Entrar'),
            lazy: async () => ({
              Component: (await import('@/features/auth/login-page')).LoginPage,
            }),
          },
          {
            path: '/cadastro',
            handle: handle('Criar conta'),
            lazy: async () => ({
              Component: (await import('@/features/auth/register-page')).RegisterPage,
            }),
          },
        ],
      },
      {
        element: <RequireAuth />,
        children: [
          {
            element: <AppLayout />,
            children: [
              {
                path: '/reservas',
                handle: handle('Reservas'),
                lazy: async () => ({
                  Component: (await import('@/features/bookings/bookings-page')).BookingsPage,
                }),
              },
              {
                path: '/imoveis',
                handle: handle('Imóveis'),
                lazy: async () => ({
                  Component: (await import('@/features/properties/properties-page')).PropertiesPage,
                }),
              },
              {
                lazy: async () => ({
                  Component: (await import('@/features/admin/admin-layout')).AdminLayout,
                }),
                children: [
                  { path: '/admin', element: <Navigate to="/admin/usuarios" replace /> },
                  {
                    path: '/admin/usuarios',
                    handle: handle('Usuários · Administração'),
                    lazy: async () => ({
                      Component: (await import('@/features/admin/admin-users-page')).AdminUsersPage,
                    }),
                  },
                  {
                    path: '/admin/planos',
                    handle: handle('Planos · Administração'),
                    lazy: async () => ({
                      Component: (await import('@/features/admin/admin-plans-page')).AdminPlansPage,
                    }),
                  },
                ],
              },
              {
                path: '/plano',
                handle: handle('Meu plano'),
                lazy: async () => ({
                  Component: (await import('@/features/plan/plan-page')).PlanPage,
                }),
              },
              {
                path: '/conta',
                handle: handle('Conta'),
                lazy: async () => ({
                  Component: (await import('@/features/account/account-page')).AccountPage,
                }),
              },
              {
                path: '/intermediadores',
                handle: handle('Intermediadores'),
                lazy: async () => ({
                  Component: (await import('@/features/brokers/brokers-page')).BrokersPage,
                }),
              },
            ],
          },
        ],
      },
      { path: '*', element: <NotFoundPage />, handle: handle('Página não encontrada') },
    ],
  },
]
