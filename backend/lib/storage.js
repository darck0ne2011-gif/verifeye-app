import fs from 'fs'
import path from 'path'
import crypto from 'crypto'
import { config } from '../config.js'

/**
 * Temporary upload storage on local disk. Files only live for the duration of
 * a scan job; swapping this for S3/R2 later only touches this module.
 */
export const uploadsDir = path.resolve(config.uploadsDir)

export function ensureUploadsDir() {
  fs.mkdirSync(uploadsDir, { recursive: true })
  return uploadsDir
}

export async function removeFile(filePath) {
  if (!filePath) return
  await fs.promises.unlink(filePath).catch(() => {})
}

export function sha256File(filePath) {
  return new Promise((resolve, reject) => {
    const hash = crypto.createHash('sha256')
    fs.createReadStream(filePath)
      .on('data', (chunk) => hash.update(chunk))
      .on('end', () => resolve(hash.digest('hex')))
      .on('error', reject)
  })
}

/** Removes uploads older than `maxAgeMs` (leftovers from crashes). */
export async function cleanupStaleUploads(maxAgeMs = 6 * 60 * 60 * 1000) {
  ensureUploadsDir()
  const now = Date.now()
  const entries = await fs.promises.readdir(uploadsDir).catch(() => [])
  await Promise.all(
    entries.map(async (name) => {
      const p = path.join(uploadsDir, name)
      const stat = await fs.promises.stat(p).catch(() => null)
      if (stat && now - stat.mtimeMs > maxAgeMs) await removeFile(p)
    })
  )
}
