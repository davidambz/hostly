import { describe, expect, it } from 'vitest'

import { ApiError } from './api/errors'
import { createQueryClient, shouldRetry } from './query-client'

describe('shouldRetry', () => {
  it.each([400, 401, 404, 409, 429])('never retries a %i', (status) => {
    expect(shouldRetry(0, new ApiError(status, undefined))).toBe(false)
  })

  it('retries server and network errors twice', () => {
    for (const error of [new ApiError(503, undefined), new TypeError('Failed to fetch')]) {
      expect(shouldRetry(0, error)).toBe(true)
      expect(shouldRetry(1, error)).toBe(true)
      expect(shouldRetry(2, error)).toBe(false)
    }
  })

  it('is the default for queries, not for mutations', () => {
    const defaults = createQueryClient().getDefaultOptions()

    expect(defaults.queries?.retry).toBe(shouldRetry)
    expect(defaults.mutations?.retry).toBe(false)
  })
})
