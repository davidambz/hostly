import { z } from 'zod'

import { isValidCpf, isValidPhone, normalizePhone, onlyDigits } from './brazil.js'

/**
 * Reusable request fields. They accept what people type (masks, spaces, any case) and
 * hand the service the normalized value the database stores. Anything beyond mask
 * characters is rejected rather than silently stripped.
 */

export const nameSchema = z.string().trim().min(1, 'Required').max(255)

export const emailSchema = z.string().trim().toLowerCase().pipe(z.email().max(255))

/** Accepts `529.982.247-25` or `52998224725`; yields digits only. */
export const cpfSchema = z
  .string()
  .regex(/^[\d.\-\s]*$/, 'Invalid CPF')
  .transform(onlyDigits)
  .refine(isValidCpf, { message: 'Invalid CPF' })

/** Accepts `(48) 99999-0000`, `+55 48 99999-0000` or `48999990000`; yields DDD + number. */
export const phoneSchema = z
  .string()
  .regex(/^[\d\s().+-]*$/, 'Invalid phone number')
  .transform(normalizePhone)
  .refine(isValidPhone, { message: 'Invalid phone number' })

export const PASSWORD_MIN_LENGTH = 8
export const PASSWORD_MAX_LENGTH = 128

/** Not trimmed: spaces are legitimate password characters. */
export const passwordSchema = z
  .string()
  .min(PASSWORD_MIN_LENGTH, `Must have at least ${PASSWORD_MIN_LENGTH} characters`)
  .max(PASSWORD_MAX_LENGTH)
