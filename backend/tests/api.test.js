import { describe, it, expect, beforeAll, afterAll, vi } from 'vitest'
import request from 'supertest'

vi.mock('../services/sightengine.js', async (importOriginal) => {
  const actual = await importOriginal()
  return {
    ...actual,
    detectAiImage: vi.fn(async (buffer, mime, name, models) => ({
      status: 'success',
      type: {
        ...(models.includes('genai') && { ai_generated: 0.91 }),
        ...(models.includes('deepfake') && { deepfake: 0.05 }),
      },
    })),
  }
})

const { initDb, closeDb } = await import('../db/index.js')
const { createApp } = await import('../app.js')
const sightengine = await import('../services/sightengine.js')

// Smallest valid PNG (1x1), so file-type detection sees a real image.
const PNG = Buffer.from(
  'iVBORw0KGgoAAAANSUhEUgAAAAEAAAABCAYAAAAfFcSJAAAADUlEQVR42mNkYPhfDwAChwGA60e6kgAAAABJRU5ErkJggg==',
  'base64'
)

let app
beforeAll(async () => {
  await initDb()
  app = createApp()
})
afterAll(async () => {
  await closeDb()
})

async function registerUser(email, password = 'password123') {
  const res = await request(app).post('/api/auth/register').send({ email, password })
  expect(res.status).toBe(201)
  return res.body
}

describe('auth', () => {
  it('registers and returns a token and public user', async () => {
    const body = await registerUser('user1@example.com')
    expect(body.success).toBe(true)
    expect(body.token).toBeTypeOf('string')
    expect(body.user).toMatchObject({
      email: 'user1@example.com',
      role: 'user',
      subscriptionTier: 'starter',
      scanCredits: 3,
    })
    expect(body.user.passwordHash).toBeUndefined()
  })

  it('rejects short passwords and bad emails', async () => {
    const short = await request(app).post('/api/auth/register').send({ email: 'x@example.com', password: 'short' })
    expect(short.status).toBe(400)
    expect(short.body.code).toBe('VALIDATION_ERROR')
    const bad = await request(app).post('/api/auth/register').send({ email: 'not-an-email', password: 'password123' })
    expect(bad.status).toBe(400)
  })

  it('rejects duplicate emails (case-insensitive)', async () => {
    const res = await request(app)
      .post('/api/auth/register')
      .send({ email: 'USER1@example.com', password: 'password123' })
    expect(res.status).toBe(409)
  })

  it('logs in with correct credentials only', async () => {
    const ok = await request(app).post('/api/auth/login').send({ email: 'user1@example.com', password: 'password123' })
    expect(ok.status).toBe(200)
    expect(ok.body.token).toBeTypeOf('string')
    const wrong = await request(app)
      .post('/api/auth/login')
      .send({ email: 'user1@example.com', password: 'wrongpass1' })
    expect(wrong.status).toBe(401)
    const missing = await request(app)
      .post('/api/auth/login')
      .send({ email: 'nobody@example.com', password: 'wrongpass1' })
    expect(missing.status).toBe(401)
  })

  it('no longer has the hardcoded test-account backdoor', async () => {
    const res = await request(app).post('/api/auth/login').send({ email: 'inta@test.test', password: '123456' })
    expect(res.status).toBe(401)
  })

  it('protects /api/me', async () => {
    expect((await request(app).get('/api/me')).status).toBe(401)
    expect((await request(app).get('/api/me').set('Authorization', 'Bearer nope')).status).toBe(401)
  })

  it('changes password and deletes account', async () => {
    const { token } = await registerUser('temp@example.com')
    const change = await request(app)
      .post('/api/auth/change-password')
      .set('Authorization', `Bearer ${token}`)
      .send({ currentPassword: 'password123', newPassword: 'newpassword456' })
    expect(change.status).toBe(200)
    const login = await request(app)
      .post('/api/auth/login')
      .send({ email: 'temp@example.com', password: 'newpassword456' })
    expect(login.status).toBe(200)
    const del = await request(app).delete('/api/auth/delete-account').set('Authorization', `Bearer ${token}`)
    expect(del.status).toBe(200)
    expect((await request(app).get('/api/me').set('Authorization', `Bearer ${token}`)).status).toBe(401)
  })
})

describe('admin', () => {
  it('grants admin role to ADMIN_EMAILS and lets them set credits', async () => {
    const admin = await registerUser('admin@example.com')
    expect(admin.user.role).toBe('admin')
    expect(admin.user.unlimitedScans).toBe(true)

    const res = await request(app)
      .post('/api/admin/credits')
      .set('Authorization', `Bearer ${admin.token}`)
      .send({ email: 'user1@example.com', credits: 10 })
    expect(res.status).toBe(200)
    expect(res.body.user.scanCredits).toBe(10)
  })

  it('refuses admin routes to regular users', async () => {
    const login = await request(app)
      .post('/api/auth/login')
      .send({ email: 'user1@example.com', password: 'password123' })
    const res = await request(app)
      .post('/api/admin/credits')
      .set('Authorization', `Bearer ${login.body.token}`)
      .send({ email: 'user1@example.com', credits: 999 })
    expect(res.status).toBe(403)
  })
})

