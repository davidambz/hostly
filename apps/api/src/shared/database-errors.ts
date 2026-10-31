/**
 * Data-layer error: a write hit a unique constraint. Repositories throw it with the
 * field involved; services decide what that means for the user (usually a 409).
 */
export class UniqueFieldError<Field extends string = string> extends Error {
  constructor(readonly field: Field) {
    super(`Unique constraint violated on ${field}`)
    this.name = 'UniqueFieldError'
  }
}
