import { describe, it, expect, vi, beforeEach } from 'vitest'
import { runScan, ScanError } from './scans'

function jsonResponse(body, status = 200) {
  return {
    ok: status >= 200 && status < 300,
    status,
    headers: { get: () => 'application/json' },
    json: async () => body,
  }
}

beforeEach(() => vi.restoreAllMocks())

describe('runScan', () => {
  it('uploads, polls until done and reports progress', async () => {
    const fetchMock = vi
      .spyOn(globalThis, 'fetch')
      .mockResolvedValueOnce(
        jsonResponse({ success: true, job: { id: 'j1', status: 'queued', stage: null, progress: 0 } }, 202)
      )
      .mockResolvedValueOnce(
        jsonResponse({
          success: true,
          job: { id: 'j1', status: 'processing', stage: 'analyzing_frames', progress: 40 },
        })
      )
      .mockResolvedValueOnce(
        jsonResponse({
          success: true,
          job: { id: 'j1', status: 'done', progress: 100, result: { verdict: 'likely_ai' } },
        })
      )

    const progress = []
    const result = await runScan(
      new Blob(['x']),
      { models: ['genai'], language: 'ro' },
      {
        authHeaders: { Authorization: 'Bearer t' },
        onProgress: (p) => progress.push(p.stage),
      }
    )

    expect(result).toEqual({ verdict: 'likely_ai' })
    expect(progress).toEqual(['uploading', 'queued', 'analyzing_frames', 'done'])
    expect(fetchMock).toHaveBeenCalledTimes(3)
    const [url, init] = fetchMock.mock.calls[0]
    expect(url).toContain('/api/scans')
    expect(init.body.get('models')).toBe('genai')
    expect(init.body.get('language')).toBe('ro')
    expect(init.body.get('source')).toBe('file')
  }, 10000)

  it('rejects with the job error when the scan fails', async () => {
    vi.spyOn(globalThis, 'fetch')
      .mockResolvedValueOnce(jsonResponse({ success: true, job: { id: 'j2', status: 'queued' } }, 202))
      .mockResolvedValueOnce(
        jsonResponse({
          success: true,
          job: { id: 'j2', status: 'failed', error: { code: 'PROVIDER_UNAVAILABLE', message: 'down' } },
        })
      )

    await expect(runScan(new Blob(['x']), { models: ['genai'] }, { authHeaders: {} })).rejects.toMatchObject({
      name: 'ScanError',
      code: 'PROVIDER_UNAVAILABLE',
      message: 'down',
    })
  }, 10000)

  it('surfaces upload errors with their code', async () => {
    vi.spyOn(globalThis, 'fetch').mockResolvedValueOnce(
      jsonResponse({ success: false, error: 'Need credits', code: 'INSUFFICIENT_CREDITS' }, 402)
    )
    await expect(runScan(new Blob(['x']), { models: ['genai'] }, { authHeaders: {} })).rejects.toBeInstanceOf(ScanError)
  })
})
