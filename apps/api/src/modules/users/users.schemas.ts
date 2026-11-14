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
    createdAt: user.createdAt.toISOString(),
  }
}

/** Body of PATCH /me: the name, the e-mail or both. */
export const updateProfileBodySchema = z
  .object({ name: nameSchema, email: emailSchema })
  .partial()
  .refine((body) => Object.keys(body).length > 0, { message: 'Nothing to update' })

export type UpdateProfileInput = z.infer<typeof updateProfileBodySchema>
