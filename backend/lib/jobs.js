/**
 * Minimal in-process job worker backed by the scan_jobs table. Postgres row
 * locking (FOR UPDATE SKIP LOCKED) makes it safe to run several instances.
 */
import { claimNextJob, failStaleProcessingJobs } from '../db/jobs.js'
import { refundCredits } from '../db/users.js'
import { removeFile } from './storage.js'

let running = false
let timer = null
let active = 0
let handler = null

export function setJobHandler(fn) {
  handler = fn
}

async function tick(concurrency) {
  while (running && active < concurrency) {
    const job = await claimNextJob().catch((err) => {
      console.error('Job claim failed:', err)
      return null
    })
    if (!job) break
    active++
    handler(job)
      .catch((err) => console.error(`Job ${job.id} handler threw:`, err))
      .finally(() => {
        active--
      })
  }
}

export async function recoverInterruptedJobs() {
  const stale = await failStaleProcessingJobs()
  for (const job of stale) {
    if (job.creditsCharged > 0) await refundCredits(job.userId, job.creditsCharged).catch(() => {})
    await removeFile(job.filePath)
  }
  if (stale.length) console.warn(`Marked ${stale.length} interrupted scan job(s) as failed`)
}

export function startWorker({ concurrency = 2, pollMs = 1000 } = {}) {
  if (!handler) throw new Error('setJobHandler() must be called before startWorker()')
  running = true
  const loop = async () => {
    if (!running) return
    await tick(concurrency)
    timer = setTimeout(loop, pollMs)
    timer.unref?.()
  }
  loop()
}

export function stopWorker() {
  running = false
  if (timer) clearTimeout(timer)
}

/** Processes every queued job now (used by tests and the synchronous image endpoint). */
export async function drainQueue() {
  let job
  while ((job = await claimNextJob())) {
    await handler(job)
  }
}

export function isWorkerBusy() {
  return active > 0
}
