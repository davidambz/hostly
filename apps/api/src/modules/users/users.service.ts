import type { User } from '../../generated/prisma/client.js'
import { UniqueFieldError } from '../../shared/database-errors.js'
import { ConflictError, UnauthorizedError } from '../../shared/errors.js'
import type { UpdateProfileInput } from './users.schemas.js'
import type { UsersRepository } from './users.repository.js'

export class UsersService {
  constructor(private readonly users: Pick<UsersRepository, 'findById' | 'updateProfile'>) {}

  /** The account behind an access token; 401 if it was deleted after the token was issued. */
  async me(userId: string): Promise<User> {
    const user = await this.users.findById(userId)
    if (!user) {
      throw new UnauthorizedError('Account no longer exists', { code: 'INVALID_TOKEN' })
    }
    return user
  }

  /** Changes the name or the e-mail; 409 EMAIL_TAKEN when the e-mail belongs to another account. */
  async updateProfile(userId: string, input: UpdateProfileInput): Promise<User> {
    await this.me(userId)
    try {
      return await this.users.updateProfile(userId, input)
    } catch (error) {
      if (error instanceof UniqueFieldError) {
        throw new ConflictError('E-mail already registered', {
          code: 'EMAIL_TAKEN',
          details: { field: 'email' },
        })
      }
      throw error
    }
  }
}
