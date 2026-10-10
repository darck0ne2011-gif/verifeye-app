import { Router } from 'express'
import { z } from 'zod'
import rateLimit from 'express-rate-limit'
import { validateBody } from '../middleware/validate.js'
import { authMiddleware } from '../middleware/auth.js'
import { hashPassword, comparePassword, signToken } from '../services/auth.js'
import {
  createUser,
  findByEmail,
  findById,
  updatePassword,
  deleteUser,
  syncAdminRole,
  toPublicUser,
} from '../db/users.js'
import { AppError, unauthorized } from '../lib/errors.js'
import { config } from '../config.js'

export const PASSWORD_MIN_LENGTH = 8

const emailSchema = z.string().trim().toLowerCase().email().max(254)
const newPasswordSchema = z
  .string()
  .min(PASSWORD_MIN_LENGTH, `Password must be at least ${PASSWORD_MIN_LENGTH} characters`)
  .max(128)

const registerSchema = z.object({ email: emailSchema, password: newPasswordSchema })
const loginSchema = z.object({ email: emailSchema, password: z.string().min(1).max(128) })
const changePasswordSchema = z.object({ currentPassword: z.string().min(1).max(128), newPassword: newPasswordSchema })

const authLimiter = rateLimit({
  windowMs: 15 * 60 * 1000,
  limit: 20,
  standardHeaders: 'draft-8',
  legacyHeaders: false,
  skip: () => config.isTest,
  message: { success: false, error: 'Too many attempts, please try again later', code: 'RATE_LIMITED' },
})

const router = Router()

router.post('/register', authLimiter, validateBody(registerSchema), async (req, res, next) => {
  try {
    const { email, password } = req.body
    if (await findByEmail(email)) throw new AppError(409, 'Email already registered', 'EMAIL_TAKEN')
    const user = await createUser({ email, passwordHash: await hashPassword(password) })
    res.status(201).json({ success: true, token: signToken(user.id), user: toPublicUser(user) })
  } catch (err) {
    next(err)
  }
})

router.post('/login', authLimiter, validateBody(loginSchema), async (req, res, next) => {
  try {
    const { email, password } = req.body
    let user = await findByEmail(email)
    const ok = user ? await comparePassword(password, user.passwordHash) : false
    if (!ok) throw unauthorized('Invalid email or password', 'INVALID_CREDENTIALS')
    user = await syncAdminRole(user)
    res.json({ success: true, token: signToken(user.id), user: toPublicUser(user) })
  } catch (err) {
    next(err)
  }
})

router.post('/change-password', authMiddleware, validateBody(changePasswordSchema), async (req, res, next) => {
  try {
    const { currentPassword, newPassword } = req.body
    const user = await findById(req.userId)
    if (!user || !(await comparePassword(currentPassword, user.passwordHash))) {
      throw unauthorized('Current password is incorrect', 'INVALID_CREDENTIALS')
    }
    await updatePassword(req.userId, await hashPassword(newPassword))
    res.json({ success: true })
  } catch (err) {
    next(err)
  }
})

router.delete('/delete-account', authMiddleware, async (req, res, next) => {
  try {
    await deleteUser(req.userId)
    res.json({ success: true })
  } catch (err) {
    next(err)
  }
})

export default router
