import { z } from 'zod'

import type { User } from '../../generated/prisma/client.js'
import { emailSchema, nameSchema } from '../../shared/validation/fields.js'

/** A user as the API returns it: never with the password hash. */
export const publicUserSchema = z
  .object({
    id: z.uuid(),
    name: z.string(),
    email: z.email(),
    /** Accounts from before signup stopped asking for it; null otherwise. */
    cpf: z.string().nullable(),
    /** Accounts from before signup stopped asking for it; null otherwise. */
    phone: z.string().nullable(),
    /** Can use the backoffice. */
    isAdmin: z.boolean(),
    createdAt: z.iso.datetime(),
  })
  .meta({ id: 'User' })

export type PublicUser = z.infer<typeof publicUserSchema>

export function toPublicUser(user: User): PublicUser {
  return {
    id: user.id,
    name: user.name,
    email: user.email,
    cpf: user.cpf,
    phone: user.phone,
    isAdmin: user.isAdmin,
    createdAt: user.createdAt.toISOString(),
  }
}

/** Body of PATCH /me: the name, the e-mail or both. */
export const updateProfileBodySchema = z
  .object({ name: nameSchema, email: emailSchema })
  .partial()
  .refine((body) => Object.keys(body).length > 0, { message: 'Nothing to update' })

export type UpdateProfileInput = z.infer<typeof updateProfileBodySchema>

/** GET /me/plan: the plan the user is on and how much of it is used. */
export const myPlanSchema = z
  .object({
    plan: z.object({
      id: z.uuid(),
      code: z.string().nullable(),
      name: z.string(),
      description: z.string().nullable(),
      /** Null: unlimited. */
      maxProperties: z.number().int().nullable(),
    }),
    /** FREE, or GRANT when an administrator gave it. */
    source: z.enum(['FREE', 'GRANT']),
    /** When a granted plan ends; null when it doesn't (lifetime, or Free). */
    endsAt: z.iso.datetime().nullable(),
    propertyCount: z.number().int(),
    /** Whether the plan lets the user add another property now. */
    canAddProperty: z.boolean(),
  })
  .meta({ id: 'MyPlan' })
