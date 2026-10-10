import { useMemo, useState } from 'react'
import { Link } from 'react-router-dom'
import { useTranslation } from 'react-i18next'
import { useQuery } from '@tanstack/react-query'
import { useAuth } from '../context/AuthContext'
import { fetchHistory } from '../api/history'
import PageHeader from '../components/PageHeader'
import { deriveVerdict } from '../components/VerdictBanner'

const BAND_CLASS = { likely_ai: 'text-ai', inconclusive: 'text-unclear', likely_real: 'text-real' }
const CATEGORIES = ['all', 'image', 'video', 'audio']

export function categoryOf(item) {
  if (item.mediaCategory) return item.mediaCategory
  const ext = (item.fileName || '').split('.').pop()?.toLowerCase()
  if (['mp4', 'mov', 'avi', 'webm', 'mkv'].includes(ext)) return 'video'
  if (['mp3', 'wav', 'ogg', 'm4a', 'aac', 'flac'].includes(ext)) return 'audio'
  return 'image'
}

export function formatDate(isoString) {
  return new Date(isoString).toLocaleString(undefined, {
    year: 'numeric',
    month: 'short',
    day: 'numeric',
    hour: '2-digit',
    minute: '2-digit',
  })
}

const CategoryIcon = ({ type }) => {
  const cls = 'w-5 h-5'
  if (type === 'video') {
    return (
      <svg className={cls} fill="none" stroke="currentColor" viewBox="0 0 24 24">
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
      <svg className={cls} fill="none" stroke="currentColor" viewBox="0 0 24 24">
        <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M4 12h2l2-6 3 12 3-9 2 6 2-3h2" />
      </svg>
    )
  }
  return (
    <svg className={cls} fill="none" stroke="currentColor" viewBox="0 0 24 24">
      <path
        strokeLinecap="round"
        strokeLinejoin="round"
        strokeWidth={2}
        d="M4 16l4.586-4.586a2 2 0 012.828 0L16 16m-2-2l1.586-1.586a2 2 0 012.828 0L20 14m-6-6h.01M6 20h12a2 2 0 002-2V6a2 2 0 00-2-2H6a2 2 0 00-2 2v12a2 2 0 002 2z"
      />
    </svg>
  )
}

export default function HistoryPage() {
  const { t } = useTranslation()
  const { user, getAuthHeaders } = useAuth()
  const [search, setSearch] = useState('')
  const [category, setCategory] = useState('all')

  const query = useQuery({
    queryKey: ['history'],
    queryFn: () => fetchHistory(getAuthHeaders()),
    enabled: !!user,
  })

  const items = useMemo(() => {
    const list = query.data ?? []
    const q = search.trim().toLowerCase()
    return list.filter(
      (item) =>
        (category === 'all' || categoryOf(item) === category) && (!q || (item.fileName || '').toLowerCase().includes(q))
    )
  }, [query.data, search, category])

  return (
    <div className="animate-fade-in">
      <PageHeader title={t('history.title')} subtitle={t('history.subtitle', { count: query.data?.length ?? 0 })} />

      <div className="flex flex-col sm:flex-row gap-2 mb-4">
        <input
          type="search"
          value={search}
          onChange={(e) => setSearch(e.target.value)}
          placeholder={t('history.search')}
          className="input sm:flex-1"
          aria-label={t('history.search')}
        />
        <div className="flex gap-1 p-1 rounded-xl bg-surface-2 border border-line" role="tablist">
          {CATEGORIES.map((c) => (
            <button
              key={c}
              type="button"
              role="tab"
              aria-selected={category === c}
              onClick={() => setCategory(c)}
              className={`flex-1 px-3 py-1.5 rounded-lg text-xs font-medium transition-colors ${
                category === c ? 'bg-accent-soft text-accent' : 'text-muted hover:text-fg'
              }`}
            >
              {t(`history.filter_${c}`)}
            </button>
          ))}
        </div>
      </div>

      {query.isLoading ? (
        <div className="card p-10 flex flex-col items-center">
          <div className="w-8 h-8 border-2 border-accent border-t-transparent rounded-full animate-spin mb-3" />
          <p className="text-muted text-sm">{t('history.loading_archive')}</p>
        </div>
      ) : query.isError ? (
        <div className="card p-6 text-center">
          <p className="text-ai text-sm mb-3">{query.error?.message || t('history.load_failed')}</p>
          <button type="button" className="btn-secondary" onClick={() => query.refetch()}>
            {t('history.retry')}
          </button>
        </div>
      ) : items.length === 0 ? (
        <div className="card p-10 text-center">
          <p className="text-muted text-sm">{query.data?.length ? t('history.no_matches') : t('history.empty')}</p>
          {!query.data?.length && (
            <Link to="/" className="btn-primary mt-4">
              {t('history.start_first')}
            </Link>
          )}
        </div>
      ) : (
        <ul className="card divide-y divide-line">
          {items.map((item) => {
            const band = deriveVerdict({ verdict: item.verdict, status: item.status, score: item.score })
            const type = categoryOf(item)
            return (
              <li key={item.id}>
                <Link
                  to={`/history/${item.id}`}
                  className="flex items-center gap-3 px-4 py-3 hover:bg-surface-2 transition-colors"
                >
                  <span className="w-9 h-9 rounded-xl bg-surface-2 text-muted flex items-center justify-center shrink-0">
                    <CategoryIcon type={type} />
                  </span>
                  <span className="flex-1 min-w-0">
                    <span className="block text-sm font-medium text-fg truncate">{item.fileName}</span>
                    <span className="block text-xs text-muted">{formatDate(item.date)}</span>
                  </span>
                  <span className="text-right shrink-0">
                    <span className={`block text-xs font-bold ${BAND_CLASS[band]}`}>
                      {t(`verdict.band_short_${band}`)}
                    </span>
                    <span className="block text-[11px] text-muted">
                      {item.confidence != null
                        ? t('verdict.confidence_short', { value: item.confidence })
                        : `${item.score}%`}
                    </span>
                  </span>
                </Link>
              </li>
            )
          })}
        </ul>
      )}
    </div>
  )
}
