/**
 * Sequential Video Scanner for Sightengine.
 * Maps UI toggles to Sightengine model parameters. Only sends enabled models to save credits.
 *
 * UI → Sightengine mapping:
 * - temporal_ai (Temporal AI Consistency) → reproach
 * - video_deepfake (Video Deepfake Detection) → deepfake
 * - frame_integrity (Frame Integrity / AI Pixel Analysis) → genai
 */

import axios from 'axios'
import FormData from 'form-data'

const SIGHTENGINE_VIDEO_URL = 'https://api.sightengine.com/1.0/video/check-sync.json'

/** Map UI model IDs to Sightengine video API model IDs. Only enabled toggles are sent. */
const UI_TO_SIGHTENGINE = {
  temporal_ai: 'reproach',       // Temporal Consistency
  video_deepfake: 'deepfake',    // Video Deepfake Detection
  frame_integrity: 'genai',      // AI Pixel / Frame Integrity Analysis
}

/**
 * Build comma-separated Sightengine models param from enabled UI toggles.
 * Only includes models that are enabled. Disabled toggles are NOT sent (saves credits).
 *
 * @param {string[]} enabledUiModelIds - Raw UI IDs from ScanSettings (e.g. ['temporal_ai', 'video_deepfake'])
 * @returns {string} - Comma-separated Sightengine models, e.g. 'reproach,deepfake,genai'
 */
export function buildSightengineModelsParam(enabledUiModelIds) {
  if (!Array.isArray(enabledUiModelIds) || enabledUiModelIds.length === 0) {
    return 'genai'
  }
  const sightengineModels = enabledUiModelIds
    .map((id) => UI_TO_SIGHTENGINE[id])
    .filter(Boolean)
  const deduped = [...new Set(sightengineModels)]
  return deduped.length > 0 ? deduped.join(',') : 'genai'
}

/**
 * Parse Sightengine video response to extract per-frame scores.
 * Handles ai_generated, deepfake, reproach (or other model-specific scores).
 *
 * @param {object} data - Sightengine API response data
 * @param {string[]} requestedSightengineModels - Models we requested (e.g. ['genai','deepfake','reproach'])
 * @returns {{ type: object, data: object, media?: object } | null}
 */
function parseVideoResponse(data, requestedSightengineModels) {
  const frames = data?.data?.frames
  if (!frames || !Array.isArray(frames)) return null

  let maxAiGenerated = 0
  let maxDeepfake = 0
  let maxReproach = 0

  for (const frame of frames) {
    const t = frame.type || frame.info?.type || {}
    if (t.ai_generated != null) maxAiGenerated = Math.max(maxAiGenerated, Number(t.ai_generated))
    if (t.deepfake != null) maxDeepfake = Math.max(maxDeepfake, Number(t.deepfake))
    if (t.reproach != null) maxReproach = Math.max(maxReproach, Number(t.reproach))
    // Some Sightengine responses may use different keys; try common variants
    const genAi = t.ai_generated ?? t.genai ?? t['gen-ai']
    if (genAi != null) maxAiGenerated = Math.max(maxAiGenerated, Number(genAi))
  }

  const type = {}
  if (requestedSightengineModels.includes('genai') || requestedSightengineModels.includes('gen-ai')) {
    type.ai_generated = maxAiGenerated
  }
  if (requestedSightengineModels.includes('deepfake')) {
    type.deepfake = maxDeepfake
  }
  if (requestedSightengineModels.includes('reproach')) {
    type.reproach = maxReproach
    // Map reproach (temporal) into ai_generated for backward compat if genai wasn't requested
    if (type.ai_generated == null) type.ai_generated = maxReproach
  }

  return {
    type: Object.keys(type).length ? type : { ai_generated: maxAiGenerated || maxDeepfake || maxReproach },
    data: { frames },
    media: data.media,
  }
}

/**
 * Call Sightengine sequential video API with dynamic model selection.
 * Only requested (enabled) models are sent to the API.
 *
 * @param {Buffer} buffer - Video file buffer
 * @param {string} mimeType - e.g. video/mp4
 * @param {string} originalName - Original filename
 * @param {string[]} enabledUiModelIds - UI toggle IDs that are ON: temporal_ai, video_deepfake, frame_integrity
 * @returns {{ type?: object, data?: object, media?: object } | null}
 */
export async function analyzeVideoSequential(buffer, mimeType, originalName, enabledUiModelIds = []) {
  const apiUser = process.env.SIGHTENGINE_USER || process.env.SIGHTENGINE_API_USER
  const apiSecret = process.env.SIGHTENGINE_SECRET || process.env.SIGHTENGINE_API_SECRET

  if (!apiUser || !apiSecret) {
    console.warn('VideoScanner: Missing Sightengine credentials.')
    return null
  }

  const modelsParam = buildSightengineModelsParam(enabledUiModelIds)
  const requestedModels = modelsParam.split(',').filter(Boolean)

  try {
    const form = new FormData()
    form.append('media', buffer, {
      filename: originalName || 'video.mp4',
      contentType: mimeType || 'video/mp4',
    })
    form.append('models', modelsParam)
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

    return parseVideoResponse(data, requestedModels)
  } catch (err) {
    const status = err.response?.status
    const respData = err.response?.data
    const isRateLimit = status === 429
    const errMsg = respData?.message || respData?.error?.message || respData?.error || err.message
    console.warn('VideoScanner:', isRateLimit ? 'Rate limit reached' : errMsg)
    return null
  }
}
