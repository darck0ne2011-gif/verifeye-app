import { API_BASE } from '../config.js'

export class ScanError extends Error {
  constructor(message, { code = null, status = null } = {}) {
    super(message)
    this.name = 'ScanError'
    this.code = code
    this.status = status
  }
}

async function readJson(res) {
  const type = res.headers.get('content-type') || ''
  if (!type.includes('application/json')) return {}
  return res.json().catch(() => ({}))
}

/** Uploads the file and creates a scan job. Resolves with the job (`{ id, status, ... }`). */
export async function createScan(file, { models, language = 'en', source = 'file' }, authHeaders) {
  const formData = new FormData()
  formData.append('file', file)
  formData.append('models', models.join(','))
  formData.append('language', language)
  formData.append('source', source)
  const res = await fetch(`${API_BASE}/api/scans`, { method: 'POST', headers: authHeaders, body: formData })
  const data = await readJson(res)
  if (!res.ok || !data.success) {
    throw new ScanError(data.error || `Upload failed (${res.status})`, { code: data.code, status: res.status })
  }
  return data.job
}

export async function getScan(jobId, authHeaders) {
  const res = await fetch(`${API_BASE}/api/scans/${encodeURIComponent(jobId)}`, { headers: authHeaders })
  const data = await readJson(res)
  if (!res.ok || !data.success) {
    throw new ScanError(data.error || `Scan lookup failed (${res.status})`, { code: data.code, status: res.status })
  }
  return data.job
}

const sleep = (ms) => new Promise((r) => setTimeout(r, ms))

/**
 * Runs a scan end to end: upload, then poll until the job is done.
 * `onProgress({ stage, progress, status })` is called on every update.
 * Resolves with the job result; rejects with ScanError on failure.
 */
export async function runScan(file, options, { authHeaders, onProgress = () => {}, signal } = {}) {
  onProgress({ stage: 'uploading', progress: 0, status: 'uploading' })
  const job = await createScan(file, options, authHeaders)
  onProgress({ stage: job.stage || 'queued', progress: job.progress ?? 0, status: job.status })

  let delay = 700
  let lastStage = job.stage
  for (;;) {
    if (signal?.aborted) throw new ScanError('Scan cancelled', { code: 'CANCELLED' })
    await sleep(delay)
    const current = await getScan(job.id, authHeaders)
    if (current.status === 'done') {
      onProgress({ stage: 'done', progress: 100, status: 'done' })
      return current.result
    }
    if (current.status === 'failed') {
      throw new ScanError(current.error?.message || 'Scan failed', { code: current.error?.code, status: 200 })
    }
    onProgress({ stage: current.stage || 'queued', progress: current.progress ?? 0, status: current.status })
    // Back off a little while nothing changes; videos take a while.
    delay = current.stage === lastStage ? Math.min(delay * 1.3, 2500) : 700
    lastStage = current.stage
  }
}
