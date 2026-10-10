/**
 * Fact-checking of a social media post: reads the post (screenshot and/or
 * pasted text), extracts the checkable claims, gathers published fact-checks
 * and web evidence for each, and lets the analyst model judge every claim
 * against that evidence only. Every verdict carries its sources; a claim
 * with no evidence is "unverifiable", never guessed.
 *
 * Runs as a scan job with mediaCategory 'post' (see scanner.js).
 */
import fs from 'fs'
import { fileTypeFromBuffer } from 'file-type'
import { config } from '../config.js'
import { AppError } from '../lib/errors.js'
import { removeFile } from '../lib/storage.js'
import { updateJobProgress, completeJob, failJob } from '../db/jobs.js'
import { refundCredits } from '../db/users.js'
import { addToUserScanHistory } from '../db/scans.js'
import {
  askModelJson,
  imageContent,
  searchFactChecks,
  searchWeb,
  webSearchProvider,
  FactCheckProviderError,
} from './factcheckProviders.js'

export const CLAIM_VERDICTS = ['supported', 'contested', 'refuted', 'unverifiable']
export const POST_VERDICTS = [...CLAIM_VERDICTS, 'no_claims']

const LANG_NAMES = {
  ar: 'Arabic',
  ban: 'Balinese',
  de: 'German',
  en: 'English',
  es: 'Spanish',
  fr: 'French',
  id: 'Indonesian',
  it: 'Italian',
  ko: 'Korean',
  pt: 'Portuguese',
  ro: 'Romanian',
  ru: 'Russian',
  vi: 'Vietnamese',
  zh: 'Chinese',
}

const langName = (code) => LANG_NAMES[String(code || 'en').split('-')[0]] || 'English'
const clip = (s, n) => (s == null ? '' : String(s).slice(0, n))

// --- Step 1: read the post ----------------------------------------------------

const READ_SYSTEM = `You transcribe social media posts from screenshots for a fact-checking tool.
Answer with a JSON object only:
{"platform": string|null, "author": string|null, "date": string|null, "text": string, "imageDescription": string|null, "language": string}
"text" is the post's own text, verbatim, without UI chrome (buttons, counters, comments by others).
"imageDescription" describes any photo or graphic in the post in one sentence, or null.
"language" is the ISO 639-1 code of the post text. Never invent text that is not visible.`

export async function readPost({ filePath, inputText }) {
  const typed = clip(inputText, config.factcheck.maxInputChars).trim()
  if (!filePath) {
    return {
      platform: null,
      author: null,
      date: null,
      text: typed,
      imageDescription: null,
      language: null,
      fromScreenshot: false,
    }
  }
  const buffer = await fs.promises.readFile(filePath)
  const type = await fileTypeFromBuffer(buffer).catch(() => null)
  if (!type || !/^image\//.test(type.mime)) {
    throw new AppError(400, 'Only a screenshot (image) or text can be fact-checked', 'UNSUPPORTED_MEDIA')
  }
  const read = await askModelJson({
    system: READ_SYSTEM,
    user: imageContent(
      buffer,
      type.mime,
      typed
        ? `Transcribe this post. The user also provided this text, which may repeat or complete it:\n${typed}`
        : 'Transcribe this post.'
    ),
    maxTokens: 900,
  })
  const text = [clip(read.text, config.factcheck.maxInputChars), typed && !clip(read.text, 50) ? typed : '']
    .filter(Boolean)
    .join('\n')
    .trim()
  return {
    platform: clip(read.platform, 40) || null,
    author: clip(read.author, 120) || null,
    date: clip(read.date, 60) || null,
    text,
    imageDescription: clip(read.imageDescription, 300) || null,
    language: clip(read.language, 5) || null,
    fromScreenshot: true,
  }
}

// --- Step 2: extract claims ---------------------------------------------------

const CLAIMS_SYSTEM = `You extract checkable factual claims from a social media post for fact-checking.
Answer with a JSON object only:
{"claims": [{"text": string, "checkable": boolean, "reason": string, "searchQuery": string, "entities": [string]}]}
Rules: a claim is checkable when it asserts something about the world that evidence could confirm or refute
(events, numbers, quotes, statements attributed to people, what an image shows). Opinions, predictions,
jokes and vague statements are not checkable. Keep each claim self-contained (resolve "he", "this", dates).
"searchQuery" is a short neutral web search query in the post's language plus key names in their original form.
Return at most 5 claims, most important first. Keep the original language of the post for "text".`

export async function extractClaims(post, language) {
  const body = post.text?.trim()
  if (!body || body.length < 12) return []
  const out = await askModelJson({
    system: CLAIMS_SYSTEM,
    user: `Post${post.author ? ` by ${post.author}` : ''}${post.platform ? ` on ${post.platform}` : ''}${post.date ? ` (${post.date})` : ''}:\n"""${body}"""\n${
      post.imageDescription ? `Attached image: ${post.imageDescription}\n` : ''
    }Interface language: ${langName(language)}.`,
    maxTokens: 900,
  })
  return (Array.isArray(out.claims) ? out.claims : [])
    .filter((c) => c && typeof c.text === 'string' && c.text.trim())
    .map((c, i) => ({
      id: `c${i + 1}`,
      text: clip(c.text, 400).trim(),
      checkable: c.checkable !== false,
      reason: clip(c.reason, 200) || null,
      searchQuery: clip(c.searchQuery, 200).trim() || clip(c.text, 200),
      entities: Array.isArray(c.entities) ? c.entities.slice(0, 6).map((e) => clip(e, 60)) : [],
    }))
    .slice(0, 5)
}

