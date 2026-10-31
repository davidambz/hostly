/**
 * Valid Brazilian documents for tests, distinct for each `seed`. The check digits are
 * computed here with the official weight tables, independently of the validators under
 * test, so a bug in those can't be mirrored by the fixtures.
 */

function mod11(chars: string, weights: number[], zeroBelow2: boolean) {
  const sum = weights.reduce((total, weight, i) => total + weight * (chars.charCodeAt(i) - 48), 0)
  const rest = sum % 11
  if (zeroBelow2) return String(rest < 2 ? 0 : 11 - rest)
  return String(((10 * sum) % 11) % 10)
}

const CPF_WEIGHTS_1 = [10, 9, 8, 7, 6, 5, 4, 3, 2]
const CPF_WEIGHTS_2 = [11, 10, 9, 8, 7, 6, 5, 4, 3, 2]
const CNPJ_WEIGHTS_1 = [5, 4, 3, 2, 9, 8, 7, 6, 5, 4, 3, 2]
const CNPJ_WEIGHTS_2 = [6, 5, 4, 3, 2, 9, 8, 7, 6, 5, 4, 3, 2]

function withCnpjDigits(base: string) {
  const first = mod11(base, CNPJ_WEIGHTS_1, true)
  return base + first + mod11(base + first, CNPJ_WEIGHTS_2, true)
}

export function validCpf(seed: number): string {
  const base = String(100_000_000 + seed).slice(-9)
  const first = mod11(base, CPF_WEIGHTS_1, false)
  return base + first + mod11(base + first, CPF_WEIGHTS_2, false)
}

export function validCnpj(seed: number): string {
  return withCnpjDigits(String(10_000_000 + seed).slice(-8) + '0001')
}

/** An alphanumeric CNPJ (issued from July 2026), e.g. `AB000001000148`. */
export function validAlphanumericCnpj(seed: number): string {
  return withCnpjDigits('AB' + String(1_000_000 + seed).slice(-6) + '0001')
}
