import { createHash, randomBytes } from 'node:crypto'

/** A new opaque refresh token: 256 random bits, URL-safe. */
export function generateRefreshToken(): string {
  return randomBytes(32).toString('base64url')
}

/** What is stored instead of the token itself. */
export function hashRefreshToken(token: string): string {
  return createHash('sha256').update(token).digest('hex')
}
