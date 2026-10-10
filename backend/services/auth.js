import jwt from 'jsonwebtoken'
import bcrypt from 'bcryptjs'
import { config } from '../config.js'

export function hashPassword(password) {
  return bcrypt.hash(password, 10)
}

export function comparePassword(password, hash) {
  return bcrypt.compare(password, hash)
}

export function signToken(userId) {
  return jwt.sign({ userId }, config.jwtSecret, { expiresIn: config.jwtExpiry })
}

/** @returns {number | null} user id, or null when the token is invalid/expired */
export function verifyToken(token) {
  try {
    const payload = jwt.verify(token, config.jwtSecret)
    return typeof payload.userId === 'number' ? payload.userId : null
  } catch {
    return null
  }
}
