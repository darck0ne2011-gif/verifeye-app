import fs from 'fs'
import path from 'path'
import { fileURLToPath } from 'url'
import { config } from '../config.js'
import * as schema from './schema.js'

const __dirname = path.dirname(fileURLToPath(import.meta.url))
const migrationsFolder = path.join(__dirname, 'migrations')

let db = null
let closeFn = async () => {}

/**
 * Connects to Postgres when DATABASE_URL is set; otherwise falls back to an
 * embedded PGlite database (on disk for development, in memory for tests).
 * Runs pending migrations on every start.
 */
export async function initDb() {
  if (db) return db

  if (config.databaseUrl) {
    const { default: pg } = await import('pg')
    const { drizzle } = await import('drizzle-orm/node-postgres')
    const { migrate } = await import('drizzle-orm/node-postgres/migrator')
    const pool = new pg.Pool({ connectionString: config.databaseUrl, max: 10 })
    db = drizzle(pool, { schema })
    await migrate(db, { migrationsFolder })
    closeFn = () => pool.end()
    console.log('Database: Postgres')
  } else {
    if (config.isProduction) {
      console.error('DATABASE_URL is not set. Refusing to start in production with an embedded database.')
      process.exit(1)
    }
    const { PGlite } = await import('@electric-sql/pglite')
    const { drizzle } = await import('drizzle-orm/pglite')
    const { migrate } = await import('drizzle-orm/pglite/migrator')
    let client
    if (config.isTest) {
      client = new PGlite()
    } else {
      const dataDir = path.resolve(config.pgliteDataDir)
      fs.mkdirSync(dataDir, { recursive: true })
      client = new PGlite(dataDir)
    }
    db = drizzle(client, { schema })
    await migrate(db, { migrationsFolder })
    closeFn = () => client.close()
    console.log(config.isTest ? 'Database: PGlite (in memory)' : `Database: PGlite (${config.pgliteDataDir})`)
  }
  return db
}

export function getDb() {
  if (!db) throw new Error('Database not initialised. Call initDb() first.')
  return db
}

export async function closeDb() {
  if (!db) return
  await closeFn()
  db = null
  closeFn = async () => {}
}

export { schema }
