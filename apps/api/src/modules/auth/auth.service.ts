import type { User } from '../../generated/prisma/client.js'
import { UniqueFieldError } from '../../shared/database-errors.js'
import { ConflictError } from '../../shared/errors.js'
import type { UserUniqueField, UsersRepository } from '../users/users.repository.js'
import type { RegisterInput } from './auth.schemas.js'

export interface AuthServiceDeps {
  users: Pick<UsersRepository, 'create' | 'takenFields'>
  hashPassword: (password: string) => Promise<string>
}

const TAKEN: Record<UserUniqueField, { code: string; message: string }> = {
  email: { code: 'EMAIL_TAKEN', message: 'E-mail already registered' },
  cpf: { code: 'CPF_TAKEN', message: 'CPF already registered' },
}

function takenError(field: UserUniqueField) {
  const { code, message } = TAKEN[field]
  return new ConflictError(message, { code, details: { field } })
}

export class AuthService {
  constructor(private readonly deps: AuthServiceDeps) {}

  /** Creates the account; throws ConflictError (EMAIL_TAKEN / CPF_TAKEN) if either is in use. */
  async register({ password, ...profile }: RegisterInput): Promise<User> {
    // Checked before hashing, so a taken e-mail or CPF doesn't cost an argon2 run.
    const [taken] = await this.deps.users.takenFields(profile)
    if (taken) {
      throw takenError(taken)
    }

    const passwordHash = await this.deps.hashPassword(password)
    try {
      return await this.deps.users.create({ ...profile, passwordHash })
    } catch (error) {
      // Someone else took it between the check and the insert.
      if (error instanceof UniqueFieldError) {
        throw takenError(error.field as UserUniqueField)
      }
      throw error
    }
  }
}
