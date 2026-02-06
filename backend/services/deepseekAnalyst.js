/**
 * DeepSeek Forensic AI Analyst.
 * Sends Sightengine + ElevenLabs technical results to DeepSeek for contextual interpretation.
 * Explains discrepancies (e.g., Lip-Sync vs visual AI scores). Elite only.
 */

import axios from 'axios'

const DEEPSEEK_URL = 'https://api.deepseek.com/v1/chat/completions'
const SYSTEM_PROMPT = `You are an elite Digital Forensic Analyst for VerifEye. Be clinical and professional. When explaining Lip-Sync vs visual AI discrepancies: a lower lip-sync score (e.g., 79%) often indicates minor lag or compression artifacts, not necessarily a deepfake. Provide concise 2-sentence explanations.`

/**
 * Generate an executive summary from scan results.
 * For video with lip-sync data: asks why Lip-Sync is at X% while visual AI is at Y%.
 * @param {object} payload - { sightengineRaw?, modelScores?, metadata?, fakeProbability?, status?, aiScore?, lipSyncScore? }
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

  let userContent
  if (aiPct != null && lipSyncPct != null) {
    userContent = `Why is the Lip-Sync at ${lipSyncPct}% while visual AI is at ${aiPct}%? Explain in 2 concise sentences. Use the full JSON below for context:\n\n${JSON.stringify(dataToAnalyze, null, 2)}`
  } else {
    userContent = `Analyze these forensic scan results and provide a 2-sentence executive summary:\n\n${JSON.stringify(dataToAnalyze, null, 2)}`
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

const VOICE_CLONE_SYSTEM = `You are an elite Digital Forensic Analyst for VerifEye. Assess whether audio metadata and lip-sync data suggest synthetic voice cloning. Be concise: 1-2 sentences. State if there is forensic suspicion of voice cloning (yes/no) and why.`

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

Is there a forensic suspicion of synthetic voice cloning? Answer in 1-2 concise sentences.`

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
