import { describe, expect, it, vi } from 'vitest'

import { getAccessToken, onAccessTokenChange, setAccessToken } from './session'

describe('session', () => {
  it('keeps the token in memory and tells listeners, until they unsubscribe', () => {
    const listener = vi.fn()
    const unsubscribe = onAccessTokenChange(listener)

    setAccessToken('t1')
    unsubscribe()
    setAccessToken(null)

    expect(listener).toHaveBeenCalledTimes(1)
    expect(listener).toHaveBeenCalledWith('t1')
    expect(getAccessToken()).toBeNull()
  })

  it('never touches localStorage', () => {
    setAccessToken('secret')

    expect(localStorage.length).toBe(0)
    expect(sessionStorage.length).toBe(0)
    setAccessToken(null)
  })
})
