/**
 * Escapes LIKE wildcards so user input is matched literally: Prisma's `contains` passes
 * `%` and `_` straight to the database, where they would match anything.
 */
export function escapeLike(text: string): string {
  return text.replace(/[\\%_]/g, '\\$&')
}
