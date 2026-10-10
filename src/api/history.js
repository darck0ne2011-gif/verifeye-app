import { API_BASE } from '../config.js'

async function request(path, authHeaders, init = {}) {
  const res = await fetch(`${API_BASE}${path}`, { ...init, headers: { ...(init.headers || {}), ...authHeaders } })
  const type = res.headers.get('content-type') || ''
  const data = type.includes('application/json') ? await res.json().catch(() => ({})) : {}
  if (!res.ok || !data.success) {
    const err = new Error(data.error || `Request failed (${res.status})`)
    err.status = res.status
    err.code = data.code
    throw err
  }
  return data
}

export const fetchHistory = (authHeaders) => request('/api/history', authHeaders).then((d) => d.history ?? [])
export const fetchHistoryItem = (id, authHeaders) =>
  request(`/api/history/${encodeURIComponent(id)}`, authHeaders).then((d) => d.item)
export const deleteHistoryItem = (id, authHeaders) =>
  request(`/api/history/${encodeURIComponent(id)}`, authHeaders, { method: 'DELETE' })

/** History rows store the same fields as a scan result; reshape for VerdictScreen. */
export function historyItemToResult(item) {
  const fakeProbability = item.status === 'FAKE' ? item.score : 100 - (item.score ?? 0)
  return {
    ...item,
    displayScore: item.score,
    fakeProbability,
    expertSummary: item.metadata?.expertSummary ?? null,
    warnings: [],
  }
}
