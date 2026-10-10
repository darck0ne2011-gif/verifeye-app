const STORAGE_KEY = 'verifeye_scan_models'

/** Backend model ids, per media category. Order is the display order. */
export const MODEL_OPTIONS = {
  image: ['genai', 'deepfake', 'type', 'quality'],
  video: ['genai', 'deepfake', 'ai_speech'],
  audio: ['ai_speech'],
}

export const DEFAULT_MODELS = {
  image: ['genai'],
  video: ['genai', 'deepfake'],
  audio: ['ai_speech'],
}

export const MODEL_IDS = {
  deepfake: 'deepfake',
  genai: 'genai',
  type: 'type',
  quality: 'quality',
  ai_speech: 'ai_speech',
}

const CATEGORIES = Object.keys(MODEL_OPTIONS)

/** Legacy key names from older versions of the app. */
const LEGACY_KEYS = { photo: 'image' }

function normalizeCategory(category) {
  const c = LEGACY_KEYS[category] ?? category
  return CATEGORIES.includes(c) ? c : 'image'
}

function sanitize(category, models) {
  const allowed = MODEL_OPTIONS[category]
  const valid = Array.isArray(models) ? models.filter((m) => allowed.includes(m)) : []
  return valid.length ? [...new Set(valid)] : [...DEFAULT_MODELS[category]]
}

function loadRaw() {
  try {
    const raw = localStorage.getItem(STORAGE_KEY)
    if (!raw) return {}
    const parsed = JSON.parse(raw)
    if (Array.isArray(parsed)) return { image: parsed } // very old flat format
    if (parsed && typeof parsed === 'object') {
      const out = {}
      for (const [k, v] of Object.entries(parsed)) out[LEGACY_KEYS[k] ?? k] = v
      return out
    }
  } catch {
    // ignore corrupt storage
  }
  return {}
}

function saveRaw(data) {
  try {
    localStorage.setItem(STORAGE_KEY, JSON.stringify(data))
  } catch {
    // storage may be unavailable (private mode); settings just won't persist
  }
}

/** Active backend model ids for a media category. Always returns at least one. */
export function getActiveModels(mediaCategory = 'image') {
  const category = normalizeCategory(mediaCategory)
  return sanitize(category, loadRaw()[category])
}

export const getActiveModelsForCategory = getActiveModels

export function setActiveModelsForCategory(mediaCategory, models) {
  const category = normalizeCategory(mediaCategory)
  const data = loadRaw()
  data[category] = sanitize(category, models)
  saveRaw(data)
  return data[category]
}

/** Credits a scan costs for a given file (1 per model). */
export function getCreditsForCategory(mediaCategory) {
  return getActiveModels(mediaCategory).length
}

/** Highest credit cost across categories (shown before a file is chosen). */
export function getMaxCreditsPerScan() {
  return Math.max(...CATEGORIES.map((c) => getActiveModels(c).length), 1)
}
