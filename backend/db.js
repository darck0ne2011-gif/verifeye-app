import fs from 'fs'
import path from 'path'
import { fileURLToPath } from 'url'

const __dirname = path.dirname(fileURLToPath(import.meta.url))
const dbPath = path.join(__dirname, 'verifeye-data.json')

function load() {
  try {
    if (!fs.existsSync(dbPath)) {
      const initial = { users: [], past_scans: [], user_scan_history: [], nextId: 1, nextScanHistoryId: 1 }
      try {
        fs.writeFileSync(dbPath, JSON.stringify(initial, null, 2), 'utf8')
      } catch {
        // disk may be read-only on some hosts; return in-memory default
      }
      return initial
    }
    const data = fs.readFileSync(dbPath, 'utf8')
    const parsed = JSON.parse(data)
    if (!Array.isArray(parsed.past_scans)) parsed.past_scans = []
    if (!Array.isArray(parsed.users)) parsed.users = []
    if (!Array.isArray(parsed.user_scan_history)) parsed.user_scan_history = []
    if (typeof parsed.nextScanHistoryId !== 'number') parsed.nextScanHistoryId = 1
    return parsed
  } catch {
    return { users: [], past_scans: [], user_scan_history: [], nextId: 1, nextScanHistoryId: 1 }
  }
}

function save(data) {
  fs.writeFileSync(dbPath, JSON.stringify(data, null, 2), 'utf8')
}

export function createUser(email, hashedPassword) {
  const data = load()
  const normalized = email.toLowerCase().trim()
  if (data.users.some((u) => u.email === normalized)) {
    throw new Error('Email already registered')
  }
  const user = {
    id: data.nextId++,
    email: normalized,
    password: hashedPassword,
    scanCredits: 3,
    subscriptionTier: 'starter',
    createdAt: new Date().toISOString(),
  }
  data.users.push(user)
  save(data)
  return user.id
}

export function findOrCreateOAuthUser(email, hashedPassword) {
  const data = load()
  const normalized = email.toLowerCase().trim()
  const existing = data.users.find((u) => u.email === normalized)
  if (existing) return existing.id
  const user = {
    id: data.nextId++,
    email: normalized,
    password: hashedPassword,
    scanCredits: 3,
    subscriptionTier: 'starter',
    createdAt: new Date().toISOString(),
  }
  data.users.push(user)
  save(data)
  return user.id
}

export function findOrCreateOAuthUserByApple(email, hashedPassword, appleSub) {
  const data = load()
  const existingBySub = appleSub && data.users.find((u) => u.appleSub === appleSub)
  if (existingBySub) return existingBySub.id
  const normalized = email.toLowerCase().trim()
  const existingByEmail = data.users.find((u) => u.email === normalized)
  if (existingByEmail) {
    existingByEmail.appleSub = appleSub
    save(data)
    return existingByEmail.id
  }
  const user = {
    id: data.nextId++,
    email: normalized,
    password: hashedPassword,
    scanCredits: 3,
    subscriptionTier: 'starter',
    appleSub: appleSub || null,
    createdAt: new Date().toISOString(),
  }
  data.users.push(user)
  save(data)
  return user.id
}

export function findByEmail(email) {
  const data = load()
  return data.users.find((u) => u.email === email.toLowerCase().trim()) ?? null
}

export function findById(id) {
  const data = load()
  const u = data.users.find((u) => u.id === id)
  if (!u) return null
  const { password, ...user } = u
  return user
}

export function findByIdWithPassword(id) {
  const data = load()
  return data.users.find((u) => u.id === id) ?? null
}

export function updateCredits(userId, credits) {
  const data = load()
  const user = data.users.find((u) => u.id === userId)
  if (user) {
    user.scanCredits = Math.max(0, credits)
    save(data)
  }
}

export function getCredits(userId) {
  const user = findById(userId)
  return user?.scanCredits ?? 0
}

/** Find cached scan entry by file hash only (Modular Memory: one entry per file) */
export function findScanByHash(hash) {
  const data = load()
  return data.past_scans?.find((s) => s.hash === hash) ?? null
}

