import { describe, it, expect } from 'vitest'
import { getWinningDisplay } from './verdictScore'

describe('getWinningDisplay', () => {
  it('shows the winning category with its own percentage', () => {
    expect(getWinningDisplay(99)).toEqual({ status: 'FAKE', displayScore: 99 })
    expect(getWinningDisplay(2)).toEqual({ status: 'REAL', displayScore: 98 })
  })

  it('treats 50 as the FAKE threshold', () => {
    expect(getWinningDisplay(50).status).toBe('FAKE')
    expect(getWinningDisplay(49.4)).toEqual({ status: 'REAL', displayScore: 51 })
  })

  it('clamps out-of-range input', () => {
    expect(getWinningDisplay(140)).toEqual({ status: 'FAKE', displayScore: 100 })
    expect(getWinningDisplay(-5)).toEqual({ status: 'REAL', displayScore: 100 })
  })
})
