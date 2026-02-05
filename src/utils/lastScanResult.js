const STORAGE_KEY = 'verifeye_last_scan_result'

export function getLastScanResult() {
  try {
    const raw = sessionStorage.getItem(STORAGE_KEY)
    if (!raw) return null
    return JSON.parse(raw)
  } catch {
    return null
  }
}

export function setLastScanResult(result) {
  try {
    if (result) {
      sessionStorage.setItem(STORAGE_KEY, JSON.stringify(result))
    } else {
      sessionStorage.removeItem(STORAGE_KEY)
    }
  } catch (_) {}
}

export function clearLastScanResult() {
  setLastScanResult(null)
}
