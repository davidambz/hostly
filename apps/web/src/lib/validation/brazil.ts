/**
 * Brazilian document and phone helpers for forms: masks for display while typing, and
 * the same checks the API runs, so most mistakes show up before the request. The API
 * stays the authority; these only spare the user a round trip.
 */

export function onlyDigits(value: string): string {
  return value.replace(/\D/g, '')
}

/** `52998224725` → `529.982.247-25`, also while typing. */
export function maskCpf(value: string): string {
  const d = onlyDigits(value).slice(0, 11)
  return d
    .replace(/^(\d{3})(\d)/, '$1.$2')
    .replace(/^(\d{3})\.(\d{3})(\d)/, '$1.$2.$3')
    .replace(/\.(\d{3})(\d{1,2})$/, '.$1-$2')
}

/** `48999990000` → `(48) 99999-0000`; `4833334444` → `(48) 3333-4444`. */
export function maskPhone(value: string): string {
  const d = onlyDigits(value).slice(0, 11)
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

/** DDD + number: 10 digits for a landline (2–5 after the DDD) or 11 for a mobile (9). */
export function isValidPhone(value: string): boolean {
  return /^[1-9]\d(?:9\d{8}|[2-5]\d{7})$/.test(onlyDigits(value))
}
