/**
 * Sightengine client (images and audio).
 * Docs: https://sightengine.com/docs
 */
import axios from 'axios'
import FormData from 'form-data'
import { config } from '../config.js'

const IMAGE_URL = 'https://api.sightengine.com/1.0/check.json'
const AUDIO_URL = 'https://api.sightengine.com/1.0/audio/check.json'

export const IMAGE_MODELS = ['deepfake', 'genai', 'type', 'quality']
export const AUDIO_MODELS = ['ai_speech']

export class ProviderError extends Error {
  constructor(code, message, status) {
    super(message)
    this.name = 'ProviderError'
    // NOT_CONFIGURED | RATE_LIMITED | MODEL_NOT_ENABLED | PROVIDER_ERROR | NETWORK_ERROR
    this.code = code
    this.status = status
  }
}

function ensureConfigured() {
  if (!config.sightengine.configured) {
    throw new ProviderError('NOT_CONFIGURED', 'Sightengine credentials are not configured')
  }
}

async function post(url, form, timeout) {
  let res
  try {
    res = await axios.post(url, form, {
      headers: form.getHeaders(),
      timeout,
      maxBodyLength: Infinity,
      maxContentLength: Infinity,
    })
  } catch (err) {
    const status = err.response?.status
    const data = err.response?.data
    const message = data?.error?.message || data?.message || err.message
    if (status === 429) throw new ProviderError('RATE_LIMITED', 'Sightengine rate limit reached', 429)
    if (status && /model|not (available|enabled|allowed)|access|permission|beta/i.test(message)) {
      throw new ProviderError('MODEL_NOT_ENABLED', `Sightengine: ${message}`, status)
    }
    if (status) throw new ProviderError('PROVIDER_ERROR', `Sightengine error: ${message}`, status)
    throw new ProviderError('NETWORK_ERROR', `Sightengine unreachable: ${message}`)
  }
  const data = res.data
  if (data?.status !== 'success') {
    const message = data?.error?.message || 'Unexpected response from Sightengine'
    throw new ProviderError('PROVIDER_ERROR', `Sightengine error: ${message}`)
  }
  return data
}

/**
 * Runs the requested models on an image. Resolves with the raw Sightengine
 * response; rejects with ProviderError when no result could be obtained.
 */
export async function detectAiImage(buffer, mimeType, originalName, models = ['genai']) {
  ensureConfigured()
  const modelsParam = models.filter((m) => IMAGE_MODELS.includes(m))
  if (modelsParam.length === 0) modelsParam.push('genai')

  const form = new FormData()
  form.append('media', buffer, {
    filename: originalName || 'image.jpg',
    contentType: mimeType || 'application/octet-stream',
  })
  form.append('models', modelsParam.join(','))
  form.append('api_user', config.sightengine.user)
  form.append('api_secret', config.sightengine.secret)
  return post(IMAGE_URL, form, 30000)
}

/**
 * Runs AI-speech detection on an audio file (WAV/MP3/OGG/FLAC/M4A/WEBM).
 * Note: Sightengine's ai_speech model is in beta and must be enabled on the
 * account; otherwise this rejects with code MODEL_NOT_ENABLED.
 */
export async function detectAiAudio(buffer, originalName = 'audio.wav', models = ['ai_speech']) {
  ensureConfigured()
  const modelsParam = models.filter((m) => AUDIO_MODELS.includes(m))
  if (modelsParam.length === 0) modelsParam.push('ai_speech')

  const form = new FormData()
  form.append('audio', buffer, { filename: originalName, contentType: 'audio/wav' })
  form.append('models', modelsParam.join(','))
  form.append('api_user', config.sightengine.user)
  form.append('api_secret', config.sightengine.secret)
  return post(AUDIO_URL, form, 60000)
}

/** Per-model results worth caching, keyed by model id. */
export function extractModelResults(response, models) {
  const out = {}
  if (!response || !models?.length) return out
  if (response.type) {
    if (models.includes('genai') && response.type.ai_generated != null) {
      out.genai = {
        ai_generated: response.type.ai_generated,
        ...(response.type.ai_generators && typeof response.type.ai_generators === 'object'
          ? { ai_generators: response.type.ai_generators }
          : {}),
      }
    }
    if (models.includes('deepfake') && response.type.deepfake != null) {
      out.deepfake = { deepfake: response.type.deepfake }
    }
    if (models.includes('type')) out.type = { ...response.type }
    if (models.includes('ai_speech') && response.type.ai_speech != null) {
      out.ai_speech = { ai_speech: response.type.ai_speech }
    }
  }
  if (models.includes('quality') && response.quality != null) {
    const q = response.quality
    out.quality = { score: typeof q === 'object' ? q?.score : q }
  }
  return out
}
