/**
 * ffmpeg/ffprobe helpers for video and audio files.
 */
import { execFile } from 'child_process'
import { promisify } from 'util'
import ffmpegPath from 'ffmpeg-static'
import ffprobeStatic from 'ffprobe-static'
import { AppError } from '../lib/errors.js'

const execFileAsync = promisify(execFile)
const ffprobePath = ffprobeStatic.path

const MAX_BUFFER = 64 * 1024 * 1024

export class MediaError extends AppError {
  constructor(message, code = 'MEDIA_ERROR') {
    super(400, message, code)
  }
}

/**
 * @returns {{ durationSec: number|null, width: number|null, height: number|null,
 *             hasVideo: boolean, hasAudio: boolean, videoCodec: string|null,
 *             audioCodec: string|null, bitrate: number|null, sampleRate: number|null }}
 */
export async function probe(filePath) {
  let stdout
  try {
    ;({ stdout } = await execFileAsync(
      ffprobePath,
      ['-v', 'error', '-print_format', 'json', '-show_format', '-show_streams', filePath],
      { maxBuffer: MAX_BUFFER }
    ))
  } catch {
    throw new MediaError('The file could not be read as a media file', 'MEDIA_UNREADABLE')
  }
  let info
  try {
    info = JSON.parse(stdout)
  } catch {
    throw new MediaError('The file could not be read as a media file', 'MEDIA_UNREADABLE')
  }
  // ffprobe happily "decodes" plain text (tty demuxer) and a few other non-media inputs.
  const formatName = String(info.format?.format_name || '')
  if (!info.format || /\b(tty|data|bin)\b/.test(formatName)) {
    throw new MediaError('The file could not be read as a media file', 'MEDIA_UNREADABLE')
  }
  const streams = info.streams ?? []
  const video = streams.find((s) => s.codec_type === 'video' && !isAttachedPicture(s) && s.codec_name !== 'ansi')
  const audio = streams.find((s) => s.codec_type === 'audio')
  const duration = Number(info.format?.duration ?? video?.duration ?? audio?.duration)
  return {
    durationSec: Number.isFinite(duration) ? duration : null,
    width: video?.width ?? null,
    height: video?.height ?? null,
    hasVideo: !!video,
    hasAudio: !!audio,
    videoCodec: video?.codec_name ?? null,
    audioCodec: audio?.codec_name ?? null,
    bitrate: info.format?.bit_rate ? Number(info.format.bit_rate) : null,
    sampleRate: audio?.sample_rate ? Number(audio.sample_rate) : null,
    // Container and stream tags (encoder, comment, title...): generators sometimes sign here.
    tags: collectTags(info),
  }
}

function collectTags(info) {
  const out = {}
  const add = (tags) => {
    for (const [k, v] of Object.entries(tags ?? {})) {
      if (typeof v === 'string' && v.trim() && !(k in out)) out[k] = v.slice(0, 500)
    }
  }
  add(info.format?.tags)
  for (const s of info.streams ?? []) add(s.tags)
  return out
}

// Cover art embedded in audio files shows up as a video stream.
function isAttachedPicture(stream) {
  return stream.disposition?.attached_pic === 1 || (stream.nb_frames === '1' && stream.avg_frame_rate === '0/0')
}

/** Evenly spaced timestamps, skipping the very start and end (titles, fades, black frames). */
export function frameTimestamps(durationSec, count) {
  if (!durationSec || durationSec <= 0) return [0]
  const n = Math.max(1, Math.min(count, Math.ceil(durationSec)))
  if (n === 1) return [durationSec / 2]
  const start = durationSec * 0.03
  const end = durationSec * 0.97
  return Array.from({ length: n }, (_, i) => +(start + ((end - start) * i) / (n - 1)).toFixed(3))
}

/**
 * Extracts one JPEG frame at each timestamp.
 * @returns {Promise<{ positionSec: number, buffer: Buffer }[]>}
 */
export async function extractFrames(filePath, { count = 10, durationSec, maxWidth = 1280 } = {}) {
  const timestamps = frameTimestamps(durationSec, count)
  const frames = []
  for (const t of timestamps) {
    try {
      const { stdout } = await execFileAsync(
        ffmpegPath,
        [
          '-v',
          'error',
          '-ss',
          String(t),
          '-i',
          filePath,
          '-frames:v',
          '1',
          '-vf',
          `scale='min(${maxWidth},iw)':-2`,
          '-q:v',
          '3',
          '-f',
          'image2',
          '-c:v',
          'mjpeg',
          'pipe:1',
        ],
        { encoding: 'buffer', maxBuffer: MAX_BUFFER }
      )
      if (stdout?.length > 0) frames.push({ positionSec: t, buffer: stdout })
    } catch {
      // A single unreadable position should not fail the whole scan.
    }
  }
  if (frames.length === 0) throw new MediaError('No frames could be extracted from the video', 'NO_FRAMES')
  return frames
}

/**
 * Extracts (or converts) the audio track to 16 kHz mono WAV, capped at `maxSec`.
 * @returns {Promise<Buffer|null>} null when the file has no audio track
 */
export async function extractAudio(filePath, { maxSec = 60 } = {}) {
  try {
    const { stdout } = await execFileAsync(
      ffmpegPath,
      ['-v', 'error', '-i', filePath, '-vn', '-ac', '1', '-ar', '16000', '-t', String(maxSec), '-f', 'wav', 'pipe:1'],
      { encoding: 'buffer', maxBuffer: MAX_BUFFER }
    )
    // A WAV header alone is 44 bytes; anything shorter than ~0.1s is useless.
    return stdout && stdout.length > 44 + 3200 ? stdout : null
  } catch {
    return null
  }
}
