import { keepPreviousData, useMutation, useQuery, useQueryClient } from '@tanstack/react-query'

import { api } from '@/lib/api/client'
import { unwrap } from '@/lib/api/errors'
import type { components } from '@/lib/api/schema'

export type AdminUser = components['schemas']['AdminUser']

export const ADMIN_PAGE_SIZE = 20

export const adminKeys = {
  all: ['admin'] as const,
  users: (query: { search: string; page: number }) => [...adminKeys.all, 'users', query] as const,
}

/** Every account, for the backoffice. */
export function useAdminUsers(query: { search: string; page: number }) {
  return useQuery({
    queryKey: adminKeys.users(query),
    queryFn: async () =>
      unwrap(
        await api.GET('/admin/users', {
          params: {
            query: {
              page: query.page,
              pageSize: ADMIN_PAGE_SIZE,
              search: query.search === '' ? undefined : query.search,
            },
          },
        }),
      ),
    placeholderData: keepPreviousData,
  })
}

export function useSetAdmin() {
  const queryClient = useQueryClient()
  return useMutation({
    mutationFn: async ({ userId, isAdmin }: { userId: string; isAdmin: boolean }) =>
      unwrap(
        await api.PATCH('/admin/users/{id}/admin', {
          params: { path: { id: userId } },
          body: { isAdmin },
        }),
      ),
    onSuccess: () => queryClient.invalidateQueries({ queryKey: adminKeys.all }),
  })
}
