/**
 * DeepSeek Forensic AI Analyst.
 * Sends Sightengine + ElevenLabs technical results to DeepSeek for an executive summary.
 * Elite only.
 */

import axios from 'axios'

const DEEPSEEK_URL = 'https://api.deepseek.com/v1/chat/completions'
const SYSTEM_PROMPT = `You are an elite Digital Forensic Analyst for VerifEye. Analyze the provided technical scores and write a concise, 2-sentence executive summary. Be clinical and professional.`

/**
 * Generate an executive summary from scan results.
 * @param {object} payload - { sightengineRaw?, modelScores?, metadata?, fakeProbability?, status? }
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

  const userContent = `Analyze these forensic scan results and provide a 2-sentence executive summary:\n\n${JSON.stringify(dataToAnalyze, null, 2)}`

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
