import { format } from 'date-fns'

import type { MyGrant, MyPlan, Plan } from './api'

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

const DURATION_LABELS: Record<MyGrant['duration'], string> = {
  ONE_MONTH: '1 mês',
  SIX_MONTHS: '6 meses',
  ONE_YEAR: '1 ano',
  LIFETIME: 'vitalícia',
}

/** `Premium por 1 ano, de 14/11/2026 a 14/11/2027`, or `Premium, vitalícia, desde …`. */
export function grantLabel(grant: MyGrant): string {
  const day = (iso: string) => format(new Date(iso), 'dd/MM/yyyy')
  if (grant.endsAt === null) {
    return `${grant.plan.name}, ${DURATION_LABELS.LIFETIME}, desde ${day(grant.startsAt)}`
  }
  return `${grant.plan.name} por ${DURATION_LABELS[grant.duration]}, de ${day(grant.startsAt)} a ${day(grant.endsAt)}`
}

/** Each billing period a plan is offered in, with its price. */
export function periodPrices(plan: Plan): { label: string; price: number }[] {
  const periods = [
    { label: 'por mês', price: plan.monthlyPrice },
    { label: 'por semestre', price: plan.semiannualPrice },
    { label: 'por ano', price: plan.annualPrice },
  ]
  return periods.filter(
    (period): period is { label: string; price: number } => period.price !== null,
  )
}
