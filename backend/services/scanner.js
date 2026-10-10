/**
 * Runs one scan job end to end: cache lookup, analysis by media type,
 * verdict, written summary, cache + history persistence, credits refund on
 * failure, temp-file cleanup.
 */
import fs from 'fs'
import { analyzeImage } from './analysis.js'
import { analyzeVideo } from './videoAnalysis.js'
import { analyzeAudio } from './audioAnalysis.js'
import { computeVerdict } from './verdict.js'
import { generateExecutiveSummary } from './deepseekAnalyst.js'
import { findScanByHash, saveScanResults, saveExpertSummary, addToUserScanHistory } from '../db/scans.js'
import { updateJobProgress, completeJob, failJob } from '../db/jobs.js'
import { refundCredits } from '../db/users.js'
import { removeFile, sha256File } from '../lib/storage.js'
import { AppError } from '../lib/errors.js'

export const MODELS_BY_CATEGORY = {
  image: ['genai', 'deepfake', 'type', 'quality'],
  video: ['genai', 'deepfake', 'ai_speech'],
  audio: ['ai_speech'],
}

export const DEFAULT_MODELS = {
  image: ['genai'],
  video: ['genai', 'deepfake'],
  audio: ['ai_speech'],
}

export function modelsForCategory(category, raw) {
  const allowed = MODELS_BY_CATEGORY[category] ?? []
  const list = String(raw || '')
    .split(',')
    .map((m) => m.trim())
    .filter((m) => allowed.includes(m))
  return list.length ? [...new Set(list)] : [...DEFAULT_MODELS[category]]
}

async function analyze(job, cachedResults, onProgress) {
  const { filePath, fileName, models, mediaCategory } = job
  const size = (await fs.promises.stat(filePath)).size
  if (mediaCategory === 'image') {
    await onProgress('analyzing_image', 20)
    const buffer = await fs.promises.readFile(filePath)
    const r = await analyzeImage(buffer, fileName, models, cachedResults)
    return { ...r, mediaCategory: 'image', timeline: null, warnings: [], evidence: { frames: null, signalCount: 1 } }
  }
  if (mediaCategory === 'video') return analyzeVideo(filePath, { fileName, size, models, cachedResults, onProgress })
  if (mediaCategory === 'audio') return analyzeAudio(filePath, { fileName, size, models, cachedResults, onProgress })
  throw new AppError(400, 'Unsupported media type', 'UNSUPPORTED_MEDIA')
}

/**
 * @param {import('../db/schema.js').scanJobs.$inferSelect} job
 * @returns {Promise<object|null>} the result on success, null on failure
 */
export async function processScanJob(job) {
  const onProgress = (stage, progress) => updateJobProgress(job.id, stage, progress).catch(() => {})
  try {
    if (!job.filePath || !fs.existsSync(job.filePath)) {
      throw new AppError(410, 'The uploaded file is no longer available', 'FILE_MISSING')
    }
    await onProgress('hashing', 2)
    const fileHash = job.fileHash || (await sha256File(job.filePath))
    const cached = await findScanByHash(fileHash)

    const analysis = await analyze(job, cached?.results ?? null, onProgress)
    const fromCache = Object.keys(analysis.newModelResults).length === 0
    if (!fromCache) {
      await saveScanResults(fileHash, analysis, analysis.newModelResults)
    }

    const verdict = computeVerdict({
      fakeProbability: analysis.fakeProbability,
      source: job.source,
      frames: analysis.evidence?.frames ?? null,
      signalCount: analysis.evidence?.signalCount ?? 1,
      betaSignals: analysis.evidence?.betaSignals ?? false,
    })

    await onProgress('summarizing', 94)
    let expertSummary = cached?.expertSummaries?.[job.language] ?? null
    if (!expertSummary) {
      expertSummary = await generateExecutiveSummary({
        mediaCategory: analysis.mediaCategory,
        modelScores: analysis.modelScores,
        metadata: analysis.metadata,
        aiSignatures: analysis.aiSignatures,
        fakeProbability: verdict.fakeProbability,
        verdict: verdict.verdict,
        confidence: verdict.confidence,
        confidenceFactors: verdict.confidenceFactors,
        status: verdict.status,
        source: job.source,
        scannedModels: job.models,
        warnings: analysis.warnings ?? [],
        timeline: analysis.timeline ?? null,
        language: job.language,
      })
      if (expertSummary) await saveExpertSummary(fileHash, job.language, expertSummary)
    }
    const metadata = { ...analysis.metadata, ...(expertSummary && { expertSummary }) }

    await addToUserScanHistory(job.userId, {
      fileName: job.fileName,
      score: verdict.displayScore,
      status: verdict.status,
      verdict: verdict.verdict,
      confidence: verdict.confidence,
      source: job.source,
      fileHash,
      modelScores: analysis.modelScores,
      aiSignatures: analysis.aiSignatures,
      scannedModels: job.models,
      metadata,
      mediaCategory: analysis.mediaCategory,
    })

    // Models that could not run (e.g. ai_speech not enabled) are refunded.
    const unavailable = Object.values(analysis.newModelResults).filter((r) => r?.unavailable).length
    if (unavailable > 0 && job.creditsCharged > 0) {
      await refundCredits(job.userId, Math.min(unavailable, job.creditsCharged)).catch(() => {})
    }

    const result = {
      fakeProbability: verdict.fakeProbability,
      aiProbability: analysis.aiProbability ?? verdict.fakeProbability,
      status: verdict.status,
      verdict: verdict.verdict,
      confidence: verdict.confidence,
      confidenceFactors: verdict.confidenceFactors,
      displayScore: verdict.displayScore,
      mediaCategory: analysis.mediaCategory,
      source: job.source,
      fileName: job.fileName,
      fileHash,
      scannedModels: job.models,
      modelScores: analysis.modelScores,
      aiSignatures: analysis.aiSignatures,
      metadata,
      expertSummary,
      timeline: analysis.timeline ?? null,
      warnings: analysis.warnings ?? [],
      cached: fromCache,
      scannedAt: new Date().toISOString(),
    }
    await completeJob(job.id, result, { fileHash })
    return result
  } catch (err) {
    const error =
      err instanceof AppError
        ? { code: err.code ?? 'SCAN_FAILED', message: err.message }
        : { code: 'SCAN_FAILED', message: 'The scan failed because of an internal error' }
    if (!(err instanceof AppError)) console.error(`Scan job ${job.id} failed:`, err)
    if (job.creditsCharged > 0) await refundCredits(job.userId, job.creditsCharged).catch(() => {})
    await failJob(job.id, error)
    return null
  } finally {
    await removeFile(job.filePath)
  }
}
