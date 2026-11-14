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

export type MonthlyReport = components['schemas']['MonthlyReport']

/** Each month of the year, for one property or all of them. */
export function useMonthly({ year, propertyId }: { year: number; propertyId?: string }) {
  return useQuery({
    queryKey: ['reports', 'monthly', year, propertyId ?? 'all'] as const,
    queryFn: async () =>
      unwrap(await api.GET('/reports/monthly', { params: { query: { year, propertyId } } })),
    placeholderData: keepPreviousData,
  })
}

export type BrokersReport = components['schemas']['BrokersReport']

/** What to pay each broker, and how each channel did, in the period. */
export function useBrokersReport({ from, to }: Period, propertyId?: string) {
  return useQuery({
    queryKey: ['reports', 'brokers', from, to, propertyId ?? 'all'] as const,
    queryFn: async () =>
      unwrap(await api.GET('/reports/brokers', { params: { query: { from, to, propertyId } } })),
    placeholderData: keepPreviousData,
  })
}
