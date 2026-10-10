import { and, eq, sql } from 'drizzle-orm'
import { getDb } from './index.js'
import { scanJobs } from './schema.js'

export async function createJob(job) {
  const [row] = await getDb().insert(scanJobs).values(job).returning()
  return row
}

export async function getJob(id) {
  const [row] = await getDb().select().from(scanJobs).where(eq(scanJobs.id, id)).limit(1)
  return row ?? null
}

export async function getJobForUser(id, userId) {
  const [row] = await getDb()
    .select()
    .from(scanJobs)
    .where(and(eq(scanJobs.id, id), eq(scanJobs.userId, userId)))
    .limit(1)
  return row ?? null
}

/** Atomically claims the oldest queued job. Safe with several workers. */
export async function claimNextJob() {
  const rows = await getDb().execute(sql`
    UPDATE scan_jobs
    SET status = 'processing', started_at = now(), stage = 'starting'
    WHERE id = (
      SELECT id FROM scan_jobs
      WHERE status = 'queued'
      ORDER BY created_at
      LIMIT 1
      FOR UPDATE SKIP LOCKED
    )
    RETURNING id
  `)
  const id = rows.rows?.[0]?.id ?? rows[0]?.id
  return id ? getJob(id) : null
}

export async function updateJobProgress(id, stage, progress) {
  await getDb()
    .update(scanJobs)
    .set({ stage, progress: Math.max(0, Math.min(100, Math.round(progress))) })
    .where(eq(scanJobs.id, id))
}

export async function completeJob(id, result, extra = {}) {
  await getDb()
    .update(scanJobs)
    .set({ status: 'done', stage: 'done', progress: 100, result, finishedAt: new Date(), filePath: null, ...extra })
    .where(eq(scanJobs.id, id))
}

export async function failJob(id, error) {
  await getDb()
    .update(scanJobs)
    .set({ status: 'failed', stage: 'failed', error, finishedAt: new Date(), filePath: null })
    .where(eq(scanJobs.id, id))
}

/** Jobs left in 'processing' by a crashed process are marked failed on start. */
export async function failStaleProcessingJobs() {
  const rows = await getDb()
    .update(scanJobs)
    .set({
      status: 'failed',
      stage: 'failed',
      error: { code: 'INTERRUPTED', message: 'The server restarted while this scan was running' },
      finishedAt: new Date(),
    })
    .where(eq(scanJobs.status, 'processing'))
    .returning({
      id: scanJobs.id,
      userId: scanJobs.userId,
      creditsCharged: scanJobs.creditsCharged,
      filePath: scanJobs.filePath,
    })
  return rows
}

/** Shape returned by GET /api/scans/:id */
export function toPublicJob(job) {
  if (!job) return null
  return {
    id: job.id,
    status: job.status,
    stage: job.stage,
    progress: job.progress,
    mediaCategory: job.mediaCategory,
    source: job.source,
    fileName: job.fileName,
    models: job.models,
    createdAt: job.createdAt,
    finishedAt: job.finishedAt,
    result: job.status === 'done' ? job.result : null,
    error: job.status === 'failed' ? job.error : null,
  }
}
