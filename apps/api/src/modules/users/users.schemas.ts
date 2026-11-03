import { z } from 'zod'

import type { User } from '../../generated/prisma/client.js'

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
