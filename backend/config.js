import 'dotenv/config'
import { z } from 'zod'

const envSchema = z.object({
  NODE_ENV: z.enum(['development', 'test', 'production']).default('development'),
  PORT: z.coerce.number().int().positive().default(3001),
  JWT_SECRET: z.string().min(16).optional(),
  DATABASE_URL: z.string().optional(),
  PGLITE_DATA_DIR: z.string().default('./data/pglite'),
  FRONTEND_URL: z.string().default('http://localhost:5173'),
  API_BASE: z.string().default('http://localhost:3001'),
  CORS_ORIGINS: z.string().default(''),
  ADMIN_EMAILS: z.string().default(''),
  SIGHTENGINE_USER: z.string().optional(),
  SIGHTENGINE_SECRET: z.string().optional(),
  DEEPSEEK_API_KEY: z.string().optional(),
  GOOGLE_CLIENT_ID: z.string().optional(),
  GOOGLE_CLIENT_SECRET: z.string().optional(),
  APPLE_CLIENT_ID: z.string().optional(),
  APPLE_TEAM_ID: z.string().optional(),
  APPLE_KEY_ID: z.string().optional(),
  APPLE_PRIVATE_KEY: z.string().optional(),
  RENDER: z.string().optional(),
})

const parsed = envSchema.safeParse({
  ...process.env,
  // Legacy names still accepted
  SIGHTENGINE_USER: process.env.SIGHTENGINE_USER || process.env.SIGHTENGINE_API_USER,
  SIGHTENGINE_SECRET: process.env.SIGHTENGINE_SECRET || process.env.SIGHTENGINE_API_SECRET,
})

if (!parsed.success) {
  console.error('Invalid environment configuration:')
  for (const issue of parsed.error.issues) {
    console.error(`  ${issue.path.join('.')}: ${issue.message}`)
  }
  process.exit(1)
}

const env = parsed.data
const isProduction = env.NODE_ENV === 'production' || !!env.RENDER
const isTest = env.NODE_ENV === 'test'

if (!env.JWT_SECRET) {
  if (isProduction) {
    console.error('JWT_SECRET is not set. Refusing to start in production without it.')
    process.exit(1)
  }
  console.warn('WARNING: JWT_SECRET is not set; using an insecure development secret.')
}

const splitList = (value) =>
  value
    .split(',')
    .map((s) => s.trim())
    .filter(Boolean)

export const config = {
  env: env.NODE_ENV,
  isProduction,
  isTest,
  port: env.PORT,
  jwtSecret: env.JWT_SECRET || 'verifeye-dev-secret-change-in-production',
  jwtExpiry: '7d',
  databaseUrl: env.DATABASE_URL,
  pgliteDataDir: env.PGLITE_DATA_DIR,
  frontendUrl: env.FRONTEND_URL.replace(/\/$/, ''),
  apiBase: env.API_BASE.replace(/\/$/, ''),
  corsOrigins: splitList(env.CORS_ORIGINS),
  adminEmails: splitList(env.ADMIN_EMAILS).map((e) => e.toLowerCase()),
  sightengine: {
    user: env.SIGHTENGINE_USER,
    secret: env.SIGHTENGINE_SECRET,
    get configured() {
      return !!(this.user && this.secret)
    },
  },
  deepseekApiKey: env.DEEPSEEK_API_KEY,
  google: {
    clientId: env.GOOGLE_CLIENT_ID,
    clientSecret: env.GOOGLE_CLIENT_SECRET,
  },
  apple: {
    clientId: env.APPLE_CLIENT_ID,
    teamId: env.APPLE_TEAM_ID,
    keyId: env.APPLE_KEY_ID,
    privateKey: env.APPLE_PRIVATE_KEY,
  },
  limits: {
    maxUploadBytes: 25 * 1024 * 1024,
    defaultCredits: 3,
    unlimitedCreditsDisplay: 999999,
  },
}

export function isAdminEmail(email) {
  return config.adminEmails.includes(
    String(email || '')
      .toLowerCase()
      .trim()
  )
}
