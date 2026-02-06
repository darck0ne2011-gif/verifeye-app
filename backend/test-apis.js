/**
 * Test all connected APIs.
 * Run: node test-apis.js
 */
import 'dotenv/config'
import axios from 'axios'

const results = { sightengine: null, deepseek: null, google: null, apple: null }

async function testSightengine() {
  const user = process.env.SIGHTENGINE_USER || process.env.SIGHTENGINE_API_USER
  const secret = process.env.SIGHTENGINE_SECRET || process.env.SIGHTENGINE_API_SECRET
  if (!user || !secret) {
    return { ok: false, error: 'SIGHTENGINE_USER / SIGHTENGINE_SECRET not set' }
  }
  try {
    // Use public URL (Sightengine example) - more reliable than tiny uploads
    const res = await axios.get('https://api.sightengine.com/1.0/check.json', {
      params: {
        url: 'https://sightengine.com/assets/img/examples/example7.jpg',
        models: 'genai',
        api_user: user,
        api_secret: secret,
      },
      timeout: 15000,
    })
    if (res.data?.status === 'success') return { ok: true, msg: 'Connected' }
    return { ok: false, error: res.data?.status || 'Unexpected response' }
  } catch (err) {
    const s = err.response?.status
    const d = err.response?.data
    return { ok: false, error: s === 401 ? 'Invalid credentials' : s === 429 ? 'Rate limit' : d?.message || err.message }
  }
}

async function testDeepSeek() {
  const key = process.env.DEEPSEEK_API_KEY
  if (!key) return { ok: false, error: 'DEEPSEEK_API_KEY not set' }
  try {
    const res = await axios.post(
      'https://api.deepseek.com/v1/chat/completions',
      {
        model: 'deepseek-chat',
        messages: [{ role: 'user', content: 'Say OK' }],
        max_tokens: 5,
      },
      {
        headers: { 'Content-Type': 'application/json', Authorization: `Bearer ${key}` },
        timeout: 15000,
      }
    )
    const text = res.data?.choices?.[0]?.message?.content
    return { ok: true, msg: text ? 'Connected' : 'Empty response' }
  } catch (err) {
    const s = err.response?.status
    const d = err.response?.data
    return { ok: false, error: s === 401 ? 'Invalid API key' : s === 429 ? 'Rate limit' : d?.error?.message || err.message }
  }
}

function checkGoogle() {
  const id = process.env.GOOGLE_CLIENT_ID
  const secret = process.env.GOOGLE_CLIENT_SECRET
  if (!id || !secret) return { ok: false, error: 'GOOGLE_CLIENT_ID / GOOGLE_CLIENT_SECRET not set' }
  return { ok: true, msg: 'Credentials set (OAuth flow not tested)' }
}

function checkApple() {
  const id = process.env.APPLE_CLIENT_ID
  const keyId = process.env.APPLE_KEY_ID
  const key = process.env.APPLE_PRIVATE_KEY
  if (!id || !keyId || !key) return { ok: false, error: 'APPLE_CLIENT_ID / APPLE_KEY_ID / APPLE_PRIVATE_KEY not set' }
  return { ok: true, msg: 'Credentials set (OAuth flow not tested)' }
}

async function run() {
  console.log('=== VerifEye API Connection Test ===\n')

  console.log('1. Sightengine...')
  results.sightengine = await testSightengine()
  console.log(results.sightengine.ok ? '   ✓ ' + results.sightengine.msg : '   ✗ ' + results.sightengine.error)

  console.log('\n2. DeepSeek...')
  results.deepseek = await testDeepSeek()
  console.log(results.deepseek.ok ? '   ✓ ' + results.deepseek.msg : '   ✗ ' + results.deepseek.error)

  console.log('\n3. Google OAuth...')
  results.google = checkGoogle()
  console.log(results.google.ok ? '   ✓ ' + results.google.msg : '   ✗ ' + results.google.error)

  console.log('\n4. Apple Sign In...')
  results.apple = checkApple()
  console.log(results.apple.ok ? '   ✓ ' + results.apple.msg : '   ✗ ' + results.apple.error)

  const ok = [results.sightengine, results.deepseek].filter((r) => r.ok).length
  const total = 4
  console.log('\n--- Summary ---')
  console.log(`Working: ${ok}/2 API calls (Sightengine, DeepSeek)`)
  console.log(`Config:  ${[results.google, results.apple].filter((r) => r.ok).length}/2 OAuth providers`)
}

run().catch(console.error)
