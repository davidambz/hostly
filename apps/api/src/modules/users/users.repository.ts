import type { User } from '../../generated/prisma/client.js'
import type { Database } from '../../shared/database.js'
import { UniqueFieldError } from '../../shared/database-errors.js'
import { uniqueViolation, violates } from '../../shared/prisma-errors.js'

export interface NewUser {
  name: string
  email: string
  cpf: string
  phone: string
  passwordHash: string
}

export type UserUniqueField = 'email' | 'cpf'

const UNIQUE_FIELDS: UserUniqueField[] = ['email', 'cpf']

export class UsersRepository {
  constructor(private readonly db: Database) {}

  findById(id: string): Promise<User | null> {
    return this.db.user.findUnique({ where: { id } })
  }

  findByEmail(email: string): Promise<User | null> {
    return this.db.user.findUnique({ where: { email } })
  }

  /** Which of `email` and `cpf` already belong to an account. */
  async takenFields(values: Pick<NewUser, UserUniqueField>): Promise<UserUniqueField[]> {
    const users = await this.db.user.findMany({
      where: { OR: [{ email: values.email }, { cpf: values.cpf }] },
      select: { email: true, cpf: true },
    })
    return UNIQUE_FIELDS.filter((field) => users.some((user) => user[field] === values[field]))
  }

  /**
   * Throws UniqueFieldError when the e-mail or CPF is taken. The unique constraints are
   * the real guard: two signups racing for the same e-mail can't both get in.
   */
  async create(data: NewUser): Promise<User> {
    try {
      return await this.db.user.create({ data })
    } catch (error) {
      const violation = uniqueViolation(error)
      const field = violation
        ? UNIQUE_FIELDS.find((f) => violates(violation, { table: 'users', field: f }))
        : undefined
      if (field) {
        throw new UniqueFieldError(field)
      }
      throw error
    }
  }
}
