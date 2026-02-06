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
    console.warn('DeepSeek: Missing DEEPSEEK_API_KEY. Set in .env')
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
        timeout: 15000,
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
