import { useState, useEffect, useCallback } from 'react'
import { useTranslation } from 'react-i18next'
import { useAuth } from '../context/AuthContext'
import { API_BASE } from '../config.js'
import DashboardHeader from '../components/DashboardHeader'
import VerdictScreen from '../components/VerdictScreen'
import { deriveVerdict } from '../components/VerdictBanner'

const bandOf = (item) => deriveVerdict({ verdict: item.verdict, status: item.status, score: item.score })
const bandClass = (item) => {
  const band = bandOf(item)
  return band === 'likely_ai' ? 'text-red-500' : band === 'likely_real' ? 'text-green-500' : 'text-amber-400'
}

const BackIcon = () => (
  <svg className="w-5 h-5" fill="none" stroke="currentColor" viewBox="0 0 24 24">
    <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M10 19l-7-7m0 0l7-7m-7 7h18" />
  </svg>
)

const TrashIcon = () => (
  <svg className="w-5 h-5" fill="none" stroke="currentColor" viewBox="0 0 24 24">
    <path
      strokeLinecap="round"
      strokeLinejoin="round"
      strokeWidth={2}
      d="M19 7l-.867 12.142A2 2 0 0116.138 21H7.862a2 2 0 01-1.995-1.858L5 7m5 4v6m4-6v6m1-10V4a1 1 0 00-1-1h-4a1 1 0 00-1 1v3M4 7h16"
    />
  </svg>
)

const ChevronIcon = () => (
  <svg className="w-5 h-5 text-slate-500" fill="none" stroke="currentColor" viewBox="0 0 24 24">
    <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M9 5l7 7-7 7" />
  </svg>
)

const FileIcon = ({ type }) => {
  if (type === 'video') {
    return (
      <svg className="w-8 h-8 text-cyan-400" fill="none" stroke="currentColor" viewBox="0 0 24 24">
        <path
          strokeLinecap="round"
          strokeLinejoin="round"
          strokeWidth={2}
          d="M15 10l4.553-2.276A1 1 0 0121 8.618v6.764a1 1 0 01-1.447.894L15 14M5 18h8a2 2 0 002-2V8a2 2 0 00-2-2H5a2 2 0 00-2 2v8a2 2 0 002 2z"
        />
      </svg>
    )
  }
  if (type === 'audio') {
    return (
      <svg className="w-8 h-8 text-purple-400" fill="none" stroke="currentColor" viewBox="0 0 24 24">
        <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M4 12h2l2-6 3 12 3-9 2 6 2-3h2" />
      </svg>
    )
  }
  return (
    <svg className="w-8 h-8 text-slate-400" fill="none" stroke="currentColor" viewBox="0 0 24 24">
      <path
        strokeLinecap="round"
        strokeLinejoin="round"
        strokeWidth={2}
        d="M4 16l4.586-4.586a2 2 0 012.828 0L16 16m-2-2l1.586-1.586a2 2 0 012.828 0L20 14m-6-6h.01M6 20h12a2 2 0 002-2V6a2 2 0 00-2-2H6a2 2 0 00-2 2v12a2 2 0 002 2z"
      />
    </svg>
  )
}

function categoryOf(item) {
  if (item.mediaCategory) return item.mediaCategory
  const ext = (item.fileName || '').split('.').pop()?.toLowerCase()
  if (['mp4', 'mov', 'avi', 'webm', 'mkv'].includes(ext)) return 'video'
  if (['mp3', 'wav', 'ogg', 'm4a', 'aac', 'flac'].includes(ext)) return 'audio'
  return 'image'
}

function formatDate(isoString) {
  const d = new Date(isoString)
  return d.toLocaleString(undefined, {
    year: 'numeric',
    month: 'short',
    day: 'numeric',
    hour: '2-digit',
    minute: '2-digit',
  })
}

/** History rows store the same fields as a scan result; reshape for VerdictScreen. */
function toResult(item) {
  const fakeProbability = item.status === 'FAKE' ? item.score : 100 - (item.score ?? 0)
  return {
    ...item,
    displayScore: item.score,
    fakeProbability,
    expertSummary: item.metadata?.expertSummary ?? null,
    warnings: [],
  }
}

