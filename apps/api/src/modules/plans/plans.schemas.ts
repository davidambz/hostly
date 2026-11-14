import { z } from 'zod'

import type { Plan } from '../../generated/prisma/client.js'
import { optionalText } from '../../shared/validation/fields.js'
import { optionalCentsSchema } from '../../shared/validation/money.js'

const planFields = {
  name: z.string().trim().min(1).max(100),
  description: optionalText(1000),
  /** Properties allowed; null for unlimited. */
  maxProperties: z.number().int().min(1).max(100_000).nullable(),
  /** Cents; null while the period isn't offered. */
  monthlyPrice: optionalCentsSchema,
  semiannualPrice: optionalCentsSchema,
  annualPrice: optionalCentsSchema,
}

export const createPlanBodySchema = z.object({
  ...planFields,
  maxProperties: planFields.maxProperties.default(null),
})

export type CreatePlanInput = z.infer<typeof createPlanBodySchema>

/** Send only what changes; `active: false` takes the plan off sale (not Free). */
export const updatePlanBodySchema = z
  .object({ ...planFields, active: z.boolean() })
  .partial()
  .refine((body) => Object.keys(body).length > 0, { message: 'Nothing to update' })

export type UpdatePlanInput = z.infer<typeof updatePlanBodySchema>

export const planIdParamsSchema = z.object({ id: z.uuid() })

export const planSchema = z
  .object({
    id: z.uuid(),
    /** "free" and "premium" for the plans the system relies on; null for the others. */
    code: z.string().nullable(),
    name: z.string(),
    description: z.string().nullable(),
    active: z.boolean(),
    maxProperties: z.number().int().nullable(),
    monthlyPrice: z.number().int().nullable(),
    semiannualPrice: z.number().int().nullable(),
    annualPrice: z.number().int().nullable(),
    createdAt: z.iso.datetime(),
    updatedAt: z.iso.datetime(),
  })
  .meta({ id: 'Plan' })

export type PublicPlan = z.infer<typeof planSchema>

export function toPublicPlan(plan: Plan): PublicPlan {
  return {
    ...plan,
    createdAt: plan.createdAt.toISOString(),
    updatedAt: plan.updatedAt.toISOString(),
  }
}
