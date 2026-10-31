/**
 * The money of a booking, all in cents. Pure: the same numbers always give the same result,
 * so the API, the quote endpoint and the validation agree to the cent.
 *
 *   gross lodging = nights × nightly rate
 *   lodging       = gross lodging − discount
 *   broker fee    = lodging × commission, rounded to the cent (the cleaning fee is not
 *                   commissioned)
 *   total         = lodging + cleaning fee      (what the guest pays)
 *   net           = total − broker fee         (what the owner keeps)
 *   balance due   = total − amount paid        (what the guest still owes)
 */

export interface FinancialInput {
  nights: number
  nightlyRate: number
  cleaningFee: number
  discount: number
  amountPaid: number
  /** Basis points: 1000 = 10%. */
  brokerCommissionBps: number
}

/** Only the derived values: the inputs are on the booking itself. */
export interface Financials {
  grossLodging: number
  lodging: number
  total: number
  brokerFee: number
  net: number
  balanceDue: number
}

const BPS_PER_UNIT = 10_000

/** `amount × bps / 10 000`, rounded half up to the cent. Inputs are non-negative integers. */
export function applyBps(amount: number, bps: number): number {
  return Math.round((amount * bps) / BPS_PER_UNIT)
}

export function computeFinancials(input: FinancialInput): Financials {
  const grossLodging = input.nights * input.nightlyRate
  const lodging = grossLodging - input.discount
  const total = lodging + input.cleaningFee
  const brokerFee = applyBps(lodging, input.brokerCommissionBps)
  return {
    grossLodging,
    lodging,
    total,
    brokerFee,
    net: total - brokerFee,
    balanceDue: total - input.amountPaid,
  }
}
