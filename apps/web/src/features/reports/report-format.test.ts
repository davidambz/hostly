import { change, formatOccupancy, formatStay } from './report-format'

describe('report formats', () => {
  it('writes occupancy and stays the Brazilian way', () => {
    expect(formatOccupancy(6_250)).toBe('62,5%')
    expect(formatOccupancy(10_000)).toBe('100%')
    expect(formatStay(3.5)).toBe('3,5 noites')
    expect(formatStay(1)).toBe('1 noite')
    expect(formatStay(null)).toBe('–')
  })

  it('compares money in percent and occupancy in points', () => {
    expect(change(12_000, 10_000)).toEqual({ direction: 'up', text: '+20%' })
    expect(change(7_500, 10_000)).toEqual({ direction: 'down', text: '−25%' })
    expect(change(5_000, 5_000)).toEqual({ direction: 'same', text: '0%' })
    expect(change(6_250, 5_000, true)).toEqual({ direction: 'up', text: '+12,5 p.p.' })
  })

  it('has nothing to compare with zero or a missing figure', () => {
    expect(change(5_000, 0)).toEqual({ direction: 'up', text: 'novo' })
    expect(change(0, 0)).toEqual({ direction: 'same', text: '0%' })
    expect(change(null, 5_000).text).toBe('–')
  })
})
