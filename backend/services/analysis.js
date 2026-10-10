import exifParser from 'exif-parser'
import { fileTypeFromBuffer } from 'file-type'
import { detectAiImage, extractModelResults, IMAGE_MODELS, ProviderError } from './sightengine.js'
import { AppError } from '../lib/errors.js'

// Output sizes commonly produced by image generators. Informational only: many
// ordinary images share these sizes, so this never changes the verdict.
const GENERATOR_RESOLUTIONS = new Set([
  '512x512',
  '512x768',
  '768x512',
  '768x768',
  '1024x1024',
  '1024x768',
  '768x1024',
  '1024x576',
  '576x1024',
  '1152x896',
  '896x1152',
  '1216x832',
  '832x1216',
  '1344x768',
  '768x1344',
])

const AI_SOFTWARE_TAGS = [
  'DALL-E',
  'DALL·E',
  'Midjourney',
  'Stable Diffusion',
  'Craiyon',
  'Adobe Firefly',
  'Leonardo.AI',
  'Runway',
  'RunwayML',
  'Kaiber',
  'Replicate',
]

function parseExif(buffer) {
  try {
    return exifParser.create(buffer).parse()
  } catch {
    return null
  }
}

function getImageDimensions(exif) {
  const tags = exif?.tags
  if (!tags) return null
  const width = tags.ImageWidth ?? tags.ExifImageWidth
  const height = tags.ImageLength ?? tags.ExifImageHeight
  return width && height ? { width, height } : null
}

function hasCameraMetadata(exif) {
  const tags = exif?.tags
  if (!tags) return false
  return !!(tags.Make || tags.Model || ((tags.DateTimeOriginal || tags.DateTime) && tags.ExifVersion))
}

/**
 * Sorted list of probable generators from Sightengine's per-generator scores.
 * @returns {{ id: string, score: number }[]}
 */
export function generatorsFromShape(shape) {
  const raw = shape?.type?.ai_generators
  if (!raw || typeof raw !== 'object') return []
  return Object.entries(raw)
    .map(([id, v]) => ({ id, score: Number(v) }))
    .filter((g) => Number.isFinite(g.score))
    .sort((a, b) => b.score - a.score)
}

/** photo vs illustration probabilities from the `type` model, when it ran. */
export function imageTypeFromShape(shape) {
  const t = shape?.type
  if (!t || (t.photo == null && t.illustration == null)) return null
  return {
    photo: t.photo != null ? Number(t.photo) : null,
    illustration: t.illustration != null ? Number(t.illustration) : null,
  }
}

function cameraFromExif(exif) {
  const tags = exif?.tags
  if (!tags) return null
  const make = tags.Make ? String(tags.Make).trim() : ''
  const model = tags.Model ? String(tags.Model).trim() : ''
  if (!make && !model) return null
  return model.toLowerCase().startsWith(make.toLowerCase()) ? model : `${make} ${model}`.trim()
}

function detectSoftwareTags(exif) {
  const software = String(exif?.tags?.Software || '').toLowerCase()
  if (!software) return []
  return AI_SOFTWARE_TAGS.filter((tag) => software.includes(tag.toLowerCase()))
}

function formatFileSize(bytes) {
  if (bytes < 1024) return `${bytes} B`
  if (bytes < 1024 * 1024) return `${(bytes / 1024).toFixed(1)} KB`
  return `${(bytes / (1024 * 1024)).toFixed(1)} MB`
}

/** Rebuilds a Sightengine-shaped object from cached per-model results. */
export function shapeFromResults(results, models) {
  const shape = { type: {}, quality: null }
  for (const m of models) {
    const r = results?.[m]
    if (!r) continue
    if (m === 'genai' && r.ai_generated != null) {
      shape.type.ai_generated = r.ai_generated
      if (r.ai_generators) shape.type.ai_generators = r.ai_generators
    }
    if (m === 'deepfake' && r.deepfake != null) shape.type.deepfake = r.deepfake
    if (m === 'type') Object.assign(shape.type, r)
    if (m === 'quality' && r.score != null) shape.quality = { score: r.score }
  }
  return shape
}

