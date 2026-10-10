import { pgTable, serial, text, integer, jsonb, timestamp, index } from 'drizzle-orm/pg-core'

export const users = pgTable('users', {
  id: serial('id').primaryKey(),
  email: text('email').notNull().unique(),
  passwordHash: text('password_hash').notNull(),
  role: text('role').notNull().default('user'), // 'user' | 'admin'
  subscriptionTier: text('subscription_tier').notNull().default('starter'), // 'starter' | 'pro' | 'elite'
  scanCredits: integer('scan_credits').notNull().default(3),
  appleSub: text('apple_sub').unique(),
  createdAt: timestamp('created_at', { withTimezone: true }).notNull().defaultNow(),
})

// One entry per unique file (sha-256). Shared across users so the same file is
// never sent to the detection provider twice.
export const scanCache = pgTable('scan_cache', {
  hash: text('hash').primaryKey(),
  mediaCategory: text('media_category'), // 'image' | 'video' | 'audio'
  results: jsonb('results').notNull().default({}), // { [modelId]: providerResult }
  fakeProbability: integer('fake_probability'),
  aiProbability: integer('ai_probability'),
  metadata: jsonb('metadata'),
  aiSignatures: jsonb('ai_signatures'),
  scannedModels: jsonb('scanned_models'),
  expertSummaries: jsonb('expert_summaries').notNull().default({}), // { [lang]: text }
  createdAt: timestamp('created_at', { withTimezone: true }).notNull().defaultNow(),
  updatedAt: timestamp('updated_at', { withTimezone: true }).notNull().defaultNow(),
})

export const scanHistory = pgTable(
  'scan_history',
  {
    id: serial('id').primaryKey(),
    userId: integer('user_id')
      .notNull()
      .references(() => users.id, { onDelete: 'cascade' }),
    fileName: text('file_name').notNull(),
    score: integer('score').notNull(),
    status: text('status').notNull(), // 'REAL' | 'FAKE' (legacy two-way label)
    verdict: text('verdict'), // 'likely_real' | 'inconclusive' | 'likely_ai'
    confidence: integer('confidence'), // 0-100
    source: text('source'), // 'file' | 'screenshot'
    fileHash: text('file_hash'),
    modelScores: jsonb('model_scores'),
    aiSignatures: jsonb('ai_signatures'),
    scannedModels: jsonb('scanned_models'),
    metadata: jsonb('metadata'),
    mediaCategory: text('media_category'),
    createdAt: timestamp('created_at', { withTimezone: true }).notNull().defaultNow(),
  },
  (table) => [index('scan_history_user_id_idx').on(table.userId)]
)

// Background scan jobs. Processed by the in-process worker (lib/jobs.js).
export const scanJobs = pgTable(
  'scan_jobs',
  {
    id: text('id').primaryKey(),
    userId: integer('user_id')
      .notNull()
      .references(() => users.id, { onDelete: 'cascade' }),
    status: text('status').notNull().default('queued'), // queued | processing | done | failed
    stage: text('stage'), // human-readable progress stage key
    progress: integer('progress').notNull().default(0), // 0-100
    mediaCategory: text('media_category').notNull(), // image | video | audio | post
    source: text('source').notNull().default('file'),
    fileName: text('file_name').notNull(),
    filePath: text('file_path'), // temp upload; removed when the job finishes
    fileHash: text('file_hash'),
    models: jsonb('models').notNull(),
    language: text('language').notNull().default('en'),
    inputText: text('input_text'), // fact-check jobs: the post text (pasted or shared)
    creditsCharged: integer('credits_charged').notNull().default(0),
    result: jsonb('result'),
    error: jsonb('error'),
    createdAt: timestamp('created_at', { withTimezone: true }).notNull().defaultNow(),
    startedAt: timestamp('started_at', { withTimezone: true }),
    finishedAt: timestamp('finished_at', { withTimezone: true }),
  },
  (table) => [index('scan_jobs_status_idx').on(table.status, table.createdAt)]
)