describe('scan', () => {
  let token
  beforeAll(async () => {
    const login = await request(app)
      .post('/api/auth/login')
      .send({ email: 'user1@example.com', password: 'password123' })
    token = login.body.token
  })

  it('analyzes an image, charges one credit per model and records history', async () => {
    const res = await request(app)
      .post('/api/analyze')
      .set('Authorization', `Bearer ${token}`)
      .field('models', 'genai,deepfake')
      .attach('file', PNG, { filename: 'test.png', contentType: 'image/png' })
    expect(res.status).toBe(200)
    expect(res.body).toMatchObject({
      success: true,
      fakeProbability: 91,
      status: 'FAKE',
      cached: false,
      scanCredits: 8,
    })
    expect(res.body.modelScores).toEqual({ ai_generated: 0.91, deepfake: 0.05, quality: null })
    expect(res.body.expertSummary).toBeNull()

    const history = await request(app).get('/api/history').set('Authorization', `Bearer ${token}`)
    expect(history.body.history).toHaveLength(1)
    expect(history.body.history[0]).toMatchObject({ fileName: 'test.png', score: 91, status: 'FAKE' })
  })

  it('lets the owner delete a history entry, and nobody else', async () => {
    const history = await request(app).get('/api/history').set('Authorization', `Bearer ${token}`)
    const id = history.body.history[0].id
    const one = await request(app).get(`/api/history/${id}`).set('Authorization', `Bearer ${token}`)
    expect(one.status).toBe(200)
    expect(one.body.item).toMatchObject({ id, fileName: 'test.png' })
    const stranger = await registerUser('stranger@example.com')
    expect((await request(app).get(`/api/history/${id}`).set('Authorization', `Bearer ${stranger.token}`)).status).toBe(
      404
    )
    const forbidden = await request(app).delete(`/api/history/${id}`).set('Authorization', `Bearer ${stranger.token}`)
    expect(forbidden.status).toBe(404)
    const ok = await request(app).delete(`/api/history/${id}`).set('Authorization', `Bearer ${token}`)
    expect(ok.status).toBe(200)
    const again = await request(app).get('/api/history').set('Authorization', `Bearer ${token}`)
    expect(again.body.history.find((h) => h.id === id)).toBeUndefined()
    expect((await request(app).delete('/api/history/abc').set('Authorization', `Bearer ${token}`)).status).toBe(404)
  })

  it('serves the same file from cache without calling the provider again', async () => {
    sightengine.detectAiImage.mockClear()
    const res = await request(app)
      .post('/api/analyze')
      .set('Authorization', `Bearer ${token}`)
      .field('models', 'genai')
      .attach('file', PNG, { filename: 'again.png', contentType: 'image/png' })
    expect(res.status).toBe(200)
    expect(res.body.cached).toBe(true)
    expect(res.body.fakeProbability).toBe(91)
    expect(sightengine.detectAiImage).not.toHaveBeenCalled()
  })

  it('rejects non-image uploads', async () => {
    const res = await request(app)
      .post('/api/analyze')
      .set('Authorization', `Bearer ${token}`)
      .attach('file', Buffer.from('hello'), { filename: 'a.txt', contentType: 'text/plain' })
    expect(res.status).toBe(400)
    expect(res.body.code).toBe('UNSUPPORTED_MEDIA')
  })

  it('rejects files that claim to be images but are not', async () => {
    const res = await request(app)
      .post('/api/analyze')
      .set('Authorization', `Bearer ${token}`)
      .attach('file', Buffer.from('not really a png'), { filename: 'fake.png', contentType: 'image/png' })
    expect(res.status).toBe(400)
    expect(res.body.code).toBe('UNSUPPORTED_MEDIA')
  })

  it('refuses when credits are insufficient and refunds on provider failure', async () => {
    const { token: poorToken } = await registerUser('poor@example.com') // 3 credits
    const tooMany = await request(app)
      .post('/api/analyze')
      .set('Authorization', `Bearer ${poorToken}`)
      .field('models', 'genai,deepfake,type,quality')
      .attach('file', PNG, { filename: 'x.png', contentType: 'image/png' })
    expect(tooMany.status).toBe(402)

    sightengine.detectAiImage.mockRejectedValueOnce(new sightengine.ProviderError('NETWORK_ERROR', 'down'))
    const other = Buffer.concat([PNG, Buffer.from([0])]) // different hash -> provider is called
    const failed = await request(app)
      .post('/api/analyze')
      .set('Authorization', `Bearer ${poorToken}`)
      .field('models', 'genai')
      .attach('file', other, { filename: 'y.png', contentType: 'image/png' })
    expect(failed.status).toBe(503)
    expect(failed.body.code).toBe('PROVIDER_UNAVAILABLE')
    const me = await request(app).get('/api/me').set('Authorization', `Bearer ${poorToken}`)
    expect(me.body.user.scanCredits).toBe(3)
  })

  it('does not charge admins', async () => {
    const login = await request(app)
      .post('/api/auth/login')
      .send({ email: 'admin@example.com', password: 'password123' })
    const res = await request(app)
      .post('/api/analyze')
      .set('Authorization', `Bearer ${login.body.token}`)
      .field('models', 'genai')
      .attach('file', PNG, { filename: 'admin.png', contentType: 'image/png' })
    expect(res.status).toBe(200)
    expect(res.body.scanCredits).toBe(999999)
  })
})

describe('misc', () => {
  it('health endpoint', async () => {
    const res = await request(app).get('/api/health')
    expect(res.status).toBe(200)
    expect(res.body.status).toBe('ok')
  })

  it('removed the fabricated alerts feed, the secret-header admin route and the free credit top-up', async () => {
    expect((await request(app).get('/api/alerts')).status).toBe(404)
    expect((await request(app).post('/api/admin/upgrade-elite').set('x-upgrade-secret', 'x')).status).toBe(404)
    expect((await request(app).post('/api/purchase-quick-boost')).status).toBe(404)
  })

  it('returns JSON for unknown routes and bad JSON', async () => {
    expect((await request(app).get('/api/does-not-exist')).body.code).toBe('NOT_FOUND')
    const res = await request(app).post('/api/auth/login').set('Content-Type', 'application/json').send('{bad')
    expect(res.status).toBe(400)
    expect(res.body.code).toBe('INVALID_JSON')
  })
})
