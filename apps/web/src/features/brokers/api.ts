import { keepPreviousData, useMutation, useQuery, useQueryClient } from '@tanstack/react-query'

import { api } from '@/lib/api/client'
import { unwrap } from '@/lib/api/errors'
import type { components, paths } from '@/lib/api/schema'

export type Broker = components['schemas']['Broker']
export type BrokerType = Broker['type']
/** What create (and a full update) sends, as the API contract defines it. */
export type BrokerInput = paths['/brokers']['post']['requestBody']['content']['application/json']

export const BROKER_TYPE_LABELS: Record<BrokerType, string> = {
  INDIVIDUAL: 'Pessoa física',
  COMPANY: 'Pessoa jurídica',
}

/** Short labels for the list. */
export const BROKER_TYPE_BADGES: Record<BrokerType, string> = {
  INDIVIDUAL: 'PF',
  COMPANY: 'PJ',
}

export const PAGE_SIZE = 20

export interface BrokerListQuery {
  search?: string
  page: number
}

export const brokerKeys = {
  all: ['brokers'] as const,
  list: (query: BrokerListQuery) => [...brokerKeys.all, 'list', query] as const,
}

export function useBrokers(query: BrokerListQuery) {
  return useQuery({
    queryKey: brokerKeys.list(query),
    queryFn: async () =>
      unwrap(
        await api.GET('/brokers', {
          params: {
            query: {
              page: query.page,
              pageSize: PAGE_SIZE,
              search: query.search === '' ? undefined : query.search,
            },
          },
        }),
      ),
    // Keep showing the current page while the next one loads.
    placeholderData: keepPreviousData,
  })
}

function useInvalidateBrokers() {
  const queryClient = useQueryClient()
  // Bookings show broker names, so they go stale too.
  return () =>
    Promise.all([
      queryClient.invalidateQueries({ queryKey: brokerKeys.all }),
      queryClient.invalidateQueries({ queryKey: ['bookings'] }),
    ])
}

export function useCreateBroker() {
  const invalidate = useInvalidateBrokers()
  return useMutation({
    mutationFn: async (input: BrokerInput) => unwrap(await api.POST('/brokers', { body: input })),
    onSuccess: invalidate,
  })
}

export function useUpdateBroker() {
  const invalidate = useInvalidateBrokers()
  return useMutation({
    mutationFn: async ({ id, input }: { id: string; input: BrokerInput }) =>
      unwrap(await api.PATCH('/brokers/{id}', { params: { path: { id } }, body: input })),
    onSuccess: invalidate,
  })
}

export function useDeleteBroker() {
  const invalidate = useInvalidateBrokers()
  return useMutation({
    mutationFn: async (id: string) =>
      unwrap(await api.DELETE('/brokers/{id}', { params: { path: { id } } })),
    onSuccess: invalidate,
  })
}
