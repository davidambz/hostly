/** Valid Brazilian documents for tests, distinct for each `seed`. Digits only. */
import { cpfCheckDigits } from '../shared/validation/brazil.js'

function checkDigit(digits: string, weights: number[], mod11: (sum: number) => number) {
  const sum = weights.reduce((total, weight, i) => total + weight * Number(digits[i]), 0)
  return String(mod11(sum))
}

export function validCpf(seed: number): string {
  const base = String(100_000_000 + seed).slice(-9)
  return base + cpfCheckDigits(base)
}

export function validCnpj(seed: number): string {
  const base = String(10_000_000 + seed).slice(-8) + '0001'
  const digit = (sum: number) => (sum % 11 < 2 ? 0 : 11 - (sum % 11))
  const first = checkDigit(base, [5, 4, 3, 2, 9, 8, 7, 6, 5, 4, 3, 2], digit)
  const second = checkDigit(base + first, [6, 5, 4, 3, 2, 9, 8, 7, 6, 5, 4, 3, 2], digit)
  return base + first + second
}
