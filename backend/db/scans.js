import { eq, desc, sql } from 'drizzle-orm'
import { getDb } from './index.js'
import { scanCache, scanHistory } from './schema.js'

export async function findScanByHash(hash) {
  const [row] = await getDb().select().from(scanCache).where(eq(scanCache.hash, hash)).limit(1)
  return row ?? null
}

/**
 * Upserts the cache entry for a file. Model results are merged so a later scan
 * with extra models only adds to what is already known. Results marked
 * `unavailable` are not cached, so they are retried next time.
 */
export async function saveScanResults(hash, analysis, newModelResults) {
  const existing = await findScanByHash(hash)
  const cacheable = Object.fromEntries(Object.entries(newModelResults).filter(([, r]) => r && !r.unavailable))
  const results = { ...(existing?.results ?? {}), ...cacheable }
  const values = {
    hash,
    mediaCategory: analysis.mediaCategory ?? analysis.metadata?.mediaCategory ?? null,
    results,
    fakeProbability: analysis.fakeProbability ?? null,
    aiProbability: analysis.aiProbability ?? analysis.fakeProbability ?? null,
    metadata: analysis.metadata ?? null,
    aiSignatures: analysis.aiSignatures ?? null,
    scannedModels: Object.keys(results),
    updatedAt: new Date(),
  }
  const [row] = await getDb()
    .insert(scanCache)
    .values(values)
    .onConflictDoUpdate({ target: scanCache.hash, set: values })
    .returning()
  return row
}

export async function saveExpertSummary(hash, language, text) {
  await getDb()
    .update(scanCache)
    .set({
      expertSummaries: sql`${scanCache.expertSummaries} || ${JSON.stringify({ [language]: text })}::jsonb`,
      updatedAt: new Date(),
    })
    .where(eq(scanCache.hash, hash))
}

export async function addToUserScanHistory(userId, entry) {
  const [row] = await getDb()
    .insert(scanHistory)
    .values({
      userId,
      fileName: entry.fileName || 'Unknown file',
      score: Math.round(Number(entry.score) || 0),
      status: entry.status === 'FAKE' ? 'FAKE' : 'REAL',
      verdict: entry.verdict ?? null,
      confidence: entry.confidence ?? null,
      source: entry.source ?? 'file',
      fileHash: entry.fileHash ?? null,
      modelScores: entry.modelScores ?? null,
      aiSignatures: entry.aiSignatures ?? null,
      scannedModels: entry.scannedModels ?? null,
      metadata: entry.metadata ?? null,
      mediaCategory: entry.mediaCategory ?? null,
    })
    .returning()
  return toHistoryItem(row)
}

export async function getUserScanHistory(userId, limit = 100) {
  const rows = await getDb()
    .select()
    .from(scanHistory)
    .where(eq(scanHistory.userId, userId))
    .orderBy(desc(scanHistory.createdAt), desc(scanHistory.id))
    .limit(limit)
  return rows.map(toHistoryItem)
}

/** API shape expected by the web client (`id` as string, `date` ISO). */
function toHistoryItem(row) {
  return {
    id: String(row.id),
    fileName: row.fileName,
    date: row.createdAt instanceof Date ? row.createdAt.toISOString() : row.createdAt,
    score: row.score,
    status: row.status,
    verdict: row.verdict,
    confidence: row.confidence,
    source: row.source,
    fileHash: row.fileHash,
    modelScores: row.modelScores,
    aiSignatures: row.aiSignatures,
    scannedModels: row.scannedModels,
    metadata: row.metadata,
    mediaCategory: row.mediaCategory,
  }
}
