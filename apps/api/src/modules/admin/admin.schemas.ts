import { z } from 'zod'

import { pageSchema, paginationQuerySchema } from '../../shared/pagination.js'

export const listUsersQuerySchema = paginationQuerySchema.extend({
  /** Part of the name or the e-mail, any case. */
  search: z.string().trim().max(255).optional(),
})

export type ListUsersQuery = z.infer<typeof listUsersQuerySchema>

export const userIdParamsSchema = z.object({ id: z.uuid() })

export const setAdminBodySchema = z.object({ isAdmin: z.boolean() })

export const adminUserSchema = z
  .object({
    id: z.uuid(),
    name: z.string(),
    email: z.string(),
    isAdmin: z.boolean(),
    createdAt: z.iso.datetime(),
    /** How many properties the user has. */
    propertyCount: z.number().int(),
    /** The plan the user is on now. */
    plan: z.object({ id: z.uuid(), code: z.string().nullable(), name: z.string() }),
    /** FREE, GRANT when an administrator gave it, SUBSCRIPTION when it is paid. */
    planSource: z.enum(['FREE', 'GRANT', 'SUBSCRIPTION']),
    /** The grant in force, if any; `endsAt` null for a lifetime one. */
    grant: z.object({ id: z.uuid(), endsAt: z.iso.datetime().nullable() }).nullable(),
  })
  .meta({ id: 'AdminUser' })

export type AdminUser = z.infer<typeof adminUserSchema>

export const adminUserPageSchema = pageSchema(adminUserSchema).meta({ id: 'AdminUserPage' })
