import crypto from 'crypto'
import { config } from '../config.js'
import { hashPassword, signToken } from './auth.js'
import { createUser, findByAppleSub, findByEmail, syncAdminRole } from '../db/users.js'
import { AppError } from '../lib/errors.js'

const STATE_TTL_MS = 10 * 60 * 1000

/**
 * Stateless CSRF protection for the OAuth round-trip: the state carries a
 * nonce and a timestamp, signed with the server secret.
 */
export function createOAuthState() {
  const payload = Buffer.from(JSON.stringify({ n: crypto.randomBytes(16).toString('hex'), t: Date.now() })).toString(
    'base64url'
  )
  const sig = crypto.createHmac('sha256', config.jwtSecret).update(payload).digest('base64url')
  return `${payload}.${sig}`
}

/** @returns {{ nonce: string }} */
export function verifyOAuthState(state) {
  const [payload, sig] = String(state || '').split('.')
  if (!payload || !sig) throw new AppError(400, 'Invalid OAuth state', 'OAUTH_STATE_INVALID')
  const expected = crypto.createHmac('sha256', config.jwtSecret).update(payload).digest('base64url')
  const a = Buffer.from(sig)
  const b = Buffer.from(expected)
  if (a.length !== b.length || !crypto.timingSafeEqual(a, b)) {
    throw new AppError(400, 'Invalid OAuth state', 'OAUTH_STATE_INVALID')
  }
  let parsed
  try {
    parsed = JSON.parse(Buffer.from(payload, 'base64url').toString('utf8'))
  } catch {
    throw new AppError(400, 'Invalid OAuth state', 'OAUTH_STATE_INVALID')
  }
  if (typeof parsed.t !== 'number' || Date.now() - parsed.t > STATE_TTL_MS) {
    throw new AppError(400, 'OAuth sign-in expired, please try again', 'OAUTH_STATE_EXPIRED')
  }
  return { nonce: parsed.n }
}

async function findOrCreateOAuthUser({ email, appleSub = null }) {
  let user = null
  if (appleSub) user = await findByAppleSub(appleSub)
  if (!user && email) user = await findByEmail(email)
  if (!user) {
    const randomPassword = crypto.randomBytes(32).toString('hex')
    user = await createUser({ email, passwordHash: await hashPassword(randomPassword), appleSub })
  }
  user = await syncAdminRole(user)
  return { token: signToken(user.id), user }
}

// ---------------------------------------------------------------------------
// Google

const GOOGLE_REDIRECT_URI = `${config.apiBase}/api/auth/google/callback`

export function getGoogleAuthUrl() {
  if (!config.google.clientId) throw new AppError(503, 'Google sign-in is not configured', 'OAUTH_NOT_CONFIGURED')
  const params = new URLSearchParams({
    client_id: config.google.clientId,
    redirect_uri: GOOGLE_REDIRECT_URI,
    response_type: 'code',
    scope: 'openid email profile',
    state: createOAuthState(),
  })
  return `https://accounts.google.com/o/oauth2/v2/auth?${params}`
}

export async function handleGoogleCallback(code, state) {
  if (!config.google.clientId || !config.google.clientSecret) {
    throw new AppError(503, 'Google sign-in is not configured', 'OAUTH_NOT_CONFIGURED')
  }
  verifyOAuthState(state)

  const tokenRes = await fetch('https://oauth2.googleapis.com/token', {
    method: 'POST',
    headers: { 'Content-Type': 'application/x-www-form-urlencoded' },
    body: new URLSearchParams({
      code,
      client_id: config.google.clientId,
      client_secret: config.google.clientSecret,
      redirect_uri: GOOGLE_REDIRECT_URI,
      grant_type: 'authorization_code',
    }),
  })
  const tokens = await tokenRes.json()
  if (!tokenRes.ok || tokens.error) throw new AppError(400, 'Google sign-in failed', 'OAUTH_EXCHANGE_FAILED')

  const userRes = await fetch('https://www.googleapis.com/oauth2/v2/userinfo', {
    headers: { Authorization: `Bearer ${tokens.access_token}` },
  })
  const profile = await userRes.json()
  if (!profile?.email) throw new AppError(400, 'Google did not return an email address', 'OAUTH_NO_EMAIL')
  if (profile.verified_email === false) {
    throw new AppError(400, 'Google account email is not verified', 'OAUTH_EMAIL_UNVERIFIED')
  }
  return findOrCreateOAuthUser({ email: profile.email })
}

// ---------------------------------------------------------------------------
// Apple

const APPLE_REDIRECT_URI = `${config.apiBase}/api/auth/apple/callback`

function appleConfigured() {
  const a = config.apple
  return !!(a.clientId && a.teamId && a.keyId && a.privateKey)
}

export function getAppleAuthUrl() {
  if (!config.apple.clientId) throw new AppError(503, 'Apple sign-in is not configured', 'OAUTH_NOT_CONFIGURED')
  const state = createOAuthState()
  const { nonce } = verifyOAuthState(state)
  const params = new URLSearchParams({
    client_id: config.apple.clientId,
    redirect_uri: APPLE_REDIRECT_URI,
    response_type: 'code id_token',
    response_mode: 'form_post',
    scope: 'name email',
    nonce,
    state,
  })
  return `https://appleid.apple.com/auth/authorize?${params}`
}

export async function handleAppleCallback({ code, id_token: idTokenFromPost, state }) {
  if (!appleConfigured()) throw new AppError(503, 'Apple sign-in is not configured', 'OAUTH_NOT_CONFIGURED')
  const { nonce } = verifyOAuthState(state)

  const { default: appleSignin } = await import('apple-signin-auth')
  const clientSecret = appleSignin.getClientSecret({
    clientId: config.apple.clientId,
    teamId: config.apple.teamId,
    privateKey: config.apple.privateKey,
    keyIdentifier: config.apple.keyId,
  })
  let idToken = idTokenFromPost
  if (code) {
    const tokenResponse = await appleSignin.getAuthorizationToken(code, {
      clientId: config.apple.clientId,
      clientSecret,
      redirectUri: APPLE_REDIRECT_URI,
    })
    idToken = tokenResponse.id_token || idToken
  }
  if (!idToken) throw new AppError(400, 'Apple sign-in failed', 'OAUTH_EXCHANGE_FAILED')

  const payload = await appleSignin.verifyIdToken(idToken, { audience: config.apple.clientId, nonce })
  if (!payload?.sub) throw new AppError(400, 'Apple did not return a user id', 'OAUTH_NO_SUBJECT')
  const email = payload.email || `apple_${payload.sub}@privaterelay.appleid.com`
  return findOrCreateOAuthUser({ email, appleSub: payload.sub })
}

/** Token travels in the URL fragment so it never reaches server logs or Referer headers. */
export function frontendRedirect({ token, error }) {
  if (token) return `${config.frontendUrl}/#auth_token=${encodeURIComponent(token)}`
  return `${config.frontendUrl}/#auth_error=${encodeURIComponent(error || 'Sign-in failed')}`
}
