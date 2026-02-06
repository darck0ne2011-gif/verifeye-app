/**
 * Sightengine API client for image and video analysis.
 * Uses check.json for images, video/check-sync.json for videos (<1 min).
 * Docs: https://sightengine.com/docs
 */

import axios from 'axios'
import FormData from 'form-data'

const SIGHTENGINE_IMAGE_URL = 'https://api.sightengine.com/1.0/check.json'
const SIGHTENGINE_VIDEO_URL = 'https://api.sightengine.com/1.0/video/check-sync.json'

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

    const res = await axios.post(SIGHTENGINE_IMAGE_URL, form, {
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

/**
 * Call Sightengine Video API for short videos (<1 min).
 * Analyzes frames for deepfake, AI-generated content.
 * @param {Buffer} buffer - Video file buffer
 * @param {string} mimeType - e.g. video/mp4
 * @param {string} originalName - Original filename
 * @param {string[]} models - e.g. ['genai', 'deepfake']
 * @returns {{ type?: { ai_generated?, deepfake? }, data?: { frames } } | null} - Normalized to match image shape
 */
export async function detectAiVideo(buffer, mimeType, originalName, models = ['genai', 'deepfake']) {
  const apiUser = process.env.SIGHTENGINE_USER || process.env.SIGHTENGINE_API_USER
  const apiSecret = process.env.SIGHTENGINE_SECRET || process.env.SIGHTENGINE_API_SECRET

  if (!apiUser || !apiSecret) {
    console.warn('Sightengine: Missing credentials for video detection.')
    return null
  }

  const validModels = ['deepfake', 'genai']
  const modelsParam = models.filter((m) => validModels.includes(m))
  if (modelsParam.length === 0) modelsParam.push('genai')

  try {
    const form = new FormData()
    form.append('media', buffer, {
      filename: originalName || 'video.mp4',
      contentType: mimeType || 'video/mp4',
    })
    form.append('models', modelsParam.join(','))
    form.append('interval', '2')
    form.append('api_user', apiUser)
    form.append('api_secret', apiSecret)

    const res = await axios.post(SIGHTENGINE_VIDEO_URL, form, {
      headers: form.getHeaders(),
      timeout: 120000,
      maxBodyLength: Infinity,
      maxContentLength: Infinity,
    })

    const data = res.data
    if (data.status !== 'success') return null

    const frames = data.data?.frames || []
    if (frames.length === 0) return null

    let maxAiGenerated = 0
    let maxDeepfake = 0
    for (const frame of frames) {
      const t = frame.type || {}
      if (t.ai_generated != null) maxAiGenerated = Math.max(maxAiGenerated, Number(t.ai_generated))
      if (t.deepfake != null) maxDeepfake = Math.max(maxDeepfake, Number(t.deepfake))
    }

    return {
      type: {
        ...(modelsParam.includes('genai') && { ai_generated: maxAiGenerated }),
        ...(modelsParam.includes('deepfake') && { deepfake: maxDeepfake }),
      },
      data: { frames },
      media: data.media,
    }
  } catch (err) {
    const status = err.response?.status
    const respData = err.response?.data
    const isRateLimit = status === 429
    const errMsg = respData?.message || respData?.error?.message || respData?.error || err.message
    console.warn('Sightengine Video:', isRateLimit ? 'Rate limit reached' : errMsg)
    return null
  }
}

/**
 * Call Sightengine with audio buffer for voice/synthetic speech detection.
 * Uses check.json with genai/deepfake models (same API as images).
 * @param {Buffer} buffer - Audio file buffer (e.g. mp3)
 * @param {string} mimeType - e.g. audio/mpeg
 * @param {string} originalName - Original filename
 * @param {string[]} models - e.g. ['genai', 'deepfake']
 * @returns {{ type?: { ai_generated?, deepfake? } } | null}
 */
export async function detectAiAudio(buffer, mimeType, originalName, models = ['genai', 'deepfake']) {
  const apiUser = process.env.SIGHTENGINE_USER || process.env.SIGHTENGINE_API_USER
  const apiSecret = process.env.SIGHTENGINE_SECRET || process.env.SIGHTENGINE_API_SECRET

  if (!apiUser || !apiSecret) {
    console.warn('Sightengine: Missing credentials for audio detection.')
    return null
  }

  const validModels = ['deepfake', 'genai']
  const modelsParam = models.filter((m) => validModels.includes(m))
  if (modelsParam.length === 0) modelsParam.push('genai')

  try {
    const form = new FormData()
    form.append('media', buffer, {
      filename: originalName || 'audio.mp3',
      contentType: mimeType || 'audio/mpeg',
    })
    form.append('models', modelsParam.join(','))
    form.append('api_user', apiUser)
    form.append('api_secret', apiSecret)

    const res = await axios.post(SIGHTENGINE_IMAGE_URL, form, {
      headers: form.getHeaders(),
      timeout: 45000,
      maxBodyLength: Infinity,
      maxContentLength: Infinity,
    })

    const data = res.data
    if (data.status !== 'success') return null

    return {
      type: {
        ...(modelsParam.includes('genai') && data.type?.ai_generated != null && { ai_generated: data.type.ai_generated }),
        ...(modelsParam.includes('deepfake') && data.type?.deepfake != null && { deepfake: data.type.deepfake }),
      },
    }
  } catch (err) {
    const status = err.response?.status
    const respData = err.response?.data
    const isRateLimit = status === 429
    const errMsg = respData?.message || respData?.error?.message || respData?.error || err.message
    console.warn('Sightengine Audio:', isRateLimit ? 'Rate limit reached' : errMsg)
    return null
  }
}
