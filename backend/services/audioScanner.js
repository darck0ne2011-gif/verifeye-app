/**
 * Sightengine Audio analysis for voice / synthetic speech detection.
 * Extracts audio from video, sends to Sightengine with genai/deepfake models.
 * Maps results to Vocalic Imprint and Voice Clone Detection.
 */

import fs from 'fs'
import { extractAudioToTempFile } from '../videoFrameExtractor.js'
import { detectAiAudio } from '../sightengine.js'

/**
 * Analyze extracted audio from video using Sightengine.
 * @param {Buffer} videoBuffer - Video file buffer
 * @param {string} ext - File extension (mp4, mov, etc.)
 * @returns {{ score: number, source: string } | null} - Vocalic imprint 0-1, or null on failure
 */
export async function classifyAudioWithSightengine(videoBuffer, ext = 'mp4') {
  let extracted = null
  try {
    extracted = await extractAudioToTempFile(videoBuffer, ext)
    if (!extracted?.audioPath || !fs.existsSync(extracted.audioPath)) {
      console.warn('AudioScanner: No extracted audio file.')
      return null
    }

    const stat = fs.statSync(extracted.audioPath)
    if (stat.size === 0) {
      return null
    }

    const audioBuffer = fs.readFileSync(extracted.audioPath)
    const res = await detectAiAudio(
      audioBuffer,
      'audio/mpeg',
      'audio.mp3',
      ['genai', 'deepfake']
    )

    if (res?.type) {
      const ag = res.type.ai_generated != null ? Number(res.type.ai_generated) : 0
      const df = res.type.deepfake != null ? Number(res.type.deepfake) : 0
      const vocalicImprint = Math.max(ag, df)
      return { score: Math.max(0, Math.min(1, vocalicImprint)), source: 'sightengine' }
    }
    return null
  } catch (err) {
    console.warn('AudioScanner:', err.message)
    return null
  } finally {
    if (extracted?.audioPath) {
      try {
        if (fs.existsSync(extracted.audioPath)) fs.unlinkSync(extracted.audioPath)
      } catch {}
    }
    if (extracted?.tmpDir) {
      try {
        if (fs.existsSync(extracted.tmpDir)) fs.rmdirSync(extracted.tmpDir)
      } catch {}
    }
  }
}
