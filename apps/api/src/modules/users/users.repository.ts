import type { User } from '../../generated/prisma/client.js'
import type { Database } from '../../shared/database.js'
import { UniqueFieldError } from '../../shared/database-errors.js'
import { uniqueViolation, violates } from '../../shared/prisma-errors.js'

export interface NewUser {
  name: string
  email: string
  passwordHash: string
}

export class UsersRepository {
  constructor(private readonly db: Database) {}

  findById(id: string): Promise<User | null> {
    return this.db.user.findUnique({ where: { id } })
  }

  findByEmail(email: string): Promise<User | null> {
    return this.db.user.findUnique({ where: { email } })
  }

  /** Whether an account uses this e-mail, without loading it (nor its password hash). */
  async existsByEmail(email: string): Promise<boolean> {
    const user = await this.db.user.findUnique({ where: { email }, select: { id: true } })
    return user !== null
  }

  /**
   * Throws UniqueFieldError when the e-mail is taken. The unique constraint is the real
   * guard: two signups racing for the same e-mail can't both get in.
   */
  async create(data: NewUser): Promise<User> {
    try {
      return await this.db.user.create({ data })
    } catch (error) {
      throw emailTakenOr(error)
    }
  }

  /** Changes the name and the e-mail; UniqueFieldError when the e-mail is someone else's. */
  async updateProfile(id: string, data: { name?: string; email?: string }): Promise<User> {
    try {
      return await this.db.user.update({ where: { id }, data })
    } catch (error) {
      throw emailTakenOr(error)
    }
  }

  async updatePasswordHash(id: string, passwordHash: string): Promise<void> {
    await this.db.user.update({ where: { id }, data: { passwordHash } })
  }
}

/** A unique violation on the e-mail as UniqueFieldError; any other error as it is. */
function emailTakenOr(error: unknown): unknown {
  const violation = uniqueViolation(error)
  if (violation && violates(violation, { table: 'users', field: 'email' })) {
    return new UniqueFieldError('email')
  }
  return error
}
