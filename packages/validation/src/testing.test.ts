import { describe, expect, it } from 'vitest'

import { cnpjCheckDigits } from './brazil.js'
import { validAlphanumericCnpj, validCnpj, validCpf } from './testing.js'

describe('test document generators', () => {
  it('computes the CPF check digits (known answer: 529.982.247-25)', () => {
    expect(validCpf(429_982_247)).toBe('52998224725')
  })

  it('computes the CNPJ check digits (known answer: 11.222.333/0001-81)', () => {
    expect(validCnpj(1_222_333)).toBe('11222333000181')
  })

  it('gives distinct, digits-only documents for distinct seeds', () => {
    const cpfs = Array.from({ length: 200 }, (_, i) => validCpf(i + 1))
    const cnpjs = Array.from({ length: 200 }, (_, i) => validCnpj(i + 1))

    expect(new Set(cpfs).size).toBe(200)
    expect(new Set(cnpjs).size).toBe(200)
    expect(cpfs.every((cpf) => /^\d{11}$/.test(cpf))).toBe(true)
    expect(cnpjs.every((cnpj) => /^\d{14}$/.test(cnpj))).toBe(true)
  })
})

describe('validAlphanumericCnpj', () => {
  it('gives distinct alphanumeric CNPJs with numeric check digits', () => {
    const cnpjs = Array.from({ length: 200 }, (_, i) => validAlphanumericCnpj(i + 1))

    expect(new Set(cnpjs).size).toBe(200)
    expect(cnpjs.every((cnpj) => /^AB\d{10}\d{2}$/.test(cnpj))).toBe(true)
  })
})

it('computes the alphanumeric CNPJ check digits (known answer: 12.ABC.345/01DE-35)', () => {
  // The generators and the validator compute the digits apart: they must agree.
  expect(cnpjCheckDigits('12ABC34501DE')).toBe('35')
})
