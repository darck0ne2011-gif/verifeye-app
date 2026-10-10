import { describe, it, expect } from 'vitest'
import { computeFakeProbability, shapeFromResults } from '../services/analysis.js'
import { extractModelResults } from '../services/sightengine.js'

describe('computeFakeProbability', () => {
  it('uses the strongest provider signal', () => {
    expect(computeFakeProbability({ type: { ai_generated: 0.12, deepfake: 0.87 } })).toBe(87)
    expect(computeFakeProbability({ type: { ai_generated: 0.99 } })).toBe(99)
  })

  it('returns null when no signal is available instead of guessing', () => {
    expect(computeFakeProbability({ type: {} })).toBeNull()
    expect(computeFakeProbability({ quality: { score: 0.1 } })).toBeNull()
    expect(computeFakeProbability(null)).toBeNull()
  })

  it('is deterministic', () => {
    const shape = { type: { ai_generated: 0.4 } }
    expect(computeFakeProbability(shape)).toBe(computeFakeProbability(shape))
  })

  it('clamps out-of-range values', () => {
    expect(computeFakeProbability({ type: { ai_generated: 1.7 } })).toBe(100)
    expect(computeFakeProbability({ type: { ai_generated: -1 } })).toBe(0)
  })
})

describe('cache round-trip', () => {
  it('rebuilds the provider shape from stored per-model results', () => {
    const response = { status: 'success', type: { ai_generated: 0.3, deepfake: 0.6 }, quality: { score: 0.8 } }
    const stored = extractModelResults(response, ['genai', 'deepfake', 'quality'])
    expect(stored).toEqual({
      genai: { ai_generated: 0.3 },
      deepfake: { deepfake: 0.6 },
      quality: { score: 0.8 },
    })
    const shape = shapeFromResults(stored, ['genai', 'deepfake', 'quality'])
    expect(computeFakeProbability(shape)).toBe(60)
    expect(shape.quality.score).toBe(0.8)
  })

  it('only uses the models that were requested', () => {
    const stored = { genai: { ai_generated: 0.1 }, deepfake: { deepfake: 0.9 } }
    expect(computeFakeProbability(shapeFromResults(stored, ['genai']))).toBe(10)
  })
})
