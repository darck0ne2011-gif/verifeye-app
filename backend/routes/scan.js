import crypto from 'crypto'
import { Router } from 'express'
import multer from 'multer'
import rateLimit from 'express-rate-limit'
import { fileTypeFromFile } from 'file-type'
import { authMiddleware } from '../middleware/auth.js'
import { modelsForCategory, processScanJob } from '../services/scanner.js'
import { createJob, getJobForUser, toPublicJob } from '../db/jobs.js'
import { deductCredits, refundCredits, hasUnlimitedScans, findById, toPublicUser } from '../db/users.js'
import { removeFile, uploadsDir, ensureUploadsDir, sha256File } from '../lib/storage.js'
import { badRequest, paymentRequired, notFound } from '../lib/errors.js'
import { config } from '../config.js'

ensureUploadsDir()

const upload = multer({
  storage: multer.diskStorage({
    destination: uploadsDir,
    filename: (req, file, cb) => cb(null, `${crypto.randomUUID()}.upload`),
  }),
  limits: { fileSize: config.limits.maxUploadBytes, files: 1 },
  fileFilter: (req, file, cb) => {
    if (/^(image|video|audio)\//i.test(file.mimetype || '')) cb(null, true)
    else cb(badRequest('Only image, video and audio files are supported', 'UNSUPPORTED_MEDIA'))
  },
})

const scanLimiter = rateLimit({
  windowMs: 15 * 60 * 1000,
  limit: 60,
  standardHeaders: 'draft-8',
  legacyHeaders: false,
  skip: () => config.isTest,
  keyGenerator: (req) => String(req.userId),
  message: { success: false, error: 'Too many scans, please slow down', code: 'RATE_LIMITED' },
})

const SIZE_LIMITS = {
  image: config.limits.maxImageBytes,
  video: config.limits.maxVideoBytes,
  audio: config.limits.maxAudioBytes,
}

/** Detects the media category from the file bytes (never from the declared MIME type). */
async function detectCategory(filePath) {
  const detected = await fileTypeFromFile(filePath).catch(() => null)
  const mime = detected?.mime || ''
  if (/^image\//.test(mime)) return { category: 'image', mime, ext: detected.ext }
  if (/^video\//.test(mime)) return { category: 'video', mime, ext: detected.ext }
  if (/^audio\//.test(mime)) return { category: 'audio', mime, ext: detected.ext }
  return null
}

/**
 * Validates the upload, charges credits and creates the job row. Shared by
 * the asynchronous and the legacy synchronous endpoints.
 */
async function createScanJobFromUpload(req) {
  const file = req.file
  if (!file) throw badRequest('No file uploaded', 'NO_FILE')
  const filePath = file.path
  try {
    const detected = await detectCategory(filePath)
    if (!detected)
      throw badRequest('The uploaded file is not a supported image, video or audio file', 'UNSUPPORTED_MEDIA')
    const { category } = detected
    if (file.size > SIZE_LIMITS[category]) {
      throw badRequest(
        `${category} files larger than ${Math.round(SIZE_LIMITS[category] / 1024 / 1024)} MB are not supported`,
        'FILE_TOO_LARGE'
      )
    }

    const models = modelsForCategory(category, req.body?.models)
    const language = String(req.body?.language || 'en').slice(0, 10)
    const source = req.body?.source === 'screenshot' ? 'screenshot' : 'file'
    const user = req.user

    let creditsCharged = 0
    if (!hasUnlimitedScans(user)) {
      const updated = await deductCredits(user.id, models.length)
      if (!updated) {
        throw paymentRequired(`This scan needs ${models.length} credit(s) (1 per model). You have ${user.scanCredits}.`)
      }
      creditsCharged = models.length
    }

    try {
      const fileHash = await sha256File(filePath)
      return await createJob({
        id: crypto.randomUUID(),
        userId: user.id,
        mediaCategory: category,
        source,
        fileName: file.originalname || `upload.${detected.ext}`,
        filePath,
        fileHash,
        models,
        language,
        creditsCharged,
      })
    } catch (err) {
      if (creditsCharged > 0) await refundCredits(user.id, creditsCharged).catch(() => {})
      throw err
    }
  } catch (err) {
    await removeFile(filePath)
    throw err
  }
}

const router = Router()

/** Starts a scan. Returns 202 with the job id; poll GET /api/scans/:id. */
router.post('/scans', authMiddleware, scanLimiter, upload.single('file'), async (req, res, next) => {
  try {
    const job = await createScanJobFromUpload(req)
    res.status(202).json({ success: true, job: toPublicJob(job) })
  } catch (err) {
    next(err)
  }
})

router.get('/scans/:id', authMiddleware, async (req, res, next) => {
  try {
    const job = await getJobForUser(String(req.params.id), req.userId)
    if (!job) throw notFound('Scan not found', 'SCAN_NOT_FOUND')
    res.json({ success: true, job: toPublicJob(job) })
  } catch (err) {
    next(err)
  }
})

/**
 * Legacy synchronous endpoint (images only). Runs the job inline and returns
 * the flat result shape used by older clients.
 */
router.post('/analyze', authMiddleware, scanLimiter, upload.single('file'), async (req, res, next) => {
  try {
    const job = await createScanJobFromUpload(req)
    if (job.mediaCategory !== 'image') {
      await removeFile(job.filePath)
      if (job.creditsCharged > 0) await refundCredits(job.userId, job.creditsCharged).catch(() => {})
      throw badRequest('Use POST /api/scans for video and audio', 'USE_ASYNC_ENDPOINT')
    }
    const claimed = { ...job, status: 'processing' }
    const result = await processScanJob(claimed)
    if (!result) {
      const failed = await getJobForUser(job.id, req.userId)
      const error = failed?.error ?? { code: 'SCAN_FAILED', message: 'Scan failed' }
      return res.status(error.code === 'API_CONFIG_MISSING' || error.code === 'PROVIDER_UNAVAILABLE' ? 503 : 400).json({
        success: false,
        error: error.message,
        code: error.code,
      })
    }
    const freshUser = await findById(req.userId)
    res.json({ success: true, ...result, scanCredits: toPublicUser(freshUser).scanCredits })
  } catch (err) {
    next(err)
  }
})

export default router
