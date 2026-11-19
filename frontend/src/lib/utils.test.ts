import { describe, expect, it } from 'vitest'
import { hours, initials, monthRange } from './utils'

describe('utils', () => {
  it('summarizes seasons, including wrap-around', () => {
    expect(monthRange([5, 6, 7, 8, 9, 10])).toBe('May – Oct')
    expect(monthRange([1, 2, 3, 4, 5, 6, 7, 8, 9, 10, 11, 12])).toBe('Year-round')
    expect(monthRange([11, 12, 1, 2])).toBe('Nov – Feb')
    expect(monthRange([3, 7])).toBe('Mar, Jul')
    expect(monthRange([])).toBe('Season unknown')
  })
  it('formats durations and initials', () => {
    expect(hours(2.5)).toBe('2 h 30 min')
    expect(hours(0.1)).toBe('5 min')
    expect(initials('Sarah Lee')).toBe('SL')
    expect(initials('bob')).toBe('B')
  })
})
