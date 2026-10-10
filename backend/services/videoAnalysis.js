import { probe, extractFrames, extractAudio } from './media.js'
import { detectAiImage, detectAiAudio, ProviderError } from './sightengine.js'
import { aggregateFrameScores } from './verdict.js'
import { AppError } from '../lib/errors.js'
import { config } from '../config.js'

export const VIDEO_MODELS = ['genai', 'deepfake', 'ai_speech']
const FRAME_MODELS = ['genai', 'deepfake']

function mapProviderError(err) {
  if (!(err instanceof ProviderError)) return err
  const code = err.code === 'NOT_CONFIGURED' ? 'API_CONFIG_MISSING' : 'PROVIDER_UNAVAILABLE'
  return new AppError(503, 'The analysis service is currently unavailable. Please try again later.', code)
}

function formatFileSize(bytes) {
  if (bytes < 1024) return `${bytes} B`
  if (bytes < 1024 * 1024) return `${(bytes / 1024).toFixed(1)} KB`
  return `${(bytes / (1024 * 1024)).toFixed(1)} MB`
}

/**
 * Samples frames across the video and runs the image detectors on each one;
 * optionally runs AI-speech detection on the audio track.
 *
 * @param {string} filePath
 * @param {{ fileName: string, size: number, models: string[], cachedResults?: object|null,
 *           onProgress?: (stage: string, progress: number) => Promise<void>|void }} opts
 */
export async function analyzeVideo(
  filePath,
  { fileName, size, models, cachedResults = null, onProgress = async () => {} }
) {
  const requested = models.filter((m) => VIDEO_MODELS.includes(m))
  if (requested.length === 0) requested.push('genai')

  await onProgress('probing', 5)
  const info = await probe(filePath)
  if (!info.hasVideo) throw new AppError(400, 'The file has no video track', 'UNSUPPORTED_MEDIA')
  if (info.durationSec && info.durationSec > config.limits.maxVideoDurationSec) {
    throw new AppError(
      400,
      `Videos longer than ${Math.round(config.limits.maxVideoDurationSec / 60)} minutes are not supported yet`,
      'MEDIA_TOO_LONG'
    )
  }

  const missing = requested.filter((m) => !cachedResults?.[m])
  const newModelResults = {}
  const warnings = []

  // --- Frames ---------------------------------------------------------------
  const frameModels = missing.filter((m) => FRAME_MODELS.includes(m))
  let frameTimeline = cachedResults?.genai?.frames ?? cachedResults?.deepfake?.frames ?? null
  if (frameModels.length > 0) {
    await onProgress('extracting_frames', 15)
    const frames = await extractFrames(filePath, { count: config.limits.videoFrames, durationSec: info.durationSec })
    const perFrame = []
    for (let i = 0; i < frames.length; i++) {
      await onProgress('analyzing_frames', 20 + Math.round((50 * i) / frames.length))
      let res
      try {
        res = await detectAiImage(frames[i].buffer, 'image/jpeg', `frame-${i + 1}.jpg`, frameModels)
      } catch (err) {
        throw mapProviderError(err)
      }
      perFrame.push({
        positionSec: frames[i].positionSec,
        ...(frameModels.includes('genai') && { ai_generated: num(res.type?.ai_generated) }),
        ...(frameModels.includes('deepfake') && { deepfake: num(res.type?.deepfake) }),
      })
    }
    frameTimeline = perFrame
    for (const m of frameModels) {
      const key = m === 'genai' ? 'ai_generated' : 'deepfake'
      const scores = perFrame.map((f) => f[key]).filter((v) => v != null)
      newModelResults[m] = {
        [key]: aggregateFrameScores(scores),
        max: scores.length ? Math.max(...scores) : null,
        mean: scores.length ? scores.reduce((a, b) => a + b, 0) / scores.length : null,
        frames: perFrame.map((f) => ({ positionSec: f.positionSec, [key]: f[key] })),
      }
    }
  }

  // --- Audio track ---------------------------------------------------------
  if (missing.includes('ai_speech')) {
    await onProgress('analyzing_audio', 75)
    const audio = info.hasAudio ? await extractAudio(filePath, { maxSec: config.limits.audioAnalysisSec }) : null
    if (!audio) {
      newModelResults.ai_speech = { ai_speech: null, unavailable: 'no_audio_track' }
      warnings.push('no_audio_track')
    } else {
      try {
        const res = await detectAiAudio(audio, 'audio.wav', ['ai_speech'])
        newModelResults.ai_speech = { ai_speech: num(res.type?.ai_speech) }
      } catch (err) {
        if (err instanceof ProviderError && err.code === 'MODEL_NOT_ENABLED') {
          newModelResults.ai_speech = { ai_speech: null, unavailable: 'model_not_enabled' }
          warnings.push('ai_speech_not_enabled')
        } else {
          throw mapProviderError(err)
        }
      }
    }
  }

  await onProgress('scoring', 90)
  const merged = { ...(cachedResults ?? {}), ...newModelResults }
  const signals = []
  const aiGenerated = merged.genai?.ai_generated ?? null
  const deepfake = merged.deepfake?.deepfake ?? null
  const aiSpeech = merged.ai_speech?.ai_speech ?? null
  if (requested.includes('genai') && aiGenerated != null) signals.push(aiGenerated)
  if (requested.includes('deepfake') && deepfake != null) signals.push(deepfake)
  if (requested.includes('ai_speech') && aiSpeech != null) signals.push(aiSpeech)
  if (signals.length === 0) {
    throw new AppError(503, 'The analysis service returned no result. Please try again later.', 'NO_RESULT')
  }
  const fakeProbability = Math.round(Math.max(...signals) * 100)

  const frameScores = (frameTimeline ?? []).map((f) => Math.max(f.ai_generated ?? 0, f.deepfake ?? 0))
  const frames = frameScores.length
    ? { count: frameScores.length, spread: Math.max(...frameScores) - Math.min(...frameScores) }
    : null

  return {
    fakeProbability,
    aiProbability: fakeProbability,
    mediaCategory: 'video',
    metadata: {
      fileType: 'video',
      mediaCategory: 'video',
      size,
      sizeFormatted: formatFileSize(size),
      durationSec: info.durationSec,
      resolution: info.width && info.height ? `${info.width}x${info.height}` : null,
      hasAudio: info.hasAudio,
      videoCodec: info.videoCodec,
      audioCodec: info.audioCodec,
      framesAnalyzed: frameTimeline?.length ?? 0,
      analysisMethod: 'frame_sampling',
    },
    aiSignatures: null,
    scannedModels: requested,
    modelScores: {
      ai_generated: aiGenerated,
      deepfake,
      ai_speech: aiSpeech,
      quality: null,
    },
    timeline: frameTimeline,
    warnings,
    evidence: {
      frames,
      signalCount: signals.length,
      betaSignals: signals.length === 1 && requested.includes('ai_speech') && aiSpeech != null,
    },
    newModelResults,
    mergedResults: merged,
    fileName,
  }
}

function num(v) {
  const n = Number(v)
  return v == null || Number.isNaN(n) ? null : n
}
