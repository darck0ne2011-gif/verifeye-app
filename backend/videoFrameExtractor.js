/**
 * Extracts keyframes from video for frame-by-frame AI detection.
 * Uses fluent-ffmpeg; requires ffmpeg binary (via ffmpeg-static or system PATH).
 */

import fs from 'fs'
import path from 'path'
import os from 'os'
import { createRequire } from 'module'

const require = createRequire(import.meta.url)
const ffmpeg = require('fluent-ffmpeg')

let ffmpegPathSet = false
try {
  const ffmpegStatic = require('ffmpeg-static')
  if (ffmpegStatic) {
    ffmpeg.setFfmpegPath(ffmpegStatic)
    ffmpegPathSet = true
  }
} catch {
  // ffmpeg-static not installed or failed; rely on system ffmpeg
}

/**
 * Extract frames from video buffer at regular intervals.
 * @param {Buffer} buffer - Video file buffer
 * @param {string} ext - File extension (mp4, mov, etc.)
 * @param {object} options - { intervalSec: number, maxFrames: number }
 * @returns {{ frames: Buffer[], count: number } | null}
 */
export async function extractKeyframes(buffer, ext = 'mp4', options = {}) {
  const { intervalSec = 2, maxFrames = 15 } = options
  const tmpDir = path.join(
    process.env.TMPDIR || process.env.TEMP || os.tmpdir(),
    `verifeye-video-${Date.now()}-${Math.random().toString(36).slice(2)}`
  )
  const inputPath = path.join(tmpDir, `input.${ext}`)
  const outputPattern = path.join(tmpDir, 'frame-%04d.jpg')

  try {
    fs.mkdirSync(tmpDir, { recursive: true })
    fs.writeFileSync(inputPath, buffer)

    const frames = await new Promise((resolve, reject) => {
      const collected = []
      const proc = ffmpeg(inputPath)
        .outputOptions([
          '-vf',
          `fps=1/${intervalSec}`,
          '-frames:v',
          String(maxFrames),
          '-q:v',
          '2',
        ])
        .output(outputPattern)
        .on('end', async () => {
          try {
            const files = fs.readdirSync(tmpDir).filter((f) => f.startsWith('frame-') && f.endsWith('.jpg'))
            files.sort()
            for (const f of files) {
              const buf = fs.readFileSync(path.join(tmpDir, f))
              collected.push(buf)
            }
            resolve(collected)
          } catch (e) {
            reject(e)
          }
        })
        .on('error', (err) => {
          reject(new Error(`FFmpeg extraction failed: ${err.message}`))
        })

      proc.run()
    })

    return { frames, count: frames.length }
  } catch (err) {
    console.warn('Video frame extraction error:', err.message)
    return null
  } finally {
    try {
      if (fs.existsSync(tmpDir)) {
        fs.readdirSync(tmpDir).forEach((f) => fs.unlinkSync(path.join(tmpDir, f)))
        fs.rmdirSync(tmpDir)
      }
    } catch {
      // ignore cleanup errors
    }
  }
}
