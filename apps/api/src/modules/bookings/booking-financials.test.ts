import { describe, expect, it } from 'vitest'

import { applyBps, computeFinancials, type FinancialInput } from './booking-financials.js'

const base: FinancialInput = {
  nights: 7,
  nightlyRate: 45_000,
  cleaningFee: 25_000,
  discount: 15_000,
  amountPaid: 100_000,
  brokerCommissionBps: 1000,
}

describe('computeFinancials', () => {
  it('works out a full booking', () => {
    expect(computeFinancials(base)).toEqual({
      grossLodging: 315_000,
      lodging: 300_000,
      total: 325_000,
      brokerFee: 30_000,
      net: 295_000,
      balanceDue: 225_000,
    })
  })

  it('has no broker fee without a commission', () => {
    expect(computeFinancials({ ...base, brokerCommissionBps: 0 })).toMatchObject({
      brokerFee: 0,
      net: 325_000,
    })
  })

  it('does not commission the cleaning fee', () => {
    const withCleaning = computeFinancials({ ...base, cleaningFee: 1_000_000 })
    const without = computeFinancials({ ...base, cleaningFee: 0 })

    expect(withCleaning.brokerFee).toBe(without.brokerFee)
  })

  it('commissions the lodging after the discount', () => {
    expect(computeFinancials({ ...base, discount: 0 }).brokerFee).toBe(31_500)
    expect(computeFinancials(base).brokerFee).toBe(30_000)
  })

  it('owes nothing once fully paid', () => {
    expect(computeFinancials({ ...base, amountPaid: 325_000 }).balanceDue).toBe(0)
  })

  it('handles a 100% discount', () => {
    expect(computeFinancials({ ...base, discount: 315_000 })).toMatchObject({
      lodging: 0,
      brokerFee: 0,
      total: 25_000,
    })
  })

  it('handles a 100% commission', () => {
    expect(computeFinancials({ ...base, brokerCommissionBps: 10_000 })).toMatchObject({
      brokerFee: 300_000,
      net: 25_000,
    })
  })

  it('always balances: net + broker fee = total = paid + balance due', () => {
    for (const nights of [1, 3, 30, 365]) {
      for (const bps of [0, 333, 1250, 10_000]) {
        const result = computeFinancials({
          ...base,
          nights,
          brokerCommissionBps: bps,
          discount: 101,
        })
        expect(result.net + result.brokerFee).toBe(result.total)
        expect(base.amountPaid + result.balanceDue).toBe(result.total)
      }
    }
  })

  it('stays exact at the largest amounts the API accepts', () => {
    const result = computeFinancials({
      nights: 365,
      nightlyRate: 1_000_000_000,
      cleaningFee: 1_000_000_000,
      discount: 0,
      amountPaid: 0,
      brokerCommissionBps: 9_999,
    })

    expect(Number.isSafeInteger(result.total)).toBe(true)
    expect(result.brokerFee).toBe(364_963_500_000)
  })
})

describe('applyBps', () => {
  it.each([
    [10_000, 1000, 1_000],
    [99, 1000, 10], // 9.9 → 10
    [95, 1000, 10], // 9.5 → 10, half up
    [94, 1000, 9], // 9.4 → 9
    [1, 4999, 0], // 0.4999 → 0
    [1, 5000, 1], // 0.5 → 1
    [0, 10_000, 0],
    [12_345, 0, 0],
  ])('%i × %i bps = %i', (amount, bps, result) => {
    expect(applyBps(amount, bps)).toBe(result)
  })
})
