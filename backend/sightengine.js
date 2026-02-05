/**
 * Sightengine API client for image analysis.
 * Uses standard check.json with dynamic models (deepfake, genai, type, quality).
 * Docs: https://sightengine.com/docs
 */

import axios from 'axios'
import FormData from 'form-data'

const SIGHTENGINE_URL = 'https://api.sightengine.com/1.0/check.json'

/**
 * Call Sightengine with selected models.
 * @param {Buffer} buffer - Image file buffer
 * @param {string} mimeType - e.g. image/jpeg
 * @param {string} originalName - Original filename
 * @param {string[]} models - Sightengine model IDs: deepfake, genai, type, quality
 * @returns {{ aiGenerated?: number, deepfake?: number, quality?: number, type?: object } | null}
 */
export async function detectAiImage(buffer, mimeType, originalName, models = ['genai']) {
  const apiUser = process.env.SIGHTENGINE_USER || process.env.SIGHTENGINE_API_USER
  const apiSecret = process.env.SIGHTENGINE_SECRET || process.env.SIGHTENGINE_API_SECRET

  if (!apiUser || !apiSecret) {
    console.warn('Sightengine: Missing credentials. Set SIGHTENGINE_USER and SIGHTENGINE_SECRET in Render env vars.')
    return null
  }

  const validModels = ['deepfake', 'genai', 'type', 'quality']
  const modelsParam = models.filter((m) => validModels.includes(m))
  if (modelsParam.length === 0) modelsParam.push('genai')

  try {
    const form = new FormData()
    form.append('media', buffer, {
      filename: originalName || 'image.jpg',
      contentType: mimeType || 'application/octet-stream',
    })
    form.append('models', modelsParam.join(','))
    form.append('api_user', apiUser)
    form.append('api_secret', apiSecret)

    const res = await axios.post(SIGHTENGINE_URL, form, {
      headers: form.getHeaders(),
      timeout: 30000,
      maxBodyLength: Infinity,
      maxContentLength: Infinity,
    })

    const data = res.data

    if (data.status !== 'success') {
      console.warn('Sightengine: Unexpected response structure', data)
      return null
    }

    return data
  } catch (err) {
    const status = err.response?.status
    const data = err.response?.data
    const isRateLimit = status === 429
    const errMsg = data?.message || data?.error?.message || data?.error || err.message
    console.warn('Sightengine:', isRateLimit ? 'Rate limit reached' : errMsg)
    return null
  }
}
