import crypto from 'crypto'
import { Router } from 'express'
import multer from 'multer'
import rateLimit from 'express-rate-limit'
import { authMiddleware } from '../middleware/auth.js'
import { analyzeImage } from '../services/analysis.js'
import { IMAGE_MODELS } from '../services/sightengine.js'
import { generateExecutiveSummary } from '../services/deepseekAnalyst.js'
import { findScanByHash, saveScanResults, saveExpertSummary, addToUserScanHistory } from '../db/scans.js'
import { deductCredits, refundCredits, findById, hasUnlimitedScans, toPublicUser } from '../db/users.js'
import { badRequest, paymentRequired } from '../lib/errors.js'
import { config } from '../config.js'

const upload = multer({
  storage: multer.memoryStorage(),
  limits: { fileSize: config.limits.maxUploadBytes, files: 1 },
  fileFilter: (req, file, cb) => {
    if (/^image\//i.test(file.mimetype || '')) cb(null, true)
    else cb(badRequest('Only image files are supported right now', 'UNSUPPORTED_MEDIA'))
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

function parseModels(raw) {
  const list = String(raw || '')
    .split(',')
    .map((m) => m.trim())
    .filter((m) => IMAGE_MODELS.includes(m))
  return list.length ? [...new Set(list)] : ['genai']
}

const router = Router()

router.post('/analyze', authMiddleware, scanLimiter, upload.single('file'), async (req, res, next) => {
  let charged = 0
  try {
    const file = req.file
    if (!file) throw badRequest('No file uploaded', 'NO_FILE')

    const models = parseModels(req.body?.models)
    const language = String(req.body?.language || 'en').slice(0, 10)
    const user = req.user
    const unlimited = hasUnlimitedScans(user)

    // One credit per model. Charged up front and refunded if the scan fails.
    if (!unlimited) {
      const updated = await deductCredits(user.id, models.length)
      if (!updated) {
        throw paymentRequired(`This scan needs ${models.length} credit(s) (1 per model). You have ${user.scanCredits}.`)
      }
      charged = models.length
    }

    const fileHash = crypto.createHash('sha256').update(file.buffer).digest('hex')
    const cached = await findScanByHash(fileHash)

    const analysis = await analyzeImage(file.buffer, file.originalname, models, cached?.results ?? null)
    const fromCache = Object.keys(analysis.newModelResults).length === 0
    if (!fromCache) {
      await saveScanResults(fileHash, analysis, analysis.newModelResults)
    }

    const fp = analysis.fakeProbability
    const status = fp >= 50 ? 'FAKE' : 'REAL'

    let expertSummary = cached?.expertSummaries?.[language] ?? null
    if (!expertSummary) {
      expertSummary = await generateExecutiveSummary({
        modelScores: analysis.modelScores,
        metadata: analysis.metadata,
        aiSignatures: analysis.aiSignatures,
        fakeProbability: fp,
        status,
        language,
      })
      if (expertSummary) await saveExpertSummary(fileHash, language, expertSummary)
    }
    const metadata = { ...analysis.metadata, ...(expertSummary && { expertSummary }) }

    await addToUserScanHistory(user.id, {
      fileName: file.originalname,
      score: fp >= 50 ? fp : 100 - fp,
      status,
      fileHash,
      modelScores: analysis.modelScores,
      aiSignatures: analysis.aiSignatures,
      scannedModels: models,
      metadata,
      mediaCategory: 'image',
    })

    const freshUser = await findById(user.id)
    res.json({
      success: true,
      fakeProbability: fp,
      aiProbability: analysis.aiProbability,
      status,
      scanCredits: toPublicUser(freshUser).scanCredits,
      metadata,
      expertSummary,
      aiSignatures: analysis.aiSignatures,
      mediaCategory: 'image',
      scannedModels: models,
      modelScores: analysis.modelScores,
      cached: fromCache,
      fileHash,
    })
  } catch (err) {
    if (charged > 0) await refundCredits(req.user.id, charged).catch(() => {})
    next(err)
  }
})

export default router
