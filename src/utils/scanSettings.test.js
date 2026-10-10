import { describe, it, expect, beforeEach } from 'vitest'
import { getActiveModels, setActiveModelsForCategory, getMaxCreditsPerScan } from './scanSettings'

beforeEach(() => localStorage.clear())

describe('scanSettings', () => {
  it('has sensible defaults per category', () => {
    expect(getActiveModels('image')).toEqual(['genai'])
    expect(getActiveModels('video')).toEqual(['genai', 'deepfake'])
    expect(getActiveModels('audio')).toEqual(['ai_speech'])
  })

  it('persists per category and drops models that do not apply', () => {
    setActiveModelsForCategory('video', ['ai_speech', 'quality', 'genai'])
    expect(getActiveModels('video')).toEqual(['ai_speech', 'genai'])
    expect(getActiveModels('image')).toEqual(['genai'])
  })

  it('never leaves a category empty', () => {
    setActiveModelsForCategory('image', [])
    expect(getActiveModels('image')).toEqual(['genai'])
  })

  it('reads the legacy photo key', () => {
    localStorage.setItem('verifeye_scan_models', JSON.stringify({ photo: ['deepfake', 'genai'] }))
    expect(getActiveModels('image')).toEqual(['deepfake', 'genai'])
    expect(getActiveModels('photo')).toEqual(['deepfake', 'genai'])
  })

  it('reports the highest credit cost across categories', () => {
    setActiveModelsForCategory('video', ['genai', 'deepfake', 'ai_speech'])
    expect(getMaxCreditsPerScan()).toBe(3)
  })
})
