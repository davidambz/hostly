import { format } from 'date-fns'

import type { MyPlan } from './api'

/** `1 de 1 imóvel`, `3 imóveis, sem limite`. */
export function usageLabel({ propertyCount, plan }: MyPlan): string {
  const noun = (count: number) => (count === 1 ? 'imóvel' : 'imóveis')
  if (plan.maxProperties === null) {
    return `${String(propertyCount)} ${noun(propertyCount)}, sem limite`
  }
  return `${String(propertyCount)} de ${String(plan.maxProperties)} ${noun(plan.maxProperties)}`
}

/** Where the plan comes from, in the user's words. */
export function sourceLabel({ source, endsAt }: MyPlan): string | null {
  if (source === 'FREE') return null
  return endsAt === null
    ? 'Cortesia, para sempre.'
    : `Cortesia até ${format(new Date(endsAt), 'dd/MM/yyyy')}.`
}
