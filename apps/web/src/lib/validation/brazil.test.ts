import { describe, expect, it } from 'vitest'

import {
  isValidCep,
  isValidCpf,
  isValidPhone,
  maskCep,
  maskCpf,
  maskPhone,
  onlyDigits,
} from './brazil'

describe('maskCpf', () => {
  it.each([
    ['', ''],
    ['5', '5'],
    ['529', '529'],
    ['5299', '529.9'],
    ['529982', '529.982'],
    ['5299822', '529.982.2'],
    ['529982247', '529.982.247'],
    ['5299822472', '529.982.247-2'],
    ['52998224725', '529.982.247-25'],
    ['529982247250000', '529.982.247-25'],
    ['529.982.247-25', '529.982.247-25'],
    ['abc529', '529'],
  ])('%j → %j', (input, output) => {
    expect(maskCpf(input)).toBe(output)
  })
})

describe('maskPhone', () => {
  it.each([
    ['', ''],
    ['4', '(4'],
    ['48', '(48'],
    ['489', '(48) 9'],
    ['483333', '(48) 3333'],
    ['4833334', '(48) 3333-4'],
    ['4833334444', '(48) 3333-4444'],
    ['48999990000', '(48) 99999-0000'],
    ['4899999000099', '(48) 99999-0000'],
    ['+55 48 99999-0000', '(48) 99999-0000'],
    ['048 3333-4444', '(48) 3333-4444'],
  ])('%j → %j', (input, output) => {
    expect(maskPhone(input)).toBe(output)
  })
})

describe('isValidCpf', () => {
  it.each(['529.982.247-25', '52998224725', '111.444.777-35'])('accepts %s', (cpf) => {
    expect(isValidCpf(cpf)).toBe(true)
  })

  it.each(['529.982.247-26', '111.111.111-11', '5299822472', ''])('rejects %s', (cpf) => {
    expect(isValidCpf(cpf)).toBe(false)
  })
})

describe('isValidPhone', () => {
  it.each([
    '(48) 99999-0000',
    '(48) 3333-4444',
    '11987654321',
    '+55 48 99999-0000',
    '048 3333-4444',
  ])('accepts %s', (phone) => {
    expect(isValidPhone(phone)).toBe(true)
  })

  it.each([
    '(48) 8999-00000',
    '(48) 9333-4444',
    '(08) 99999-0000',
    '9999-0000',
    '(20) 99999-0000',
    '(23) 3333-4444',
  ])('rejects %s', (phone) => {
    expect(isValidPhone(phone)).toBe(false)
  })
})

it('onlyDigits strips everything else', () => {
  expect(onlyDigits('(48) 9.9-a')).toBe('4899')
})

describe('CEP', () => {
  it.each([
    ['', ''],
    ['880', '880'],
    ['88053', '88053'],
    ['880537', '88053-7'],
    ['88053700', '88053-700'],
    ['88053-7009', '88053-700'],
  ])('maskCep %j → %j', (input, output) => {
    expect(maskCep(input)).toBe(output)
  })

  it.each([
    ['88053-700', true],
    ['88053700', true],
    ['00000-000', false],
    ['8805370', false],
  ])('isValidCep %s → %o', (cep, valid) => {
    expect(isValidCep(cep)).toBe(valid)
  })
})
