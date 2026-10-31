import { describe, expect, it } from 'vitest'

import { escapeLike } from './search.js'

describe('escapeLike', () => {
  it.each([
    ['casa', 'casa'],
    ['100%', '100\\%'],
    ['a_b', 'a\\_b'],
    ['c:\\x', 'c:\\\\x'],
    ['%_\\', '\\%\\_\\\\'],
  ])('%s → %s', (input, output) => {
    expect(escapeLike(input)).toBe(output)
  })
})
