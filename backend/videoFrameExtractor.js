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
 * Extract both keyframes and audio track from video (dual-track extraction).
 * @param {Buffer} buffer - Video file buffer
 * @param {string} ext - File extension (mp4, mov, etc.)
 * @param {object} options - { intervalSec: number, maxFrames: number }
 * @returns {{ frames: Buffer[], audio: Buffer | null, count: number } | null}
 */
export async function extractVideoTracks(buffer, ext = 'mp4', options = {}) {
  const { intervalSec = 2, maxFrames = 15 } = options
  const tmpDir = path.join(
    process.env.TMPDIR || process.env.TEMP || os.tmpdir(),
    `verifeye-video-${Date.now()}-${Math.random().toString(36).slice(2)}`
  )
  const inputPath = path.join(tmpDir, `input.${ext}`)
  const outputPattern = path.join(tmpDir, 'frame-%04d.jpg')
  const audioPath = path.join(tmpDir, 'audio.mp3')

  try {
    fs.mkdirSync(tmpDir, { recursive: true })
    fs.writeFileSync(inputPath, buffer)

    await new Promise((resolve, reject) => {
      ffmpeg(inputPath)
        .outputOptions([
          '-vf',
          `fps=1/${intervalSec}`,
          '-frames:v',
          String(maxFrames),
          '-q:v',
          '2',
        ])
        .output(outputPattern)
        .on('end', () => resolve())
        .on('error', (err) => reject(new Error(`FFmpeg frames failed: ${err.message}`)))
        .run()
    })

    let audioBuffer = null
    try {
      await new Promise((resolve, reject) => {
        ffmpeg(inputPath)
          .noVideo()
          .format('mp3')
          .audioCodec('libmp3lame')
          .audioBitrate('128k')
          .output(audioPath)
          .on('end', () => resolve())
          .on('error', (err) => reject(err))
          .run()
      })
      if (fs.existsSync(audioPath)) {
        audioBuffer = fs.readFileSync(audioPath)
      }
    } catch (e) {
      // No audio track or extraction failed - continue without audio
    }

    const files = fs.readdirSync(tmpDir).filter((f) => f.startsWith('frame-') && f.endsWith('.jpg'))
    files.sort()
    const frames = files.map((f) => fs.readFileSync(path.join(tmpDir, f)))

    return { frames, audio: audioBuffer, count: frames.length }
  } catch (err) {
    console.warn('Video dual-track extraction error:', err.message)
    return null
  } finally {
    try {
      if (fs.existsSync(tmpDir)) {
        fs.readdirSync(tmpDir).forEach((f) => fs.unlinkSync(path.join(tmpDir, f)))
        fs.rmdirSync(tmpDir)
      }
    } catch {}
  }
}

/**
 * Extract audio track from video to a temporary .mp3 file.
 * Caller must delete the file after use.
 * @param {Buffer} buffer - Video file buffer
 * @param {string} ext - File extension (mp4, mov, etc.)
 * @returns {{ audioPath: string } | null} - Path to temp mp3, or null on failure
 */
export async function extractAudioToTempFile(buffer, ext = 'mp4') {
  const tmpDir = path.join(
    process.env.TMPDIR || process.env.TEMP || os.tmpdir(),
    `verifeye-audio-${Date.now()}-${Math.random().toString(36).slice(2)}`
  )
  const inputPath = path.join(tmpDir, `input.${ext}`)
  const audioPath = path.join(tmpDir, 'audio.mp3')

  try {
    fs.mkdirSync(tmpDir, { recursive: true })
    fs.writeFileSync(inputPath, buffer)

    await new Promise((resolve, reject) => {
      ffmpeg(inputPath)
        .noVideo()
        .format('mp3')
        .audioCodec('libmp3lame')
        .audioBitrate('128k')
        .output(audioPath)
        .on('end', () => resolve())
        .on('error', (err) => reject(err))
        .run()
    })

    if (fs.existsSync(audioPath)) {
      try {
        fs.unlinkSync(inputPath)
      } catch {}
      return { audioPath, tmpDir }
    }
    return null
  } catch (err) {
    console.warn('Audio extraction error:', err.message)
    return null
  } finally {
    try {
      if (fs.existsSync(inputPath)) fs.unlinkSync(inputPath)
    } catch {}
  }
}

/**
 * Extract frames only (legacy / non-dual path).
 * @param {Buffer} buffer - Video file buffer
 * @param {string} ext - File extension (mp4, mov, etc.)
 * @param {object} options - { intervalSec: number, maxFrames: number }
 * @returns {{ frames: Buffer[], count: number } | null}
 */
export async function extractKeyframes(buffer, ext = 'mp4', options = {}) {
  const out = await extractVideoTracks(buffer, ext, options)
  return out ? { frames: out.frames, count: out.count } : null
}
