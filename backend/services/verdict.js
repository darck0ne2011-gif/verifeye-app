/**
 * Turns raw detector signals into a three-band verdict with a confidence level.
 *
 *   likely_ai      fakeProbability >= 70
 *   inconclusive   30 < fakeProbability < 70
 *   likely_real    fakeProbability <= 30
 *
 * Confidence starts from how far the probability is from the 50% midpoint and
 * is reduced when the evidence is weaker (screenshot instead of the original
 * file, few sampled frames, frames that disagree with each other, beta models).
 */

export const LIKELY_AI_THRESHOLD = 70
export const LIKELY_REAL_THRESHOLD = 30

/** Mean of the strongest quarter of frame scores (at least two frames). */
export function aggregateFrameScores(scores) {
  const valid = scores
    .filter((v) => v != null && v !== '')
    .map(Number)
    .filter((n) => Number.isFinite(n))
  if (valid.length === 0) return null
  const sorted = [...valid].sort((a, b) => b - a)
  const take = Math.min(sorted.length, Math.max(2, Math.ceil(sorted.length / 4)))
  const top = sorted.slice(0, take)
  return top.reduce((a, b) => a + b, 0) / top.length
}

/**
 * @param {object} input
 * @param {number} input.fakeProbability 0-100
 * @param {'file'|'screenshot'} [input.source]
 * @param {{ count: number, spread: number }} [input.frames] spread = max - min of per-frame scores (0-1)
 * @param {number} [input.signalCount] number of independent detector signals that contributed
 * @param {boolean} [input.betaSignals] true when the verdict rests on a beta model only
 */
export function computeVerdict({
  fakeProbability,
  source = 'file',
  frames = null,
  signalCount = 1,
  betaSignals = false,
}) {
  const p = Math.max(0, Math.min(100, Math.round(Number(fakeProbability) || 0)))
  const verdict = p >= LIKELY_AI_THRESHOLD ? 'likely_ai' : p <= LIKELY_REAL_THRESHOLD ? 'likely_real' : 'inconclusive'

  let confidence = Math.abs(p - 50) * 2
  const factors = []
  if (source === 'screenshot') {
    confidence *= 0.8
    factors.push('screenshot')
  }
  if (frames) {
    if (frames.count < 3) {
      confidence *= 0.85
      factors.push('few_frames')
    }
    if (frames.spread > 0.5) {
      confidence *= 0.75
      factors.push('frames_disagree')
    }
  }
  if (betaSignals) {
    confidence *= 0.9
    factors.push('beta_model')
  }
  if (signalCount >= 2 && verdict !== 'inconclusive') {
    confidence = Math.min(100, confidence * 1.05)
  }
  confidence = Math.round(Math.max(0, Math.min(100, confidence)))

  return {
    verdict,
    confidence,
    confidenceFactors: factors,
    fakeProbability: p,
    // Legacy two-way label still used by the web client and PDF.
    status: p >= 50 ? 'FAKE' : 'REAL',
    displayScore: p >= 50 ? p : 100 - p,
  }
}
