import 'dotenv/config'
import crypto from 'crypto'
import express from 'express'
import cors from 'cors'
import multer from 'multer'
import { analyzeFile } from './analysis.js'
import {
  authMiddleware,
  register,
  login,
  changePassword,
  deleteAccount,
} from './auth.js'
import {
  findById,
  getCredits,
  updateCredits,
  updatePassword,
  deleteUser,
  upgradeUserToElite,
  findScanByHash,
  saveScanResults,
  addToUserScanHistory,
  getUserScanHistory,
} from './db.js'
import { generatePdfBuffer } from './pdfReport.js'
import { generateExecutiveSummary } from './services/deepseekAnalyst.js'
import {
  getGoogleAuthUrl,
  handleGoogleCallback,
  getAppleAuthUrl,
  handleAppleCallback,
  getFrontendUrl,
} from './oauth.js'

const app = express()
const PORT = process.env.PORT || 3001

const storage = multer.memoryStorage()
const upload = multer({
  storage,
  limits: { fileSize: 50 * 1024 * 1024 },
  fileFilter: (req, file, cb) => {
    const allowed = /video|audio|image/i
    if (allowed.test(file.mimetype)) {
      cb(null, true)
    } else {
      cb(new Error('Only video, audio, or image files are allowed'), false)
    }
  },
})

const allowedOrigins = [
  'http://localhost:5173',
  'http://127.0.0.1:5173',
  /^https:\/\/verifeye(-[\w-]+)?\.vercel\.app$/,
  /^https:\/\/[\w-]+\.vercel\.app$/,
]
if (process.env.FRONTEND_URL) {
  allowedOrigins.push(process.env.FRONTEND_URL)
}

function isOriginAllowed(origin) {
  if (!origin) return true
  return allowedOrigins.some((o) =>
    typeof o === 'string' ? o === origin : o.test(origin)
  )
}

app.use(cors({
  origin: (origin, cb) => cb(null, isOriginAllowed(origin)),
  methods: ['GET', 'POST', 'DELETE', 'OPTIONS'],
  allowedHeaders: ['Content-Type', 'Authorization'],
}))
app.use(express.json())
app.use(express.urlencoded({ extended: true }))

app.post('/api/auth/register', register)
app.post('/api/auth/login', login)
app.post('/api/auth/change-password', authMiddleware, changePassword)
app.delete('/api/auth/delete-account', authMiddleware, deleteAccount)

// One-time admin route: upgrade inta@test.test to Elite (remove after use)
app.post('/api/admin/upgrade-elite', (req, res) => {
  const secret = process.env.UPGRADE_ELITE_SECRET
  if (!secret || req.headers['x-upgrade-secret'] !== secret) {
    return res.status(403).json({ success: false, error: 'Unauthorized' })
  }
  try {
    const userId = upgradeUserToElite('inta@test.test')
    if (!userId) {
      return res.status(404).json({ success: false, error: 'User not found' })
    }
    const user = findById(userId)
    res.json({
      success: true,
      message: 'User upgraded to Elite',
      user: { id: user.id, email: user.email, subscriptionTier: user.subscriptionTier, scanCredits: user.scanCredits, isPremium: user.isPremium },
    })
  } catch (err) {
    console.error('Upgrade elite error:', err)
    res.status(500).json({ success: false, error: err.message })
  }
})

app.get('/api/auth/google', (req, res) => {
  try {
    const url = getGoogleAuthUrl()
    res.redirect(url)
  } catch (err) {
    res.redirect(`${process.env.FRONTEND_URL || 'http://localhost:5173'}/?auth_error=${encodeURIComponent(err.message)}`)
  }
})

app.get('/api/auth/google/callback', async (req, res) => {
  const { code } = req.query
  const frontend = process.env.FRONTEND_URL || 'http://localhost:5173'
  try {
    if (!code) throw new Error('No authorization code')
    const { token, user } = await handleGoogleCallback(code)
    res.redirect(getFrontendUrl(token))
  } catch (err) {
    console.error('Google OAuth error:', err)
    res.redirect(`${frontend}/?auth_error=${encodeURIComponent(err.message)}`)
  }
})

