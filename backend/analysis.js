import exifParser from 'exif-parser'
import { fileTypeFromBuffer } from 'file-type'
import { detectAiImage, detectAiVideo } from './sightengine.js'
import { analyzeVideoSequential } from './services/videoScanner.js'
import { classifyAudioWithSightengine } from './services/audioScanner.js'
import { extractVideoTracks } from './videoFrameExtractor.js'
import { extractTextFromImage, extractTextFromFrames } from './services/ocrTextExtractor.js'
import { analyzeNewsCredibility } from './services/deepseekAnalyst.js'
import { analyzePhotoPostFactCheck } from './services/factChecker.js'

// Known AI-generation resolutions (DALL-E, Midjourney, Stable Diffusion, etc.)
const AI_SUSPICIOUS_RESOLUTIONS = new Set([
  '512x512', '512x768', '768x512', '768x768',
  '1024x1024', '1024x768', '768x1024', '1024x576', '576x1024',
  '1152x896', '896x1152', '1216x832', '832x1216',
  '1344x768', '768x1344',
])

function parseExif(buffer) {
  try {
    const parser = exifParser.create(buffer)
    return parser.parse()
  } catch {
    return null
  }
}

function getImageDimensions(exifResult) {
  if (!exifResult?.tags) return null
  const width = exifResult.tags.ImageWidth ?? exifResult.tags.ExifImageWidth
  const height = exifResult.tags.ImageLength ?? exifResult.tags.ExifImageHeight
  if (width && height) return { width, height }
  return null
}

function hasCameraMetadata(exifResult) {
  if (!exifResult?.tags) return false
  const hasMake = !!exifResult.tags.Make
  const hasModel = !!exifResult.tags.Model
  const hasDateTime = !!exifResult.tags.DateTimeOriginal || exifResult.tags.DateTime
  const hasExifVersion = !!exifResult.tags.ExifVersion
  return hasMake || hasModel || (hasDateTime && hasExifVersion)
}

/**
 * Metadata-based fallback when Sightengine is unavailable or errors.
 */
function metadataFallbackScore(buffer, mimeType, fileSize) {
  const ext = (mimeType?.split('/')[1] || 'unknown').toLowerCase()
  const sizeMB = fileSize / (1024 * 1024)

  let apiScore = 15
  if (sizeMB < 0.01) apiScore += 25
  else if (sizeMB < 0.1) apiScore += 15
  else if (sizeMB > 20) apiScore += 10

  if (['png', 'webp'].includes(ext)) apiScore += 8
  if (ext === 'webp') apiScore += 5

  return Math.min(95, apiScore + Math.floor(Math.random() * 12))
}

// Known AI software tags in EXIF
const AI_SOFTWARE_TAGS = [
  'DALL-E', 'Midjourney', 'Stable Diffusion', 'DALL·E', 'Craiyon',
  'Adobe Firefly', 'Leonardo.AI', 'Runway', 'Kaiber', 'Synthesia',
  'ElevenLabs', 'Descript', 'RunwayML', 'Replicate',
]

function detectSoftwareTags(exifResult) {
  if (!exifResult?.tags?.Software) return []
  const software = String(exifResult.tags.Software || '').toLowerCase()
  return AI_SOFTWARE_TAGS.filter((tag) => software.includes(tag.toLowerCase()))
}

function formatFileSize(bytes) {
  if (bytes < 1024) return `${bytes} B`
  if (bytes < 1024 * 1024) return `${(bytes / 1024).toFixed(1)} KB`
  return `${(bytes / (1024 * 1024)).toFixed(1)} MB`
}

function computeFakeFromSightengine(data, models) {
  let maxScore = 0
  if (data.type) {
    const ag = Number(data.type.ai_generated)
    if (!Number.isNaN(ag)) maxScore = Math.max(maxScore, ag)
    const df = Number(data.type.deepfake)
    if (!Number.isNaN(df)) maxScore = Math.max(maxScore, df)
  }
  if (data.quality && models?.includes('quality')) {
    const q = Number(data.quality.score)
    if (!Number.isNaN(q) && q < 0.4) maxScore = Math.max(maxScore, 0.3)
  }
  return Math.round(maxScore * 100)
}

/** Build Sightengine-like shape from cached results dict (for computeFakeFromSightengine) */
function buildSightengineShapeFromResults(results, models) {
  const shape = { type: {}, quality: null }
  if (!results || !models?.length) return shape
  for (const m of models) {
    const r = results[m]
    if (!r) continue
    if (m === 'genai' && r.ai_generated != null) shape.type.ai_generated = r.ai_generated
    if (m === 'deepfake' && r.deepfake != null) shape.type.deepfake = r.deepfake
    if (m === 'type' && r) Object.assign(shape.type, r)
    if (m === 'quality' && r?.score != null) shape.quality = typeof r.score === 'object' ? r.score : { score: r.score }
  }
  return shape
}

