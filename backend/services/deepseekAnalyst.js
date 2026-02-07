/**
 * DeepSeek AI Analyst.
 * Sends Sightengine + ElevenLabs technical results to DeepSeek for contextual interpretation.
 * Explains discrepancies (e.g., Lip-Sync vs visual AI scores). Elite only.
 */

import axios from 'axios'

const DEEPSEEK_URL = 'https://api.deepseek.com/v1/chat/completions'
const SYSTEM_PROMPT = `You are an expert AI analyst for VerifEye. Be clinical and professional. When explaining Lip-Sync vs visual AI discrepancies: a lower lip-sync score (e.g., 79%) often indicates minor lag or compression artifacts, not necessarily a deepfake. Provide concise 2-sentence explanations.`

const LANG_NAMES = { ro: 'Romanian', en: 'English', de: 'German', fr: 'French', es: 'Spanish', it: 'Italian', pt: 'Portuguese' }

/**
 * Generate an executive summary from scan results.
 * For video with lip-sync data: asks why Lip-Sync is at X% while visual AI is at Y%.
 * @param {object} payload - { sightengineRaw?, modelScores?, metadata?, fakeProbability?, status?, aiScore?, lipSyncScore?, language? }
 * @returns {Promise<string | null>} - Executive summary text or null on failure
 */
export async function generateExecutiveSummary(payload) {
  const apiKey = process.env.DEEPSEEK_API_KEY
  if (!apiKey) {
    console.warn('DeepSeek: DEEPSEEK_API_KEY not set. Add it to .env (local) or Render env vars (production) for AI Expert Interpretation.')
    return null
  }

  const dataToAnalyze = {
    sightengine: payload.sightengineRaw ?? null,
    modelScores: payload.modelScores ?? null,
    metadata: payload.metadata ?? null,
    fakeProbability: payload.fakeProbability ?? null,
    status: payload.status ?? null,
  }

  const aiPct = payload.aiScore != null ? Math.round(Number(payload.aiScore)) : null
  const lipSyncPct = payload.lipSyncScore != null ? Math.round(Number(payload.lipSyncScore) * 100) : null

  const lang = LANG_NAMES[payload.language?.split('-')[0]] || payload.language || 'English'
  const langNote = `\n\nIMPORTANT: Respond ONLY in ${lang}.`
  let userContent
  if (aiPct != null && lipSyncPct != null) {
    userContent = `Why is the Lip-Sync at ${lipSyncPct}% while visual AI is at ${aiPct}%? Explain in 2 concise sentences. Use the full JSON below for context:\n\n${JSON.stringify(dataToAnalyze, null, 2)}${langNote}`
  } else {
    userContent = `Analyze these scan results and provide a 2-sentence executive summary:\n\n${JSON.stringify(dataToAnalyze, null, 2)}${langNote}`
  }

  try {
    const res = await axios.post(
      DEEPSEEK_URL,
      {
        model: 'deepseek-chat',
        messages: [
          { role: 'system', content: SYSTEM_PROMPT },
          { role: 'user', content: userContent },
        ],
        max_tokens: 150,
      },
      {
        headers: {
          'Content-Type': 'application/json',
          Authorization: `Bearer ${apiKey}`,
        },
        timeout: 25000,
      }
    )

    const text = res.data?.choices?.[0]?.message?.content?.trim()
    return text || null
  } catch (err) {
    const status = err.response?.status
    const errMsg = err.response?.data?.error?.message ?? err.message
    console.warn('DeepSeek Analyst:', status === 429 ? 'Rate limit' : errMsg)
    return null
  }
}

const VOICE_CLONE_SYSTEM = `You are an expert AI analyst for VerifEye. Assess whether audio metadata and lip-sync data suggest synthetic voice cloning. Be concise: 1-2 sentences. State if there is suspicion of voice cloning (yes/no) and why.`

/**
 * Voice Clone Detection: Ask DeepSeek if audio metadata + Lip-Sync suggest synthetic voice cloning.
 * @param {object} audioMetadata - { bitrate?, sampleRate?, silenceGaps?, hasAudio }
 * @param {number|null} lipSyncScore - Lip-Sync integrity 0-1 (higher = better sync)
 * @returns {Promise<string | null>} - DeepSeek reasoning or null
 */