// --- Step 3: gather evidence --------------------------------------------------

export async function gatherEvidence(claims, language) {
  const lang = String(language || 'en').split('-')[0]
  const sources = []
  const seen = new Set()
  const push = (claimId, src) => {
    if (!src.url || seen.has(src.url)) {
      const existing = sources.find((s) => s.url === src.url)
      if (existing && !existing.claimIds.includes(claimId)) existing.claimIds.push(claimId)
      return
    }
    seen.add(src.url)
    sources.push({ id: `s${sources.length + 1}`, claimIds: [claimId], ...src })
  }
  for (const claim of claims) {
    const [fc, web] = await Promise.all([
      searchFactChecks(claim.searchQuery, lang),
      searchWeb(claim.searchQuery, { language: lang, maxResults: 5 }),
    ])
    for (const s of fc) push(claim.id, s)
    for (const s of web) push(claim.id, s)
  }
  return sources
}

// --- Step 4: judge --------------------------------------------------------------

const JUDGE_SYSTEM = `You are the fact-check analyst of VerifEye. You receive claims from a social media post and a
numbered list of sources (published fact-checks with their rating, and web search results with snippets).
Judge each claim ONLY from these sources. Answer with a JSON object only:
{"claims": [{"id": string, "verdict": "supported"|"contested"|"refuted"|"unverifiable", "confidence": 0-100,
  "explanation": string, "sourceIds": [string]}],
 "overall": {"verdict": "supported"|"contested"|"refuted"|"unverifiable", "summary": string}}
Rules:
- "supported": reliable sources confirm it. "refuted": reliable sources or published fact-checks contradict it.
  "contested": sources disagree or the claim is partly true / misleading context. "unverifiable": no relevant
  source among those given. A published fact-check outranks search snippets.
- sourceIds must only contain ids from the list, and only sources that actually bear on that claim.
- Never use outside knowledge to decide a verdict; you may use it only to explain context, and say so.
- Explanations and the summary are 1-3 plain sentences for a non-expert, written in the requested language,
  mentioning dates when the claim is time-sensitive. No markdown.
- The overall verdict follows the most important claims: any refuted central claim makes the post "refuted";
  all supported makes "supported"; otherwise "contested", or "unverifiable" when nothing could be checked.`

export async function judgeClaims(post, claims, sources, language) {
  const sourceLines = sources.map((s) =>
    s.kind === 'factcheck'
      ? `[${s.id}] FACT-CHECK by ${s.publisher ?? s.site ?? 'unknown'} (${s.reviewDate ?? 'n.d.'}): claim "${clip(s.claim, 200)}" rated "${s.rating ?? '?'}". ${clip(s.title, 150)} ${s.url}`
      : `[${s.id}] WEB ${s.publisher ?? ''} (${s.date ?? 'n.d.'}): ${clip(s.title, 120)} — ${clip(s.snippet, 400)} ${s.url}`
  )
  const claimLines = claims.map((c) => `(${c.id}) ${c.text}`)
  const out = await askModelJson({
    system: JUDGE_SYSTEM,
    user: `Post${post.author ? ` by ${post.author}` : ''}${post.date ? ` (${post.date})` : ''}:\n"""${clip(post.text, 1500)}"""\n\nClaims:\n${claimLines.join('\n')}\n\nSources:\n${
      sourceLines.length ? sourceLines.join('\n') : '(none found)'
    }\n\nWrite explanations and the summary in ${langName(language)}.`,
    maxTokens: 1400,
  })
  const byId = new Map(claims.map((c) => [c.id, c]))
  const validSource = new Set(sources.map((s) => s.id))
  const judged = (Array.isArray(out.claims) ? out.claims : [])
    .filter((j) => byId.has(j.id))
    .map((j) => {
      const sourceIds = (Array.isArray(j.sourceIds) ? j.sourceIds : []).filter((id) => validSource.has(id))
      let verdict = CLAIM_VERDICTS.includes(j.verdict) ? j.verdict : 'unverifiable'
      if (sourceIds.length === 0 && verdict !== 'unverifiable') verdict = 'unverifiable'
      return {
        ...byId.get(j.id),
        verdict,
        confidence: Math.max(0, Math.min(100, Math.round(Number(j.confidence) || 0))),
        explanation: clip(j.explanation, 700).trim() || null,
        sourceIds,
      }
    })
  for (const c of claims) {
    if (!judged.find((j) => j.id === c.id))
      judged.push({ ...c, verdict: 'unverifiable', confidence: 0, explanation: null, sourceIds: [] })
  }
  const overall = CLAIM_VERDICTS.includes(out.overall?.verdict) ? out.overall.verdict : overallFrom(judged)
  return { claims: judged, overall, summary: clip(out.overall?.summary, 900).trim() || null }
}

