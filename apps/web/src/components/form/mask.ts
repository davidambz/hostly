import type { ChangeEvent } from 'react'
import type { UseFormRegisterReturn } from 'react-hook-form'

const significant = (char: string) => /[0-9A-Za-z]/.test(char)
const countSignificant = (text: string) => text.replace(/[^0-9A-Za-z]/g, '').length

/**
 * Reformats the input's value with `mask`, keeping the caret after the same letter or
 * digit it was after, so editing in the middle of a masked value doesn't jump to the end.
 */
export function applyMask(input: HTMLInputElement, mask: (value: string) => string): string {
  const { value, selectionStart } = input
  const next = mask(value)
  if (next === value) return next

  const caret = selectionStart ?? value.length
  const before = countSignificant(value.slice(0, caret))
  input.value = next
  if (caret < value.length) {
    let position = 0
    for (let seen = 0; position < next.length && seen < before; position++) {
      if (significant(next.charAt(position))) seen++
    }
    input.setSelectionRange(position, position)
  }
  return next
}

/** A registered field whose value is reformatted with `mask` as the user types. */
export function withMask<T extends UseFormRegisterReturn>(
  field: T,
  mask: (value: string) => string,
  /** Called with the masked value, after the form has it. */
  onMasked?: (value: string) => void,
): T {
  return {
    ...field,
    onChange: async (event: ChangeEvent<HTMLInputElement>) => {
      const value = applyMask(event.target, mask)
      await field.onChange(event)
      onMasked?.(value)
    },
  }
}
