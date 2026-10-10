/**
 * External services used by the fact-checker. Kept apart from the logic so
 * tests can replace them.
 *
 *  - DeepSeek (OpenAI-compatible): reads screenshots, extracts claims, judges evidence.
 *  - Google Fact Check Tools: published fact-checks (ClaimReview) from
 *    organisations such as AFP, Reuters, Snopes, Factual.ro, Veridica.
 *  - Tavily or Brave: web search for fresh evidence when no fact-check exists.
 */
import axios from 'axios'
import { config } from '../config.js'

const DEEPSEEK_URL = 'https://api.deepseek.com/chat/completions'
const FACTCHECK_URL = 'https://factchecktools.googleapis.com/v1alpha1/claims:search'
const TAVILY_URL = 'https://api.tavily.com/search'
const BRAVE_URL = 'https://api.search.brave.com/res/v1/web/search'

export class FactCheckProviderError extends Error {
  constructor(code, message) {
    super(message)
    this.name = 'FactCheckProviderError'
    this.code = code // NOT_CONFIGURED | RATE_LIMITED | PROVIDER_ERROR
  }
}

/**
 * One chat completion that must answer with a JSON object.
 * @param {{ system: string, user: string|Array, maxTokens?: number, model?: string }} opts
 */
export async function askModelJson({ system, user, maxTokens = 1200, model = 'deepseek-flash' }) {
  if (!config.deepseekApiKey) throw new FactCheckProviderError('NOT_CONFIGURED', 'DeepSeek API key missing')
  let res
  try {
    res = await axios.post(
      DEEPSEEK_URL,
      {
        model,
        messages: [
          { role: 'system', content: system },
          { role: 'user', content: user },
        ],
        response_format: { type: 'json_object' },
        thinking: { type: 'disabled' },
        max_tokens: maxTokens,
        temperature: 0.2,
      },
      {
        headers: { 'Content-Type': 'application/json', Authorization: `Bearer ${config.deepseekApiKey}` },
        timeout: 60000,
      }
    )
  } catch (err) {
    const status = err.response?.status
    const message = err.response?.data?.error?.message ?? err.message
    if (status === 429) throw new FactCheckProviderError('RATE_LIMITED', 'DeepSeek rate limit reached')
    throw new FactCheckProviderError('PROVIDER_ERROR', `DeepSeek: ${message}`)
  }
  const text = res.data?.choices?.[0]?.message?.content?.trim()
  if (!text) throw new FactCheckProviderError('PROVIDER_ERROR', 'DeepSeek returned an empty answer')
  try {
    return JSON.parse(text)
  } catch {
    const m = text.match(/\{[\s\S]*\}/)
    if (m) {
      try {
        return JSON.parse(m[0])
      } catch {
        // fall through
      }
    }
    throw new FactCheckProviderError('PROVIDER_ERROR', 'DeepSeek returned malformed JSON')
  }
}

/** Builds the multimodal user content for a screenshot plus instructions. */
export function imageContent(buffer, mimeType, text) {
  return [
    { type: 'text', text },
    { type: 'image_url', image_url: { url: `data:${mimeType};base64,${buffer.toString('base64')}` } },
  ]
}

/**
 * Published fact-checks matching a query. Resolves with [] when the API key
 * is not configured or nothing matches.
 * @returns {Promise<Array<{ kind: 'factcheck', claim, claimant, claimDate, publisher, site, url, title, rating, reviewDate, language }>>}
 */
export async function searchFactChecks(query, languageCode = 'en') {
  const key = config.factcheck.googleFactCheckKey
  if (!key || !query) return []
  try {
    const res = await axios.get(FACTCHECK_URL, {
      params: { query: query.slice(0, 300), languageCode, pageSize: 5, key },
      timeout: 15000,
    })
    const out = []
    for (const claim of res.data?.claims ?? []) {
      for (const review of claim.claimReview ?? []) {
        out.push({
          kind: 'factcheck',
          claim: claim.text ?? null,
          claimant: claim.claimant ?? null,
          claimDate: claim.claimDate ?? null,
          publisher: review.publisher?.name ?? review.publisher?.site ?? null,
          site: review.publisher?.site ?? null,
          url: review.url,
          title: review.title ?? null,
          rating: review.textualRating ?? null,
          reviewDate: review.reviewDate ?? null,
          language: review.languageCode ?? null,
        })
      }
    }
    return out.slice(0, 6)
  } catch (err) {
    console.warn('Fact Check API:', err.response?.data?.error?.message ?? err.message)
    return []
  }
}

/** Which web search provider is available, if any. */
export function webSearchProvider() {
  if (config.factcheck.tavilyKey) return 'tavily'
  if (config.factcheck.braveKey) return 'brave'
  return null
}

/**
 * Web search for evidence. Resolves with [] when no provider is configured.
 * @returns {Promise<Array<{ kind: 'web', title, url, snippet, publisher, date }>>}
 */
export async function searchWeb(query, { language = 'en', maxResults = 5 } = {}) {
  const provider = webSearchProvider()
  if (!provider || !query) return []
  try {
    if (provider === 'tavily') {
      const res = await axios.post(
        TAVILY_URL,
        {
          api_key: config.factcheck.tavilyKey,
          query: query.slice(0, 400),
          search_depth: 'basic',
          max_results: maxResults,
          include_answer: false,
          include_raw_content: false,
        },
        { timeout: 20000 }
      )
      return (res.data?.results ?? []).map((r) => ({
        kind: 'web',
        title: r.title ?? null,
        url: r.url,
        snippet: String(r.content ?? '').slice(0, 600),
        publisher: hostOf(r.url),
        date: r.published_date ?? null,
      }))
    }
    const res = await axios.get(BRAVE_URL, {
      params: { q: query.slice(0, 400), count: maxResults, search_lang: language.split('-')[0] },
      headers: { Accept: 'application/json', 'X-Subscription-Token': config.factcheck.braveKey },
      timeout: 20000,
    })
    return (res.data?.web?.results ?? []).map((r) => ({
      kind: 'web',
      title: r.title ?? null,
      url: r.url,
      snippet: String(r.description ?? '').slice(0, 600),
      publisher: hostOf(r.url),
      date: r.page_age ?? r.age ?? null,
    }))
  } catch (err) {
    console.warn(`Web search (${provider}):`, err.response?.data?.message ?? err.message)
    return []
  }
}

function hostOf(url) {
  try {
    return new URL(url).hostname.replace(/^www\./, '')
  } catch {
    return null
  }
}
