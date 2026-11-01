import { keepPreviousData, useMutation, useQuery, useQueryClient } from '@tanstack/react-query'

import { api } from '@/lib/api/client'
import { unwrap } from '@/lib/api/errors'
import type { components, paths } from '@/lib/api/schema'

export type Property = components['schemas']['Property']
export type PropertyType = Property['type']
/** What create (and a full update) sends, as the API contract defines it. */
export type PropertyInput =
  paths['/properties']['post']['requestBody']['content']['application/json']

export const PROPERTY_TYPE_LABELS: Record<PropertyType, string> = {
  HOUSE: 'Casa',
  APARTMENT: 'Apartamento',
}

export const PAGE_SIZE = 20

export interface PropertyListQuery {
  search?: string
  page: number
}

export const propertyKeys = {
  all: ['properties'] as const,
  list: (query: PropertyListQuery) => [...propertyKeys.all, 'list', query] as const,
}

export function useProperties(query: PropertyListQuery) {
  return useQuery({
    queryKey: propertyKeys.list(query),
    queryFn: async () =>
      unwrap(
        await api.GET('/properties', {
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

function useInvalidateProperties() {
  const queryClient = useQueryClient()
  // Bookings show property names, so they go stale too.
  return () =>
    Promise.all([
      queryClient.invalidateQueries({ queryKey: propertyKeys.all }),
      queryClient.invalidateQueries({ queryKey: ['bookings'] }),
    ])
}

export function useCreateProperty() {
  const invalidate = useInvalidateProperties()
  return useMutation({
    mutationFn: async (input: PropertyInput) =>
      unwrap(await api.POST('/properties', { body: input })),
    onSuccess: invalidate,
  })
}

export function useUpdateProperty() {
  const invalidate = useInvalidateProperties()
  return useMutation({
    mutationFn: async ({ id, input }: { id: string; input: PropertyInput }) =>
      unwrap(await api.PATCH('/properties/{id}', { params: { path: { id } }, body: input })),
    onSuccess: invalidate,
  })
}

export function useDeleteProperty() {
  const invalidate = useInvalidateProperties()
  return useMutation({
    mutationFn: async (id: string) =>
      unwrap(await api.DELETE('/properties/{id}', { params: { path: { id } } })),
    onSuccess: invalidate,
  })
}
