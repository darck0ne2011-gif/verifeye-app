/**
 * Test Voice Clone (ffprobe metadata + DeepSeek reasoning)
 * Run: node test-voice-clone.js [path/to/video.mp4]
 */
import 'dotenv/config'
import fs from 'fs'
import { classifyAudioWithSightengine } from './services/audioScanner.js'
import { getAudioMetadata } from './services/audioMetadataService.js'

const VIDEO = process.argv[2] || 'C:\\Users\\kalib\\Downloads\\Download.mp4'

async function run() {
  console.log('=== Voice Clone Test (DeepSeek) ===\n')
  console.log('Video:', VIDEO)

  if (!fs.existsSync(VIDEO)) {
    console.log('File not found. Usage: node test-voice-clone.js [path/to/video.mp4]')
    process.exit(1)
  }

  const buffer = fs.readFileSync(VIDEO)
  const ext = VIDEO.split('.').pop() || 'mp4'
  console.log('Size:', Math.round(buffer.length / 1024), 'KB\n')

  console.log('1. Audio metadata (ffprobe)...')
  try {
    const meta = await getAudioMetadata(buffer, ext)
    console.log(meta?.hasAudio ? `   ✓ bitrate: ${meta.bitrate ?? 'N/A'}, sampleRate: ${meta.sampleRate ?? 'N/A'} Hz` : '   ✗ No audio')
  } catch (e) {
    console.log('   ✗', e.message)
  }

  console.log('\n2. Voice Clone (DeepSeek reasoning)...')
  try {
    const r = await classifyAudioWithSightengine(buffer, ext, { lipSyncScore: 0.79 })
    if (r?.reasoning) {
      console.log('   ✓', r.reasoning)
      console.log('   Source:', r.source)
    } else {
      console.log('   ✗ No reasoning returned')
    }
  } catch (e) {
    console.log('   ✗', e.message)
  }
}

run().catch(console.error)
