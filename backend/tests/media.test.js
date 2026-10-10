import { describe, it, expect } from 'vitest'
import fs from 'fs'
import { probe, extractFrames, extractAudio, frameTimestamps } from '../services/media.js'
import { testVideoPath, testAudioPath } from './fixtures.js'

describe('media', () => {
  it('probes a video with audio', async () => {
    const info = await probe(testVideoPath({ seconds: 4 }))
    expect(info.hasVideo).toBe(true)
    expect(info.hasAudio).toBe(true)
    expect(info.width).toBe(320)
    expect(info.height).toBe(240)
    expect(info.durationSec).toBeGreaterThan(3.5)
    expect(info.durationSec).toBeLessThan(4.6)
  })

  it('probes an audio file', async () => {
    const info = await probe(testAudioPath({ seconds: 3 }))
    expect(info.hasVideo).toBe(false)
    expect(info.hasAudio).toBe(true)
    expect(info.durationSec).toBeGreaterThan(2.5)
  })

  it('rejects non-media files', async () => {
    const p = `${testAudioPath()}.txt`
    fs.writeFileSync(p, 'hello')
    await expect(probe(p)).rejects.toMatchObject({ code: 'MEDIA_UNREADABLE' })
  })

  it('spreads frame timestamps across the duration', () => {
    const ts = frameTimestamps(100, 5)
    expect(ts).toHaveLength(5)
    expect(ts[0]).toBeGreaterThan(0)
    expect(ts[4]).toBeLessThan(100)
    expect(frameTimestamps(2.5, 10)).toHaveLength(3)
    expect(frameTimestamps(0, 10)).toEqual([0])
  })

  it('extracts JPEG frames', async () => {
    const frames = await extractFrames(testVideoPath({ seconds: 4 }), { count: 4, durationSec: 4 })
    expect(frames.length).toBeGreaterThanOrEqual(3)
    for (const f of frames) {
      expect(f.buffer[0]).toBe(0xff) // JPEG SOI
      expect(f.buffer[1]).toBe(0xd8)
      expect(f.positionSec).toBeGreaterThanOrEqual(0)
    }
  })

  it('extracts the audio track as WAV and returns null when there is none', async () => {
    const wav = await extractAudio(testVideoPath({ seconds: 4 }), { maxSec: 2 })
    expect(wav.subarray(0, 4).toString()).toBe('RIFF')
    // 2 s * 16000 Hz * 2 bytes mono, plus header
    expect(wav.length).toBeGreaterThan(60000)
    expect(wav.length).toBeLessThan(70000)

    const none = await extractAudio(testVideoPath({ seconds: 2, withAudio: false }))
    expect(none).toBeNull()
  })
})
