import { describe, expect, it } from 'vitest'

import { validCpf } from '../../test/documents.js'
import {
  cpfCheckDigits,
  isValidCpf,
  isValidLandlinePhone,
  isValidMobilePhone,
  isValidPhone,
  normalizePhone,
  onlyDigits,
} from './brazil.js'

describe('onlyDigits', () => {
  it.each([
    ['529.982.247-25', '52998224725'],
    ['(48) 99999-0000', '48999990000'],
    [' 12 34 ', '1234'],
    ['abc', ''],
  ])('%s → %s', (input, output) => {
    expect(onlyDigits(input)).toBe(output)
  })
})

describe('isValidCpf', () => {
  it.each(['52998224725', '11144477735', '39053344705'])('accepts %s', (cpf) => {
    expect(isValidCpf(cpf)).toBe(true)
  })

  it('accepts every generated test CPF', () => {
    for (let seed = 1; seed <= 500; seed++) {
      expect(isValidCpf(validCpf(seed))).toBe(true)
    }
  })

  it.each([
    ['a wrong first check digit', '52998224735'],
    ['a wrong second check digit', '52998224726'],
    ['too few digits', '5299822472'],
    ['too many digits', '529982247250'],
    ['a mask', '529.982.247-25'],
    ['letters', '5299822472a'],
    ['empty', ''],
  ])('rejects a CPF with %s', (_case, cpf) => {
    expect(isValidCpf(cpf)).toBe(false)
  })

  it.each(Array.from({ length: 10 }, (_, d) => String(d).repeat(11)))(
    'rejects %s, which passes the check digits but is not a real CPF',
    (cpf) => {
      expect(isValidCpf(cpf)).toBe(false)
    },
  )
})

describe('phones', () => {
  it.each(['48999990000', '11987654321', '99912345678'])('accepts the mobile %s', (phone) => {
    expect(isValidMobilePhone(phone)).toBe(true)
    expect(isValidPhone(phone)).toBe(true)
  })

  it.each(['4833334444', '1121234567', '5155556666'])('accepts the landline %s', (phone) => {
    expect(isValidLandlinePhone(phone)).toBe(true)
    expect(isValidPhone(phone)).toBe(true)
  })

  it.each([
    ['an unused area code', '20999990000'],
    ['area code 00', '00999990000'],
    ['a mobile without the leading 9', '48899990000'],
    ['a landline starting with 9', '4893334444'],
    ['a landline starting with 1', '4813334444'],
    ['too few digits', '489999000'],
    ['too many digits', '489999900000'],
    ['a mask', '(48) 99999-0000'],
    ['empty', ''],
  ])('rejects %s', (_case, phone) => {
    expect(isValidPhone(phone)).toBe(false)
  })

  it('does not take a mobile for a landline or the other way around', () => {
    expect(isValidLandlinePhone('48999990000')).toBe(false)
    expect(isValidMobilePhone('4833334444')).toBe(false)
  })
})

describe('cpfCheckDigits', () => {
  it.each([
    ['529982247', '25'],
    ['111444777', '35'],
    ['390533447', '05'],
  ])('%s → %s', (base, digits) => {
    expect(cpfCheckDigits(base)).toBe(digits)
  })
})

describe('normalizePhone', () => {
  it.each([
    ['(48) 99999-0000', '48999990000'],
    ['+55 (48) 99999-0000', '48999990000'],
    ['55 48 3333-4444', '4833334444'],
    ['048 99999-0000', '48999990000'],
    ['0 48 3333-4444', '4833334444'],
    ['48999990000', '48999990000'],
  ])('%s → %s', (input, output) => {
    expect(normalizePhone(input)).toBe(output)
  })

  it('keeps a number that only happens to start with 55 (area code 55)', () => {
    expect(normalizePhone('55999990000')).toBe('55999990000')
  })
})
