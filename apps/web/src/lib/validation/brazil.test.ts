import { describe, expect, it } from 'vitest'

import {
  cnpjCheckDigits,
  isValidCep,
  isValidCnpj,
  isValidCpf,
  isValidLandlinePhone,
  isValidMobilePhone,
  isValidPhone,
  maskCep,
  maskCnpj,
  maskCpf,
  maskPhone,
  normalizeDocument,
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

describe('phone kinds', () => {
  it.each([
    ['(48) 99999-0000', true, false],
    ['+55 48 99999-0000', true, false],
    ['(48) 3333-4444', false, true],
    ['(20) 99999-0000', false, false],
    ['(48) 8999-0000', false, false],
  ])('%s → mobile %o, landline %o', (phone, mobile, landline) => {
    expect(isValidMobilePhone(phone)).toBe(mobile)
    expect(isValidLandlinePhone(phone)).toBe(landline)
    expect(isValidPhone(phone)).toBe(mobile || landline)
  })
})

describe('CNPJ', () => {
  it.each([
    ['', ''],
    ['11', '11'],
    ['112', '11.2'],
    ['11222333', '11.222.333'],
    ['112223330001', '11.222.333/0001'],
    ['11222333000181', '11.222.333/0001-81'],
    ['11.222.333/0001-81999', '11.222.333/0001-81'],
    ['12abc34501de35', '12.ABC.345/01DE-35'],
    // the check digits are digits only
    ['12ABC34501DEXY', '12.ABC.345/01DE'],
  ])('maskCnpj %j → %j', (input, output) => {
    expect(maskCnpj(input)).toBe(output)
  })

  it('normalizes a typed document to letters and digits, uppercased', () => {
    expect(normalizeDocument('12.abc.345/01de-35')).toBe('12ABC34501DE35')
  })

  it.each(['11.222.333/0001-81', '11222333000181', '12.ABC.345/01DE-35', '12abc34501de35'])(
    'accepts %s',
    (cnpj) => {
      expect(isValidCnpj(cnpj)).toBe(true)
    },
  )

  it.each([
    ['a wrong check digit', '11222333000182'],
    ['all the same', '11111111111111'],
    ['letters in the check digits', '12ABC34501DEAB'],
    ['too short', '1122233300018'],
  ])('rejects %s', (_case, cnpj) => {
    expect(isValidCnpj(cnpj)).toBe(false)
  })

  it('matches the API check digits', () => {
    expect(cnpjCheckDigits('112223330001')).toBe('81')
    expect(cnpjCheckDigits('12ABC34501DE')).toBe('35')
  })
})
