/**
 * Brazilian documents, phones and CEPs: the rules the API enforces and the web app checks
 * before sending, in one place.
 *
 * - Validators (`isValid…`) take the normalized value: digits only for CPF, CEP and phones
 *   (`onlyDigits`, `normalizePhone`), digits and uppercase letters for a CNPJ, which can be
 *   alphanumeric (`normalizeDocument`). A masked value is not valid as is.
 * - Masks (`mask…`) take anything typed and format it, also while typing.
 */

export function onlyDigits(value: string): string {
  return value.replace(/\D/g, '')
}

/** Every area code (DDD) in use, from Anatel's numbering plan. */
const AREA_CODES = new Set([
  11, 12, 13, 14, 15, 16, 17, 18, 19, 21, 22, 24, 27, 28, 31, 32, 33, 34, 35, 37, 38, 41, 42, 43,
  44, 45, 46, 47, 48, 49, 51, 53, 54, 55, 61, 62, 63, 64, 65, 66, 67, 68, 69, 71, 73, 74, 75, 77,
  79, 81, 82, 83, 84, 85, 86, 87, 88, 89, 91, 92, 93, 94, 95, 96, 97, 98, 99,
])

/** The two check digits of a CPF whose first 9 digits are `base`. */
export function cpfCheckDigits(base: string): string {
  const digit = (digits: string) => {
    let sum = 0
    for (let i = 0; i < digits.length; i++) {
      sum += Number(digits[i]) * (digits.length + 1 - i)
    }
    return String(((sum * 10) % 11) % 10)
  }
  const first = digit(base)
  return first + digit(base + first)
}

/** A CPF: 11 digits, not all the same, with both check digits right. */
export function isValidCpf(cpf: string): boolean {
  if (!/^\d{11}$/.test(cpf) || /^(\d)\1{10}$/.test(cpf)) {
    return false
  }
  return cpfCheckDigits(cpf.slice(0, 9)) === cpf.slice(9)
}

/** A mobile number: area code + 9 + 8 digits. */
export function isValidMobilePhone(phone: string): boolean {
  return /^\d{2}9\d{8}$/.test(phone) && AREA_CODES.has(Number(phone.slice(0, 2)))
}

/** A landline: area code + a number starting with 2 to 5 + 7 digits. */
export function isValidLandlinePhone(phone: string): boolean {
  return /^\d{2}[2-5]\d{7}$/.test(phone) && AREA_CODES.has(Number(phone.slice(0, 2)))
}

export function isValidPhone(phone: string): boolean {
  return isValidMobilePhone(phone) || isValidLandlinePhone(phone)
}

/**
 * Digits of a phone as people type it: drops the country code (+55) or the long-distance
 * 0 prefix, so `+55 (48) 99999-0000` and `048 99999-0000` both give `48999990000`.
 */
export function normalizePhone(value: string): string {
  const digits = onlyDigits(value)
  const withPrefix = digits.length === 11 || digits.length === 12
  // No area code starts with 0, so a leading 0 is always the long-distance prefix.
  if (digits.startsWith('0') && withPrefix) {
    return digits.slice(1)
  }
  // DDD + number is at most 11 digits, so 12 or 13 starting with 55 carry the country code.
  if (digits.startsWith('55') && (digits.length === 12 || digits.length === 13)) {
    return digits.slice(2)
  }
  return digits
}

/** The 26 states and the Federal District. */
export const STATES = [
  'AC',
  'AL',
  'AP',
  'AM',
  'BA',
  'CE',
  'DF',
  'ES',
  'GO',
  'MA',
  'MT',
  'MS',
  'MG',
  'PA',
  'PB',
  'PR',
  'PE',
  'PI',
  'RJ',
  'RN',
  'RS',
  'RO',
  'RR',
  'SC',
  'SP',
  'SE',
  'TO',
] as const

export type State = (typeof STATES)[number]

/** A CEP: 8 digits, not all zeros. */
export function isValidCep(cep: string): boolean {
  return /^\d{8}$/.test(cep) && cep !== '00000000'
}

/**
 * The two check digits of a CNPJ whose first 12 characters are `base`. Works for the
 * alphanumeric CNPJ (from July 2026): each character counts as its ASCII code minus 48,
 * which keeps digits at their face value.
 */
export function cnpjCheckDigits(base: string): string {
  const digit = (chars: string) => {
    let sum = 0
    for (let i = 0; i < chars.length; i++) {
      const weight = ((chars.length - 1 - i) % 8) + 2
      sum += (chars.charCodeAt(i) - 48) * weight
    }
    const rest = sum % 11
    return String(rest < 2 ? 0 : 11 - rest)
  }
  const first = digit(base)
  return first + digit(base + first)
}

/** A CNPJ, numeric or alphanumeric: 12 of [0-9A-Z], 2 check digits, not all the same. */
export function isValidCnpj(cnpj: string): boolean {
  if (!/^[0-9A-Z]{12}\d{2}$/.test(cnpj) || /^(.)\1{13}$/.test(cnpj)) {
    return false
  }
  return cnpjCheckDigits(cnpj.slice(0, 12)) === cnpj.slice(12)
}

/**
 * A CPF or CNPJ as typed: keeps letters and digits, uppercased. Never `onlyDigits` for a
 * CNPJ, which would strip the letters of an alphanumeric one.
 */
export function normalizeDocument(value: string): string {
  return value.toUpperCase().replace(/[^0-9A-Z]/g, '')
}

// Masks for typing: they format, they don't validate.

/** `52998224725` → `529.982.247-25`, also while typing. */
export function maskCpf(value: string): string {
  const d = onlyDigits(value).slice(0, 11)
  return d
    .replace(/^(\d{3})(\d)/, '$1.$2')
    .replace(/^(\d{3})\.(\d{3})(\d)/, '$1.$2.$3')
    .replace(/\.(\d{3})(\d{1,2})$/, '.$1-$2')
}

/** `48999990000` → `(48) 99999-0000`; `4833334444` → `(48) 3333-4444`; `+55 …` is dropped. */
export function maskPhone(value: string): string {
  const d = normalizePhone(value).slice(0, 11)
  if (d.length <= 2) return d.length ? `(${d}` : ''
  const area = d.slice(0, 2)
  const rest = d.slice(2)
  const split = rest.length > 8 ? 5 : 4
  return rest.length > split
    ? `(${area}) ${rest.slice(0, split)}-${rest.slice(split)}`
    : `(${area}) ${rest}`
}

/** `88053700` → `88053-700`, also while typing. */
export function maskCep(value: string): string {
  const d = onlyDigits(value).slice(0, 8)
  return d.length > 5 ? `${d.slice(0, 5)}-${d.slice(5)}` : d
}

/**
 * `12ABC34501DE35` → `12.ABC.345/01DE-35`, also while typing. The first 12 characters can be
 * letters (alphanumeric CNPJ, from July 2026); the 2 check digits are always digits.
 */
export function maskCnpj(value: string): string {
  const raw = normalizeDocument(value)
  const base = raw.slice(0, 12)
  const check = onlyDigits(raw.slice(12)).slice(0, 2)
  let masked = base.slice(0, 2)
  if (base.length > 2) masked += `.${base.slice(2, 5)}`
  if (base.length > 5) masked += `.${base.slice(5, 8)}`
  if (base.length > 8) masked += `/${base.slice(8, 12)}`
  if (check) masked += `-${check}`
  return masked
}
