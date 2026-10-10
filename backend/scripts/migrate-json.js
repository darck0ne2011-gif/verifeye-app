/**
 * One-off import of the legacy verifeye-data.json file into the database.
 *
 *   node scripts/migrate-json.js [path/to/verifeye-data.json]
 *
 * Safe to re-run: existing emails and file hashes are skipped.
 */
import fs from 'fs'
import path from 'path'
import { sql } from 'drizzle-orm'
import { initDb, closeDb, getDb } from '../db/index.js'
import { users, scanCache, scanHistory } from '../db/schema.js'
import { isAdminEmail } from '../config.js'

const file = path.resolve(
  process.argv[2] || path.join(path.dirname(new URL(import.meta.url).pathname), '..', 'verifeye-data.json')
)
if (!fs.existsSync(file)) {
  console.error(`File not found: ${file}`)
  process.exit(1)
}
const legacy = JSON.parse(fs.readFileSync(file, 'utf8'))

await initDb()
const db = getDb()

const idMap = new Map() // legacy user id -> new id
let userCount = 0
for (const u of legacy.users ?? []) {
  if (!u.email || !u.password) continue
  const email = String(u.email).toLowerCase().trim()
  const [row] = await db
    .insert(users)
    .values({
      email,
      passwordHash: u.password,
      role: isAdminEmail(email) ? 'admin' : 'user',
      subscriptionTier: u.subscriptionTier === 'elite' || u.isPremium ? 'elite' : u.subscriptionTier || 'starter',
      scanCredits: Math.min(Number(u.scanCredits) || 0, 1_000_000),
      createdAt: u.createdAt ? new Date(u.createdAt) : new Date(),
    })
    .onConflictDoNothing({ target: users.email })
    .returning({ id: users.id })
  const id =
    row?.id ??
    (
      await db
        .select({ id: users.id })
        .from(users)
        .where(sql`${users.email} = ${email}`)
    )[0]?.id
  if (id) idMap.set(u.id, id)
  if (row) userCount++
}

let cacheCount = 0
for (const s of legacy.past_scans ?? []) {
  if (!s.hash) continue
  const [row] = await db
    .insert(scanCache)
    .values({
      hash: s.hash,
      results: s.results ?? {},
      fakeProbability: s.fakeProbability ?? null,
      aiProbability: s.aiProbability ?? s.fakeProbability ?? null,
      metadata: s.metadata ?? null,
      aiSignatures: s.aiSignatures ?? null,
      scannedModels: s.scannedModels ?? Object.keys(s.results ?? {}),
      createdAt: s.createdAt ? new Date(s.createdAt) : new Date(),
      updatedAt: s.updatedAt ? new Date(s.updatedAt) : new Date(),
    })
    .onConflictDoNothing({ target: scanCache.hash })
    .returning({ hash: scanCache.hash })
  if (row) cacheCount++
}

let historyCount = 0
for (const h of legacy.user_scan_history ?? []) {
  const userId = idMap.get(h.userId)
  if (!userId) continue
  await db.insert(scanHistory).values({
    userId,
    fileName: h.fileName || 'Unknown file',
    score: Math.round(Number(h.score) || 0),
    status: h.status === 'FAKE' ? 'FAKE' : 'REAL',
    fileHash: h.fileHash ?? null,
    modelScores: h.modelScores ?? null,
    aiSignatures: h.aiSignatures ?? null,
    scannedModels: h.scannedModels ?? null,
    metadata: h.metadata ?? null,
    mediaCategory: h.mediaCategory ?? 'image',
    createdAt: h.date ? new Date(h.date) : new Date(),
  })
  historyCount++
}

console.log(`Imported ${userCount} users, ${cacheCount} cached scans, ${historyCount} history entries.`)
await closeDb()
