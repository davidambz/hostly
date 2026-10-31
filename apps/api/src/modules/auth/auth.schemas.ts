import { z } from 'zod'

import {
  cpfSchema,
  PASSWORD_MAX_LENGTH,
  emailSchema,
  nameSchema,
  passwordSchema,
  phoneSchema,
} from '../../shared/validation/fields.js'
import { publicUserSchema } from '../users/users.schemas.js'

export const registerBodySchema = z.object({
  name: nameSchema,
  email: emailSchema,
  cpf: cpfSchema,
  phone: phoneSchema,
  password: passwordSchema,
})

export type RegisterInput = z.infer<typeof registerBodySchema>

export const loginBodySchema = z.object({
  email: emailSchema,
  // Not validated beyond presence: the rules for new passwords may change over time.
  password: z.string().min(1, 'Required').max(PASSWORD_MAX_LENGTH),
})

export type LoginInput = z.infer<typeof loginBodySchema>

export const accessTokenSchema = z
  .object({
    accessToken: z.string(),
    tokenType: z.literal('Bearer'),
    /** Seconds until the access token expires. */
    expiresIn: z.number().int().positive(),
  })
  .meta({ id: 'AccessToken' })

export const loginResponseSchema = accessTokenSchema
  .extend({ user: publicUserSchema })
  .meta({ id: 'LoginResponse' })
