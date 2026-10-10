import { eq, sql, and, gte } from 'drizzle-orm'
import { getDb } from './index.js'
import { users } from './schema.js'
import { config, isAdminEmail } from '../config.js'

export const normalizeEmail = (email) =>
  String(email || '')
    .toLowerCase()
    .trim()

export function hasUnlimitedScans(user) {
  return !!user && (user.role === 'admin' || user.subscriptionTier === 'elite')
}

/** Shape returned to API clients. Never includes the password hash. */
export function toPublicUser(user) {
  if (!user) return null
  const unlimited = hasUnlimitedScans(user)
  return {
    id: user.id,
    email: user.email,
    role: user.role,
    subscriptionTier: user.subscriptionTier,
    scanCredits: unlimited ? config.limits.unlimitedCreditsDisplay : user.scanCredits,
    unlimitedScans: unlimited,
    createdAt: user.createdAt,
  }
}

export async function findByEmail(email) {
  const [row] = await getDb()
    .select()
    .from(users)
    .where(eq(users.email, normalizeEmail(email)))
    .limit(1)
  return row ?? null
}

export async function findById(id) {
  const [row] = await getDb().select().from(users).where(eq(users.id, id)).limit(1)
  return row ?? null
}

export async function findByAppleSub(appleSub) {
  const [row] = await getDb().select().from(users).where(eq(users.appleSub, appleSub)).limit(1)
  return row ?? null
}

export async function createUser({ email, passwordHash, appleSub = null }) {
  const normalized = normalizeEmail(email)
  const [row] = await getDb()
    .insert(users)
    .values({
      email: normalized,
      passwordHash,
      appleSub,
      role: isAdminEmail(normalized) ? 'admin' : 'user',
      scanCredits: config.limits.defaultCredits,
    })
    .returning()
  return row
}

/** Admin status comes from ADMIN_EMAILS; keep the stored role in sync on login. */
export async function syncAdminRole(user) {
  const shouldBeAdmin = isAdminEmail(user.email)
  if (shouldBeAdmin && user.role !== 'admin') {
    const [row] = await getDb().update(users).set({ role: 'admin' }).where(eq(users.id, user.id)).returning()
    return row
  }
  return user
}

export async function updatePassword(userId, passwordHash) {
  await getDb().update(users).set({ passwordHash }).where(eq(users.id, userId))
}

export async function deleteUser(userId) {
  await getDb().delete(users).where(eq(users.id, userId))
}

export async function setCredits(userId, credits) {
  const [row] = await getDb()
    .update(users)
    .set({ scanCredits: Math.max(0, Math.floor(credits)) })
    .where(eq(users.id, userId))
    .returning()
  return row ?? null
}

export async function setTier(userId, tier) {
  const [row] = await getDb().update(users).set({ subscriptionTier: tier }).where(eq(users.id, userId)).returning()
  return row ?? null
}

/**
 * Atomically deducts credits. Returns the updated user, or null when the
 * balance is insufficient (no change made).
 */
export async function deductCredits(userId, amount) {
  const [row] = await getDb()
    .update(users)
    .set({ scanCredits: sql`${users.scanCredits} - ${amount}` })
    .where(and(eq(users.id, userId), gte(users.scanCredits, amount)))
    .returning()
  return row ?? null
}

export async function refundCredits(userId, amount) {
  await getDb()
    .update(users)
    .set({ scanCredits: sql`${users.scanCredits} + ${amount}` })
    .where(eq(users.id, userId))
}
