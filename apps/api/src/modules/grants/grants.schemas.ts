import { z } from 'zod'

export const grantDurationSchema = z.enum(['ONE_MONTH', 'SIX_MONTHS', 'ONE_YEAR', 'LIFETIME'])

const reasonSchema = z.string().trim().min(1, 'Required').max(500)

export const createGrantBodySchema = z.object({
  planId: z.uuid(),
  duration: grantDurationSchema,
  /** Why: shows in the history. */
  reason: reasonSchema,
})
export type CreateGrantInput = z.infer<typeof createGrantBodySchema>

export const renewGrantBodySchema = z.object({
  duration: grantDurationSchema,
  reason: reasonSchema,
})
export type RenewGrantInput = z.infer<typeof renewGrantBodySchema>

export const changeGrantPlanBodySchema = z.object({ planId: z.uuid(), reason: reasonSchema })
export type ChangeGrantPlanInput = z.infer<typeof changeGrantPlanBodySchema>

export const revokeGrantBodySchema = z.object({ reason: reasonSchema })

export const grantIdParamsSchema = z.object({ id: z.uuid() })

const planRefSchema = z.object({ id: z.uuid(), code: z.string().nullable(), name: z.string() })
const personSchema = z.object({ id: z.uuid(), name: z.string() }).nullable()

export const grantSchema = z
  .object({
    id: z.uuid(),
    plan: planRefSchema,
    duration: grantDurationSchema,
    startsAt: z.iso.datetime(),
    /** Null for a lifetime grant. */
    endsAt: z.iso.datetime().nullable(),
    reason: z.string(),
    revokedAt: z.iso.datetime().nullable(),
    /** Not revoked, started and not over. */
    inForce: z.boolean(),
    /** Null when that administrator's account was deleted. */
    grantedBy: personSchema,
    /** Oldest first. */
    events: z.array(
      z.object({
        action: z.enum(['GRANTED', 'RENEWED', 'PLAN_CHANGED', 'REVOKED']),
        plan: planRefSchema,
        endsAt: z.iso.datetime().nullable(),
        duration: grantDurationSchema.nullable(),
        reason: z.string(),
        at: z.iso.datetime(),
        actor: personSchema,
      }),
    ),
  })
  .meta({ id: 'PlanGrant' })

export type PublicGrant = z.infer<typeof grantSchema>
