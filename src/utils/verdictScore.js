/**
 * Convert fakeProbability (0-100) from API to winning category display.
 * Shows the percentage of the winning category directly (no inverse).
 * - fake 0.99 → FAKE 99%
 * - real 0.98 (fake 0.02) → REAL 98%
 */
export function getWinningDisplay(fakeProbability) {
  const fp = Number(fakeProbability) ?? 0
  const clamped = Math.max(0, Math.min(100, fp))
  if (clamped >= 50) {
    return { status: 'FAKE', displayScore: Math.round(clamped) }
  }
  return { status: 'REAL', displayScore: Math.round(100 - clamped) }
}
