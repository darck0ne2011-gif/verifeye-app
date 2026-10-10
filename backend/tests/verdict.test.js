import { describe, it, expect } from 'vitest'
import { computeVerdict, aggregateFrameScores } from '../services/verdict.js'

describe('computeVerdict', () => {
  it('maps probability to three bands', () => {
    expect(computeVerdict({ fakeProbability: 95 }).verdict).toBe('likely_ai')
    expect(computeVerdict({ fakeProbability: 70 }).verdict).toBe('likely_ai')
    expect(computeVerdict({ fakeProbability: 69 }).verdict).toBe('inconclusive')
    expect(computeVerdict({ fakeProbability: 31 }).verdict).toBe('inconclusive')
    expect(computeVerdict({ fakeProbability: 30 }).verdict).toBe('likely_real')
    expect(computeVerdict({ fakeProbability: 3 }).verdict).toBe('likely_real')
  })

  it('keeps the legacy two-way status and display score', () => {
    expect(computeVerdict({ fakeProbability: 55 })).toMatchObject({ status: 'FAKE', displayScore: 55 })
    expect(computeVerdict({ fakeProbability: 12 })).toMatchObject({ status: 'REAL', displayScore: 88 })
  })

  it('confidence grows with distance from 50%', () => {
    expect(computeVerdict({ fakeProbability: 50 }).confidence).toBe(0)
    expect(computeVerdict({ fakeProbability: 75 }).confidence).toBe(50)
    expect(computeVerdict({ fakeProbability: 100 }).confidence).toBe(100)
    expect(computeVerdict({ fakeProbability: 0 }).confidence).toBe(100)
  })

  it('lowers confidence for screenshots, few frames, disagreeing frames and beta models', () => {
    const base = computeVerdict({ fakeProbability: 90 }).confidence
    const shot = computeVerdict({ fakeProbability: 90, source: 'screenshot' })
    expect(shot.confidence).toBeLessThan(base)
    expect(shot.confidenceFactors).toContain('screenshot')

    const few = computeVerdict({ fakeProbability: 90, frames: { count: 2, spread: 0.1 } })
    expect(few.confidenceFactors).toContain('few_frames')

    const disagree = computeVerdict({ fakeProbability: 90, frames: { count: 10, spread: 0.8 } })
    expect(disagree.confidence).toBeLessThan(base)
    expect(disagree.confidenceFactors).toContain('frames_disagree')

    const beta = computeVerdict({ fakeProbability: 90, betaSignals: true })
    expect(beta.confidenceFactors).toContain('beta_model')
  })

  it('clamps inputs', () => {
    expect(computeVerdict({ fakeProbability: 140 }).fakeProbability).toBe(100)
    expect(computeVerdict({ fakeProbability: 'nope' }).fakeProbability).toBe(0)
  })
})

describe('aggregateFrameScores', () => {
  it('uses the mean of the strongest quarter (at least two frames)', () => {
    expect(aggregateFrameScores([0.9])).toBe(0.9)
    expect(aggregateFrameScores([0.1, 0.9])).toBeCloseTo(0.5)
    // 8 frames -> top 2
    expect(aggregateFrameScores([0.1, 0.1, 0.1, 0.1, 0.1, 0.1, 0.8, 1.0])).toBeCloseTo(0.9)
    // 12 frames -> top 3
    expect(aggregateFrameScores([0, 0, 0, 0, 0, 0, 0, 0, 0, 0.6, 0.6, 0.6])).toBeCloseTo(0.6)
  })

  it('ignores invalid values and returns null when nothing is left', () => {
    expect(aggregateFrameScores([null, undefined, 'x'])).toBeNull()
    expect(aggregateFrameScores([])).toBeNull()
  })
})
