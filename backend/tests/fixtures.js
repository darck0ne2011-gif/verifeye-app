/**
 * Generates small media fixtures with ffmpeg so tests never depend on binary
 * files in the repo.
 */
import fs from 'fs'
import os from 'os'
import path from 'path'
import { execFileSync } from 'child_process'
import ffmpegPath from 'ffmpeg-static'

const dir = fs.mkdtempSync(path.join(os.tmpdir(), 'verifeye-fixtures-'))

function run(args) {
  execFileSync(ffmpegPath, ['-v', 'error', '-y', ...args], { stdio: ['ignore', 'ignore', 'inherit'] })
}

export function testVideoPath({ seconds = 4, withAudio = true } = {}) {
  const p = path.join(dir, `video-${seconds}-${withAudio}.mp4`)
  if (!fs.existsSync(p)) {
    const args = ['-f', 'lavfi', '-i', `testsrc=size=320x240:rate=10`]
    if (withAudio) args.push('-f', 'lavfi', '-i', 'sine=frequency=440:sample_rate=22050')
    args.push('-t', String(seconds), '-pix_fmt', 'yuv420p', '-c:v', 'libx264', '-preset', 'ultrafast')
    if (withAudio) args.push('-c:a', 'aac')
    args.push(p)
    run(args)
  }
  return p
}

export function testAudioPath({ seconds = 3 } = {}) {
  const p = path.join(dir, `audio-${seconds}.mp3`)
  if (!fs.existsSync(p)) {
    run(['-f', 'lavfi', '-i', 'sine=frequency=440:sample_rate=22050', '-t', String(seconds), '-c:a', 'libmp3lame', p])
  }
  return p
}

export function testImageBuffer() {
  // Smallest valid PNG (1x1).
  return Buffer.from(
    'iVBORw0KGgoAAAANSUhEUgAAAAEAAAABCAYAAAAfFcSJAAAADUlEQVR42mNkYPhfDwAChwGA60e6kgAAAABJRU5ErkJggg==',
    'base64'
  )
}
