/**
 * ElevenLabs AI Speech Classifier integration.
 * Extracts audio from video, sends to classifier, returns AI-generated probability score.
 */

import fs from 'fs'
import path from 'path'
import axios from 'axios'
import FormData from 'form-data'
import { extractAudioToTempFile } from '../videoFrameExtractor.js'

const ELEVENLABS_CLASSIFIER_URL = 'https://api.elevenlabs.io/v1/classifier'

/**
 * Run ElevenLabs classifier on extracted audio from video.
 * Extracts audio to temp .mp3, POSTs to classifier, deletes temp file.
 * @param {Buffer} videoBuffer - Video file buffer
 * @param {string} ext - File extension (mp4, mov, etc.)
 * @returns {{ score: number } | null} - AI-generated probability 0-1, or null on failure
 */
export async function classifyAudioWithElevenLabs(videoBuffer, ext = 'mp4') {
  const apiKey = process.env.ELEVENLABS_API_KEY || process.env.ELEVENLABS_XI_API_KEY
  if (!apiKey) {
    console.warn('ElevenLabs: Missing ELEVENLABS_API_KEY. Set in .env')
    return null
  }

  let extracted = null
  try {
    extracted = await extractAudioToTempFile(videoBuffer, ext)
    if (!extracted?.audioPath || !fs.existsSync(extracted.audioPath)) {
      console.warn('ElevenLabs: No extracted audio file. Extraction may have failed.')
      return null
    }

    const stat = fs.statSync(extracted.audioPath)
    const sizeKb = (stat.size / 1024).toFixed(2)
    console.log(`ElevenLabs: Extracted .mp3 size: ${sizeKb} KB${stat.size === 0 ? ' (WARNING: 0 KB - extraction likely failed)' : ''}`)
    if (stat.size === 0) {
      return null
    }

    const form = new FormData()
    form.append('file', fs.createReadStream(extracted.audioPath), {
      filename: 'audio.mp3',
      contentType: 'audio/mpeg',
    })

    const res = await axios.post(ELEVENLABS_CLASSIFIER_URL, form, {
      headers: {
        'xi-api-key': apiKey,
        ...form.getHeaders(),
      },
      timeout: 45000,
      maxBodyLength: Infinity,
      maxContentLength: Infinity,
    })

    const data = res.data
    console.log('ElevenLabs classifier response:', JSON.stringify(data, null, 2))
    const score = data?.probability ?? data?.score ?? data?.ai_generated_probability ?? data?.result?.probability
    if (score != null) {
      const num = Number(score)
      return { score: Math.max(0, Math.min(1, num)) }
    }
    return null
  } catch (err) {
    const status = err.response?.status
    const respData = err.response?.data
    const errMsg = respData?.message ?? respData?.detail ?? err.message
    console.warn('ElevenLabs classifier:', status === 429 ? 'Rate limit' : errMsg)
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
