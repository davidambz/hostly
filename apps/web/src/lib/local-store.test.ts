import { afterEach, describe, expect, it, vi } from 'vitest'

import { readStored, removeStored, writeStored } from './local-store'

afterEach(() => {
  vi.restoreAllMocks()
})

describe('local store', () => {
  it('writes, reads and removes a value', () => {
    writeStored('k', 'v')
    expect(readStored('k')).toBe('v')
    removeStored('k')
    expect(readStored('k')).toBeNull()
  })

  it('reads as nothing saved, and never throws, when storage is blocked', () => {
    const blocked = () => {
      throw new DOMException('blocked', 'SecurityError')
    }
    vi.spyOn(Storage.prototype, 'getItem').mockImplementation(blocked)
    vi.spyOn(Storage.prototype, 'setItem').mockImplementation(blocked)
    vi.spyOn(Storage.prototype, 'removeItem').mockImplementation(blocked)

    expect(() => {
      writeStored('k', 'v')
      removeStored('k')
    }).not.toThrow()
    expect(readStored('k')).toBeNull()
  })
})
