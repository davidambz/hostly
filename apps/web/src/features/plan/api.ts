import { useMutation, useQuery, useQueryClient } from '@tanstack/react-query'

import { api } from '@/lib/api/client'
import { unwrap } from '@/lib/api/errors'
import type { components } from '@/lib/api/schema'

export type MyPlan = components['schemas']['MyPlan']

/** Refreshed whenever properties are added or removed (the usage changes with them). */
export const myPlanKey = ['plan', 'me'] as const

/** The plan the user is on and how many properties it allows. */
export function useMyPlan() {
  return useQuery({
    queryKey: myPlanKey,
    queryFn: async () => unwrap(await api.GET('/me/plan')),
  })
}

export type Plan = components['schemas']['Plan']
export type MyGrant = components['schemas']['MyGrant']

/** The plans on sale, Free first. */
export function usePlans() {
  return useQuery({
    queryKey: ['plan', 'all'],
    queryFn: async () => unwrap(await api.GET('/plans')),
  })
}

/** The courtesy plans an administrator gave this account. */
export function useMyGrants() {
  return useQuery({
    queryKey: ['plan', 'grants'],
    queryFn: async () => unwrap(await api.GET('/me/grants')),
  })
}

export type BillingPeriod = 'MONTHLY' | 'SEMIANNUAL' | 'ANNUAL'

/** Starts paying for a plan: answers the Stripe checkout page to go to. */
export function useCheckout() {
  return useMutation({
    mutationFn: async (input: { planId: string; period: BillingPeriod }) =>
      unwrap(await api.POST('/billing/checkout', { body: input })),
  })
}

export type BillingPayment = components['schemas']['BillingPayment']

/** The account's charges, newest first. */
export function useBillingPayments() {
  return useQuery({
    queryKey: ['plan', 'payments'],
    queryFn: async () => unwrap(await api.GET('/billing/payments')),
  })
}

/** Every change to the subscription refreshes the plan (and its page). */
function useSubscriptionMutation<T>(run: (input: T) => Promise<unknown>) {
  const queryClient = useQueryClient()
  return useMutation({
    mutationFn: run,
    onSuccess: () => queryClient.invalidateQueries({ queryKey: ['plan'] }),
  })
}

export function useSetRenewal() {
  return useSubscriptionMutation(async (renew: boolean) =>
    unwrap(await api.POST('/billing/subscription/renewal', { body: { renew } })),
  )
}

export function useChangePeriod() {
  return useSubscriptionMutation(async (period: BillingPeriod) =>
    unwrap(await api.POST('/billing/subscription/period', { body: { period } })),
  )
}

export function usePortal() {
  return useMutation({
    mutationFn: async () => unwrap(await api.POST('/billing/portal')),
  })
}