export default function HistoryPage({ onSettingsClick, onUpgradeClick }) {
  const { t } = useTranslation()
  const { user, getAuthHeaders } = useAuth()
  const scansCount = user?.scanCredits ?? 0
  const [history, setHistory] = useState([])
  const [loading, setLoading] = useState(true)
  const [error, setError] = useState(null)
  const [selected, setSelected] = useState(null)
  const [confirmDeleteId, setConfirmDeleteId] = useState(null)
  const [deletingId, setDeletingId] = useState(null)

  const fetchHistory = useCallback(async () => {
    if (!user) return
    setLoading(true)
    setError(null)
    try {
      const res = await fetch(`${API_BASE}/api/history`, { headers: getAuthHeaders() })
      const data = await res.json().catch(() => ({}))
      if (res.ok && data.success) setHistory(data.history ?? [])
      else {
        setError(data.error || t('history.load_failed'))
        setHistory([])
      }
    } catch (err) {
      setError(err.message || t('scan.network_error'))
      setHistory([])
    } finally {
      setLoading(false)
    }
  }, [user, getAuthHeaders, t])

  useEffect(() => {
    fetchHistory()
  }, [fetchHistory])

  useEffect(() => {
    const onVisibilityChange = () => {
      if (document.visibilityState === 'visible') fetchHistory()
    }
    document.addEventListener('visibilitychange', onVisibilityChange)
    return () => document.removeEventListener('visibilitychange', onVisibilityChange)
  }, [fetchHistory])

  const handleDelete = async (item) => {
    setDeletingId(item.id)
    try {
      const res = await fetch(`${API_BASE}/api/history/${encodeURIComponent(item.id)}`, {
        method: 'DELETE',
        headers: getAuthHeaders(),
      })
      const data = await res.json().catch(() => ({}))
      if (!res.ok || !data.success) throw new Error(data.error || t('history.delete_failed'))
      setHistory((h) => h.filter((x) => x.id !== item.id))
      if (selected?.id === item.id) setSelected(null)
    } catch (err) {
      setError(err.message)
    } finally {
      setDeletingId(null)
      setConfirmDeleteId(null)
    }
  }

  if (selected) {
    return (
      <div className="min-h-screen bg-[#0d0d0d] flex flex-col pb-20">
        <header className="flex items-center gap-3 px-4 py-4 border-b border-slate-800 shrink-0">
          <button
            onClick={() => setSelected(null)}
            className="p-2 text-white hover:bg-white/10 rounded-full transition-colors"
            aria-label={t('history.back')}
          >
            <BackIcon />
          </button>
          <div className="min-w-0">
            <h1 className="text-base font-semibold text-white truncate">{selected.fileName}</h1>
            <p className="text-xs text-slate-500">{formatDate(selected.date)}</p>
          </div>
        </header>
        <main className="flex-1 px-4 pt-6 pb-8 overflow-y-auto">
          <VerdictScreen result={toResult(selected)} canDownloadPdf={true} onUpgradeClick={onUpgradeClick} />
        </main>
      </div>
    )
  }

  return (
    <div className="min-h-screen bg-[#0d0d0d] flex flex-col pb-20">
      <DashboardHeader
        scansCount={scansCount}
        userEmail={user?.email}
        subscriptionTier={user?.subscriptionTier}
        onSettingsClick={onSettingsClick}
      />

      <main className="flex-1 flex flex-col w-full max-w-4xl mx-auto px-4 pt-6 pb-8 overflow-y-auto">
        <h1 className="text-xl font-bold text-white text-left mb-6">{t('history.title')}</h1>

        {error && <p className="text-red-400 text-sm mb-4">{error}</p>}

        {loading ? (
          <div className="flex-1 w-full flex flex-col items-center justify-center py-16 px-4 min-h-[240px]">
            <div className="w-8 h-8 border-2 border-cyan-400 border-t-transparent rounded-full animate-spin mb-4" />
            <p className="text-slate-400 text-center">{t('history.loading_archive')}</p>
          </div>
        ) : history.length === 0 ? (
          <div className="flex flex-col items-center justify-center py-16 px-4">
            <p className="text-slate-400 text-center">{t('history.empty')}</p>
          </div>
        ) : (
          <ul className="space-y-3 w-full">
            {history.map((item) => (
              <li
                key={item.id}
                className="w-full flex items-center gap-3 p-4 bg-slate-800/50 rounded-xl border border-slate-700/50"
              >
                <button
                  type="button"
                  onClick={() => setSelected(item)}
                  className="flex items-center gap-4 flex-1 min-w-0 text-left"
                  aria-label={t('history.open')}
                >
                  <FileIcon type={categoryOf(item)} />
                  <div className="min-w-0 flex-1 overflow-hidden">
                    <p className="text-white font-medium truncate">{item.fileName}</p>
                    <p className="text-slate-400 text-sm truncate">{formatDate(item.date)}</p>
                  </div>
                  <div className="flex flex-col items-end gap-0.5 shrink-0">
                    <span className={`text-sm font-bold ${bandClass(item)}`}>
                      {t(`verdict.band_short_${bandOf(item)}`)}
                    </span>
                    <span className="text-slate-500 text-xs">
                      {item.confidence != null
                        ? t('verdict.confidence_short', { value: item.confidence })
                        : `${item.score}%`}
                    </span>
                  </div>
                  <ChevronIcon />
                </button>
                {confirmDeleteId === item.id ? (
                  <div className="flex items-center gap-1 shrink-0">
                    <button
                      type="button"
                      onClick={() => handleDelete(item)}
                      disabled={deletingId === item.id}
                      className="px-2 py-1 rounded-lg bg-red-600 text-white text-xs font-medium disabled:opacity-50"
                    >
                      {t('history.confirm_delete')}
                    </button>
                    <button
                      type="button"
                      onClick={() => setConfirmDeleteId(null)}
                      className="px-2 py-1 rounded-lg text-slate-300 text-xs"
                    >
                      {t('history.cancel')}
                    </button>
                  </div>
                ) : (
                  <button
                    type="button"
                    onClick={() => setConfirmDeleteId(item.id)}
                    className="p-2 rounded-lg text-slate-500 hover:text-red-400 hover:bg-slate-700/80 transition-colors shrink-0"
                    aria-label={t('history.delete')}
                    title={t('history.delete')}
                  >
                    <TrashIcon />
                  </button>
                )}
              </li>
            ))}
          </ul>
        )}
      </main>
    </div>
  )
}
