import { describe, expect, it } from 'vitest'

import { ApiError, errorField } from './errors'

describe('errorField', () => {
  it.each([
    [{ field: 'email' }, 'email'],
    [{ field: 3 }, undefined],
    [[{ path: 'name' }], undefined],
    [undefined, undefined],
  ])('reads %j as %j', (details, field) => {
    expect(errorField(new ApiError(400, { code: 'X', message: 'x', details }))).toBe(field)
  })
})
