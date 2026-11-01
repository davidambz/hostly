import { describe, expect, it } from 'vitest'

import {
  bpsToPercent,
  formatBRL,
  formatPercent,
  MAX_CENTS,
  maskMoney,
  maskPercent,
  parseMoney,
  percentToBps,
} from './money'

describe('money', () => {
  it.each([
    [0, 'R$ 0,00'],
    [5, 'R$ 0,05'],
    [123456, 'R$ 1.234,56'],
    [MAX_CENTS, 'R$ 10.000.000,00'],
  ])('formatBRL(%i) → %s', (cents, text) => {
    expect(formatBRL(cents)).toBe(text)
  })

  it.each([
    ['', ''],
    ['1', 'R$ 0,01'],
    ['12', 'R$ 0,12'],
    ['1234', 'R$ 12,34'],
    ['R$ 12,345', 'R$ 123,45'],
    ['R$ 12,3', 'R$ 1,23'],
    ['0', 'R$ 0,00'],
    ['abc', ''],
    ['99999999999', 'R$ 10.000.000,00'],
  ])('maskMoney(%j) → %j, like a cash register', (typed, masked) => {
    expect(maskMoney(typed)).toBe(masked)
  })

  it('reads the cents back, or null when blank', () => {
    expect(parseMoney('R$ 1.234,56')).toBe(123456)
    expect(parseMoney('')).toBeNull()
  })
})

describe('percent', () => {
  it.each([
    ['', ''],
    ['10', '10'],
    ['10,5', '10,5'],
    ['10.5', '10,5'],
    ['10,555', '10,55'],
    ['1000', '100'],
    ['1,2,3', '1,23'],
    ['a5%', '5'],
  ])('maskPercent(%j) → %j', (typed, masked) => {
    expect(maskPercent(typed)).toBe(masked)
  })

  it('converts between percent and basis points', () => {
    expect(percentToBps('10,5')).toBe(1050)
    expect(percentToBps('0,01')).toBe(1)
    expect(percentToBps(' ')).toBeNull()
    // a comma alone (the mask allows it while typing) is no number
    expect(percentToBps(',')).toBeNull()
    expect(bpsToPercent(1050)).toBe('10,5')
    expect(bpsToPercent(1000)).toBe('10')
    expect(formatPercent(1250)).toBe('12,5%')
  })
})
