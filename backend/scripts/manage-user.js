/**
 * Account administration from the command line (works against DATABASE_URL,
 * or the local PGlite database when it is not set).
 *
 *   node scripts/manage-user.js create-admin <email> <password>
 *   node scripts/manage-user.js set-password <email> <password>
 *   node scripts/manage-user.js delete <email>
 *   node scripts/manage-user.js list
 *
 * create-admin creates the account if needed, sets the password and gives it
 * the admin role. Passwords are hashed with bcrypt before being stored.
 */
import { initDb, closeDb, getDb } from '../db/index.js'
import { users } from '../db/schema.js'
import { eq } from 'drizzle-orm'
import { hashPassword } from '../services/auth.js'
import { normalizeEmail } from '../db/users.js'

const [command, rawEmail, password] = process.argv.slice(2)
const email = normalizeEmail(rawEmail)

function usage(message) {
  if (message) console.error(message)
  console.error('Usage: node scripts/manage-user.js <create-admin|set-password|delete|list> [email] [password]')
  process.exit(1)
}

if (!command) usage()
if (['create-admin', 'set-password', 'delete'].includes(command) && !email) usage('Email is required')
if (['create-admin', 'set-password'].includes(command) && (!password || password.length < 8)) {
  usage('A password of at least 8 characters is required')
}

await initDb()
const db = getDb()

try {
  if (command === 'list') {
    const rows = await db
      .select({
        id: users.id,
        email: users.email,
        role: users.role,
        tier: users.subscriptionTier,
        credits: users.scanCredits,
      })
      .from(users)
      .orderBy(users.id)
    console.table(rows)
  } else if (command === 'create-admin') {
    const passwordHash = await hashPassword(password)
    const [existing] = await db.select().from(users).where(eq(users.email, email)).limit(1)
    if (existing) {
      await db.update(users).set({ role: 'admin', passwordHash }).where(eq(users.id, existing.id))
      console.log(`Updated ${email}: role=admin, password reset.`)
    } else {
      await db.insert(users).values({ email, passwordHash, role: 'admin' })
      console.log(`Created admin account ${email}.`)
    }
    console.log('Remember to also list this email in ADMIN_EMAILS so the role is kept on login.')
  } else if (command === 'set-password') {
    const passwordHash = await hashPassword(password)
    const rows = await db.update(users).set({ passwordHash }).where(eq(users.email, email)).returning({ id: users.id })
    if (rows.length === 0) throw new Error(`No account with email ${email}`)
    console.log(`Password updated for ${email}.`)
  } else if (command === 'delete') {
    const rows = await db.delete(users).where(eq(users.email, email)).returning({ id: users.id })
    if (rows.length === 0) console.log(`No account with email ${email}; nothing to do.`)
    else console.log(`Deleted ${email} (and its scan history).`)
  } else {
    usage(`Unknown command: ${command}`)
  }
} finally {
  await closeDb()
}