/** Extract per-model results from Sightengine response for storage */
function extractModelResults(seResponse, models) {
  const out = {}
  if (!seResponse || !models?.length) return out
  if (seResponse.type) {
    if (models.includes('genai') && seResponse.type.ai_generated != null) {
      out.genai = { ai_generated: seResponse.type.ai_generated }
    }
    if (models.includes('deepfake') && seResponse.type.deepfake != null) {
      out.deepfake = { deepfake: seResponse.type.deepfake }
    }
    if (models.includes('type')) {
      out.type = { ...seResponse.type }
    }
  }
  if (models.includes('quality') && seResponse.quality != null) {
    const q = seResponse.quality
    out.quality = { score: typeof q === 'object' ? q?.score : q }
  }
  return out
}

/** Save or update scan with modular results. Merges new model results into existing. */
export function saveScanResults(hash, result, sightengineResponse, modelsRequested) {
  const data = load()
  if (!data.past_scans) data.past_scans = []

  const existing = data.past_scans.find((s) => s.hash === hash)
  const meta = result.metadata ?? {}
  const base = {
    fakeProbability: result.fakeProbability,
    aiProbability: result.aiProbability ?? result.fakeProbability,
    metadata: { ...meta, mediaCategory: meta.mediaCategory ?? 'image' },
    aiSignatures: result.aiSignatures ?? {},
    scannedModels: result.scannedModels ?? [],
    updatedAt: new Date().toISOString(),
  }

  const newModelResults = extractModelResults(sightengineResponse, modelsRequested)
  const mergedResults = {
    ...(existing?.results ?? {}),
    ...newModelResults,
  }

  if (existing) {
    existing.results = mergedResults
    Object.assign(existing, base)
  } else {
    data.past_scans.push({
      hash,
      results: mergedResults,
      createdAt: new Date().toISOString(),
      ...base,
    })
  }
  save(data)
}

/** Add a scan to the user's history (shared across devices) */
export function addToUserScanHistory(userId, { fileName, score, status }) {
  const data = load()
  if (!data.user_scan_history) data.user_scan_history = []
  const id = String(data.nextScanHistoryId ?? 1)
  if (typeof data.nextScanHistoryId === 'number') data.nextScanHistoryId++
  else data.nextScanHistoryId = 2
  const entry = {
    id,
    userId,
    fileName: fileName || 'Unknown file',
    date: new Date().toISOString(),
    score: Number(score) || 0,
    status: status === 'FAKE' || status === 'REAL' ? status : 'REAL',
  }
  data.user_scan_history.unshift(entry)
  save(data)
  return entry
}

/** Get scan history for a user, newest first */
export function getUserScanHistory(userId, limit = 100) {
  const data = load()
  const list = (data.user_scan_history || []).filter((s) => s.userId === userId)
  return list.slice(0, limit)
}

export function updatePassword(userId, hashedPassword) {
  const data = load()
  const user = data.users.find((u) => u.id === userId)
  if (user) {
    user.password = hashedPassword
    save(data)
  }
}

export function deleteUser(userId) {
  const data = load()
  data.users = data.users.filter((u) => u.id !== userId)
  save(data)
}

export function upgradeUserToElite(email) {
  const data = load()
  const normalized = email.toLowerCase().trim()
  const user = data.users.find((u) => u.email === normalized)
  if (!user) return null
  user.subscriptionTier = 'elite'
  user.scanCredits = 999999
  user.isPremium = true
  save(data)
  return user.id
}

const ADMIN_ELITE_EMAILS = ['andrei@test.test', 'inta@test.test']

/** Auto-upgrade admin accounts to Elite on login; persists to DB */
export function ensureAdminElite(email) {
  const normalized = (email || '').toLowerCase().trim()
  if (!ADMIN_ELITE_EMAILS.includes(normalized)) return null
  const data = load()
  const user = data.users.find((u) => u.email === normalized)
  if (!user) return null
  user.subscriptionTier = 'elite'
  user.scanCredits = 9999
  user.isPremium = true
  save(data)
  return user.id
}

/** Create inta@test.test with password 123456 if missing (first-login pre-registration) */
export function findOrCreateAdminUser(email, hashedPassword) {
  const normalized = (email || '').toLowerCase().trim()
  if (normalized !== 'inta@test.test') return null
  const data = load()
  const existing = data.users.find((u) => u.email === normalized)
  if (existing) return existing.id
  const user = {
    id: data.nextId++,
    email: normalized,
    password: hashedPassword,
    scanCredits: 9999,
    subscriptionTier: 'elite',
    isPremium: true,
    createdAt: new Date().toISOString(),
  }
  data.users.push(user)
  save(data)
  return user.id
}
