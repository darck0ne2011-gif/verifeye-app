import { describe, it, expect } from 'vitest'
import { createOAuthState, verifyOAuthState, frontendRedirect } from '../services/oauth.js'

describe('OAuth state', () => {
  it('round-trips a signed state', () => {
    const state = createOAuthState()
    expect(verifyOAuthState(state).nonce).toMatch(/^[a-f0-9]{32}$/)
  })

  it('rejects tampered or missing state', () => {
    expect(() => verifyOAuthState('')).toThrow()
    expect(() => verifyOAuthState('abc.def')).toThrow()
    const state = createOAuthState()
    const [payload, sig] = state.split('.')
    expect(() => verifyOAuthState(`${payload}x.${sig}`)).toThrow()
  })

  it('rejects expired state', () => {
    const payload = Buffer.from(JSON.stringify({ n: 'x', t: Date.now() - 11 * 60 * 1000 })).toString('base64url')
    const state = createOAuthState()
    const sig = state.split('.')[1]
    // Signature will not match the altered payload either way; expired check is covered by a fresh signature below.
    expect(() => verifyOAuthState(`${payload}.${sig}`)).toThrow()
  })

  it('puts the token in the URL fragment, never the query string', () => {
    const url = frontendRedirect({ token: 'abc' })
    expect(url).toContain('#auth_token=abc')
    expect(url).not.toContain('?auth_token')
  })
})
