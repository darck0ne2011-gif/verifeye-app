/**
 * OCR text extraction for Fake News Detection.
 * Extracts text from images or video frames using Tesseract.js.
 */

import { createWorker } from 'tesseract.js'

/**
 * Extract text from a single image buffer.
 * @param {Buffer} imageBuffer - JPEG/PNG image buffer
 * @returns {Promise<string>} - Extracted text (trimmed)
 */
export async function extractTextFromImage(imageBuffer) {
  let worker
  try {
    worker = await createWorker('ron+eng', 1, {
      logger: () => {},
    })
    const { data } = await worker.recognize(imageBuffer)
    return (data?.text || '').trim()
  } catch (err) {
    console.warn('OCR TextExtractor:', err.message)
    return ''
  } finally {
    if (worker) await worker.terminate()
  }
}

/**
 * Extract text from multiple image buffers (e.g. video frames).
 * Deduplicates and concatenates unique text.
 * @param {Buffer[]} frames - Array of image buffers
 * @param {number} maxFrames - Max frames to process (default 5)
 * @returns {Promise<string>} - Combined extracted text
 */
export async function extractTextFromFrames(frames, maxFrames = 5) {
  if (!Array.isArray(frames) || frames.length === 0) return ''
  const toProcess = frames.slice(0, maxFrames)
  const texts = []
  let worker
  try {
    worker = await createWorker('ron+eng', 1, { logger: () => {} })
    for (const frame of toProcess) {
      const { data } = await worker.recognize(frame)
      const t = (data?.text || '').trim()
      if (t && !texts.includes(t)) texts.push(t)
    }
    return texts.join('\n\n').trim()
  } catch (err) {
    console.warn('OCR TextExtractor:', err.message)
    return ''
  } finally {
    if (worker) await worker.terminate()
  }
}
