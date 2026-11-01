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

/** DDD in use + a mobile (9 + 8 digits) or a landline (2–5 + 7 digits). */
export function isValidPhone(value: string): boolean {
  const phone = normalizePhone(value)
  return /^\d{2}(?:9\d{8}|[2-5]\d{7})$/.test(phone) && AREA_CODES.has(Number(phone.slice(0, 2)))
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