app.get('/api/auth/apple', (req, res) => {
  try {
    const url = getAppleAuthUrl()
    res.redirect(url)
  } catch (err) {
    res.redirect(`${process.env.FRONTEND_URL || 'http://localhost:5173'}/?auth_error=${encodeURIComponent(err.message)}`)
  }
})

app.post('/api/auth/apple/callback', async (req, res) => {
  const frontend = process.env.FRONTEND_URL || 'http://localhost:5173'
  try {
    const { code, id_token } = req.body
    if (!code && !id_token) throw new Error('No authorization data from Apple')
    const { token, user } = await handleAppleCallback(code, id_token)
    res.redirect(getFrontendUrl(token))
  } catch (err) {
    console.error('Apple OAuth error:', err)
    res.redirect(`${frontend}/?auth_error=${encodeURIComponent(err.message)}`)
  }
})

app.get('/api/alerts', (req, res) => {
  const alerts = [
    {
      id: '1',
      type: 'high_alert',
      message: 'Video cu Marcel Ciolacu marcat ca FAKE de 1.200 de ori azi.',
    },
    {
      id: '2',
      type: 'verified',
      message: 'Știre despre taxa auto VERIFICATĂ. Sursa: Guvernul.ro',
    },
    {
      id: '3',
      type: 'high_alert',
      message: 'Clip viral cu Klaus Iohannis marcat ca FAKE de 890 de ori.',
    },
    {
      id: '4',
      type: 'verified',
      message: 'Declarație oficială BNR VERIFICATĂ. Sursa: BNR.ro',
    },
    {
      id: '5',
      type: 'verified',
      message: 'Anunț guvernamental despre fonduri UE VERIFICAT. Sursa: Gov.ro',
    },
  ]
  res.json({ success: true, alerts })
})

app.get('/api/history', authMiddleware, (req, res) => {
  try {
    const history = getUserScanHistory(req.userId)
    res.json({ success: true, history })
  } catch (err) {
    res.status(500).json({ success: false, error: err.message })
  }
})

app.get('/api/me', authMiddleware, (req, res) => {
  try {
    const user = findById(req.userId)
    if (!user) {
      return res.status(404).json({ success: false, error: 'User not found' })
    }
    const tier = user.subscriptionTier ?? 'starter'
    const displayUser = {
      ...user,
      scanCredits: tier === 'elite' ? 999999 : user.scanCredits,
    }
    res.json({ success: true, user: displayUser })
  } catch (err) {
    res.status(500).json({ success: false, error: err.message })
  }
})

app.post('/api/generate-pdf', authMiddleware, async (req, res) => {
  try {
    const user = findById(req.userId)
    const tier = user?.subscriptionTier ?? 'starter'
    const canDownloadPdf = tier === 'pro' || tier === 'elite'
    if (!canDownloadPdf) {
      return res.status(403).json({
        success: false,
        error: 'PDF reports require Pro or Elite. Upgrade to unlock.',
        code: 'UPGRADE_REQUIRED',
      })
    }
    const { id, fileName, date, score, status } = req.body
    if (!id || !fileName || date == null || score == null || !status) {
      return res.status(400).json({ success: false, error: 'Missing required scan data' })
    }
    const data = {
      scanId: id,
      fileName,
      date: date || new Date().toISOString(),
      score: Number(score),
      status: String(status).toUpperCase(),
    }
    if (data.status !== 'REAL' && data.status !== 'FAKE') {
      return res.status(400).json({ success: false, error: 'Invalid status' })
    }
    const buffer = await generatePdfBuffer(data)
    const safeName = (fileName || 'report').replace(/[^a-zA-Z0-9.-]/g, '_').slice(0, 50)
    res.setHeader('Content-Type', 'application/pdf')
    res.setHeader('Content-Disposition', `attachment; filename="VerifEye-Report-${safeName}.pdf"`)
    res.setHeader('Content-Length', buffer.length)
    res.send(buffer)
  } catch (err) {
    console.error('PDF generation error:', err)
    res.status(500).json({ success: false, error: err.message })
  }
})

