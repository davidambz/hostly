/** Validators for Brazilian documents and phones. They take digits only; see `onlyDigits`. */

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
