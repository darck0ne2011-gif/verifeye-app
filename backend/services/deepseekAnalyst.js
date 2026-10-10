/**
 * Short, human-readable interpretation of a scan result. Optional: when the
 * API key is missing or the call fails, the scan still succeeds without it.
 */
import axios from 'axios'
import { config } from '../config.js'

const DEEPSEEK_URL = 'https://api.deepseek.com/v1/chat/completions'

const SYSTEM_PROMPT = `You are the analyst for VerifEye, an AI-generated media detection tool.
You receive the numeric output of detection models and file metadata for one image.
Write a clinical, 2-sentence summary for a non-technical reader explaining which signals support the verdict.
Rules: never contradict the given verdict; a missing EXIF block or a common resolution is weak evidence on its own and must not be presented as proof; do not speculate beyond the data.`

const LANG_NAMES = {
  ro: 'Romanian',
  en: 'English',
  de: 'German',
  fr: 'French',
  es: 'Spanish',
  it: 'Italian',
  pt: 'Portuguese',
}

/**
 * @param {{ modelScores, metadata, aiSignatures, fakeProbability, status, language }} payload
 * @returns {Promise<string | null>}
 */
export async function generateExecutiveSummary(payload) {
  if (!config.deepseekApiKey) return null

  const lang = LANG_NAMES[payload.language?.split('-')[0]] || 'English'
  const data = {
    verdict: payload.status,
    fakeProbability: payload.fakeProbability,
    modelScores: payload.modelScores ?? null,
    aiSignatures: payload.aiSignatures ?? null,
    metadata: payload.metadata ?? null,
  }
  const userContent = `Scan result:\n${JSON.stringify(data, null, 2)}\n\nRespond ONLY in ${lang}.`

  try {
    const res = await axios.post(
      DEEPSEEK_URL,
      {
        model: 'deepseek-chat',
        messages: [
          { role: 'system', content: SYSTEM_PROMPT },
          { role: 'user', content: userContent },
        ],
        max_tokens: 200,
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
