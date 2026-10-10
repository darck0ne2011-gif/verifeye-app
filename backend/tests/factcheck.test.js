import { describe, it, expect, beforeAll, afterAll, vi } from 'vitest'
import request from 'supertest'

// The fact-checker needs the analyst model; the setup file clears the key.
process.env.DEEPSEEK_API_KEY = 'test-key'
process.env.GOOGLE_FACTCHECK_API_KEY = 'fc-key'
process.env.TAVILY_API_KEY = 'tv-key'

const calls = []
vi.mock('../services/factcheckProviders.js', async (importOriginal) => {
  const actual = await importOriginal()
  return {
    ...actual,
    askModelJson: vi.fn(async ({ system, user }) => {
      calls.push({ system, user })
      if (/extract checkable factual claims/i.test(system)) {
        return {
          claims: [
            {
              text: 'The mayor of Cluj resigned on 3 March 2026.',
              checkable: true,
              reason: 'event',
              searchQuery: 'mayor Cluj resigned March 2026',
              entities: ['Cluj'],
            },
            { text: 'This is the worst government ever.', checkable: false, reason: 'opinion', searchQuery: '' },
          ],
        }
      }
      if (/fact-check analyst/i.test(system)) {
        return {
          claims: [
            {
              id: 'c1',
              verdict: 'refuted',
              confidence: 88,
              explanation: 'A published fact-check found no resignation; the mayor was in office on 10 March 2026.',
              sourceIds: ['s1', 'bogus'],
            },
          ],
          overall: { verdict: 'refuted', summary: 'The central claim of the post is false.' },
        }
      }
      if (/transcribe social media posts/i.test(system)) {
        return {
          platform: 'Facebook',
          author: 'Ion P.',
          date: null,
          text: 'BREAKING: the mayor of Cluj resigned today!',
          imageDescription: null,
          language: 'en',
        }
      }
      return {}
    }),
    searchFactChecks: vi.fn(async () => [
      {
        kind: 'factcheck',
        claim: 'Mayor of Cluj resigned',
        publisher: 'Factual.ro',
        site: 'factual.ro',
        url: 'https://www.factual.ro/x',
        title: 'False: the mayor did not resign',
        rating: 'False',
        reviewDate: '2026-03-10',
      },
    ]),
    searchWeb: vi.fn(async () => [
      {
        kind: 'web',
        title: 'City hall agenda',
        url: 'https://primariaclujnapoca.ro/agenda',
        snippet: 'Mayor chairs the council meeting',
        publisher: 'primariaclujnapoca.ro',
        date: '2026-03-10',
      },
    ]),
    webSearchProvider: () => 'tavily',
  }
})

const { initDb, closeDb } = await import('../db/index.js')
const { createApp } = await import('../app.js')
const { setJobHandler, drainQueue } = await import('../lib/jobs.js')
const { processScanJob } = await import('../services/scanner.js')
const { factCheckPost, overallFrom } = await import('../services/factcheck.js')

let app
let token
beforeAll(async () => {
  await initDb()
  setJobHandler(processScanJob)
  app = createApp()
  const res = await request(app)
    .post('/api/auth/register')
    .send({ email: 'facts@example.com', password: 'password123' })
  token = res.body.token
})
afterAll(async () => {
  await closeDb()
})
const auth = () => ({ Authorization: `Bearer ${token}` })

describe('factCheckPost', () => {
  it('extracts claims, gathers evidence and judges only from the given sources', async () => {
    const r = await factCheckPost({
      inputText: 'BREAKING: the mayor of Cluj resigned today! Worst government ever.',
      language: 'ro',
    })
    expect(r.mediaCategory).toBe('post')
    expect(r.verdict).toBe('refuted')
    expect(r.claims).toHaveLength(1)
    expect(r.claims[0]).toMatchObject({ id: 'c1', verdict: 'refuted', confidence: 88 })
    // ids the model invented are dropped, real ones kept
    expect(r.claims[0].sourceIds).toEqual(['s1'])
    expect(r.sources.map((s) => s.kind)).toEqual(['factcheck', 'web'])
    expect(r.skippedClaims).toEqual([{ text: 'This is the worst government ever.', reason: 'opinion' }])
    expect(r.summary).toMatch(/false/i)
    expect(r.providers).toEqual({ factcheckApi: true, webSearch: 'tavily' })
    expect(r.warnings).toEqual([])
    // the judge was asked to answer in the interface language
    const judge = calls.find((c) => /fact-check analyst/i.test(c.system))
    expect(judge.user).toMatch(/Romanian/)
  })

  it('rejects posts without readable text', async () => {
    await expect(factCheckPost({ inputText: 'hi', language: 'en' })).rejects.toMatchObject({ code: 'NO_TEXT' })
  })

  it('derives the overall verdict from the claims', () => {
    expect(overallFrom([])).toBe('no_claims')
    expect(overallFrom([{ verdict: 'supported' }, { verdict: 'refuted' }])).toBe('refuted')
    expect(overallFrom([{ verdict: 'supported' }, { verdict: 'supported' }])).toBe('supported')
    expect(overallFrom([{ verdict: 'unverifiable' }])).toBe('unverifiable')
    expect(overallFrom([{ verdict: 'supported' }, { verdict: 'unverifiable' }])).toBe('contested')
  })
})

describe('POST /api/factchecks', () => {
  it('charges two credits, runs the job and records it in history', async () => {
    const before = (await request(app).get('/api/me').set(auth())).body.user.scanCredits
    const start = await request(app)
      .post('/api/factchecks')
      .set(auth())
      .field('text', 'BREAKING: the mayor of Cluj resigned today! Worst government ever.')
      .field('language', 'ro')
    expect(start.status).toBe(202)
    expect(start.body.job).toMatchObject({ status: 'queued', mediaCategory: 'post', models: ['factcheck'] })
    const after = (await request(app).get('/api/me').set(auth())).body.user.scanCredits
    expect(before - after).toBe(2)

    await drainQueue()
    const job = (await request(app).get(`/api/scans/${start.body.job.id}`).set(auth())).body.job
    expect(job.status).toBe('done')
    expect(job.result.verdict).toBe('refuted')
    expect(job.result.claims[0].sourceIds).toEqual(['s1'])
    expect(job.result.sources[0].url).toBe('https://www.factual.ro/x')

    const history = (await request(app).get('/api/history').set(auth())).body
    const items = history.items ?? history.history ?? history
    const entry = items.find((h) => h.mediaCategory === 'post')
    expect(entry).toBeTruthy()
    expect(entry.verdict).toBe('refuted')
    expect(entry.metadata.factcheck.claims).toHaveLength(1)
  })

  it('needs text or a screenshot', async () => {
    const res = await request(app).post('/api/factchecks').set(auth()).field('text', 'x')
    expect(res.status).toBe(400)
    expect(res.body.code).toBe('NO_TEXT')
  })
})
