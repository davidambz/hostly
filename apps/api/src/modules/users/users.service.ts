import type { User } from '../../generated/prisma/client.js'
import { UnauthorizedError } from '../../shared/errors.js'
import type { UsersRepository } from './users.repository.js'

export class UsersService {
  constructor(private readonly users: Pick<UsersRepository, 'findById'>) {}

  /** The account behind an access token; 401 if it was deleted after the token was issued. */
  async me(userId: string): Promise<User> {
    const user = await this.users.findById(userId)
    if (!user) {
      throw new UnauthorizedError('Account no longer exists', { code: 'INVALID_TOKEN' })
    }
    return user
  }
}
