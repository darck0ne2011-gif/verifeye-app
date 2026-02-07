/**
 * Full video test + verdict as in app. Run: node test-app-verdict.js [video.mp4]
 */
import 'dotenv/config'
import fs from 'fs'
import { analyzeFile } from './analysis.js'

const VIDEO = process.argv[2] || 'C:\\Users\\kalib\\Downloads\\Canva.mp4'

async function run() {
  console.log('=== VerifEye Video Test (exact app verdict) ===\n')
  console.log('Video:', VIDEO)

  if (!fs.existsSync(VIDEO)) {
    console.log('File not found.')
    process.exit(1)
  }

  const buffer = fs.readFileSync(VIDEO)
  const name = VIDEO.split(/[/\\]/).pop() || 'video.mp4'
  const mime = 'video/mp4'
  const models = ['genai', 'deepfake', 'voice_clone', 'lip_sync']

  console.log('Size:', Math.round(buffer.length / 1024), 'KB')
  console.log('Models:', models.join(', '))
  console.log('\nRunning full analysis (as in app)...\n')

  const start = Date.now()
  const result = await analyzeFile(buffer, name, mime, models, null, {
    isElite: true,
    videoAnalysisEngine: 'native_video',
    videoModelIds: ['temporal_ai', 'video_deepfake', 'frame_integrity'],
  })
  const totalMs = Date.now() - start

  const { fakeProbability, metadata, modelScores, scannedModels } = result

  // Per-test results (from modelScores + metadata) + source
  console.log('--- Rezultate pe teste (cu sursă) ---\n')
  const aiGen = modelScores?.ai_generated
  const deepfake = modelScores?.deepfake
  const lipSync = metadata?.lipSyncIntegrity ?? modelScores?.lip_sync_integrity
  const voiceReason = metadata?.audioAnalysis?.voiceCloneReasoning ?? modelScores?.voice_clone_reasoning
  const voiceSource = metadata?.audioAnalysis?.source ?? 'deepseek'

  console.log(`1. Temporal AI Consistency`)
  console.log(`   Rezultat: ${aiGen != null ? `${Math.round((aiGen || 0) * 100)}%` : 'N/A'}`)
  console.log(`   Sursă: Sightengine Video API (api.sightengine.com/1.0/video/check-sync.json, model genai)\n`)

  console.log(`2. Video Deepfake Detection`)
  console.log(`   Rezultat: ${deepfake != null ? `${Math.round((deepfake || 0) * 100)}%` : 'N/A'}`)
  console.log(`   Sursă: Sightengine Video API (model deepfake)\n`)

  console.log(`3. Frame Integrity`)
  console.log(`   Rezultat: ${aiGen != null ? `${Math.round((aiGen || 0) * 100)}%` : 'N/A'}`)
  console.log(`   Sursă: Sightengine Video API (model genai)\n`)

  console.log(`4. Voice Clone Detection`)
  console.log(`   Rezultat: ${voiceReason || 'N/A'}`)
  console.log(`   Sursă: ${voiceSource === 'deepseek' ? 'DeepSeek (ffprobe metadata + lip-sync → api.deepseek.com)' : voiceSource}\n`)

  console.log(`5. Lip-Sync Integrity`)
  console.log(`   Rezultat: ${lipSync != null ? `${Math.round((lipSync || 0) * 100)}%` : 'N/A'}`)
  console.log(`   Sursă: Calcul local (FFmpeg extractVideoTracks – ratio audio/frames)\n`)

  console.log(`Frames analizate: ${metadata?.framesAnalyzed ?? '—'}`)

  // Verdict (exactly as in app)
  const status = fakeProbability >= 50 ? 'FAKE' : 'REAL'
  const displayScore = fakeProbability >= 50 ? fakeProbability : 100 - fakeProbability

  console.log('\n--- Verdict (ca în aplicație) ---')
  console.log(`Status:   ${status}`)
  console.log(`Scor:     ${displayScore}%`)
  console.log(`          ${status === 'FAKE' ? '(Probabilitate Deepfake)' : '(Încredere autenticitate)'}`)
  console.log(`\nTimp total: ${(totalMs / 1000).toFixed(1)}s`)
}

run().catch(console.error)
