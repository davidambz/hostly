import { z } from 'zod'

import {
  cpfSchema,
  emailSchema,
  nameSchema,
  passwordSchema,
  phoneSchema,
} from '../../shared/validation/fields.js'

export const registerBodySchema = z.object({
  name: nameSchema,
  email: emailSchema,
  cpf: cpfSchema,
  phone: phoneSchema,
  password: passwordSchema,
})

export type RegisterInput = z.infer<typeof registerBodySchema>