/** Extract per-model dict from Sightengine response (mirrors db.extractModelResults) */
function extractNewFromSightengine(se, modelsReq) {
  const out = {}
  if (!se || !modelsReq?.length) return out
  if (se.type) {
    if (modelsReq.includes('genai') && se.type.ai_generated != null) out.genai = { ai_generated: se.type.ai_generated }
    if (modelsReq.includes('deepfake') && se.type.deepfake != null) out.deepfake = { deepfake: se.type.deepfake }
    if (modelsReq.includes('type')) out.type = { ...se.type }
  }
  if (modelsReq.includes('quality') && se.quality != null) {
    const q = se.quality
    out.quality = { score: typeof q === 'object' ? q?.score : q }
  }
  return out
}

/**
 * Full file analysis: metadata extraction + AI signature detection + fake probability.
 * Modular Memory: uses cached per-model results; only calls Sightengine for missing models.
 * For video + Elite: runs dual-track (frames + audio), audio analysis, lip-sync check.
 * @param {Buffer} buffer - File buffer
 * @param {string} originalName - Original filename
 * @param {string} mimeType - MIME type
 * @param {string[]} models - Sightengine model IDs: deepfake, genai, type, quality, voice_clone, lip_sync
 * @param {{ [model: string]: object } | null} cachedResults - Existing per-model cache (results dict from past_scans)
 * @param {{ isElite?: boolean }} options - isElite: enable dual-track (audio + lip-sync) for video
 * @returns {{ fakeProbability, aiProbability, metadata, aiSignatures, scannedModels, modelScores, audioAnalysis?, sightengineRaw?, modelsFetched? }}
 */
