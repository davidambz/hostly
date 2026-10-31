import type { User } from '../../generated/prisma/client.js'
import type { Database } from '../../shared/database.js'
import { ConflictError } from '../../shared/errors.js'
import { violatedUniqueConstraint } from '../../shared/prisma-errors.js'

export interface NewUser {
  name: string
  email: string
  cpf: string
  phone: string
  passwordHash: string
}

/** Which field a unique violation is about, as told to the client. */
const TAKEN = {
  users_email_key: { code: 'EMAIL_TAKEN', field: 'email', message: 'E-mail already registered' },
  users_cpf_key: { code: 'CPF_TAKEN', field: 'cpf', message: 'CPF already registered' },
} as const

export class UsersRepository {
  constructor(private readonly db: Database) {}

  /**
   * Relies on the unique constraints instead of checking first, so two signups racing
   * for the same e-mail or CPF can't both get in.
   */
  async create(data: NewUser): Promise<User> {
    try {
      return await this.db.user.create({ data })
    } catch (error) {
      const constraint = violatedUniqueConstraint(error)
      if (constraint === 'users_email_key' || constraint === 'users_cpf_key') {
        const { code, field, message } = TAKEN[constraint]
        throw new ConflictError(message, { code, details: { field } })
      }
      throw error
    }
  }
}
