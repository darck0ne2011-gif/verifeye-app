import express from 'express'
import cors from 'cors'
import helmet from 'helmet'
import rateLimit from 'express-rate-limit'
import { config } from './config.js'
import authRoutes from './routes/auth.js'
import oauthRoutes from './routes/oauth.js'
import userRoutes from './routes/user.js'
import scanRoutes from './routes/scan.js'
import { errorHandler, notFoundHandler } from './middleware/errors.js'

const allowedOrigins = [
  'http://localhost:5173',
  'http://127.0.0.1:5173',
  config.frontendUrl,
  ...config.corsOrigins,
  // Vercel preview deployments of this project
  /^https:\/\/verifeye(-[\w-]+)?\.vercel\.app$/,
]

function isOriginAllowed(origin) {
  if (!origin) return true // same-origin, curl, native apps
  return allowedOrigins.some((o) => (typeof o === 'string' ? o === origin : o.test(origin)))
}

export function createApp() {
  const app = express()

  // Render/Vercel sit behind a proxy; needed for correct client IPs in rate limiting.
  app.set('trust proxy', 1)
  app.disable('x-powered-by')

  app.use(helmet())
  app.use(
    cors({
      origin: (origin, cb) => (isOriginAllowed(origin) ? cb(null, true) : cb(null, false)),
      methods: ['GET', 'POST', 'DELETE', 'OPTIONS'],
      allowedHeaders: ['Content-Type', 'Authorization'],
    })
  )
  app.use(
    rateLimit({
      windowMs: 15 * 60 * 1000,
      limit: 300,
      standardHeaders: 'draft-8',
      legacyHeaders: false,
      skip: () => config.isTest,
      message: { success: false, error: 'Too many requests', code: 'RATE_LIMITED' },
    })
  )
  app.use(express.json({ limit: '100kb' }))
  app.use(express.urlencoded({ extended: false, limit: '100kb' }))

  app.get('/api/health', (req, res) => {
    res.json({ success: true, status: 'ok', uptime: Math.round(process.uptime()) })
  })

  app.use('/api/auth', authRoutes)
  app.use('/api/auth', oauthRoutes)
  app.use('/api', userRoutes)
  app.use('/api', scanRoutes)

  app.use(notFoundHandler)
  app.use(errorHandler)
  return app
}
