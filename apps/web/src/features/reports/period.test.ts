import {
  customPeriod,
  lastYearOf,
  periodFromSearch,
  periodLabel,
  periodOf,
  periodSearch,
  shiftPeriod,
} from './period'

const search = (query: string) => new URLSearchParams(query)

describe('periods', () => {
  it.each([
    ['month', '2026-12-15', '2026-12-01', '2027-01-01', 'dezembro de 2026'],
    ['quarter', '2026-11-15', '2026-10-01', '2027-01-01', '4º trimestre de 2026'],
    ['year', '2026-11-15', '2026-01-01', '2027-01-01', '2026'],
  ] as const)('the %s holding a day', (kind, day, from, to, label) => {
    const period = periodOf(kind, day)

    expect(period).toEqual({ kind, from, to })
    expect(periodLabel(period)).toBe(label)
  })

  it('takes a custom period with both ends included', () => {
    const period = customPeriod('2026-12-01', '2026-12-15')

    expect(period.to).toBe('2026-12-16')
    expect(periodLabel(period)).toBe('01/12/2026 a 15/12/2026')
  })

  it('steps back and forth, a custom period by its own length', () => {
    expect(shiftPeriod(periodOf('month', '2026-01-10'), -1)).toMatchObject({
      from: '2025-12-01',
      to: '2026-01-01',
    })
    expect(shiftPeriod(periodOf('quarter', '2026-11-01'), 1)).toMatchObject({
      from: '2027-01-01',
      to: '2027-04-01',
    })
    expect(shiftPeriod(customPeriod('2026-12-11', '2026-12-20'), -1)).toMatchObject({
      from: '2026-12-01',
      to: '2026-12-11',
    })
  })

  it('goes a year back, leap day included', () => {
    expect(lastYearOf(customPeriod('2028-02-29', '2028-03-01'))).toMatchObject({
      from: '2027-02-28',
      to: '2027-03-02',
    })
  })

  it('reads the URL, falling back to this month', () => {
    const today = '2026-12-15'

    expect(periodFromSearch(search(''), today)).toEqual(periodOf('month', today))
    expect(periodFromSearch(search('periodo=ano&inicio=2025-06-01'), today)).toEqual(
      periodOf('year', '2025-06-01'),
    )
    expect(
      periodFromSearch(search('periodo=personalizado&inicio=2026-12-01&fim=2026-12-10'), today),
    ).toEqual(customPeriod('2026-12-01', '2026-12-10'))
    for (const broken of [
      'periodo=personalizado&inicio=2026-12-10&fim=2026-12-01',
      'periodo=personalizado&inicio=2020-01-01&fim=2026-12-01',
      'periodo=personalizado&inicio=ontem&fim=2026-12-01',
      'periodo=mes&inicio=2026-02-31',
    ]) {
      expect(periodFromSearch(search(broken), today)).toEqual(periodOf('month', today))
    }
  })

  it('writes the URL back', () => {
    expect(periodSearch(periodOf('month', '2026-12-15'))).toEqual({
      periodo: undefined,
      inicio: '2026-12-01',
      fim: undefined,
    })
    expect(periodSearch(customPeriod('2026-12-01', '2026-12-10'))).toEqual({
      periodo: 'personalizado',
      inicio: '2026-12-01',
      fim: '2026-12-10',
    })
  })
})
