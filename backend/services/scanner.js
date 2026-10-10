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
import { analyzeProvenance } from './provenance.js'
import { processFactCheckJob } from './factcheck.js'
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
  post: ['factcheck'],
}

export const DEFAULT_MODELS = {
  image: ['genai'],
  video: ['genai', 'deepfake'],
  audio: ['ai_speech'],
  post: ['factcheck'],
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
  if (job.mediaCategory === 'post') return processFactCheckJob(job)
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

    // Content Credentials and generator metadata: local, free, and decisive when present.
    await onProgress('provenance', 90)
    const provenance = await analyzeProvenance({
      filePath: job.filePath,
      mimeType: analysis.metadata?.fileType || job.mimeType || 'application/octet-stream',
      mediaCategory: analysis.mediaCategory,
    }).catch((err) => {
      console.warn('Provenance check failed:', err?.message)
      return null
    })
    const warnings = [...(analysis.warnings ?? [])]
    if (provenance?.tampered) warnings.push('c2pa_tampered')
    if (provenance?.c2pa?.present && provenance.c2pa.validation === 'untrusted') warnings.push('c2pa_untrusted')

    const verdict = computeVerdict({
      fakeProbability: analysis.fakeProbability,
      source: job.source,
      frames: analysis.evidence?.frames ?? null,
      signalCount: analysis.evidence?.signalCount ?? 1,
      betaSignals: analysis.evidence?.betaSignals ?? false,
      provenance,
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
        evidence: verdict.evidence,
        provenance,
        status: verdict.status,
        source: job.source,
        scannedModels: job.models,
        warnings,
        timeline: analysis.timeline ?? null,
        language: job.language,
      })
      if (expertSummary) await saveExpertSummary(fileHash, job.language, expertSummary)
    }
    // Provenance and evidence ride along in metadata so history rows keep them.
    const metadata = {
      ...analysis.metadata,
      ...(expertSummary && { expertSummary }),
      provenance,
      evidence: verdict.evidence,
      warnings,
    }

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
      evidence: verdict.evidence,
      provenance,
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
      warnings,
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
