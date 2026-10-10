/**
 * Keeps the File of a scan in memory for the lifetime of the page so the
 * result screen can show a preview after navigation. Files are never
 * persisted.
 */
const files = new Map()

export function rememberFile(jobId, file) {
  if (jobId && file) files.set(jobId, file)
}

export function recallFile(jobId) {
  return files.get(jobId) ?? null
}
