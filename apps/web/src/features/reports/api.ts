import { keepPreviousData, useQuery } from '@tanstack/react-query'

import { api } from '@/lib/api/client'
import { unwrap } from '@/lib/api/errors'
import type { components } from '@/lib/api/schema'

import type { Period } from './period'

export type PerformanceReport = components['schemas']['PerformanceReport']
export type ReportFigures = components['schemas']['ReportFigures']

export const reportKeys = {
  all: ['reports'] as const,
  performance: (from: string, to: string) => ['reports', 'performance', from, to] as const,
}

/** How each property did in the period. */
export function usePerformance({ from, to }: Period) {
  return useQuery({
    queryKey: reportKeys.performance(from, to),
    queryFn: async () =>
      unwrap(await api.GET('/reports/performance', { params: { query: { from, to } } })),
    placeholderData: keepPreviousData,
  })
}
