import jwt from 'jsonwebtoken'
import bcrypt from 'bcryptjs'
import { createUser, findByEmail, findById, findByIdWithPassword, updateCredits, updatePassword, deleteUser } from './db.js'

const JWT_SECRET = process.env.JWT_SECRET || 'verifeye-dev-secret-change-in-production'
const JWT_EXPIRY = '7d'

export function hashPassword(password) {
  return bcrypt.hashSync(password, 10)
}

export function comparePassword(password, hash) {
  return bcrypt.compareSync(password, hash)
}

export function signToken(userId) {
  return jwt.sign({ userId }, JWT_SECRET, { expiresIn: JWT_EXPIRY })
}

export function verifyToken(token) {
  try {
    const payload = jwt.verify(token, JWT_SECRET)
    return payload.userId
  } catch {
    return null
  }
}

export function authMiddleware(req, res, next) {
  const authHeader = req.headers.authorization
  const token = authHeader?.startsWith('Bearer ') ? authHeader.slice(7) : null

  if (!token) {
    return res.status(401).json({ success: false, error: 'Authentication required' })
  }

  const userId = verifyToken(token)
  if (!userId) {
    return res.status(401).json({ success: false, error: 'Invalid or expired token' })
  }

  req.userId = userId
  next()
}

export async function register(req, res) {
  try {
    const { email, password } = req.body
    if (!email || !password) {
      return res.status(400).json({ success: false, error: 'Email and password required' })
    }
    if (password.length < 6) {
      return res.status(400).json({ success: false, error: 'Password must be at least 6 characters' })
    }

    const existing = findByEmail(email)
    if (existing) {
      return res.status(400).json({ success: false, error: 'Email already registered' })
    }

    const hashed = hashPassword(password)
    const userId = createUser(email, hashed)
    const user = findById(userId)
    const token = signToken(userId)

    res.json({
      success: true,
      token,
      user: { id: user.id, email: user.email, scanCredits: user.scanCredits },
    })
  } catch (err) {
    console.error(err)
    res.status(500).json({ success: false, error: err.message })
  }
}

export async function login(req, res) {
  try {
    const { email, password } = req.body
    if (!email || !password) {
      return res.status(400).json({ success: false, error: 'Email and password required' })
    }

    const user = findByEmail(email)
    if (!user || !comparePassword(password, user.password)) {
      return res.status(401).json({ success: false, error: 'Invalid email or password' })
    }

    const token = signToken(user.id)
    res.json({
      success: true,
      token,
      user: { id: user.id, email: user.email, scanCredits: user.scanCredits },
    })
  } catch (err) {
    console.error(err)
    res.status(500).json({ success: false, error: err.message })
  }
}

export async function changePassword(req, res) {
  try {
    const { currentPassword, newPassword } = req.body
    if (!currentPassword || !newPassword) {
      return res.status(400).json({ success: false, error: 'Current and new password required' })
    }
    if (newPassword.length < 6) {
      return res.status(400).json({ success: false, error: 'New password must be at least 6 characters' })
    }
    const userId = req.userId
    const user = findByIdWithPassword(userId)
    if (!user || !comparePassword(currentPassword, user.password)) {
      return res.status(401).json({ success: false, error: 'Current password is incorrect' })
    }
    updatePassword(userId, hashPassword(newPassword))
    res.json({ success: true })
  } catch (err) {
    console.error(err)
    res.status(500).json({ success: false, error: err.message })
  }
}

export async function deleteAccount(req, res) {
  try {
    const userId = req.userId
    deleteUser(userId)
    res.json({ success: true })
  } catch (err) {
    console.error(err)
    res.status(500).json({ success: false, error: err.message })
  }
}

export { updateCredits }
