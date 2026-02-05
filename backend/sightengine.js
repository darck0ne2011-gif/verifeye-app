/**
 * Sightengine API client for AI-generated image detection.
 * Uses workflow API with custom workflow ID.
 * Docs: https://sightengine.com/docs
 */

import axios from 'axios'
import FormData from 'form-data'

const SIGHTENGINE_URL = 'https://api.sightengine.com/1.0/check-workflow.json'
const SIGHTENGINE_WORKFLOW = 'wfl_k4LPE9FL9ieoC1A806ES7'

/**
 * Call Sightengine to detect AI-generated images.
 * @param {Buffer} buffer - Image file buffer
 * @param {string} mimeType - e.g. image/jpeg
 * @param {string} originalName - Original filename for Content-Disposition
 * @returns {{ aiGenerated: number } | null} - aiGenerated 0-1, or null on error
 */
export async function detectAiImage(buffer, mimeType, originalName) {
  const apiUser = process.env.SIGHTENGINE_USER || process.env.SIGHTENGINE_API_USER
  const apiSecret = process.env.SIGHTENGINE_SECRET || process.env.SIGHTENGINE_API_SECRET

  if (!apiUser || !apiSecret) {
    console.warn('Sightengine: Missing credentials. Set SIGHTENGINE_USER and SIGHTENGINE_SECRET in Render env vars.')
    return null
  }

  try {
    const form = new FormData()
    form.append('media', buffer, {
      filename: originalName || 'image.jpg',
      contentType: mimeType || 'application/octet-stream',
    })
    form.append('workflow', SIGHTENGINE_WORKFLOW)
    form.append('api_user', apiUser)
    form.append('api_secret', apiSecret)

    const res = await axios.post(SIGHTENGINE_URL, form, {
      headers: form.getHeaders(),
      timeout: 30000,
      maxBodyLength: Infinity,
      maxContentLength: Infinity,
    })

    const data = res.data

    if (data.status !== 'success' || !data.type) {
      console.warn('Sightengine: Unexpected response structure', data)
      return null
    }

    const aiGenerated = Number(data.type.ai_generated)
    if (Number.isNaN(aiGenerated) || aiGenerated < 0 || aiGenerated > 1) {
      return null
    }

    return { aiGenerated }
  } catch (err) {
    const status = err.response?.status
    const data = err.response?.data
    const isRateLimit = status === 429
    const errMsg = data?.message || data?.error?.message || data?.error || err.message
    console.warn('Sightengine:', isRateLimit ? 'Rate limit reached' : errMsg)
    return null
  }
}
