import { describe, it, expect, beforeAll, afterAll, vi } from 'vitest'
import request from 'supertest'
import fs from 'fs'

vi.mock('../services/sightengine.js', async (importOriginal) => {
  const actual = await importOriginal()
  let frameCall = 0
  return {
    ...actual,
    detectAiImage: vi.fn(async (buffer, mime, name, models) => {
      // Alternate frame scores so the aggregate and spread are predictable.
      const score = name.startsWith('frame-') ? (frameCall++ % 2 === 0 ? 0.9 : 0.8) : 0.2
      return {
        status: 'success',
        type: {
          ...(models.includes('genai') && { ai_generated: score }),
          ...(models.includes('deepfake') && { deepfake: 0.1 }),
        },
      }
    }),
    detectAiAudio: vi.fn(async () => ({ status: 'success', type: { ai_speech: 0.15 } })),
  }
})

const { initDb, closeDb } = await import('../db/index.js')
const { createApp } = await import('../app.js')
const { setJobHandler, drainQueue } = await import('../lib/jobs.js')
const { processScanJob } = await import('../services/scanner.js')
const sightengine = await import('../services/sightengine.js')
const { testVideoPath, testAudioPath, testImageBuffer } = await import('./fixtures.js')

let app
let token
beforeAll(async () => {
  await initDb()
  setJobHandler(processScanJob)
  app = createApp()
  const res = await request(app)
    .post('/api/auth/register')
    .send({ email: 'scanner@example.com', password: 'password123' })
  token = res.body.token
  // Plenty of credits for this suite.
  const admin = await request(app)
    .post('/api/auth/register')
    .send({ email: 'admin@example.com', password: 'password123' })
  await request(app)
    .post('/api/admin/credits')
    .set('Authorization', `Bearer ${admin.body.token}`)
    .send({ email: 'scanner@example.com', credits: 100 })
})
afterAll(async () => {
  await closeDb()
})

const auth = () => ({ Authorization: `Bearer ${token}` })

async function startScan(filePath, fields = {}, filename = 'clip.mp4', contentType = 'video/mp4') {
  let req = request(app).post('/api/scans').set(auth())
  for (const [k, v] of Object.entries(fields)) req = req.field(k, v)
  const buffer = Buffer.isBuffer(filePath) ? filePath : fs.readFileSync(filePath)
  return req.attach('file', buffer, { filename, contentType })
}

async function waitForJob(id) {
  await drainQueue()
  const res = await request(app).get(`/api/scans/${id}`).set(auth())
  return res.body.job
}

describe('POST /api/scans (video)', () => {
  it('queues a job, processes it and returns a verdict with a frame timeline', async () => {
    const start = await startScan(testVideoPath({ seconds: 4 }), { models: 'genai,deepfake' })
    expect(start.status).toBe(202)
    expect(start.body.job).toMatchObject({ status: 'queued', mediaCategory: 'video', models: ['genai', 'deepfake'] })

    const job = await waitForJob(start.body.job.id)
    expect(job.status).toBe('done')
    expect(job.progress).toBe(100)
    const r = job.result
    expect(r.mediaCategory).toBe('video')
    expect(r.verdict).toBe('likely_ai')
    expect(r.fakeProbability).toBeGreaterThanOrEqual(80)
    expect(r.confidence).toBeGreaterThan(50)
    expect(r.timeline.length).toBeGreaterThanOrEqual(3)
    expect(r.timeline[0]).toHaveProperty('ai_generated')
    expect(r.metadata).toMatchObject({ mediaCategory: 'video', resolution: '320x240', hasAudio: true })
    expect(r.metadata.framesAnalyzed).toBe(r.timeline.length)
    expect(r.modelScores.deepfake).toBeCloseTo(0.1)
    expect(r.cached).toBe(false)

    const me = await request(app).get('/api/me').set(auth())
    expect(me.body.user.scanCredits).toBe(98)
  })

  it('serves a repeat scan of the same video from cache and still records history', async () => {
    sightengine.detectAiImage.mockClear()
    const start = await startScan(testVideoPath({ seconds: 4 }), { models: 'genai,deepfake' })
    const job = await waitForJob(start.body.job.id)
    expect(job.status).toBe('done')
    expect(job.result.cached).toBe(true)
    expect(sightengine.detectAiImage).not.toHaveBeenCalled()

    const history = await request(app).get('/api/history').set(auth())
    expect(history.body.history.filter((h) => h.mediaCategory === 'video')).toHaveLength(2)
    expect(history.body.history[0]).toMatchObject({ verdict: 'likely_ai', source: 'file' })
  })

  it('runs ai_speech on the audio track when requested', async () => {
    const start = await startScan(testVideoPath({ seconds: 4 }), { models: 'genai,ai_speech' })
    const job = await waitForJob(start.body.job.id)
    expect(job.status).toBe('done')
    expect(sightengine.detectAiAudio).toHaveBeenCalled()
    expect(job.result.modelScores.ai_speech).toBeCloseTo(0.15)
    expect(job.result.scannedModels).toEqual(['genai', 'ai_speech'])
  })

  it('refunds the ai_speech credit when the model is not enabled on the account', async () => {
    sightengine.detectAiAudio.mockRejectedValueOnce(
      new sightengine.ProviderError('MODEL_NOT_ENABLED', 'ai_speech not enabled', 403)
    )
    const before = (await request(app).get('/api/me').set(auth())).body.user.scanCredits
    const start = await startScan(testVideoPath({ seconds: 3 }), { models: 'genai,ai_speech' })
    const job = await waitForJob(start.body.job.id)
    expect(job.status).toBe('done')
    expect(job.result.warnings).toContain('ai_speech_not_enabled')
    expect(job.result.modelScores.ai_speech).toBeNull()
    const after = (await request(app).get('/api/me').set(auth())).body.user.scanCredits
    expect(before - after).toBe(1)
  })

  it('reports no audio track instead of failing', async () => {
    const start = await startScan(testVideoPath({ seconds: 2, withAudio: false }), { models: 'genai,ai_speech' })
    const job = await waitForJob(start.body.job.id)
    expect(job.status).toBe('done')
    expect(job.result.warnings).toContain('no_audio_track')
  })

  it('lowers confidence for screenshots', async () => {
    const start = await startScan(testVideoPath({ seconds: 4 }), { models: 'genai', source: 'screenshot' })
    const job = await waitForJob(start.body.job.id)
    expect(job.result.source).toBe('screenshot')
    expect(job.result.confidenceFactors).toContain('screenshot')
  })

  it('fails the job, refunds credits and removes the upload when the provider is down', async () => {
    sightengine.detectAiImage.mockRejectedValueOnce(new sightengine.ProviderError('NETWORK_ERROR', 'down'))
    const { uploadsDir } = await import('../lib/storage.js')
    const countUploads = () => fs.readdirSync(uploadsDir).filter((f) => f.endsWith('.upload')).length
    const uploadsBefore = countUploads()
    const before = (await request(app).get('/api/me').set(auth())).body.user.scanCredits
    const start = await startScan(testVideoPath({ seconds: 5, withAudio: false }), { models: 'genai' })
    const job = await waitForJob(start.body.job.id)
    expect(job.status).toBe('failed')
    expect(job.error.code).toBe('PROVIDER_UNAVAILABLE')
    const after = (await request(app).get('/api/me').set(auth())).body.user.scanCredits
    expect(after).toBe(before)
    expect(countUploads()).toBe(uploadsBefore)
  })
})

