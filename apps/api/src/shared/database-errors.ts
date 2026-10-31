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

/**
 * Data-layer error: a row can't be deleted because other rows still reference it
 * (a foreign key). Services decide what that means for the user (usually a 409).
 */
export class RowInUseError extends Error {
  constructor(readonly referencedBy: string) {
    super(`Row is still referenced by ${referencedBy}`)
    this.name = 'RowInUseError'
  }
}

/**
 * Data-layer error: a write conflicts with an existing row under an exclusion constraint
 * (e.g. two bookings sharing a night). Services decide what that means for the user.
 */
export class ExclusionConflictError extends Error {
  constructor(readonly constraint: string) {
    super(`Exclusion constraint ${constraint} violated`)
    this.name = 'ExclusionConflictError'
  }
}
