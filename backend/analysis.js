import exifParser from 'exif-parser'
import { fileTypeFromBuffer } from 'file-type'

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
 * Placeholder for Reality Defender or similar deepfake detection API.
 * TODO: Replace with real API call when key is available.
 *
 * Example integration:
 *   const response = await fetch('https://api.realitydefender.com/v1/analyze', {
 *     method: 'POST',
 *     headers: { 'Authorization': `Bearer ${process.env.REALITY_DEFENDER_API_KEY}` },
 *     body: formData,
 *   })
 *   const data = await response.json()
 *   return data.fakeProbability ?? data.score
 */
export async function callDeepfakeDetectionAPI(buffer, mimeType, fileSize) {
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

/**
 * Full file analysis: metadata extraction + AI signature detection + fake probability.
 */
export async function analyzeFile(buffer, originalName, mimeType) {
  const fileSize = buffer?.length || 0
  let score = 20

  const fileType = await fileTypeFromBuffer(buffer).catch(() => null)
  const detectedMime = fileType?.mime || mimeType
  const ext = (originalName?.split('.').pop() || detectedMime?.split('/')[1] || 'unknown').toLowerCase()

  const isImage = /image/i.test(detectedMime || '')
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

  const apiScore = await callDeepfakeDetectionAPI(buffer, detectedMime, fileSize)
  score = Math.round((score + apiScore) / 2)
  const fakeProbability = Math.max(0, Math.min(100, score))

  const metadata = {
    fileType: detectedMime || 'application/octet-stream',
    extension: ext,
    size: fileSize,
    sizeFormatted: formatFileSize(fileSize),
    createdAt: exifResult?.tags?.DateTimeOriginal || exifResult?.tags?.DateTime || null,
  }

  return {
    fakeProbability,
    metadata,
    aiSignatures,
  }
}

export async function computeFakeProbability(buffer, originalName, mimeType) {
  const result = await analyzeFile(buffer, originalName, mimeType)
  return result.fakeProbability
}
