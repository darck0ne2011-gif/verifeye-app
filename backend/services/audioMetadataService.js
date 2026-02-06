/**
 * Audio metadata extraction via ffprobe (bitrate, sample rate, silence gaps).
 * Used by Voice Clone DeepSeek analysis.
 */

import fs from 'fs'
import path from 'path'
import os from 'os'
import { createRequire } from 'module'

const require = createRequire(import.meta.url)
const ffmpeg = require('fluent-ffmpeg')

try {
  const ffprobeStatic = require('ffprobe-static')
  if (ffprobeStatic?.path) {
    ffmpeg.setFfprobePath(ffprobeStatic.path)
  }
} catch {
  // Rely on system ffprobe in PATH
}

/**
 * Get audio metadata from video file using ffprobe.
 * @param {Buffer} videoBuffer - Video file buffer
 * @param {string} ext - File extension (mp4, mov, etc.)
 * @returns {{ bitrate?: number, sampleRate?: number, duration?: number, hasAudio: boolean, silenceGaps?: string } | null}
 */
export async function getAudioMetadata(videoBuffer, ext = 'mp4') {
  const tmpDir = path.join(
    process.env.TMPDIR || process.env.TEMP || os.tmpdir(),
    `verifeye-probe-${Date.now()}-${Math.random().toString(36).slice(2)}`
  )
  const inputPath = path.join(tmpDir, `input.${ext}`)

  try {
    fs.mkdirSync(tmpDir, { recursive: true })
    fs.writeFileSync(inputPath, videoBuffer)

    const metadata = await new Promise((resolve, reject) => {
      ffmpeg.ffprobe(inputPath, (err, data) => {
        if (err) {
          reject(err)
          return
        }
        resolve(data)
      })
    })

    const audioStream = metadata?.streams?.find((s) => s.codec_type === 'audio')
    const format = metadata?.format || {}
    if (!audioStream && !format.bit_rate) {
      return { hasAudio: false }
    }

    const bitrate = audioStream?.bit_rate
      ? Number(audioStream.bit_rate)
      : format.bit_rate
        ? Number(format.bit_rate)
        : null
    const sampleRate = audioStream?.sample_rate ? Number(audioStream.sample_rate) : null
    const duration = format.duration ? Number(format.duration) : null

    let silenceGaps = null
    try {
      const silenceOut = await getSilenceGaps(inputPath)
      if (silenceOut) silenceGaps = silenceOut
    } catch {
      // Ignore silence detection errors
    }

    return {
      hasAudio: true,
      bitrate: bitrate != null ? Math.round(bitrate) : undefined,
      sampleRate: sampleRate != null ? Math.round(sampleRate) : undefined,
      duration: duration != null ? Math.round(duration * 100) / 100 : undefined,
      silenceGaps: silenceGaps ?? undefined,
    }
  } catch (err) {
    console.warn('AudioMetadataService:', err.message)
    return null
  } finally {
    try {
      if (fs.existsSync(tmpDir)) {
        if (fs.existsSync(inputPath)) fs.unlinkSync(inputPath)
        fs.rmdirSync(tmpDir)
      }
    } catch {}
  }
}

/**
 * Run ffmpeg silencedetect to get silence gap info.
 * @param {string} inputPath - Path to media file
 * @returns {Promise<string | null>} - Human-readable silence summary or null
 */
async function getSilenceGaps(inputPath) {
  const { spawn } = await import('child_process')
  const ffmpegBin = require('ffmpeg-static')
  if (!ffmpegBin) return null
  return new Promise((resolve) => {
    const proc = spawn(ffmpegBin, [
      '-i', inputPath,
      '-af', 'silencedetect=noise=-30dB:d=0.5',
      '-f', 'null',
      '-',
    ], { stdio: ['ignore', 'ignore', 'pipe'] })

    let stderr = ''
    proc.stderr?.on('data', (d) => { stderr += d.toString() })
    proc.on('close', (code) => {
      const matches = stderr.match(/silence_(?:start|end): ([\d.]+)/g)
      if (matches && matches.length >= 2) {
        const gaps = []
        for (let i = 0; i < matches.length; i += 2) {
          const start = matches[i]?.match(/([\d.]+)/)?.[1]
          const end = matches[i + 1]?.match(/([\d.]+)/)?.[1]
          if (start != null && end != null) {
            gaps.push(`${start}s-${end}s`)
          }
        }
        resolve(gaps.length ? gaps.join('; ') : 'none detected')
      } else {
        resolve('none detected')
      }
    })
    proc.on('error', () => resolve(null))
    setTimeout(() => {
      proc.kill('SIGTERM')
      resolve(null)
    }, 10000)
  })
}
