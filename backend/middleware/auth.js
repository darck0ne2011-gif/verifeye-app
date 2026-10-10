import { verifyToken } from '../services/auth.js'
import { findById } from '../db/users.js'
import { unauthorized, forbidden } from '../lib/errors.js'

/** Requires a valid Bearer token; attaches `req.user` (full DB row). */
export async function authMiddleware(req, res, next) {
  try {
    const header = req.headers.authorization || ''
    const token = header.startsWith('Bearer ') ? header.slice(7) : null
    if (!token) throw unauthorized()

    const userId = verifyToken(token)
    if (!userId) throw unauthorized('Invalid or expired token', 'INVALID_TOKEN')

    const user = await findById(userId)
    if (!user) throw unauthorized('Invalid or expired token', 'INVALID_TOKEN')

    req.user = user
    req.userId = user.id
    next()
  } catch (err) {
    next(err)
  }
}

export function requireAdmin(req, res, next) {
  if (req.user?.role !== 'admin') return next(forbidden('Admin access required', 'ADMIN_REQUIRED'))
  next()
}