describe('POST /api/scans (audio and image)', () => {
  it('analyzes an audio file', async () => {
    const start = await startScan(testAudioPath({ seconds: 3 }), {}, 'voice.mp3', 'audio/mpeg')
    expect(start.status).toBe(202)
    expect(start.body.job.mediaCategory).toBe('audio')
    const job = await waitForJob(start.body.job.id)
    expect(job.status).toBe('done')
    expect(job.result).toMatchObject({ mediaCategory: 'audio', verdict: 'likely_real', fakeProbability: 15 })
    expect(job.result.confidenceFactors).toContain('beta_model')
  })

  it('fails an audio scan clearly when ai_speech is not enabled', async () => {
    sightengine.detectAiAudio.mockRejectedValueOnce(new sightengine.ProviderError('MODEL_NOT_ENABLED', 'nope', 403))
    const start = await startScan(testAudioPath({ seconds: 2 }), {}, 'v.mp3', 'audio/mpeg')
    const job = await waitForJob(start.body.job.id)
    expect(job.status).toBe('failed')
    expect(job.error.code).toBe('MODEL_NOT_ENABLED')
  })

  it('analyzes an image through the async endpoint too', async () => {
    const start = await startScan(testImageBuffer(), { models: 'genai' }, 'pic.png', 'image/png')
    expect(start.body.job.mediaCategory).toBe('image')
    const job = await waitForJob(start.body.job.id)
    expect(job.status).toBe('done')
    expect(job.result).toMatchObject({ mediaCategory: 'image', verdict: 'likely_real', fakeProbability: 20 })
  })

  it('ignores models that do not apply to the media type', async () => {
    const start = await startScan(testAudioPath({ seconds: 2 }), { models: 'genai,deepfake' }, 'v.mp3', 'audio/mpeg')
    expect(start.body.job.models).toEqual(['ai_speech'])
  })

  it('hides other users’ jobs', async () => {
    const other = await request(app)
      .post('/api/auth/register')
      .send({ email: 'other@example.com', password: 'password123' })
    const start = await startScan(testImageBuffer(), {}, 'pic.png', 'image/png')
    const res = await request(app)
      .get(`/api/scans/${start.body.job.id}`)
      .set('Authorization', `Bearer ${other.body.token}`)
    expect(res.status).toBe(404)
  })

  it('rejects unsupported files and declared-but-fake media types', async () => {
    const txt = await request(app)
      .post('/api/scans')
      .set(auth())
      .attach('file', Buffer.from('hello'), { filename: 'a.txt', contentType: 'text/plain' })
    expect(txt.status).toBe(400)
    const fake = await request(app)
      .post('/api/scans')
      .set(auth())
      .attach('file', Buffer.from('not a video'), { filename: 'a.mp4', contentType: 'video/mp4' })
    expect(fake.status).toBe(400)
    expect(fake.body.code).toBe('UNSUPPORTED_MEDIA')
  })

  it('legacy /api/analyze refuses video and points to the async endpoint', async () => {
    const res = await request(app)
      .post('/api/analyze')
      .set(auth())
      .attach('file', fs.readFileSync(testVideoPath({ seconds: 2, withAudio: false })), {
        filename: 'c.mp4',
        contentType: 'video/mp4',
      })
    expect(res.status).toBe(400)
    expect(res.body.code).toBe('USE_ASYNC_ENDPOINT')
  })
})