export async function getVoiceCloneReasoning(audioMetadata, lipSyncScore) {
  const apiKey = process.env.DEEPSEEK_API_KEY
  if (!apiKey) {
    console.warn('DeepSeek: DEEPSEEK_API_KEY not set. Voice Clone reasoning unavailable.')
    return null
  }

  const lipSyncPct = lipSyncScore != null ? Math.round(Number(lipSyncScore) * 100) : null
  const bitrate = audioMetadata?.bitrate != null ? `${audioMetadata.bitrate} bps` : 'unknown'
  const sampleRate = audioMetadata?.sampleRate != null ? `${audioMetadata.sampleRate} Hz` : 'unknown'
  const silenceGaps = audioMetadata?.silenceGaps ?? 'not analyzed'
  const hasAudio = audioMetadata?.hasAudio !== false

  const userContent = `Based on:
- Lip-Sync score: ${lipSyncPct ?? 'N/A'}%
- Audio bitrate: ${bitrate}
- Sample rate: ${sampleRate}
- Silence gaps: ${silenceGaps}
- Has audio track: ${hasAudio}

Is there suspicion of synthetic voice cloning? Answer in 1-2 concise sentences.`

  try {
    const res = await axios.post(
      DEEPSEEK_URL,
      {
        model: 'deepseek-chat',
        messages: [
          { role: 'system', content: VOICE_CLONE_SYSTEM },
          { role: 'user', content: userContent },
        ],
        max_tokens: 150,
      },
      {
        headers: {
          'Content-Type': 'application/json',
          Authorization: `Bearer ${apiKey}`,
        },
        timeout: 25000,
      }
    )

    const text = res.data?.choices?.[0]?.message?.content?.trim()
    return text || null
  } catch (err) {
    const status = err.response?.status
    const errMsg = err.response?.data?.error?.message ?? err.message
    console.warn('DeepSeek Voice Clone:', status === 429 ? 'Rate limit' : errMsg)
    return null
  }
}

const FAKE_NEWS_SYSTEM = `You are an expert Fact-Checker for VerifEye. Analyze news claims for:
1. Logical fallacies (ad hominem, false dilemma, appeal to emotion, etc.)
2. Emotional manipulation (loaded language, fear-mongering)
3. Factual consistency (contradictions, unsupported claims)
4. Overall credibility

Provide a credibility score 0-100 (100 = highly credible, 0 = highly suspicious).
Give a 2-3 sentence analysis. If the text mentions a low lip-sync score or video manipulation, highlight that the speaker's words may have been digitally altered (dubbing/lip-swap).`

/**
 * Fake News / Credibility Detection: Analyze extracted text for logical fallacies, manipulation, and factual consistency.
 * @param {string} extractedText - Text from OCR (images or video frames)
 * @param {number|null} lipSyncScore - Lip-Sync integrity 0-1 (lower = possible dubbing/lip-swap)
 * @param {string} [language] - e.g. 'ro', 'en' - response will be in that language
 * @returns {Promise<{ score: number, reasoning: string } | null>}
 */
export async function analyzeNewsCredibility(extractedText, lipSyncScore, language) {
  const apiKey = process.env.DEEPSEEK_API_KEY
  if (!apiKey) {
    console.warn('DeepSeek: DEEPSEEK_API_KEY not set. Fake News Detection unavailable.')
    return null
  }

  const text = (extractedText || '').trim()
  if (text.length < 10) {
    return { score: 50, reasoning: 'Insufficient text extracted for credibility analysis.' }
  }

  const lipSyncPct = lipSyncScore != null ? Math.round(Number(lipSyncScore) * 100) : null
  const lipSyncNote = lipSyncPct != null && lipSyncPct < 85
    ? `\n\nIMPORTANT: This content has a low Lip-Sync score (${lipSyncPct}%). Highlight if the speaker's words might have been digitally altered (dubbing or lip-swap).`
    : ''

  const lang = LANG_NAMES[language?.split('-')[0]] || language || 'English'
  const userContent = `Analyze this news claim for logical fallacies, emotional manipulation, and factual consistency. Provide a credibility score (0-100) and brief analysis.\n\n--- Extracted text ---\n${text.slice(0, 4000)}${lipSyncNote}\n\n--- End ---\n\nRespond with: "Score: [0-100]" on the first line, then 2-3 sentences of analysis.\n\nIMPORTANT: Respond ONLY in ${lang}.`

  try {
    const res = await axios.post(
      DEEPSEEK_URL,
      {
        model: 'deepseek-chat',
        messages: [
          { role: 'system', content: FAKE_NEWS_SYSTEM },
          { role: 'user', content: userContent },
        ],
        max_tokens: 200,
      },
      {
        headers: {
          'Content-Type': 'application/json',
          Authorization: `Bearer ${apiKey}`,
        },
        timeout: 30000,
      }
    )

    const textResponse = res.data?.choices?.[0]?.message?.content?.trim()
    if (!textResponse) return null

    const scoreMatch = textResponse.match(/Score:\s*(\d+)/i) || textResponse.match(/(\d{1,3})\s*(?:%|out of 100)/i)
    const score = scoreMatch ? Math.max(0, Math.min(100, parseInt(scoreMatch[1], 10))) : 50
    const reasoning = textResponse.replace(/Score:\s*\d+/i, '').trim() || textResponse

    return { score, reasoning }
  } catch (err) {
    const status = err.response?.status
    const errMsg = err.response?.data?.error?.message ?? err.message
    console.warn('DeepSeek Fake News:', status === 429 ? 'Rate limit' : errMsg)
    return {
      score: null,
      reasoning: status === 429 ? 'credibility_error_rate_limit' : 'credibility_error_unavailable',
      error: true,
    }
  }
}
