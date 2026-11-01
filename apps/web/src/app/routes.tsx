import { Navigate, type RouteObject } from 'react-router'

import { AppLayout } from '@/components/layout/app-layout'
import { RequireAuth, RequireGuest } from '@/features/auth/guards'
import { LoginPage } from '@/features/auth/login-page'
import { RegisterPage } from '@/features/auth/register-page'
import { NotFoundPage } from '@/pages/not-found-page'

import type { RouteHandle } from './navigation'

const handle = (title: string): RouteHandle => ({ title })

export const routes: RouteObject[] = [
  {
    element: <RequireGuest />,
    children: [
      { path: '/login', element: <LoginPage />, handle: handle('Entrar') },
      { path: '/cadastro', element: <RegisterPage />, handle: handle('Criar conta') },
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
