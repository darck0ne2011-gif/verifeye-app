/**
 * Full video analysis test - all options on a local file
 * Run: node test-full-video.js [path/to/video.mp4]
 */
import 'dotenv/config'
import fs from 'fs'
import { analyzeVideoSequential } from './services/videoScanner.js'
import { classifyAudioWithSightengine } from './services/audioScanner.js'
import { extractVideoTracks } from './videoFrameExtractor.js'

const VIDEO = process.argv[2] || 'C:\\Users\\kalib\\Downloads\\Canva.mp4'

async function run() {
  console.log('=== VerifEye Full Video Test ===\n')
  console.log('Video:', VIDEO)

  if (!fs.existsSync(VIDEO)) {
    console.log('File not found.')
    process.exit(1)
  }

  const videoBuffer = fs.readFileSync(VIDEO)
  const ext = VIDEO.split('.').pop() || 'mp4'
  const mime = ext === 'mp4' ? 'video/mp4' : `video/${ext}`
  const name = VIDEO.split(/[/\\]/).pop() || 'video.mp4'

  console.log('Size:', Math.round(videoBuffer.length / 1024), 'KB\n')

  const results = {}
  const totalStart = Date.now()

  // 1. Temporal AI
  console.log('1. Temporal AI Consistency...')
  try {
    const t1 = Date.now()
    const r = await analyzeVideoSequential(videoBuffer, mime, name, ['temporal_ai'])
    const ms1 = Date.now() - t1
    results.temporal_ai = r?.type?.ai_generated != null
    console.log(results.temporal_ai ? `   ✓ ai_generated: ${r?.type?.ai_generated} (${(ms1/1000).toFixed(1)}s)` : `   ✗ No score (${(ms1/1000).toFixed(1)}s)`)
  } catch (e) {
    results.temporal_ai = false
    console.log('   ✗', e.message)
  }

  // 2. Video Deepfake
  console.log('\n2. Video Deepfake...')
  try {
    const t2 = Date.now()
    const r = await analyzeVideoSequential(videoBuffer, mime, name, ['video_deepfake'])
    const ms2 = Date.now() - t2
    results.video_deepfake = r?.type?.deepfake != null
    console.log(results.video_deepfake ? `   ✓ deepfake: ${r.type.deepfake} (${(ms2/1000).toFixed(1)}s)` : `   ✗ No score (${(ms2/1000).toFixed(1)}s)`)
  } catch (e) {
    results.video_deepfake = false
    console.log('   ✗', e.message)
  }

  // 3. Frame Integrity
  console.log('\n3. Frame Integrity...')
  try {
    const t3 = Date.now()
    const r = await analyzeVideoSequential(videoBuffer, mime, name, ['frame_integrity'])
    const ms3 = Date.now() - t3
    results.frame_integrity = r?.type?.ai_generated != null
    console.log(results.frame_integrity ? `   ✓ ai_generated: ${r.type.ai_generated} (${(ms3/1000).toFixed(1)}s)` : `   ✗ No score (${(ms3/1000).toFixed(1)}s)`)
  } catch (e) {
    results.frame_integrity = false
    console.log('   ✗', e.message)
  }

  // 4. All 3 native together
  console.log('\n4. All 3 models together...')
  try {
    const t4 = Date.now()
    const r = await analyzeVideoSequential(videoBuffer, mime, name, [
      'temporal_ai',
      'video_deepfake',
      'frame_integrity',
    ])
    const ms4 = Date.now() - t4
    const ok = r?.type && (r.type.ai_generated != null || r.type.deepfake != null)
    results.all_native = !!ok
    console.log(ok ? `   ✓ ${JSON.stringify(r.type)} (${(ms4/1000).toFixed(1)}s)` : `   ✗ No scores (${(ms4/1000).toFixed(1)}s)`)
  } catch (e) {
    results.all_native = false
    console.log('   ✗', e.message)
  }

  // 5. Voice Clone (DeepSeek)
  console.log('\n5. Voice Clone (DeepSeek reasoning)...')
  try {
    const t5 = Date.now()
    const lipSync = 0.79
    const r = await classifyAudioWithSightengine(videoBuffer, ext, { lipSyncScore: lipSync })
    const ms5 = Date.now() - t5
    results.voice_clone = r?.reasoning != null
    console.log(results.voice_clone ? `   ✓ ${r.reasoning?.slice(0, 80)}... (${r.source}) (${(ms5/1000).toFixed(1)}s)` : `   ✗ No reasoning (${(ms5/1000).toFixed(1)}s)`)
  } catch (e) {
    results.voice_clone = false
    console.log('   ✗', e.message)
  }

  // 6. Lip-Sync extract
  console.log('\n6. Lip-Sync (frames + audio extraction)...')
  try {
    const t6 = Date.now()
    const extracted = await extractVideoTracks(videoBuffer, ext, { intervalSec: 2, maxFrames: 3 })
    const ms6 = Date.now() - t6
    const hasFrames = extracted?.frames?.length > 0
    const hasAudio = extracted?.audio?.length > 0
    results.lip_sync = hasFrames && hasAudio
    console.log(
      results.lip_sync
        ? `   ✓ ${extracted.frames.length} frames, ${Math.round(extracted.audio?.length / 1024 || 0)} KB audio (${(ms6/1000).toFixed(1)}s)`
        : `   ✗ Frames: ${hasFrames}, Audio: ${hasAudio} (${(ms6/1000).toFixed(1)}s)`
    )
  } catch (e) {
    results.lip_sync = false
    console.log('   ✗', e.message)
  }

  const totalMs = Date.now() - totalStart
  console.log('\n--- Summary ---')
  const ok = Object.values(results).filter(Boolean).length
  const total = Object.keys(results).length
  console.log(`Working: ${ok}/${total} | Total: ${(totalMs/1000).toFixed(1)}s`)
  for (const [k, v] of Object.entries(results)) {
    console.log(`  ${k}: ${v ? '✓' : '✗'}`)
  }
}

run().catch(console.error)
