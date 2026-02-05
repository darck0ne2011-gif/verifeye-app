const STORAGE_KEY = 'verifeye_scan_models'

const DEFAULT_MODELS = ['genai']

export function getActiveModels() {
  try {
    const raw = localStorage.getItem(STORAGE_KEY)
    if (!raw) return [...DEFAULT_MODELS]
    const parsed = JSON.parse(raw)
    return Array.isArray(parsed) && parsed.length > 0 ? parsed : [...DEFAULT_MODELS]
  } catch {
    return [...DEFAULT_MODELS]
  }
}

export function setActiveModels(models) {
  try {
    const valid = Array.isArray(models) && models.length > 0 ? models : DEFAULT_MODELS
    localStorage.setItem(STORAGE_KEY, JSON.stringify(valid))
  } catch (_) {}
}