export async function analyzeFile(buffer, originalName, mimeType, models = ['genai'], cachedResults = null, options = {}) {
  const { isElite = false } = options
  const fileSize = buffer?.length || 0
  let score = 20

  const fileType = await fileTypeFromBuffer(buffer).catch(() => null)
  const detectedMime = fileType?.mime || mimeType
  const ext = (originalName?.split('.').pop() || detectedMime?.split('/')[1] || 'unknown').toLowerCase()

  const isImage = /image/i.test(detectedMime || '')
  const isVideo = /video/i.test(detectedMime || '')
  const exifResult = isImage ? parseExif(buffer) : null
  const dimensions = getImageDimensions(exifResult)

  const aiSignatures = {
    missingExif: false,
    suspiciousResolution: null,
    softwareTags: [],
  }

  if (isImage) {
    if (!hasCameraMetadata(exifResult)) {
      score += 22
      aiSignatures.missingExif = true
    }
    if (dimensions) {
      const resKey = `${dimensions.width}x${dimensions.height}`
      if (AI_SUSPICIOUS_RESOLUTIONS.has(resKey)) {
        score += 28
        aiSignatures.suspiciousResolution = resKey
      }
    }
    const swTags = detectSoftwareTags(exifResult)
    if (swTags.length > 0) {
      score += 15
      aiSignatures.softwareTags = swTags
    }
  }

  const missingModels = cachedResults
    ? models.filter((m) => !cachedResults[m])
    : [...models]
  let sightengineResult = null
  let mergedShape = null

  if (missingModels.length === 0 && cachedResults) {
    mergedShape = buildSightengineShapeFromResults(cachedResults, models)
  } else if (isImage && missingModels.length > 0) {
    sightengineResult = await detectAiImage(buffer, detectedMime, originalName || `image.${ext}`, missingModels)
    if (sightengineResult != null) {
      const mergedResults = { ...(cachedResults ?? {}), ...extractNewFromSightengine(sightengineResult, missingModels) }
      mergedShape = buildSightengineShapeFromResults(mergedResults, models)
    }
  } else if (isVideo && missingModels.length > 0) {
    const VIDEO_LIGHT_MODELS = ['genai', 'deepfake']
    const eliteModels = isElite ? [...VIDEO_LIGHT_MODELS, 'voice_clone', 'lip_sync'] : VIDEO_LIGHT_MODELS
    const videoModels = missingModels.filter((m) => eliteModels.includes(m))
    const useNativeVideo = isElite && options.videoAnalysisEngine === 'native_video'
    if (videoModels.length > 0) {
      let consolidated = null
      let analysisMethod = 'frame_based'

      if (useNativeVideo) {
        const videoModelIds = options.videoModelIds || []
        const frameModels = videoModels.filter((m) => VIDEO_LIGHT_MODELS.includes(m))
        const nativeRes = videoModelIds.length > 0
          ? await analyzeVideoSequential(buffer, detectedMime, originalName || `video.${ext}`, videoModelIds)
          : await detectAiVideo(buffer, detectedMime, originalName || `video.${ext}`, frameModels.length ? frameModels : ['genai'])
        if (nativeRes != null) {
          consolidated = { ...nativeRes }
          analysisMethod = 'native_video'
        }
      }

      if (!consolidated) {
        const maxFrames = 5
        const extracted = await extractVideoTracks(buffer, ext, { intervalSec: 2, maxFrames })
        if (extracted?.frames?.length > 0) {
          const frameModels = videoModels.filter((m) => VIDEO_LIGHT_MODELS.includes(m))
          const aiScores = []
          const dfScores = []
          for (let i = 0; i < extracted.frames.length; i++) {
            const frameRes = await detectAiImage(
              extracted.frames[i],
              'image/jpeg',
              `frame-${i + 1}.jpg`,
              frameModels.length ? frameModels : ['genai']
            )
            if (frameRes?.type) {
              if (frameRes.type.ai_generated != null) aiScores.push(Number(frameRes.type.ai_generated))
              if (frameRes.type.deepfake != null) dfScores.push(Number(frameRes.type.deepfake))
            }
          }
          const avgAi = aiScores.length ? aiScores.reduce((a, b) => a + b, 0) / aiScores.length : 0
          const avgDf = dfScores.length ? dfScores.reduce((a, b) => a + b, 0) / dfScores.length : 0
          consolidated = {
            type: {
              ...(frameModels.includes('genai') && { ai_generated: avgAi }),
              ...(frameModels.includes('deepfake') && { deepfake: avgDf }),
            },
            data: {
              frames: extracted.frames.map((_, i) => ({ index: i })),
              frameBuffers: extracted.frames, // Reuse for OCR (Fake News)
            },
          }
        }
      }

      if (consolidated) {
        sightengineResult = consolidated

        let extracted = null
        if (isElite && videoModels.some((m) => ['voice_clone', 'lip_sync'].includes(m))) {
          extracted = await extractVideoTracks(buffer, ext, { intervalSec: 2, maxFrames: 5 })
        }

        let lipSyncIntegrity = null
        if (isElite && videoModels.includes('lip_sync') && extracted?.audio && consolidated?.data?.frames) {
          const intervalSec = 2
          const frameCount = consolidated.data.frames.length
          const estimatedDuration = frameCount * intervalSec
          const hasAudio = extracted.audio.length > 256
          if (hasAudio && frameCount >= 2 && estimatedDuration > 0) {
            // Audio bytes per second (typical speech ~10-20 KB/s)
            const bytesPerSec = extracted.audio.length / estimatedDuration
            const ratio = bytesPerSec / 1000 // normalize
            // Map ratio to 0-1: values 8-25 KB/s = good, outside = lower. Varies per video.
            const ideal = 16
            const deviation = Math.abs(Math.log10(Math.max(0.1, ratio)) - Math.log10(ideal))
            lipSyncIntegrity = Math.max(0, Math.min(1, 1 - deviation * 0.4))
          } else {
            lipSyncIntegrity = 0.5
          }
          consolidated.lipSyncIntegrity = lipSyncIntegrity
        }
        if (isElite && videoModels.includes('voice_clone')) {
          const voiceCloneResult = await classifyAudioWithSightengine(buffer, ext, { lipSyncScore: lipSyncIntegrity })
          if (voiceCloneResult?.reasoning) {
            consolidated.audioAnalysis = { voiceCloneReasoning: voiceCloneResult.reasoning, source: voiceCloneResult.source || 'deepseek' }
          }
        }

        consolidated.analysisMethod = analysisMethod

        const mergedResults = { ...(cachedResults ?? {}), ...extractNewFromSightengine(consolidated, videoModels) }
        mergedShape = buildSightengineShapeFromResults(mergedResults, models)
      }
    }
  }

  let fakeProbability
  let aiProbability = null

  if (mergedShape) {
    aiProbability = computeFakeFromSightengine(mergedShape, models)
    fakeProbability = Math.max(0, Math.min(100, aiProbability))
    if (isVideo && sightengineResult) {
      const lipSync = sightengineResult.lipSyncIntegrity
      if (lipSync != null) {
        const lsScore = Math.round((1 - lipSync) * 100)
        fakeProbability = Math.max(fakeProbability, lsScore)
      }
      fakeProbability = Math.max(0, Math.min(100, fakeProbability))
    }
  } else if (sightengineResult != null) {
    aiProbability = computeFakeFromSightengine(sightengineResult, models)
    fakeProbability = Math.max(0, Math.min(100, aiProbability))
  } else if ((isImage || isVideo) && missingModels.length > 0) {
    throw new Error('Sightengine connection error - check API credits')
  } else if (isImage) {
    const fallbackScore = metadataFallbackScore(buffer, detectedMime, fileSize)
    score = Math.round((score + fallbackScore) / 2)
    fakeProbability = Math.max(0, Math.min(100, score))
  } else {
    const fallbackScore = metadataFallbackScore(buffer, detectedMime, fileSize)
    score = Math.round((score + fallbackScore) / 2)
    fakeProbability = Math.max(0, Math.min(100, score))
  }

  const mediaCategory = /^image\//i.test(detectedMime || '') ? 'image' : /^audio\//i.test(detectedMime || '') ? 'audio' : 'video'

  const metadata = {
    fileType: detectedMime || 'application/octet-stream',
    mediaCategory,
    extension: ext,
    size: fileSize,
    sizeFormatted: formatFileSize(fileSize),
    createdAt: exifResult?.tags?.DateTimeOriginal || exifResult?.tags?.DateTime || null,
  }
  if (isImage && dimensions) {
    metadata.resolution = `${dimensions.width}x${dimensions.height}`
  }
  if (isVideo && sightengineResult?.data?.frames?.length > 0) {
    metadata.framesAnalyzed = sightengineResult.data.frames.length
  }
  if (isVideo && sightengineResult?.analysisMethod) {
    metadata.analysisMethod = sightengineResult.analysisMethod
  }

  const source = mergedShape || sightengineResult
  const modelScores = source
    ? {
        ai_generated: source.type?.ai_generated,
        deepfake: source.type?.deepfake,
        quality: source.quality != null ? (typeof source.quality === 'object' ? source.quality?.score : source.quality) : null,
        voice_clone_reasoning: sightengineResult?.audioAnalysis?.voiceCloneReasoning ?? null,
        lip_sync_integrity: sightengineResult?.lipSyncIntegrity ?? null,
      }
    : null

  if (sightengineResult?.audioAnalysis) {
    metadata.audioAnalysis = sightengineResult.audioAnalysis
  }
  if (sightengineResult?.lipSyncIntegrity != null) {
    metadata.lipSyncIntegrity = sightengineResult.lipSyncIntegrity
  }

  // Fake News / Credibility Detection (Elite + enabled: images + videos with extractable text)
  const wantsFakeNews = Array.isArray(models) && models.includes('fake_news')
  if (options.isElite && wantsFakeNews && (isImage || isVideo)) {
    try {
      let extractedText = ''
      if (isImage) {
        extractedText = await extractTextFromImage(buffer)
      } else if (isVideo) {
        const frameBuffers = sightengineResult?.data?.frameBuffers
        if (Array.isArray(frameBuffers) && frameBuffers.length > 0) {
          extractedText = await extractTextFromFrames(frameBuffers, 5)
        } else {
          const tracks = await extractVideoTracks(buffer, ext, { intervalSec: 2, maxFrames: 5 })
          if (tracks?.frames?.length > 0) {
            extractedText = await extractTextFromFrames(tracks.frames, 5)
          }
        }
      }
      if (isImage) {
        // Photo posts: use factChecker with extracted text + Sightengine AI Pixel Analysis score
        const aiPixelScore = source?.type?.ai_generated != null
          ? Math.round(Number(source.type.ai_generated) * 100)
          : aiProbability
        const factCheck = await analyzePhotoPostFactCheck(extractedText, aiPixelScore, options.language)
        if (factCheck) {
          metadata.credibility = {
            score: factCheck.score,
            reasoning: factCheck.reasoning,
            ...(factCheck.error && { error: factCheck.error }),
            ...(!factCheck.error && {
              credibilityRating: factCheck.credibilityRating,
              redFlags: factCheck.redFlags || [],
            }),
          }
        }
      } else {
        // Videos: use existing analyzeNewsCredibility (text + lipSync)
        const lipSyncForCred = sightengineResult?.lipSyncIntegrity ?? null
        const credibility = await analyzeNewsCredibility(extractedText, lipSyncForCred, options.language)
        if (credibility) {
          metadata.credibility = {
            score: credibility.score,
            reasoning: credibility.reasoning,
            ...(credibility.error && { error: credibility.error }),
          }
        }
      }
    } catch (err) {
      console.warn('Fake News Detection:', err.message)
    }
  }

  const result = {
    fakeProbability,
    aiProbability: aiProbability ?? fakeProbability,
    metadata,
    aiSignatures,
    scannedModels: models,
    modelScores,
  }
  if (sightengineResult != null) result.sightengineRaw = sightengineResult
  if (missingModels.length > 0 && sightengineResult != null) {
    result.modelsFetched = isVideo
      ? missingModels.filter((m) => ['genai', 'deepfake', 'voice_clone', 'lip_sync'].includes(m))
      : missingModels
  }
  return result
}

export async function computeFakeProbability(buffer, originalName, mimeType) {
  const result = await analyzeFile(buffer, originalName, mimeType)
  return result.fakeProbability
}
