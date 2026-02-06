/**
 * Test video analysis options: temporal_ai, video_deepfake, frame_integrity, voice_clone, lip_sync
 * Run: node test-video-options.js
 */
import 'dotenv/config'
import axios from 'axios'
import { analyzeVideoSequential } from './services/videoScanner.js'
import { classifyAudioWithSightengine } from './services/audioScanner.js'
import { extractVideoTracks } from './videoFrameExtractor.js'

const SAMPLE_VIDEO_URL = 'https://www.w3schools.com/html/mov_bbb.mp4'

async function getTestVideo() {
  const res = await axios.get(SAMPLE_VIDEO_URL, {
    responseType: 'arraybuffer',
    timeout: 15000,
  })
  return Buffer.from(res.data)
}

async function run() {
  console.log('=== VerifEye Video Options Test ===\n')

  console.log('Downloading test video...')
  let videoBuffer
  try {
    videoBuffer = await getTestVideo()
    console.log('  OK -', Math.round(videoBuffer.length / 1024), 'KB\n')
  } catch (e) {
    console.log('  FAIL -', e.message)
    process.exit(1)
  }

  const results = {}

  // 1. Temporal AI
  console.log('1. Temporal AI Consistency (genai)...')
  try {
    const r = await analyzeVideoSequential(videoBuffer, 'video/mp4', 'test.mp4', ['temporal_ai'])
    results.temporal_ai = r?.type?.ai_generated != null
    console.log(results.temporal_ai ? '   ✓ OK' : '   ✗ No score returned')
  } catch (e) {
    results.temporal_ai = false
    console.log('   ✗', e.message)
  }

  // 2. Video Deepfake
  console.log('\n2. Video Deepfake Detection (deepfake)...')
  try {
    const r = await analyzeVideoSequential(videoBuffer, 'video/mp4', 'test.mp4', ['video_deepfake'])
    results.video_deepfake = r?.type?.deepfake != null
    console.log(results.video_deepfake ? '   ✓ OK' : '   ✗ No score returned')
  } catch (e) {
    results.video_deepfake = false
    console.log('   ✗', e.message)
  }

  // 3. Frame Integrity (genai)
  console.log('\n3. Frame Integrity Analysis (genai)...')
  try {
    const r = await analyzeVideoSequential(videoBuffer, 'video/mp4', 'test.mp4', ['frame_integrity'])
    results.frame_integrity = r?.type?.ai_generated != null
    console.log(results.frame_integrity ? '   ✓ OK' : '   ✗ No score returned')
  } catch (e) {
    results.frame_integrity = false
    console.log('   ✗', e.message)
  }

  // 4. All three together (Native Video)
  console.log('\n4. All 3 models together (genai,deepfake)...')
  try {
    const r = await analyzeVideoSequential(videoBuffer, 'video/mp4', 'test.mp4', [
      'temporal_ai',
      'video_deepfake',
      'frame_integrity',
    ])
    const ok = r?.type && (r.type.ai_generated != null || r.type.deepfake != null)
    results.all_native = !!ok
    console.log(ok ? '   ✓ OK' : '   ✗ No scores')
    if (r?.type) console.log('     Scores:', JSON.stringify(r.type))
  } catch (e) {
    results.all_native = false
    console.log('   ✗', e.message)
  }

  // 5. Voice Clone (DeepSeek reasoning)
  console.log('\n5. Voice Clone Detection (DeepSeek)...')
  try {
    const r = await classifyAudioWithSightengine(videoBuffer, 'mp4', { lipSyncScore: 0.79 })
    results.voice_clone = r?.reasoning != null
    console.log(results.voice_clone ? `   ✓ OK (${r.reasoning?.slice(0, 60)}...)` : '   ✗ No reasoning')
  } catch (e) {
    results.voice_clone = false
    console.log('   ✗', e.message)
  }

  // 6. Lip-Sync (extract tracks - needs frames + audio)
  console.log('\n6. Lip-Sync Integrity (extract frames+audio)...')
  try {
    const extracted = await extractVideoTracks(videoBuffer, 'mp4', { intervalSec: 2, maxFrames: 3 })
    const hasFrames = extracted?.frames?.length > 0
    const hasAudio = extracted?.audio?.length > 0
    results.lip_sync_extract = hasFrames && hasAudio
    console.log(
      results.lip_sync_extract
        ? `   ✓ OK (${extracted.frames.length} frames, ${Math.round(extracted.audio?.length / 1024 || 0)} KB audio)`
        : `   ✗ Frames: ${hasFrames}, Audio: ${hasAudio}`
    )
  } catch (e) {
    results.lip_sync_extract = false
    console.log('   ✗', e.message)
  }

  console.log('\n--- Summary ---')
  const ok = Object.values(results).filter(Boolean).length
  const total = Object.keys(results).length
  console.log(`Working: ${ok}/${total}`)
  for (const [k, v] of Object.entries(results)) {
    console.log(`  ${k}: ${v ? '✓' : '✗'}`)
  }
}

run().catch(console.error)
