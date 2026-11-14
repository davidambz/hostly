import { useQuery } from '@tanstack/react-query'

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
