import { keepPreviousData, useMutation, useQuery, useQueryClient } from '@tanstack/react-query'

import { api } from '@/lib/api/client'
import { unwrap } from '@/lib/api/errors'
import type { components, paths } from '@/lib/api/schema'

export type Booking = components['schemas']['Booking']
export type Financials = components['schemas']['BookingFinancials']
/** What create (and a full update) sends, as the API contract defines it. */
export type BookingInput = paths['/bookings']['post']['requestBody']['content']['application/json']
export type QuoteInput =
  paths['/bookings/quote']['post']['requestBody']['content']['application/json']
export type BookingStatus = 'upcoming' | 'past'

export const PAGE_SIZE = 20

export interface BookingListQuery {
  status: BookingStatus
  propertyId?: string
  search?: string
  page: number
}

export interface CalendarQuery {
  /** First day, `YYYY-MM-DD`. */
  from: string
  /** Day after the last one, `YYYY-MM-DD`. */
  to: string
  propertyId?: string
}

export const bookingKeys = {
  all: ['bookings'] as const,
  list: (query: BookingListQuery) => [...bookingKeys.all, 'list', query] as const,
  calendar: (query: CalendarQuery) => [...bookingKeys.all, 'calendar', query] as const,
}

const blankToUndefined = (value: string | undefined) => (value === '' ? undefined : value)

export function useBookings(query: BookingListQuery) {
  return useQuery({
    queryKey: bookingKeys.list(query),
    queryFn: async () =>
      unwrap(
        await api.GET('/bookings', {
          params: {
            query: {
              status: query.status,
              page: query.page,
              pageSize: PAGE_SIZE,
              propertyId: blankToUndefined(query.propertyId),
              search: blankToUndefined(query.search),
            },
          },
        }),
      ),
    placeholderData: keepPreviousData,
  })
}

export function useCalendarBookings(query: CalendarQuery) {
  return useQuery({
    queryKey: bookingKeys.calendar(query),
    queryFn: async () =>
      unwrap(
        await api.GET('/bookings/calendar', {
          params: {
            query: {
              from: query.from,
              to: query.to,
              propertyId: blankToUndefined(query.propertyId),
            },
          },
        }),
      ),
    // Moving between months keeps the old one on screen until the new one arrives.
    placeholderData: keepPreviousData,
  })
}

/** The financial summary of a booking being filled in; nothing while `input` is null. */
export function useQuote(input: QuoteInput | null) {
  return useQuery({
    queryKey: ['quote', input],
    queryFn: async () => {
      if (input === null) throw new Error('Nothing to quote')
      // Kept with its input: while the next quote loads, this one is shown whole.
      return { input, financials: unwrap(await api.POST('/bookings/quote', { body: input })) }
    },
    enabled: input !== null,
    placeholderData: keepPreviousData,
    // The same numbers always give the same quote.
    staleTime: Infinity,
    retry: false,
  })
}

function useInvalidateBookings() {
  const queryClient = useQueryClient()
  return () => queryClient.invalidateQueries({ queryKey: bookingKeys.all })
}

export function useCreateBooking() {
  const invalidate = useInvalidateBookings()
  return useMutation({
    mutationFn: async (input: BookingInput) => unwrap(await api.POST('/bookings', { body: input })),
    onSuccess: invalidate,
  })
}

export function useUpdateBooking() {
  const invalidate = useInvalidateBookings()
  return useMutation({
    mutationFn: async ({ id, input }: { id: string; input: BookingInput }) =>
      unwrap(await api.PATCH('/bookings/{id}', { params: { path: { id } }, body: input })),
    onSuccess: invalidate,
  })
}

export function useDeleteBooking() {
  const invalidate = useInvalidateBookings()
  return useMutation({
    mutationFn: async (id: string) =>
      unwrap(await api.DELETE('/bookings/{id}', { params: { path: { id } } })),
    onSuccess: invalidate,
  })
}
