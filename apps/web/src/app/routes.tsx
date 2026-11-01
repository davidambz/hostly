import { Navigate, type RouteObject } from 'react-router'

import { AppLayout } from '@/components/layout/app-layout'
import { RequireAuth, RequireGuest } from '@/features/auth/guards'
import { NotFoundPage } from '@/pages/not-found-page'

import type { RouteHandle } from './navigation'

const handle = (title: string): RouteHandle => ({ title })

export const routes: RouteObject[] = [
  {
    element: <RequireGuest />,
    children: [
      {
        path: '/login',
        handle: handle('Entrar'),
        lazy: async () => ({ Component: (await import('@/features/auth/login-page')).LoginPage }),
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
          { path: '/', element: <Navigate to="/reservas" replace /> },
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
]
