const STORAGE_KEY = 'verifeye_scan_models'

// Backend model IDs (used by API)
const PHOTO_IDS = ['deepfake', 'genai', 'type', 'quality']

const DEFAULTS = {
  photo: ['genai'],
}

/** Map UI model IDs to backend API model IDs */
const TO_API_MAP = {
  // Photo: direct 1:1
  deepfake: 'deepfake',
  genai: 'genai',
  type: 'type',
  quality: 'quality',
}

function loadRaw() {
  try {
    const raw = localStorage.getItem(STORAGE_KEY)
    if (!raw) return null
    const parsed = JSON.parse(raw)
    if (parsed && typeof parsed === 'object' && !Array.isArray(parsed)) {
      // Photo-only mode: ignore any legacy video/audio keys
      return { photo: Array.isArray(parsed.photo) ? parsed.photo : DEFAULTS.photo }
    }
    // Legacy flat array → migrate to photo
    if (Array.isArray(parsed) && parsed.length > 0) {
      const migrated = { photo: parsed }
      localStorage.setItem(STORAGE_KEY, JSON.stringify(migrated))
      return migrated
    }
    return null
  } catch {
    return null
  }
}

function saveRaw(data) {
  try {
    localStorage.setItem(STORAGE_KEY, JSON.stringify(data))
  } catch (_) {}
}

/** Get models for a category. Ensures at least one is selected. */
function getForCategory(category) {
  const data = loadRaw()
  const key = category === 'image' ? 'photo' : category
  if (key !== 'photo') return [...DEFAULTS.photo]
  const arr = data?.[key]
  if (Array.isArray(arr) && arr.length > 0) return [...arr]
  return [...(DEFAULTS[key] ?? DEFAULTS.photo)]
}

/** Get active models for a media category. Returns backend-compatible IDs. */
export function getActiveModels(mediaCategory = 'photo') {
  const cat = mediaCategory === 'image' ? 'photo' : mediaCategory
  const ids = getForCategory(cat === 'photo' ? 'photo' : 'photo')
  const apiIds = ids.map((id) => TO_API_MAP[id]).filter(Boolean)
  const deduped = [...new Set(apiIds)]
  return deduped.length > 0 ? deduped : ['genai']
}

/** Get raw UI model IDs for a category (for settings UI) */
export function getActiveModelsForCategory(category) {
  return getForCategory(category === 'photo' ? 'photo' : 'photo')
}

/** Set active models for a category. Ensures at least one remains. */
export function setActiveModelsForCategory(category, models, ensureOne = true) {
  const data = loadRaw() || { photo: DEFAULTS.photo }
  const valid = Array.isArray(models) ? models.filter(Boolean) : []
  const arr = ensureOne && valid.length === 0
    ? ['genai']
    : valid.length > 0 ? valid : data.photo ?? DEFAULTS.photo
  data.photo = arr
  saveRaw(data)
}

/** Legacy: set photo models (backward compat) */
export function setActiveModels(models) {
  setActiveModelsForCategory('photo', models)
}

/** Max credits needed across all categories (for display before file selection) */
export function getMaxCreditsPerScan() {
  const p = getForCategory('photo').map((id) => TO_API_MAP[id]).filter(Boolean)
  return Math.max(
    [...new Set(p)].length,
    1
  )
}
