/**
 * Fake News Detection for photo posts.
 * Sends extracted OCR text + Sightengine AI Pixel Analysis score to DeepSeek.
 * Cross-references for emotional manipulation, out-of-context images, logical fallacies.
 */

import axios from 'axios'

const DEEPSEEK_URL = 'https://api.deepseek.com/v1/chat/completions'

const LANG_NAMES = { ro: 'Romanian', en: 'English', de: 'German', fr: 'French', es: 'Spanish', it: 'Italian', pt: 'Portuguese' }

const FACT_CHECK_SYSTEM = `You are an expert Fact-Checker for VerifEye's Fake News Detection. Analyze social media posts (screenshots, memes, photo posts) for:
1. Emotional manipulation (loaded language, fear-mongering, outrage bait)
2. Out-of-context images (text claiming something the image may not support)
3. Logical fallacies (ad hominem, false dilemma, appeal to emotion, etc.)
4. Credibility signals vs. AI-generated image indicators

You receive: extracted text from the image/screenshot + Image AI Score (0-100, higher = more likely AI-generated).
Cross-reference the text with the AI score: if the image is likely AI-generated but the text presents it as "real photo" or "proof", that's a red flag.
Respond with a structured format.`

/**
 * Analyze a photo post for fake news / credibility.
 * @param {string} extractedText - Text from OCR (tesseract.js)
 * @param {number|null} aiPixelScore - Sightengine AI Pixel Analysis score 0-100 (higher = more AI-generated)
 * @param {string} [language] - e.g. 'ro', 'en' - response will be in that language
 * @returns {Promise<{ credibilityRating: 'Low'|'Medium'|'High', score: number, reasoning: string, redFlags: string[] } | { error: boolean, score?: null, reasoning: string } | null>}
 */
export async function analyzePhotoPostFactCheck(extractedText, aiPixelScore, language) {
  const apiKey = process.env.DEEPSEEK_API_KEY
  if (!apiKey) {
    console.warn('DeepSeek: DEEPSEEK_API_KEY not set. Fake News Detection unavailable.')
    return null
  }

  const text = (extractedText || '').trim()
  if (text.length < 5) {
    return {
      credibilityRating: 'Medium',
      score: 50,
      reasoning: 'Insufficient text extracted from the image for credibility analysis.',
      redFlags: [],
    }
  }

  const aiScoreStr = aiPixelScore != null ? `${Math.round(Number(aiPixelScore))}%` : 'N/A'
  const lang = LANG_NAMES[language?.split('-')[0]] || language || 'English'

  const userContent = `Analyze this social media post.

Text: ${text.slice(0, 4000)}

Image AI Score: ${aiScoreStr} (0-100, higher = more likely AI-generated image)

Cross-reference for emotional manipulation, out-of-context images, and logical fallacies.

Respond in this EXACT format:

Credibility Rating: [Low|Medium|High]
Red Flags:
- [red flag 1]
- [red flag 2]
(omit this section if none)
Analysis: [2-3 sentences explaining your assessment]

IMPORTANT: Respond ONLY in ${lang}.`

  try {
    const res = await axios.post(
      DEEPSEEK_URL,
      {
        model: 'deepseek-chat',
        messages: [
          { role: 'system', content: FACT_CHECK_SYSTEM },
          { role: 'user', content: userContent },
        ],
        max_tokens: 300,
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

    // Parse Credibility Rating
    const ratingMatch = textResponse.match(/Credibility Rating:\s*(Low|Medium|High)/i)
    const credibilityRating = ratingMatch
      ? (ratingMatch[1].charAt(0).toUpperCase() + ratingMatch[1].slice(1).toLowerCase())
      : 'Medium'

    // Map rating to score for backward compatibility
    const scoreMap = { Low: 25, Medium: 50, High: 75 }
    const score = scoreMap[credibilityRating] ?? 50

    // Parse Red Flags (lines after "Red Flags:" until "Analysis:" or end)
    const redFlags = []
    const redFlagsMatch = textResponse.match(/Red Flags:\s*\n([\s\S]*?)(?=Analysis:|$)/i)
    if (redFlagsMatch) {
      const block = redFlagsMatch[1].trim()
      const lines = block.split('\n').map((l) => l.replace(/^-\s*/, '').trim()).filter(Boolean)
      redFlags.push(...lines)
    }

    // Parse Analysis
    const analysisMatch = textResponse.match(/Analysis:\s*([\s\S]+)/i)
    const reasoning = analysisMatch ? analysisMatch[1].trim() : textResponse

    return {
      credibilityRating,
      score,
      reasoning,
      redFlags,
    }
  } catch (err) {
    const status = err.response?.status
    const errMsg = err.response?.data?.error?.message ?? err.message
    console.warn('DeepSeek Fact-Check:', status === 429 ? 'Rate limit' : errMsg)
    return {
      score: null,
      reasoning: status === 429 ? 'credibility_error_rate_limit' : 'credibility_error_unavailable',
      redFlags: [],
      error: true,
    }
  }
}
