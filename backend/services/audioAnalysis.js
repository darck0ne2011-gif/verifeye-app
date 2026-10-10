import { probe, extractAudio } from './media.js'
import { detectAiAudio, ProviderError } from './sightengine.js'
import { AppError } from '../lib/errors.js'
import { config } from '../config.js'

export const AUDIO_MODELS = ['ai_speech']

function formatFileSize(bytes) {
  if (bytes < 1024) return `${bytes} B`
  if (bytes < 1024 * 1024) return `${(bytes / 1024).toFixed(1)} KB`
  return `${(bytes / (1024 * 1024)).toFixed(1)} MB`
}

/**
 * Converts the audio to WAV and runs AI-speech detection on it.
 */
export async function analyzeAudio(
  filePath,
  { fileName, size, models, cachedResults = null, onProgress = async () => {} }
) {
  const requested = models.filter((m) => AUDIO_MODELS.includes(m))
  if (requested.length === 0) requested.push('ai_speech')

  await onProgress('probing', 5)
  const info = await probe(filePath)
  if (!info.hasAudio) throw new AppError(400, 'The file has no audio track', 'UNSUPPORTED_MEDIA')
  if (info.durationSec && info.durationSec > config.limits.maxAudioDurationSec) {
    throw new AppError(
      400,
      `Audio longer than ${Math.round(config.limits.maxAudioDurationSec / 60)} minutes is not supported yet`,
      'MEDIA_TOO_LONG'
    )
  }

  const newModelResults = {}
  if (!cachedResults?.ai_speech?.ai_speech) {
    await onProgress('converting_audio', 20)
    const audio = await extractAudio(filePath, { maxSec: config.limits.audioAnalysisSec })
    if (!audio) throw new AppError(400, 'The audio track could not be decoded', 'MEDIA_UNREADABLE')
    await onProgress('analyzing_audio', 40)
    try {
      const res = await detectAiAudio(audio, 'audio.wav', ['ai_speech'])
      newModelResults.ai_speech = { ai_speech: num(res.type?.ai_speech) }
    } catch (err) {
      if (err instanceof ProviderError) {
        if (err.code === 'MODEL_NOT_ENABLED') {
          throw new AppError(503, 'AI speech detection is not enabled on this account yet', 'MODEL_NOT_ENABLED')
        }
        const code = err.code === 'NOT_CONFIGURED' ? 'API_CONFIG_MISSING' : 'PROVIDER_UNAVAILABLE'
        throw new AppError(503, 'The analysis service is currently unavailable. Please try again later.', code)
      }
      throw err
    }
  }

  await onProgress('scoring', 90)
  const merged = { ...(cachedResults ?? {}), ...newModelResults }
  const aiSpeech = merged.ai_speech?.ai_speech ?? null
  if (aiSpeech == null) {
    throw new AppError(503, 'The analysis service returned no result. Please try again later.', 'NO_RESULT')
  }
  const fakeProbability = Math.round(aiSpeech * 100)

  return {
    fakeProbability,
    aiProbability: fakeProbability,
    mediaCategory: 'audio',
    metadata: {
      fileType: 'audio',
      mediaCategory: 'audio',
      size,
      sizeFormatted: formatFileSize(size),
      durationSec: info.durationSec,
      audioCodec: info.audioCodec,
      sampleRate: info.sampleRate,
      analyzedSec: info.durationSec ? Math.min(info.durationSec, config.limits.audioAnalysisSec) : null,
    },
    aiSignatures: null,
    scannedModels: requested,
    modelScores: { ai_generated: null, deepfake: null, ai_speech: aiSpeech, quality: null },
    timeline: null,
    warnings: [],
    evidence: { frames: null, signalCount: 1, betaSignals: true },
    newModelResults,
    mergedResults: merged,
    fileName,
  }
}

function num(v) {
  const n = Number(v)
  return v == null || Number.isNaN(n) ? null : n
}
