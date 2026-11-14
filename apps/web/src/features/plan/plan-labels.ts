import { format } from 'date-fns'

import type { BillingPeriod, MyGrant, MyPlan, Plan } from './api'

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

export interface PeriodPrice {
  period: BillingPeriod
  label: string
  price: number
}

/** Each billing period a plan is offered in, with its price. */
export function periodPrices(plan: Plan): PeriodPrice[] {
  const periods = [
    { period: 'MONTHLY' as const, label: 'por mês', price: plan.monthlyPrice },
    { period: 'SEMIANNUAL' as const, label: 'por semestre', price: plan.semiannualPrice },
    { period: 'ANNUAL' as const, label: 'por ano', price: plan.annualPrice },
  ]
  return periods.filter(
    (period): period is PeriodPrice => period.price !== null && period.price > 0,
  )
}

const PERIOD_NAMES: Record<BillingPeriod, string> = {
  MONTHLY: 'mensal',
  SEMIANNUAL: 'semestral',
  ANNUAL: 'anual',
}

/** `Assinatura mensal. Próxima cobrança em 14/12/2026.`, or when it was cancelled. */
export function subscriptionLabel({ subscription }: MyPlan): string | null {
  if (!subscription) return null
  const name = `Assinatura ${PERIOD_NAMES[subscription.period]}.`
  if (!subscription.currentPeriodEnd) return name
  const day = format(new Date(subscription.currentPeriodEnd), 'dd/MM/yyyy')
  return subscription.cancelAtPeriodEnd
    ? `${name} Renovação cancelada: vale até ${day}.`
    : `${name} Próxima cobrança em ${day}.`
}
