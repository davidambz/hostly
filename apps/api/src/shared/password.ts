import { hash, verify } from '@node-rs/argon2'

/** argon2id with the library's defaults (OWASP-recommended memory and time cost). */
export function hashPassword(password: string): Promise<string> {
  return hash(password)
}

export async function verifyPassword(passwordHash: string, password: string): Promise<boolean> {
  try {
    return await verify(passwordHash, password)
  } catch {
    // A malformed hash is a mismatch, not a server error.
    return false
  }
}
