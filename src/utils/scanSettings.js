const STORAGE_KEY = 'verifeye_scan_models'
const VIDEO_AUDIT_KEY = 'verifeye_video_audit_mode'

// Backend model IDs (used by API)
const PHOTO_IDS = ['deepfake', 'genai', 'type', 'quality']
const VIDEO_IDS = ['temporal_ai', 'video_deepfake', 'frame_integrity']
const AUDIO_IDS = ['voice_cloning', 'synthetic_speech', 'background_noise']

const DEFAULTS = {
  photo: ['genai'],
  video: ['temporal_ai', 'video_deepfake'],
  audio: ['voice_cloning', 'synthetic_speech'],
}

/** Map UI model IDs to backend API model IDs */
const TO_API_MAP = {
  // Photo: direct 1:1
  deepfake: 'deepfake',
  genai: 'genai',
  type: 'type',
  quality: 'quality',
  // Video: frame-by-frame uses genai/deepfake; Elite-only dual-track
  temporal_ai: 'genai',
  video_deepfake: 'deepfake',
  frame_integrity: 'deepfake',
  video_voice_clone: 'voice_clone',
  video_lip_sync: 'lip_sync',
  // Audio: maps to genai/deepfake
  voice_cloning: 'deepfake',
  synthetic_speech: 'genai',
  background_noise: 'quality',
}

function loadRaw() {
  try {
    const raw = localStorage.getItem(STORAGE_KEY)
    if (!raw) return null
    const parsed = JSON.parse(raw)
    if (parsed && typeof parsed === 'object' && !Array.isArray(parsed)) {
      return parsed
    }
    // Legacy flat array → migrate to photo
    if (Array.isArray(parsed) && parsed.length > 0) {
      const migrated = { photo: parsed, video: [...DEFAULTS.video], audio: [...DEFAULTS.audio] }
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
  const arr = data?.[key]
  if (Array.isArray(arr) && arr.length > 0) return [...arr]
  return [...(DEFAULTS[key] ?? DEFAULTS.photo)]
}

/** Get active models for a media category. Returns backend-compatible IDs. */
export function getActiveModels(mediaCategory = 'photo') {
  const cat = mediaCategory === 'image' ? 'photo' : mediaCategory
  const ids = getForCategory(cat)
  const apiIds = ids.map((id) => TO_API_MAP[id]).filter(Boolean)
  const deduped = [...new Set(apiIds)]
  return deduped.length > 0 ? deduped : ['genai']
}

/** Get raw UI model IDs for a category (for settings UI) */
export function getActiveModelsForCategory(category) {
  return getForCategory(category)
}

/** Set active models for a category. Ensures at least one remains. */
export function setActiveModelsForCategory(category, models, ensureOne = true) {
  const data = loadRaw() || { photo: DEFAULTS.photo, video: DEFAULTS.video, audio: DEFAULTS.audio }
  const valid = Array.isArray(models) ? models.filter(Boolean) : []
  const arr = ensureOne && valid.length === 0
    ? (category === 'photo' ? ['genai'] : category === 'video' ? ['temporal_ai'] : ['voice_cloning'])
    : valid.length > 0 ? valid : data[category] ?? DEFAULTS[category]
  data[category] = arr
  saveRaw(data)
}

/** Legacy: set photo models (backward compat) */
export function setActiveModels(models) {
  setActiveModelsForCategory('photo', models)
}

/** Video audit mode: 'quick' = 5 frames (default), 'full_forensic' = 15 frames (Elite only) */
export function getVideoAuditMode() {
  try {
    const v = localStorage.getItem(VIDEO_AUDIT_KEY)
    return v === 'full_forensic' ? 'full_forensic' : 'quick'
  } catch {
    return 'quick'
  }
}

export function setVideoAuditMode(mode) {
  try {
    localStorage.setItem(VIDEO_AUDIT_KEY, mode === 'full_forensic' ? 'full_forensic' : 'quick')
  } catch {}
}

/** Max credits needed across all categories (for display before file selection) */
export function getMaxCreditsPerScan() {
  const p = getForCategory('photo').map((id) => TO_API_MAP[id]).filter(Boolean)
  const v = getForCategory('video').map((id) => TO_API_MAP[id]).filter(Boolean)
  const a = getForCategory('audio').map((id) => TO_API_MAP[id]).filter(Boolean)
  return Math.max(
    [...new Set(p)].length,
    [...new Set(v)].length,
    [...new Set(a)].length,
    1
  )
}
