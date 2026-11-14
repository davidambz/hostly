import { z } from 'zod'

import { formatBRL, parseMoney } from '@/lib/money'

import type { Plan, PlanInput } from './api'

/** Every field as typed: amounts masked (`R$ 39,90`), the limit as digits, blank = unlimited. */
export const planFormSchema = z.object({
  name: z.string().trim().min(1, 'Dê um nome ao plano.').max(100, 'Nome longo demais.'),
  description: z.string().trim().max(1000, 'Descrição longa demais.'),
  maxProperties: z
    .string()
    .trim()
    .refine((value) => value === '' || (/^\d+$/.test(value) && Number(value) >= 1), {
      message: 'Pelo menos 1 imóvel, ou deixe em branco para ilimitado.',
    }),
  monthlyPrice: z.string(),
  semiannualPrice: z.string(),
  annualPrice: z.string(),
})

export type PlanFormValues = z.infer<typeof planFormSchema>

export const EMPTY_PLAN_FORM: PlanFormValues = {
  name: '',
  description: '',
  maxProperties: '',
  monthlyPrice: '',
  semiannualPrice: '',
  annualPrice: '',
}

const amount = (cents: number | null) => (cents === null ? '' : formatBRL(cents))

export function toPlanFormValues(plan: Plan): PlanFormValues {
  return {
    name: plan.name,
    description: plan.description ?? '',
    maxProperties: plan.maxProperties === null ? '' : String(plan.maxProperties),
    monthlyPrice: amount(plan.monthlyPrice),
    semiannualPrice: amount(plan.semiannualPrice),
    annualPrice: amount(plan.annualPrice),
  }
}

export function toPlanInput(values: PlanFormValues): Required<PlanInput> {
  return {
    name: values.name,
    description: values.description || null,
    maxProperties: values.maxProperties === '' ? null : Number(values.maxProperties),
    monthlyPrice: parseMoney(values.monthlyPrice),
    semiannualPrice: parseMoney(values.semiannualPrice),
    annualPrice: parseMoney(values.annualPrice),
  }
}

/** `1 imóvel`, `5 imóveis`, `Ilimitados`. */
export function propertyLimitLabel(limit: number | null): string {
  if (limit === null) return 'Ilimitados'
  return limit === 1 ? '1 imóvel' : `${String(limit)} imóveis`
}
