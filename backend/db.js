import fs from 'fs'
import path from 'path'
import { fileURLToPath } from 'url'

const __dirname = path.dirname(fileURLToPath(import.meta.url))
const dbPath = path.join(__dirname, 'verifeye-data.json')

function load() {
  try {
    const data = fs.readFileSync(dbPath, 'utf8')
    return JSON.parse(data)
  } catch {
    return { users: [], nextId: 1 }
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
