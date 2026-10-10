/**
 * Short, human-readable interpretation of a scan result. Optional: when the
 * API key is missing or the call fails, the scan still succeeds without it.
 */
import axios from 'axios'
import { config } from '../config.js'

const DEEPSEEK_URL = 'https://api.deepseek.com/v1/chat/completions'

const SYSTEM_PROMPT = `You are the analyst for VerifEye, an AI-generated media detection tool.
You receive a compact description of one scanned image, video or audio file: the verdict already
computed by the system (likely authentic / inconclusive / likely AI-generated), the confidence level
and the reasons it was lowered, the detector scores, the most likely generator families (when the
detector could attribute the file), the image type (photo vs illustration), file metadata and, for
videos, a per-frame timeline.

Write 3 to 4 short sentences for a non-technical reader, in this order:
1. State the verdict in plain words and the overall AI-probability as a percentage.
2. Name the signals that support it (detector scores, generator attribution phrased as "resembles
   output from ...", metadata such as a camera model or editing software, frame timeline peaks).
3. Name the limitations that matter here: the confidence factors, a screenshot source, a beta model,
   a short video with few frames, frames disagreeing, missing metadata (which is weak evidence on its own).
4. One practical next step for the reader (check the original source, compare with other frames, etc.).

Rules: never contradict the given verdict or invent data; never output internal codes such as
likely_real, few_frames or genai; no markdown, no lists, no headings; keep it under 90 words;
generator attribution is a resemblance, not proof of which tool was used.`

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

const VERDICT_WORDS = {
  likely_real: 'likely authentic',
  inconclusive: 'inconclusive',
  likely_ai: 'likely AI-generated',
}

const CONFIDENCE_REASONS = {
  screenshot: 'the file is a screenshot, so compression and re-encoding may hide traces',
  few_frames: 'the video is short and only a few frames could be sampled',
  frames_disagree: 'sampled frames disagree with each other',
  beta_model: 'at least one detector used is a beta model',
}

const pct = (v) => (v == null || Number.isNaN(Number(v)) ? null : Math.round(Number(v) * 100))

function describeTimeline(timeline) {
  if (!Array.isArray(timeline) || timeline.length === 0) return null
  const scores = timeline.map((p) => Number(p.score)).filter((n) => Number.isFinite(n))
  if (scores.length === 0) return null
  const peakIdx = scores.indexOf(Math.max(...scores))
  const peak = timeline[peakIdx]
  return {
    framesSampled: timeline.length,
    minPercent: Math.min(...scores),
    maxPercent: Math.max(...scores),
    peakAtSeconds: peak?.time ?? peak?.timestamp ?? null,
  }
}

/** Builds the compact, model-agnostic description sent to the analyst. */
export function describeScan(payload) {
  const scores = payload.modelScores ?? {}
  const meta = payload.metadata ?? {}
  const sig = payload.aiSignatures ?? {}

  const detectors = {}
  if (scores.ai_generated != null) detectors.aiGeneratedPercent = pct(scores.ai_generated)
  if (scores.deepfake != null) detectors.deepfakePercent = pct(scores.deepfake)
  if (scores.ai_speech != null) detectors.aiSpeechPercent = pct(scores.ai_speech)
  if (scores.quality != null) detectors.imageQualityPercent = pct(scores.quality)

  const generators = Array.isArray(scores.generators)
    ? scores.generators
        .filter((g) => g.score > 0.05)
        .slice(0, 3)
        .map((g) => ({ family: g.id, percent: pct(g.score) }))
    : []

  const imageType = scores.imageType
    ? { photoPercent: pct(scores.imageType.photo), illustrationPercent: pct(scores.imageType.illustration) }
    : null

  const limitations = (payload.confidenceFactors ?? [])
    .map((f) => CONFIDENCE_REASONS[f] ?? String(f).replace(/_/g, ' '))
    .concat(payload.warnings ?? [])

  return {
    mediaType: payload.mediaCategory ?? 'image',
    verdict: VERDICT_WORDS[payload.verdict] ?? VERDICT_WORDS[payload.status] ?? 'inconclusive',
    aiProbabilityPercent: payload.fakeProbability ?? null,
    confidence: payload.confidence ?? null,
    limitations,
    detectors,
    likelyGeneratorFamilies: generators,
    imageType,
    metadata: {
      fileType: meta.fileType ?? null,
      resolution: meta.resolution ?? null,
      duration: meta.duration ?? meta.durationFormatted ?? null,
      hasCameraMetadata: meta.hasExif ? !sig.missingExif : false,
      camera: meta.camera ?? null,
      software: meta.software ?? null,
      aiSoftwareTags: sig.softwareTags ?? [],
      createdAt: meta.createdAt ?? null,
      source: payload.source === 'screenshot' ? 'screenshot captured from the screen' : 'uploaded file',
    },
    frameTimeline: payload.mediaCategory === 'video' ? describeTimeline(payload.timeline) : null,
  }
}

/**
 * @param {{ mediaCategory, modelScores, metadata, aiSignatures, fakeProbability, verdict, confidence,
 *           confidenceFactors, status, source, scannedModels, warnings, timeline, language }} payload
 * @returns {Promise<string | null>}
 */
export async function generateExecutiveSummary(payload) {
  if (!config.deepseekApiKey) return null

  const lang = LANG_NAMES[payload.language?.split('-')[0]] || 'English'
  const userContent = `Scan result:\n${JSON.stringify(describeScan(payload), null, 2)}\n\nRespond ONLY in ${lang}.`

  try {
    const res = await axios.post(
      DEEPSEEK_URL,
      {
        model: 'deepseek-chat',
        messages: [
          { role: 'system', content: SYSTEM_PROMPT },
          { role: 'user', content: userContent },
        ],
        max_tokens: 320,
        temperature: 0.3,
      },
      {
        headers: { 'Content-Type': 'application/json', Authorization: `Bearer ${config.deepseekApiKey}` },
        timeout: 20000,
      }
    )
    const text = res.data?.choices?.[0]?.message?.content?.trim()
    return text || null
  } catch (err) {
    const status = err.response?.status
    console.warn(
      'DeepSeek Analyst:',
      status === 429 ? 'rate limit' : (err.response?.data?.error?.message ?? err.message)
    )
    return null
  }
}
