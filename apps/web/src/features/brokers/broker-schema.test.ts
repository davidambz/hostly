import { describe, expect, it } from 'vitest'

import type { Broker } from './api'
import { documentLine, phonesLine } from './broker-format'
import {
  brokerFormSchema,
  EMPTY_BROKER_FORM,
  maskDocument,
  toBrokerInput,
  toFormValues,
} from './broker-schema'

const company: Broker = {
  id: 'b1',
  type: 'COMPANY',
  name: 'Imobiliária Litoral',
  email: 'contato@litoral.com',
  document: '12ABC34501DE35',
  mobilePhone: '48999990000',
  landlinePhone: '4833334444',
  createdAt: '',
  updatedAt: '',
}

const parse = (values: Partial<typeof EMPTY_BROKER_FORM>) =>
  brokerFormSchema.safeParse({ ...EMPTY_BROKER_FORM, name: 'Maria', ...values })

describe('brokerFormSchema', () => {
  it('accepts a broker with only a type and a name', () => {
    expect(parse({}).success).toBe(true)
  })

  it.each([
    ['a CPF for a person', 'INDIVIDUAL', '529.982.247-25'],
    ['a numeric CNPJ for a company', 'COMPANY', '11.222.333/0001-81'],
    ['an alphanumeric CNPJ for a company', 'COMPANY', '12.ABC.345/01DE-35'],
  ] as const)('accepts %s', (_case, type, document) => {
    expect(parse({ type, document }).success).toBe(true)
  })

  it.each([
    ['a CNPJ for a person', 'INDIVIDUAL', '11.222.333/0001-81', 'CPF inválido.'],
    ['a CPF for a company', 'COMPANY', '529.982.247-25', 'CNPJ inválido.'],
    ['a CPF with a wrong digit', 'INDIVIDUAL', '529.982.247-26', 'CPF inválido.'],
  ] as const)('rejects %s', (_case, type, document, message) => {
    const issue = parse({ type, document }).error?.issues[0]
    expect(issue).toMatchObject({ path: ['document'], message })
  })

  it.each([
    ['no name', { name: '  ' }, 'Informe o nome.'],
    ['a bad e-mail', { email: 'maria@' }, 'E-mail inválido.'],
    ['a landline as the mobile', { mobilePhone: '(48) 3333-4444' }, 'Celular inválido.'],
    ['a mobile as the landline', { landlinePhone: '(48) 99999-0000' }, 'Telefone fixo inválido.'],
    ['an unknown area code', { mobilePhone: '(20) 99999-0000' }, 'Celular inválido.'],
  ])('rejects %s', (_case, values, message) => {
    expect(parse(values).error?.issues[0]?.message).toBe(message)
  })
})

describe('toBrokerInput', () => {
  it('strips the masks, lowercases the e-mail and turns blanks into null', () => {
    const values = brokerFormSchema.parse({
      ...EMPTY_BROKER_FORM,
      type: 'COMPANY',
      name: ' Litoral ',
      email: ' Contato@Litoral.com ',
      document: '12.abc.345/01de-35',
      mobilePhone: '(48) 99999-0000',
    })

    expect(toBrokerInput(values)).toEqual({
      type: 'COMPANY',
      name: 'Litoral',
      email: 'contato@litoral.com',
      document: '12ABC34501DE35',
      mobilePhone: '48999990000',
      landlinePhone: null,
    })
  })
})

describe('toFormValues', () => {
  it('masks what was saved', () => {
    expect(toFormValues(company)).toEqual({
      type: 'COMPANY',
      name: 'Imobiliária Litoral',
      email: 'contato@litoral.com',
      document: '12.ABC.345/01DE-35',
      mobilePhone: '(48) 99999-0000',
      landlinePhone: '(48) 3333-4444',
    })
  })

  it('round-trips through the form unchanged', () => {
    const { id: _id, createdAt: _c, updatedAt: _u, ...fields } = company

    expect(toBrokerInput(brokerFormSchema.parse(toFormValues(company)))).toEqual(fields)
  })

  it('leaves empty fields empty', () => {
    const bare = { ...company, email: null, document: null, mobilePhone: null, landlinePhone: null }

    expect(toFormValues(bare)).toMatchObject({ email: '', document: '', mobilePhone: '' })
  })
})

describe('broker lines', () => {
  it('mask the document by type and list the phones', () => {
    expect(maskDocument('INDIVIDUAL', '52998224725')).toBe('529.982.247-25')
    expect(documentLine(company)).toBe('12.ABC.345/01DE-35')
    expect(phonesLine(company)).toBe('(48) 99999-0000 · (48) 3333-4444')
  })

  it('are empty when there is nothing', () => {
    const bare = { ...company, document: null, mobilePhone: null, landlinePhone: null }

    expect([documentLine(bare), phonesLine(bare)]).toEqual(['', ''])
  })
})
