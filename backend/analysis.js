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

export async function computeFakeProbability(buffer, originalName, mimeType) {
  const fileSize = buffer?.length || 0
  let score = 20

  const fileType = await fileTypeFromBuffer(buffer).catch(() => null)
  const detectedMime = fileType?.mime || mimeType

  const isImage = /image/i.test(detectedMime || '')
  const exifResult = isImage ? parseExif(buffer) : null
  const dimensions = getImageDimensions(exifResult)

  if (isImage) {
    if (!hasCameraMetadata(exifResult)) {
      score += 22
    }
    if (dimensions) {
      const resKey = `${dimensions.width}x${dimensions.height}`
      if (AI_SUSPICIOUS_RESOLUTIONS.has(resKey)) {
        score += 28
      }
    }
  }

  const apiScore = await callDeepfakeDetectionAPI(buffer, detectedMime, fileSize)
  score = Math.round((score + apiScore) / 2)
  return Math.max(0, Math.min(100, score))
}
