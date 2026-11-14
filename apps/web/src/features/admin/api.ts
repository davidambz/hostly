import { keepPreviousData, useMutation, useQuery, useQueryClient } from '@tanstack/react-query'

import { api } from '@/lib/api/client'
import { unwrap } from '@/lib/api/errors'
import type { components, paths } from '@/lib/api/schema'

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

export type Plan = components['schemas']['Plan']
export type PlanInput = paths['/admin/plans']['post']['requestBody']['content']['application/json']
export type PlanChanges = NonNullable<
  paths['/admin/plans/{id}']['patch']['requestBody']
>['content']['application/json']

/** Every plan, Free first. */
export function useAdminPlans() {
  return useQuery({
    queryKey: [...adminKeys.all, 'plans'],
    queryFn: async () => unwrap(await api.GET('/admin/plans')),
  })
}

export function useCreatePlan() {
  const queryClient = useQueryClient()
  return useMutation({
    mutationFn: async (input: PlanInput) => unwrap(await api.POST('/admin/plans', { body: input })),
    onSuccess: () => queryClient.invalidateQueries({ queryKey: adminKeys.all }),
  })
}

export function useUpdatePlan() {
  const queryClient = useQueryClient()
  return useMutation({
    mutationFn: async ({ id, input }: { id: string; input: PlanChanges }) =>
      unwrap(await api.PATCH('/admin/plans/{id}', { params: { path: { id } }, body: input })),
    onSuccess: () => queryClient.invalidateQueries({ queryKey: adminKeys.all }),
  })
}

export type PlanGrant = components['schemas']['PlanGrant']
export type GrantDuration = PlanGrant['duration']

const grantKeys = (userId: string) => [...adminKeys.all, 'grants', userId] as const

/** A user's grants, newest first, each with its history. */
export function useUserGrants(userId: string) {
  return useQuery({
    queryKey: grantKeys(userId),
    queryFn: async () =>
      unwrap(await api.GET('/admin/users/{id}/grants', { params: { path: { id: userId } } })),
  })
}

/** Every grant action refreshes the backoffice (the accounts' plans change with it). */
function useGrantMutation<T>(run: (input: T) => Promise<unknown>) {
  const queryClient = useQueryClient()
  return useMutation({
    mutationFn: run,
    onSuccess: () => queryClient.invalidateQueries({ queryKey: adminKeys.all }),
  })
}

export function useGrantPlan(userId: string) {
  return useGrantMutation(
    async (input: { planId: string; duration: GrantDuration; reason: string }) =>
      unwrap(
        await api.POST('/admin/users/{id}/grants', {
          params: { path: { id: userId } },
          body: input,
        }),
      ),
  )
}

export function useRenewGrant() {
  return useGrantMutation(
    async ({ id, ...body }: { id: string; duration: GrantDuration; reason: string }) =>
      unwrap(await api.POST('/admin/grants/{id}/renew', { params: { path: { id } }, body })),
  )
}

export function useChangeGrantPlan() {
  return useGrantMutation(async ({ id, ...body }: { id: string; planId: string; reason: string }) =>
    unwrap(await api.PATCH('/admin/grants/{id}/plan', { params: { path: { id } }, body })),
  )
}

export function useRevokeGrant() {
  return useGrantMutation(async ({ id, reason }: { id: string; reason: string }) =>
    unwrap(
      await api.POST('/admin/grants/{id}/revoke', { params: { path: { id } }, body: { reason } }),
    ),
  )
}
