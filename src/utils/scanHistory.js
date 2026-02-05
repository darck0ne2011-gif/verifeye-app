const HISTORY_STORAGE_KEY = 'verifeye_scan_history'

export function getScanHistory() {
  try {
    const stored = localStorage.getItem(HISTORY_STORAGE_KEY)
    if (stored) {
      return JSON.parse(stored)
    }
  } catch (_) {}
  return []
}

export function addScanToHistory({ fileName, score, status }) {
  const entry = {
    id: crypto.randomUUID?.() || Date.now().toString(36) + Math.random().toString(36).slice(2),
    fileName,
    date: new Date().toISOString(),
    score,
    status, // 'REAL' | 'FAKE'
  }
  const history = getScanHistory()
  history.unshift(entry)
  localStorage.setItem(HISTORY_STORAGE_KEY, JSON.stringify(history))
  return entry
}
