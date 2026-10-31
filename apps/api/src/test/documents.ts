/** Valid Brazilian documents for tests, distinct for each `seed`. */
import { cnpjCheckDigits, cpfCheckDigits } from '../shared/validation/brazil.js'

export function validCpf(seed: number): string {
  const base = String(100_000_000 + seed).slice(-9)
  return base + cpfCheckDigits(base)
}

export function validCnpj(seed: number): string {
  const base = String(10_000_000 + seed).slice(-8) + '0001'
  return base + cnpjCheckDigits(base)
}

/** An alphanumeric CNPJ (issued from July 2026), e.g. `AB000001000148`. */
export function validAlphanumericCnpj(seed: number): string {
  const base = 'AB' + String(1_000_000 + seed).slice(-6) + '0001'
  return base + cnpjCheckDigits(base)
}