/**
 * Probability (0-100) that the image is AI-generated or manipulated, from the
 * strongest provider signal. Returns null when no signal is available.
 */
export function computeFakeProbability(shape) {
  let max = null
  const consider = (value) => {
    const n = Number(value)
    if (value == null || Number.isNaN(n)) return
    max = max == null ? n : Math.max(max, n)
  }
  consider(shape?.type?.ai_generated)
  consider(shape?.type?.deepfake)
  if (max == null) return null
  return Math.round(Math.max(0, Math.min(1, max)) * 100)
}

/**
 * Analyses an image. Uses cached per-model results where available and only
 * asks the provider for the models that are missing.
 *
 * @returns {{ fakeProbability, aiProbability, metadata, aiSignatures, scannedModels,
 *             modelScores, providerResponse, newModelResults, mergedResults }}
 */
export async function analyzeImage(buffer, originalName, models = ['genai'], cachedResults = null) {
  const requested = models.filter((m) => IMAGE_MODELS.includes(m))
  if (requested.length === 0) requested.push('genai')

  // Trust the bytes, not the declared MIME type or the file extension.
  const detected = await fileTypeFromBuffer(buffer).catch(() => null)
  if (!detected || !/^image\//i.test(detected.mime)) {
    throw new AppError(400, 'The uploaded file is not a supported image', 'UNSUPPORTED_MEDIA')
  }
  const detectedMime = detected.mime
  const ext = detected.ext.toLowerCase()

  const exif = parseExif(buffer)
  const dimensions = getImageDimensions(exif)
  const resolution = dimensions ? `${dimensions.width}x${dimensions.height}` : null

  const aiSignatures = {
    missingExif: !hasCameraMetadata(exif),
    suspiciousResolution: resolution && GENERATOR_RESOLUTIONS.has(resolution) ? resolution : null,
    softwareTags: detectSoftwareTags(exif),
  }

  const missing = requested.filter((m) => !cachedResults?.[m])
  let providerResponse = null
  let newModelResults = {}
  if (missing.length > 0) {
    try {
      providerResponse = await detectAiImage(buffer, detectedMime, originalName || `image.${ext}`, missing)
    } catch (err) {
      if (err instanceof ProviderError) {
        const code = err.code === 'NOT_CONFIGURED' ? 'API_CONFIG_MISSING' : 'PROVIDER_UNAVAILABLE'
        throw new AppError(503, 'The analysis service is currently unavailable. Please try again later.', code)
      }
      throw err
    }
    newModelResults = extractModelResults(providerResponse, missing)
  }

  const mergedResults = { ...(cachedResults ?? {}), ...newModelResults }
  const shape = shapeFromResults(mergedResults, requested)
  const fakeProbability = computeFakeProbability(shape)
  if (fakeProbability == null) {
    throw new AppError(503, 'The analysis service returned no result. Please try again later.', 'NO_RESULT')
  }

  const metadata = {
    fileType: detectedMime || 'application/octet-stream',
    mediaCategory: 'image',
    extension: ext,
    size: buffer.length,
    sizeFormatted: formatFileSize(buffer.length),
    createdAt: exif?.tags?.DateTimeOriginal || exif?.tags?.DateTime || null,
    hasExif: !!exif?.tags && Object.keys(exif.tags).length > 0,
    camera: cameraFromExif(exif),
    software: exif?.tags?.Software ? String(exif.tags.Software).trim() : null,
    ...(resolution && { resolution }),
  }

  return {
    fakeProbability,
    aiProbability: fakeProbability,
    metadata,
    aiSignatures,
    scannedModels: requested,
    modelScores: {
      ai_generated: shape.type.ai_generated ?? null,
      deepfake: shape.type.deepfake ?? null,
      quality: shape.quality?.score ?? null,
      generators: generatorsFromShape(shape),
      imageType: imageTypeFromShape(shape),
    },
    providerResponse,
    newModelResults,
    mergedResults,
  }
}
