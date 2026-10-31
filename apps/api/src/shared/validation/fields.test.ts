import { describe, expect, it } from 'vitest'

import {
  cpfSchema,
  emailSchema,
  nameSchema,
  PASSWORD_MAX_LENGTH,
  passwordSchema,
  phoneSchema,
} from './fields.js'

describe('nameSchema', () => {
  it('trims', () => {
    expect(nameSchema.parse('  Ana Souza ')).toBe('Ana Souza')
  })

  it.each(['', '   ', 'a'.repeat(256)])('rejects %j', (name) => {
    expect(nameSchema.safeParse(name).success).toBe(false)
  })
})

describe('emailSchema', () => {
  it('trims and lowercases', () => {
    expect(emailSchema.parse('  Ana.Souza@Hostly.DEV ')).toBe('ana.souza@hostly.dev')
  })

  it.each(['ana', 'ana@', '@hostly.dev', 'ana souza@hostly.dev', `${'a'.repeat(250)}@x.com`])(
    'rejects %s',
    (email) => {
      expect(emailSchema.safeParse(email).success).toBe(false)
    },
  )
})

describe('cpfSchema', () => {
  it.each(['529.982.247-25', '52998224725', ' 529 982 247 25 '])(
    'normalizes %s to digits',
    (cpf) => {
      expect(cpfSchema.parse(cpf)).toBe('52998224725')
    },
  )

  it.each(['529.982.247-26', '111.111.111-11', '', 'abc529x982247-25zz', '529_982_247_25'])(
    'rejects %s',
    (cpf) => {
      const result = cpfSchema.safeParse(cpf)

      expect(result.success).toBe(false)
      expect(result.error?.issues[0]?.message).toBe('Invalid CPF')
    },
  )
})

describe('phoneSchema', () => {
  it.each([
    ['(48) 99999-0000', '48999990000'],
    ['48 3333-4444', '4833334444'],
    ['+55 48 99999-0000', '48999990000'],
    ['048 99999-0000', '48999990000'],
  ])('normalizes %s to %s', (phone, digits) => {
    expect(phoneSchema.parse(phone)).toBe(digits)
  })

  it.each(['(20) 99999-0000', '9999-0000', '', 'tel: 48a99999b0000', '48 99999-0000 ramal 2'])(
    'rejects %s',
    (phone) => {
      expect(phoneSchema.safeParse(phone).success).toBe(false)
    },
  )
})

describe('passwordSchema', () => {
  it('keeps the password exactly as typed, spaces included', () => {
    expect(passwordSchema.parse('  my secret  ')).toBe('  my secret  ')
  })

  it.each([
    ['too short', 'a'.repeat(7)],
    ['too long', 'a'.repeat(PASSWORD_MAX_LENGTH + 1)],
  ])('rejects a password that is %s', (_case, password) => {
    expect(passwordSchema.safeParse(password).success).toBe(false)
  })

  it('accepts the boundaries', () => {
    expect(passwordSchema.safeParse('a'.repeat(8)).success).toBe(true)
    expect(passwordSchema.safeParse('a'.repeat(PASSWORD_MAX_LENGTH)).success).toBe(true)
  })
})
