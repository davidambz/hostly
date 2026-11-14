import { z } from 'zod'

import type { Payment } from '../../generated/prisma/client.js'
import { formatDate } from '../../shared/dates.js'
import { optionalText } from '../../shared/validation/fields.js'
import { MAX_AMOUNT_CENTS } from '../../shared/validation/money.js'

/** Body of POST /bookings/:id/payments. */
export const createPaymentBodySchema = z.object({
  /** Cents, more than zero. */
  amount: z.number().int().min(1).max(MAX_AMOUNT_CENTS),
  /** The day it was received, `YYYY-MM-DD`. */
  paidOn: z.iso.date(),
  /** E.g. "Sinal", "Pix"; up to 255 characters. */
  note: optionalText(255),
})

export type CreatePaymentInput = z.infer<typeof createPaymentBodySchema>

export const paymentParamsSchema = z.object({ id: z.uuid(), paymentId: z.uuid() })

export const paymentSchema = z
  .object({
    id: z.uuid(),
    amount: z.number().int(),
    paidOn: z.iso.date(),
    note: z.string().nullable(),
    createdAt: z.iso.datetime(),
  })
  .meta({ id: 'Payment' })

export type PublicPayment = z.infer<typeof paymentSchema>

export function toPublicPayment(payment: Payment): PublicPayment {
  return {
    id: payment.id,
    amount: payment.amount,
    paidOn: formatDate(payment.paidOn),
    note: payment.note,
    createdAt: payment.createdAt.toISOString(),
  }
}
