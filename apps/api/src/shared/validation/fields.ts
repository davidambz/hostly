import { z } from 'zod'

import { isValidCpf, isValidPhone, onlyDigits } from './brazil.js'

/**
 * Reusable request fields. They accept what people type (masks, spaces, any case) and
 * hand the service the normalized value the database stores.
 */

export const nameSchema = z.string().trim().min(1, 'Required').max(255)

export const emailSchema = z.string().trim().toLowerCase().pipe(z.email().max(255))

/** Accepts `529.982.247-25` or `52998224725`; yields digits only. */
export const cpfSchema = z
  .string()
  .transform(onlyDigits)
  .refine(isValidCpf, { message: 'Invalid CPF' })

/** Accepts `(48) 99999-0000` or `48999990000`, mobile or landline; yields digits only. */
export const phoneSchema = z
  .string()
  .transform(onlyDigits)
  .refine(isValidPhone, { message: 'Invalid phone number' })

export const PASSWORD_MIN_LENGTH = 8
export const PASSWORD_MAX_LENGTH = 128

/** Not trimmed: spaces are legitimate password characters. */
export const passwordSchema = z
  .string()
  .min(PASSWORD_MIN_LENGTH, `Must have at least ${PASSWORD_MIN_LENGTH} characters`)
  .max(PASSWORD_MAX_LENGTH)
