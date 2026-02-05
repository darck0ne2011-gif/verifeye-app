import { hashPassword } from './auth.js'
import { signToken } from './auth.js'
import { findOrCreateOAuthUser, findById } from './db.js'
import crypto from 'crypto'

const FRONTEND_URL = process.env.FRONTEND_URL || 'http://localhost:5173'
const API_BASE = process.env.API_BASE || 'http://localhost:3001'

// Google OAuth
const GOOGLE_CLIENT_ID = process.env.GOOGLE_CLIENT_ID || ''
const GOOGLE_CLIENT_SECRET = process.env.GOOGLE_CLIENT_SECRET || ''

export function getGoogleAuthUrl() {
  if (!GOOGLE_CLIENT_ID) {
    throw new Error('GOOGLE_CLIENT_ID not configured')
  }
  const params = new URLSearchParams({
    client_id: GOOGLE_CLIENT_ID,
    redirect_uri: `${API_BASE}/api/auth/google/callback`,
    response_type: 'code',
    scope: 'openid email profile',
    access_type: 'offline',
    prompt: 'consent',
  })
  return `https://accounts.google.com/o/oauth2/v2/auth?${params}`
}

export async function handleGoogleCallback(code) {
  if (!GOOGLE_CLIENT_ID || !GOOGLE_CLIENT_SECRET) {
    throw new Error('Google OAuth not configured')
  }
  const tokenRes = await fetch('https://oauth2.googleapis.com/token', {
    method: 'POST',
    headers: { 'Content-Type': 'application/x-www-form-urlencoded' },
    body: new URLSearchParams({
      code,
      client_id: GOOGLE_CLIENT_ID,
      client_secret: GOOGLE_CLIENT_SECRET,
      redirect_uri: `${API_BASE}/api/auth/google/callback`,
      grant_type: 'authorization_code',
    }),
  })
  const tokens = await tokenRes.json()
  if (tokens.error) throw new Error(tokens.error_description || 'Google token exchange failed')

  const userRes = await fetch('https://www.googleapis.com/oauth2/v2/userinfo', {
    headers: { Authorization: `Bearer ${tokens.access_token}` },
  })
  const profile = await userRes.json()
  const email = profile.email
  if (!email) throw new Error('No email from Google')

  const randomPassword = crypto.randomBytes(32).toString('hex')
  const userId = findOrCreateOAuthUser(email, hashPassword(randomPassword))
  const user = findById(userId)
  return { token: signToken(userId), user }
}

// Apple Sign In (requires Apple Developer: Service ID, Key, Team ID, etc.)
const APPLE_CLIENT_ID = process.env.APPLE_CLIENT_ID || ''
const APPLE_TEAM_ID = process.env.APPLE_TEAM_ID || ''
const APPLE_KEY_ID = process.env.APPLE_KEY_ID || ''
const APPLE_PRIVATE_KEY = process.env.APPLE_PRIVATE_KEY || ''
const APPLE_REDIRECT_URI = `${API_BASE}/api/auth/apple/callback`

export function getAppleAuthUrl() {
  if (!APPLE_CLIENT_ID) {
    throw new Error('APPLE_CLIENT_ID not configured')
  }
  const params = new URLSearchParams({
    client_id: APPLE_CLIENT_ID,
    redirect_uri: APPLE_REDIRECT_URI,
    response_type: 'code id_token',
    response_mode: 'form_post',
    scope: 'name email',
    nonce: crypto.randomBytes(16).toString('hex'),
    state: crypto.randomBytes(16).toString('hex'),
  })
  return `https://appleid.apple.com/auth/authorize?${params}`
}

export async function handleAppleCallback(code, idTokenFromPost) {
  if (!APPLE_CLIENT_ID || !APPLE_TEAM_ID || !APPLE_KEY_ID || !APPLE_PRIVATE_KEY) {
    throw new Error('Apple Sign In not fully configured')
  }
  const appleSignin = await import('apple-signin-auth')
  const clientSecret = appleSignin.default.getClientSecret({
    clientId: APPLE_CLIENT_ID,
    teamId: APPLE_TEAM_ID,
    privateKey: APPLE_PRIVATE_KEY,
    keyIdentifier: APPLE_KEY_ID,
  })
  const tokenResponse = await appleSignin.default.getAuthorizationToken(code, {
    clientId: APPLE_CLIENT_ID,
    clientSecret,
    redirectUri: APPLE_REDIRECT_URI,
  })
  const idToken = tokenResponse.id_token || idTokenFromPost
  if (!idToken) throw new Error('No id_token from Apple')
  const payload = await appleSignin.default.verifyIdToken(idToken, {
    audience: APPLE_CLIENT_ID,
  })
  const sub = payload.sub
  const email = payload.email || (typeof payload.email === 'string' ? payload.email : null)
  if (!sub && !email) throw new Error('No user info from Apple')

  const randomPassword = crypto.randomBytes(32).toString('hex')
  const userId = findOrCreateOAuthUserByApple(email || `apple_${sub}@privaterelay.appleid.com`, hashPassword(randomPassword), sub)
  const user = findById(userId)
  return { token: signToken(userId), user }
}

export function getFrontendUrl(token) {
  return `${FRONTEND_URL}/?auth_token=${encodeURIComponent(token)}`
}
