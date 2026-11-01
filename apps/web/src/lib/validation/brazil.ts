/**
 * Brazilian document and phone helpers for forms: masks for display while typing, and
 * the same rules the API applies (see apps/api/src/shared/validation/brazil.ts), so most
 * mistakes show up before the request. The API stays the authority.
 */

export function onlyDigits(value: string): string {
  return value.replace(/\D/g, '')
}

/** Every area code (DDD) in use, from Anatel's numbering plan. Same list as the API. */
const AREA_CODES = new Set([
  11, 12, 13, 14, 15, 16, 17, 18, 19, 21, 22, 24, 27, 28, 31, 32, 33, 34, 35, 37, 38, 41, 42, 43,
  44, 45, 46, 47, 48, 49, 51, 53, 54, 55, 61, 62, 63, 64, 65, 66, 67, 68, 69, 71, 73, 74, 75, 77,
  79, 81, 82, 83, 84, 85, 86, 87, 88, 89, 91, 92, 93, 94, 95, 96, 97, 98, 99,
])

/**
 * Digits of a phone as people type or paste it: drops the country code (+55) or the
 * long-distance 0, like the API does.
 */
export function normalizePhone(value: string): string {
  const digits = onlyDigits(value)
  if (digits.startsWith('0') && (digits.length === 11 || digits.length === 12)) {
    return digits.slice(1)
  }
  if (digits.startsWith('55') && (digits.length === 12 || digits.length === 13)) {
    return digits.slice(2)
  }
  return digits
}

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

/** A CPF: 11 digits, not all the same, with both check digits right. */
export function isValidCpf(value: string): boolean {
  const cpf = onlyDigits(value)
  if (cpf.length !== 11 || /^(\d)\1{10}$/.test(cpf)) return false
  const digit = (length: number) => {
    let sum = 0
    for (let i = 0; i < length; i++) sum += Number(cpf[i]) * (length + 1 - i)
    return ((sum * 10) % 11) % 10
  }
  return digit(9) === Number(cpf[9]) && digit(10) === Number(cpf[10])
}

const hasAreaCode = (phone: string) => AREA_CODES.has(Number(phone.slice(0, 2)))

/** A mobile number: DDD in use + 9 + 8 digits. */
export function isValidMobilePhone(value: string): boolean {
  const phone = normalizePhone(value)
  return /^\d{2}9\d{8}$/.test(phone) && hasAreaCode(phone)
}

/** A landline: DDD in use + a number starting with 2 to 5 + 7 digits. */
export function isValidLandlinePhone(value: string): boolean {
  const phone = normalizePhone(value)
  return /^\d{2}[2-5]\d{7}$/.test(phone) && hasAreaCode(phone)
}

/** A mobile or a landline. */
export function isValidPhone(value: string): boolean {
  return isValidMobilePhone(value) || isValidLandlinePhone(value)
}

/**
 * A CPF or CNPJ as typed: letters and digits, uppercased. Never `onlyDigits` for a CNPJ,
 * which would strip the letters of an alphanumeric one.
 */
export function normalizeDocument(value: string): string {
  return value.toUpperCase().replace(/[^0-9A-Z]/g, '')
}

/**
 * `12ABC34501DE35` → `12.ABC.345/01DE-35`, also while typing. The first 12 characters can be
 * letters (alphanumeric CNPJ, from July 2026); the 2 check digits are always digits.
 */
export function maskCnpj(value: string): string {
  const raw = normalizeDocument(value)
  const base = raw.slice(0, 12)
  const check = onlyDigits(raw.slice(12)).slice(0, 2)
  const parts = [base.slice(0, 2), base.slice(2, 5), base.slice(5, 8), base.slice(8, 12)]
  let masked = parts[0] ?? ''
  if (parts[1]) masked += `.${parts[1]}`
  if (parts[2]) masked += `.${parts[2]}`
  if (parts[3]) masked += `/${parts[3]}`
  if (check) masked += `-${check}`
  return masked
}

/** The two check digits of a CNPJ whose first 12 characters are `base` (same as the API). */
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
export function isValidCnpj(value: string): boolean {
  const cnpj = normalizeDocument(value)
  if (!/^[0-9A-Z]{12}\d{2}$/.test(cnpj) || /^(.)\1{13}$/.test(cnpj)) return false
  return cnpjCheckDigits(cnpj.slice(0, 12)) === cnpj.slice(12)
}

/** `88053700` → `88053-700`, also while typing. */
export function maskCep(value: string): string {
  const d = onlyDigits(value).slice(0, 8)
  return d.length > 5 ? `${d.slice(0, 5)}-${d.slice(5)}` : d
}

/** A CEP: 8 digits, not all zeros. */
export function isValidCep(value: string): boolean {
  const cep = onlyDigits(value)
  return cep.length === 8 && cep !== '00000000'
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
