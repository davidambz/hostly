import type { User } from '../../generated/prisma/client.js'
import type { UsersRepository } from '../users/users.repository.js'
import type { RegisterInput } from './auth.schemas.js'

export interface AuthServiceDeps {
  users: Pick<UsersRepository, 'create'>
  hashPassword: (password: string) => Promise<string>
}

export class AuthService {
  constructor(private readonly deps: AuthServiceDeps) {}

  /** Creates the account; throws ConflictError (EMAIL_TAKEN / CPF_TAKEN) if either is in use. */
  async register({ password, ...profile }: RegisterInput): Promise<User> {
    const passwordHash = await this.deps.hashPassword(password)
    return this.deps.users.create({ ...profile, passwordHash })
  }
}
