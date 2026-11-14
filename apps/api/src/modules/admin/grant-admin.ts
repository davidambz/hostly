import type { Database } from '../../shared/database.js'

/**
 * Makes the account with `email` an administrator (or not). Returns its name, or null when
 * no account has that e-mail. Used by `pnpm admin:grant`, to name the first admin, who can
 * then name the others in the backoffice.
 */
export async function setAdmin(
  db: Database,
  email: string,
  isAdmin: boolean,
): Promise<string | null> {
  const { count } = await db.user.updateMany({
    where: { email: email.trim().toLowerCase() },
    data: { isAdmin },
  })
  if (count === 0) return null
  const user = await db.user.findUniqueOrThrow({
    where: { email: email.trim().toLowerCase() },
    select: { name: true },
  })
  return user.name
}
