import { Router } from 'express'
import {
  getGoogleAuthUrl,
  handleGoogleCallback,
  getAppleAuthUrl,
  handleAppleCallback,
  frontendRedirect,
} from '../services/oauth.js'
import { AppError } from '../lib/errors.js'

const router = Router()

function redirectWithError(res, err) {
  const message = err instanceof AppError ? err.message : 'Sign-in failed'
  if (!(err instanceof AppError)) console.error('OAuth error:', err)
  res.redirect(frontendRedirect({ error: message }))
}

router.get('/google', (req, res) => {
  try {
    res.redirect(getGoogleAuthUrl())
  } catch (err) {
    redirectWithError(res, err)
  }
})

router.get('/google/callback', async (req, res) => {
  try {
    const { code, state } = req.query
    if (!code) throw new AppError(400, 'No authorization code from Google', 'OAUTH_NO_CODE')
    const { token } = await handleGoogleCallback(String(code), String(state || ''))
    res.redirect(frontendRedirect({ token }))
  } catch (err) {
    redirectWithError(res, err)
  }
})

router.get('/apple', (req, res) => {
  try {
    res.redirect(getAppleAuthUrl())
  } catch (err) {
    redirectWithError(res, err)
  }
})

router.post('/apple/callback', async (req, res) => {
  try {
    const { code, id_token, state } = req.body ?? {}
    if (!code && !id_token) throw new AppError(400, 'No authorization data from Apple', 'OAUTH_NO_CODE')
    const { token } = await handleAppleCallback({ code, id_token, state })
    res.redirect(frontendRedirect({ token }))
  } catch (err) {
    redirectWithError(res, err)
  }
})

export default router
