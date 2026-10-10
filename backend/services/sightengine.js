/**
 * Sightengine image client.
 * Docs: https://sightengine.com/docs
 */
import axios from 'axios'
import FormData from 'form-data'
import { config } from '../config.js'

const IMAGE_URL = 'https://api.sightengine.com/1.0/check.json'

export const IMAGE_MODELS = ['deepfake', 'genai', 'type', 'quality']

export class ProviderError extends Error {
  constructor(code, message, status) {
    super(message)
    this.name = 'ProviderError'
    this.code = code // NOT_CONFIGURED | RATE_LIMITED | PROVIDER_ERROR | NETWORK_ERROR
    this.status = status
  }
}

/**
 * Runs the requested models on an image. Resolves with the raw Sightengine
 * response; rejects with ProviderError when no result could be obtained.
 */
export async function detectAiImage(buffer, mimeType, originalName, models = ['genai']) {
  if (!config.sightengine.configured) {
    throw new ProviderError('NOT_CONFIGURED', 'Sightengine credentials are not configured')
  }

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

  let res
  try {
    res = await axios.post(IMAGE_URL, form, {
      headers: form.getHeaders(),
      timeout: 30000,
      maxBodyLength: Infinity,
      maxContentLength: Infinity,
    })
  } catch (err) {
    const status = err.response?.status
    const data = err.response?.data
    const message = data?.error?.message || data?.message || err.message
    if (status === 429) throw new ProviderError('RATE_LIMITED', 'Sightengine rate limit reached', 429)
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

/** Per-model results worth caching, keyed by model id. */
export function extractModelResults(response, models) {
  const out = {}
  if (!response || !models?.length) return out
  if (response.type) {
    if (models.includes('genai') && response.type.ai_generated != null) {
      out.genai = { ai_generated: response.type.ai_generated }
    }
    if (models.includes('deepfake') && response.type.deepfake != null) {
      out.deepfake = { deepfake: response.type.deepfake }
    }
    if (models.includes('type')) out.type = { ...response.type }
  }
  if (models.includes('quality') && response.quality != null) {
    const q = response.quality
    out.quality = { score: typeof q === 'object' ? q?.score : q }
  }
  return out
}