export function overallFrom(claims) {
  const v = claims.map((c) => c.verdict)
  if (v.length === 0) return 'no_claims'
  if (v.includes('refuted')) return 'refuted'
  if (v.every((x) => x === 'supported')) return 'supported'
  if (v.every((x) => x === 'unverifiable')) return 'unverifiable'
  return 'contested'
}

// --- Pipeline -----------------------------------------------------------------

/**
 * @param {{ filePath?: string|null, inputText?: string|null, language?: string, onProgress?: Function }} input
 */
export async function factCheckPost({
  filePath = null,
  inputText = null,
  language = 'en',
  onProgress = async () => {},
}) {
  if (!config.factcheck.configured) {
    throw new AppError(503, 'Fact-checking is not configured on this server', 'FACTCHECK_NOT_CONFIGURED')
  }
  const warnings = []
  await onProgress('reading_post', 10)
  const post = await readPost({ filePath, inputText })
  if (!post.text || post.text.trim().length < 12) {
    throw new AppError(400, 'No readable text was found in the post', 'NO_TEXT')
  }
  if (/^https?:\/\/\S+$/i.test(post.text.trim())) warnings.push('link_only')

  await onProgress('extracting_claims', 30)
  const all = await extractClaims(post, language)
  const claims = all.filter((c) => c.checkable).slice(0, config.factcheck.maxClaims)
  const skipped = all.filter((c) => !c.checkable)
  if (!config.factcheck.googleFactCheckKey) warnings.push('no_factcheck_api')
  if (!webSearchProvider()) warnings.push('no_web_search')

  let judged = { claims: [], overall: 'no_claims', summary: null }
  let sources = []
  if (claims.length > 0) {
    await onProgress('searching', 50)
    sources = await gatherEvidence(claims, post.language || language)
    await onProgress('judging', 80)
    judged = await judgeClaims(post, claims, sources, language)
  }
  const confidence =
    judged.claims.length === 0
      ? 0
      : Math.round(judged.claims.reduce((a, c) => a + c.confidence, 0) / judged.claims.length)

  return {
    mediaCategory: 'post',
    verdict: judged.overall,
    confidence,
    summary: judged.summary,
    post,
    claims: judged.claims,
    skippedClaims: skipped.map((c) => ({ text: c.text, reason: c.reason })),
    sources,
    providers: {
      factcheckApi: !!config.factcheck.googleFactCheckKey,
      webSearch: webSearchProvider(),
    },
    warnings,
  }
}

/**
 * Runs a 'post' job end to end (see scanner.processScanJob for media jobs).
 * @returns {Promise<object|null>} the result on success, null on failure
 */
export async function processFactCheckJob(job) {
  const onProgress = (stage, progress) => updateJobProgress(job.id, stage, progress).catch(() => {})
  try {
    if (job.filePath && !fs.existsSync(job.filePath)) {
      throw new AppError(410, 'The uploaded file is no longer available', 'FILE_MISSING')
    }
    const analysis = await factCheckPost({
      filePath: job.filePath,
      inputText: job.inputText,
      language: job.language,
      onProgress,
    })
    const result = {
      ...analysis,
      source: job.source,
      fileName: job.fileName,
      scannedModels: job.models,
      scannedAt: new Date().toISOString(),
    }
    await addToUserScanHistory(job.userId, {
      fileName: job.fileName,
      score: result.confidence,
      status: result.verdict === 'refuted' ? 'FAKE' : 'REAL',
      verdict: result.verdict,
      confidence: result.confidence,
      source: job.source,
      fileHash: job.fileHash ?? null,
      modelScores: null,
      aiSignatures: null,
      scannedModels: job.models,
      metadata: {
        mediaCategory: 'post',
        factcheck: {
          summary: result.summary,
          post: result.post,
          claims: result.claims,
          skippedClaims: result.skippedClaims,
          sources: result.sources,
          providers: result.providers,
          warnings: result.warnings,
        },
      },
      mediaCategory: 'post',
    })
    await completeJob(job.id, result, { fileHash: job.fileHash ?? null })
    return result
  } catch (err) {
    const error =
      err instanceof AppError
        ? { code: err.code ?? 'SCAN_FAILED', message: err.message }
        : err instanceof FactCheckProviderError
          ? {
              code: err.code === 'NOT_CONFIGURED' ? 'FACTCHECK_NOT_CONFIGURED' : 'PROVIDER_UNAVAILABLE',
              message: 'The fact-checking service is currently unavailable. Please try again later.',
            }
          : { code: 'SCAN_FAILED', message: 'The fact-check failed because of an internal error' }
    if (!(err instanceof AppError) && !(err instanceof FactCheckProviderError)) {
      console.error(`Fact-check job ${job.id} failed:`, err)
    }
    if (job.creditsCharged > 0) await refundCredits(job.userId, job.creditsCharged).catch(() => {})
    await failJob(job.id, error)
    return null
  } finally {
    if (job.filePath) await removeFile(job.filePath)
  }
}
