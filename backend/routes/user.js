import { Router } from 'express'
import { z } from 'zod'
import { authMiddleware, requireAdmin } from '../middleware/auth.js'
import { validateBody } from '../middleware/validate.js'
import { findByEmail, setCredits, setTier, toPublicUser } from '../db/users.js'
import { getUserScanHistory } from '../db/scans.js'
import { notFound } from '../lib/errors.js'

const router = Router()

router.get('/me', authMiddleware, (req, res) => {
  res.json({ success: true, user: toPublicUser(req.user) })
})

router.get('/history', authMiddleware, async (req, res, next) => {
  try {
    const history = await getUserScanHistory(req.userId)
    res.json({ success: true, history })
  } catch (err) {
    next(err)
  }
})

// --- Admin -----------------------------------------------------------------
// Admins are the accounts listed in ADMIN_EMAILS.

const creditsSchema = z.object({
  email: z.string().trim().toLowerCase().email(),
  credits: z.number().int().min(0).max(1_000_000),
})
const tierSchema = z.object({
  email: z.string().trim().toLowerCase().email(),
  tier: z.enum(['starter', 'pro', 'elite']),
})

router.post('/admin/credits', authMiddleware, requireAdmin, validateBody(creditsSchema), async (req, res, next) => {
  try {
    const target = await findByEmail(req.body.email)
    if (!target) throw notFound('User not found', 'USER_NOT_FOUND')
    const updated = await setCredits(target.id, req.body.credits)
    res.json({ success: true, user: toPublicUser(updated) })
  } catch (err) {
    next(err)
  }
})

router.post('/admin/tier', authMiddleware, requireAdmin, validateBody(tierSchema), async (req, res, next) => {
  try {
    const target = await findByEmail(req.body.email)
    if (!target) throw notFound('User not found', 'USER_NOT_FOUND')
    const updated = await setTier(target.id, req.body.tier)
    res.json({ success: true, user: toPublicUser(updated) })
  } catch (err) {
    next(err)
  }
})

export default router
