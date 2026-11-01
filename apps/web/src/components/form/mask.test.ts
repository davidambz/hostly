import { describe, expect, it } from 'vitest'

import { maskPhone } from '@/lib/validation/brazil'

import { applyMask } from './mask'

function input(value: string, caret = value.length) {
  const element = document.createElement('input')
  document.body.append(element)
  element.value = value
  element.setSelectionRange(caret, caret)
  return element
}

describe('applyMask', () => {
  it('masks the value', () => {
    const element = input('48999990000')

    expect(applyMask(element, maskPhone)).toBe('(48) 99999-0000')
    expect(element.value).toBe('(48) 99999-0000')
  })

  it('keeps the caret after the same digit when editing in the middle', () => {
    // "(48) 99999-0000" with the 8 deleted: the caret was after "4"
    const element = input('(4) 99999-0000', 2)

    applyMask(element, maskPhone)

    expect(element.value).toBe('(49) 9999-0000')
    expect(element.selectionStart).toBe(2)
  })

  it('leaves the caret alone when typing at the end', () => {
    const element = input('(48) 9999')

    applyMask(element, maskPhone)

    expect(element.selectionStart).toBe(element.value.length)
  })

  it('does not touch a value that is already masked', () => {
    const element = input('(48) 99999-0000', 3)

    applyMask(element, maskPhone)

    expect(element.selectionStart).toBe(3)
  })
})