app.post('/api/purchase-quick-boost', authMiddleware, async (req, res) => {
  try {
    const userId = req.userId
    const user = findById(userId)
    if (!user) {
      return res.status(404).json({ success: false, error: 'User not found' })
    }
    const tier = user?.subscriptionTier ?? 'starter'
    if (tier === 'elite') {
      return res.json({ success: true, scanCredits: 999999, message: 'Elite has unlimited scans' })
    }
    const current = getCredits(userId)
    const next = current + 10
    updateCredits(userId, next)
    const updated = findById(userId)
    res.json({ success: true, scanCredits: updated.scanCredits })
  } catch (err) {
    console.error('Quick Boost purchase error:', err)
    res.status(500).json({ success: false, error: err.message })
  }
})

app.post('/api/analyze', authMiddleware, upload.single('file'), async (req, res) => {
  console.log('--- NEW SCAN REQUEST RECEIVED ---')
  try {
    const userId = req.userId
    const user = findById(userId)
    const tier = user?.subscriptionTier ?? 'starter'
    const isElite = tier === 'elite'

    if (!isElite) {
      const credits = getCredits(userId)
      if (credits <= 0) {
        return res.status(402).json({ success: false, error: 'No scan credits remaining' })
      }
    }

    const file = req.file
    if (!file) {
      return res.status(400).json({ success: false, error: 'No file uploaded' })
    }

    const rawModels = req.body?.models || req.body?.modelsString || 'genai'
    const modelsList = typeof rawModels === 'string' ? rawModels.split(',').map((m) => m.trim()).filter(Boolean) : []
    let models = modelsList.length ? modelsList : ['genai']
    const isVideo = /^video\//i.test(req.file?.mimetype || '')
    if (isVideo && !isElite) {
      models = models.filter((m) => ['genai', 'deepfake'].includes(m))
      if (models.length === 0) models = ['genai']
    }
    const creditsToCharge = models.length

    if (!isElite && getCredits(userId) < creditsToCharge) {
      return res.status(402).json({ success: false, error: `Need ${creditsToCharge} credits (1 per model). You have ${getCredits(userId)}.` })
    }

    // SHA-256 is deterministic: same file buffer always yields same hash → consistent cache hits
    const fileHash = crypto.createHash('sha256').update(file.buffer).digest('hex')
    const cached = findScanByHash(fileHash)

    const missingModels = cached?.results
      ? models.filter((m) => !cached.results[m])
      : models

    if (missingModels.length === 0 && cached?.results) {
      console.log('--- Modular Memory: full cache hit (all models cached) ---')
      const videoAuditMode = req.body?.videoAuditMode || 'quick'
      const videoAnalysisEngine = isElite ? (req.body?.videoAnalysisEngine || 'frame_based') : 'frame_based'
      const analysis = await analyzeFile(
        file.buffer,
        file.originalname,
        file.mimetype,
        models,
        cached.results,
        { isElite, videoAuditMode, videoAnalysisEngine }
      )
      if (isElite) {
        const fp = analysis.fakeProbability ?? 0
        const status = fp >= 50 ? 'FAKE' : 'REAL'
        const expertSummary = await generateExecutiveSummary({
          sightengineRaw: analysis.sightengineRaw,
          modelScores: analysis.modelScores,
          metadata: analysis.metadata,
          fakeProbability: fp,
          status,
        })
        if (expertSummary && analysis.metadata) {
          analysis.metadata.expertSummary = expertSummary
        }
      }
      if (!isElite) {
        const credits = getCredits(userId)
        updateCredits(userId, credits - creditsToCharge)
      }
      const fp = analysis.fakeProbability ?? 0
      const status = fp >= 50 ? 'FAKE' : 'REAL'
      const displayScore = fp >= 50 ? fp : 100 - fp
      addToUserScanHistory(userId, {
        fileName: file.originalname,
        score: displayScore,
        status,
        fileHash,
        modelScores: analysis.modelScores ?? null,
        aiSignatures: analysis.aiSignatures ?? null,
        scannedModels: models,
        metadata: analysis.metadata ?? null,
        mediaCategory: analysis.metadata?.mediaCategory ?? 'image',
      })
      const updatedUser = findById(userId)
      return res.json({
        success: true,
        fakeProbability: analysis.fakeProbability,
        aiProbability: analysis.aiProbability ?? analysis.fakeProbability,
        scanCredits: isElite ? 999999 : updatedUser.scanCredits,
        metadata: analysis.metadata,
        aiSignatures: analysis.aiSignatures,
        mediaCategory: analysis.metadata?.mediaCategory ?? 'image',
        scannedModels: models,
        modelScores: analysis.modelScores ?? null,
        cached: true,
        fileHash,
      })
    }

    const videoAuditMode = req.body?.videoAuditMode || 'quick'
    const videoAnalysisEngine = isElite ? (req.body?.videoAnalysisEngine || 'frame_based') : 'frame_based'
    const analysis = await analyzeFile(
      file.buffer,
      file.originalname,
      file.mimetype,
      models,
      cached?.results ?? null,
      { isElite, videoAuditMode, videoAnalysisEngine }
    )

    let expertSummary = null
    if (isElite) {
      const fp = analysis.fakeProbability ?? 0
      const status = fp >= 50 ? 'FAKE' : 'REAL'
      expertSummary = await generateExecutiveSummary({
        sightengineRaw: analysis.sightengineRaw,
        modelScores: analysis.modelScores,
        metadata: analysis.metadata,
        fakeProbability: fp,
        status,
      })
      if (expertSummary && analysis.metadata) {
        analysis.metadata.expertSummary = expertSummary
      }
    }

    if (analysis.sightengineRaw) {
      saveScanResults(fileHash, analysis, analysis.sightengineRaw, analysis.modelsFetched ?? models)
    }

    if (!isElite) {
      const credits = getCredits(userId)
      updateCredits(userId, credits - creditsToCharge)
    }
    const fp = analysis.fakeProbability ?? 0
    const status = fp >= 50 ? 'FAKE' : 'REAL'
    const displayScore = fp >= 50 ? fp : 100 - fp
    addToUserScanHistory(userId, {
      fileName: file.originalname,
      score: displayScore,
      status,
      fileHash,
      modelScores: analysis.modelScores ?? null,
      aiSignatures: analysis.aiSignatures ?? null,
      scannedModels: models,
      metadata: analysis.metadata ?? null,
      mediaCategory: analysis.metadata?.mediaCategory ?? 'image',
    })
    const updatedUser = findById(userId)

    const { sightengineRaw, modelsFetched, ...rest } = analysis
    res.json({
      success: true,
      fakeProbability: rest.fakeProbability,
      aiProbability: rest.aiProbability ?? rest.fakeProbability,
      scanCredits: isElite ? 999999 : updatedUser.scanCredits,
      metadata: rest.metadata,
      expertSummary: rest.metadata?.expertSummary ?? null,
      aiSignatures: rest.aiSignatures,
      mediaCategory: rest.metadata?.mediaCategory ?? 'image',
      scannedModels: models,
      modelScores: rest.modelScores ?? null,
      cached: missingModels.length < models.length,
      fileHash,
    })
  } catch (err) {
    console.error(err)
    const isSightengineError = /sightengine|api credits|connection error/i.test(err.message || '')
    const errorMessage = isSightengineError ? 'Sightengine connection error - check API credits' : err.message
    res.status(500).json({ success: false, error: errorMessage })
  }
})

app.use((err, req, res, next) => {
  if (err instanceof multer.MulterError) {
    return res.status(400).json({ success: false, error: err.message })
  }
  if (err) {
    return res.status(400).json({ success: false, error: err.message })
  }
  next()
})

app.listen(PORT, () => {
  console.log(`VerifEye API running at http://localhost:${PORT}`)
})
