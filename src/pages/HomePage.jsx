import { useState, useEffect, useRef, useCallback } from 'react'
import { Link, useLocation, useNavigate, useSearchParams } from 'react-router-dom'
import { useTranslation } from 'react-i18next'
import { useQuery } from '@tanstack/react-query'
import { useAuth } from '../context/AuthContext'
import { createScan, createFactCheck } from '../api/scans'
import { fetchHistory } from '../api/history'
import { rememberFile } from '../lib/fileStore'
import { takeSharedFile } from '../lib/sharedFile'
import { takeStoredPendingFile } from '../native/pendingFileStore'
import { getActiveModels } from '../utils/scanSettings'
import { getMediaCategory } from '../utils/fileType'
import PageHeader from '../components/PageHeader'
import DropZone from '../components/DropZone'
import MediaPreview from '../components/MediaPreview'
import { deriveVerdict } from '../components/VerdictBanner'
import { bandLabel } from './HistoryPage'

const ACCEPTED = /^(image|video|audio)\//i

const MODEL_LABEL_KEY = {
  genai: 'scan_settings.model_genai',
  deepfake: 'scan_settings.model_deepfake',
  type: 'scan_settings.model_metadata',
  quality: 'scan_settings.model_quality',
  ai_speech: 'scan_settings.model_audio_speech',
}

const BAND_CLASS = {
  likely_ai: 'text-ai',
  inconclusive: 'text-unclear',
  likely_real: 'text-real',
  supported: 'text-real',
  contested: 'text-unclear',
  refuted: 'text-ai',
  unverifiable: 'text-muted',
  no_claims: 'text-muted',
}
const FACTCHECK_COST = 2

export default function HomePage() {
  const { t, i18n } = useTranslation()
  const navigate = useNavigate()
  const location = useLocation()
  const [searchParams, setSearchParams] = useSearchParams()
  const { user, getAuthHeaders, refreshUser, logout } = useAuth()
  const credits = user?.scanCredits ?? 0
  const unlimited = !!user?.unlimitedScans || credits >= 999999

  const [file, setFile] = useState(null)
  const [source, setSource] = useState('file')
  const [error, setError] = useState(null)
  const [starting, setStarting] = useState(false)
  const [sharedNote, setSharedNote] = useState(null)
  const [autoStart, setAutoStart] = useState(false)
  const [mode, setMode] = useState('file') // 'file' | 'post'
  const [postText, setPostText] = useState('')
  const [postShot, setPostShot] = useState(null)
  const shotInputRef = useRef(null)
  const fileInputRef = useRef(null)
  const cameraInputRef = useRef(null)

  // Web Share Target: the service worker stored the shared file for us.
  useEffect(() => {
    if (searchParams.get('shared') === '1') {
      takeSharedFile().then((shared) => {
        if (shared && ACCEPTED.test(shared.type || '')) setFile(shared)
        else setSharedNote(t('home.shared_unsupported'))
      })
      setSearchParams({}, { replace: true })
    } else if (searchParams.get('shared_text')) {
      // Text or a link shared from another app: offer the fact-check on it.
      setPostText(searchParams.get('shared_text'))
      setMode('post')
      setSharedNote(t('home.shared_text_prefilled'))
      setSearchParams({}, { replace: true })
    }
  }, [searchParams, setSearchParams, t])

  // Android app: NativeFileBridge parks a shared file or a bubble capture and
  // sends us here with a ticket in the router state. Captures scan right away.
  useEffect(() => {
    if (!location.state?.nativeFile) return
    const pending = takeStoredPendingFile()
    navigate(location.pathname, { replace: true, state: null })
    if (!pending?.file) return
    setError(null)
    setSharedNote(null)
    setSource(pending.source)
    setFile(pending.file)
    setAutoStart(pending.source === 'screenshot')
  }, [location.state, location.pathname, navigate])

  const recent = useQuery({
    queryKey: ['history'],
    queryFn: () => fetchHistory(getAuthHeaders()),
    enabled: !!user,
  })

  const pick = useCallback(
    (files) => {
      const f = files?.[0]
      if (!f) return
      if (!ACCEPTED.test(f.type || '')) {
        setError(t('home.unsupported_file'))
        return
      }
      setError(null)
      setSource('file')
      setFile(f)
    },
    [t]
  )

  const onInputChange = (e) => {
    pick(e.target.files)
    e.target.value = ''
  }

  const category = file ? getMediaCategory(file) : null
  const models = file ? getActiveModels(category) : []
  const cost = models.length
  const canAnalyze = !!file && !starting && (unlimited || credits >= cost)

  const analyze = useCallback(async () => {
    if (!canAnalyze) return
    setStarting(true)
    setError(null)
    try {
      const job = await createScan(file, { models, language: i18n.language || 'en', source }, getAuthHeaders())
      rememberFile(job.id, file)
      refreshUser()
      navigate(`/scan/${job.id}`)
    } catch (err) {
      if (err.status === 401) return logout()
      setError(err.message || t('scan.network_error'))
      setStarting(false)
    }
  }, [canAnalyze, file, models, i18n.language, source, getAuthHeaders, refreshUser, navigate, logout, t])

  useEffect(() => {
    if (!autoStart || !file) return
    setAutoStart(false)
    if (canAnalyze) analyze()
  }, [autoStart, file, canAnalyze, analyze])

  const canFactCheck =
    mode === 'post' &&
    !starting &&
    (postText.trim().length >= 12 || !!postShot) &&
    (unlimited || credits >= FACTCHECK_COST)

  const runFactCheck = async () => {
    if (!canFactCheck) return
    setStarting(true)
    setError(null)
    try {
      const job = await createFactCheck(
        { file: postShot, text: postText.trim(), language: i18n.language || 'en', source: 'file' },
        getAuthHeaders()
      )
      if (postShot) rememberFile(job.id, postShot)
      refreshUser()
      navigate(`/scan/${job.id}`)
    } catch (err) {
      if (err.status === 401) return logout()
      setError(err.message || t('scan.network_error'))
      setStarting(false)
    }
  }

  const onShotChange = (e) => {
    const f = e.target.files?.[0]
    if (f && /^image\//.test(f.type || '')) {
      setPostShot(f)
      setError(null)
    } else if (f) {
      setError(t('home.unsupported_file'))
    }
    e.target.value = ''
  }

  return (
    <div className="animate-fade-in">
      <PageHeader
        title={mode === 'post' ? t('factcheck.title') : t('home.title')}
        subtitle={mode === 'post' ? t('factcheck.subtitle') : t('home.subtitle')}
      />

      <div className="flex gap-2 mb-4" role="tablist" aria-label={t('home.title')}>
        {['file', 'post'].map((m) => (
          <button
            key={m}
            type="button"
            role="tab"
            aria-selected={mode === m}
            onClick={() => {
              setMode(m)
              setError(null)
            }}
            className={`px-4 py-2 rounded-xl text-sm font-medium transition-colors ${
              mode === m ? 'bg-accent-soft text-accent' : 'text-muted bg-surface-2 hover:text-fg'
            }`}
          >
            {t(`factcheck.mode_${m}`)}
          </button>
        ))}
      </div>

      {sharedNote && (
        <p className="mb-4 rounded-xl bg-unclear-soft text-unclear text-sm px-4 py-3" role="status">
          {sharedNote}
        </p>
      )}

      <section className="card p-4 sm:p-5 space-y-4">
        {mode === 'post' ? (
          <>
            <div>
              <label className="label" htmlFor="post-text">
                {t('factcheck.text_label')}
              </label>
              <textarea
                id="post-text"
                className="input min-h-[140px] resize-y"
                placeholder={t('factcheck.text_placeholder')}
                value={postText}
                onChange={(e) => setPostText(e.target.value)}
                maxLength={6000}
              />
            </div>
            {postShot ? (
              <>
                <MediaPreview file={postShot} />
                <div className="flex gap-2">
                  <button type="button" className="btn-ghost text-sm" onClick={() => shotInputRef.current?.click()}>
                    {t('factcheck.change_screenshot')}
                  </button>
                  <button type="button" className="btn-ghost text-sm" onClick={() => setPostShot(null)}>
                    {t('factcheck.remove_screenshot')}
                  </button>
                </div>
              </>
            ) : (
              <button type="button" className="btn-secondary w-full" onClick={() => shotInputRef.current?.click()}>
                {t('factcheck.attach_screenshot')}
              </button>
            )}
            {!unlimited && (
              <p className="text-xs text-muted">
                {t('factcheck.cost', { count: FACTCHECK_COST })} · {t('home.balance', { count: credits })}
              </p>
            )}
            {error && (
              <p className="text-sm text-ai" role="alert">
                {error}
              </p>
            )}
            <button type="button" className="btn-primary w-full" onClick={runFactCheck} disabled={!canFactCheck}>
              {starting ? t('home.starting') : t('factcheck.run')}
            </button>
          </>
        ) : !file ? (
          <DropZone
            disabled={!unlimited && credits <= 0}
            showCredits={false}
            onDrop={pick}
            onTriggerClick={() => fileInputRef.current?.click()}
            onCameraClick={() => cameraInputRef.current?.click()}
          />
        ) : (
          <>
            <MediaPreview file={file} />
            <div className="flex flex-wrap items-center gap-2 text-xs">
              <span className="px-2 py-1 rounded-full bg-surface-2 text-muted uppercase tracking-wide">
                {t(`home.category_${category}`)}
              </span>
              {models.map((m) => (
                <span key={m} className="px-2 py-1 rounded-full bg-accent-soft text-accent">
                  {t(MODEL_LABEL_KEY[m] ?? m)}
                </span>
              ))}
              <Link to="/models" className="text-muted hover:text-fg underline underline-offset-2">
                {t('home.change_models')}
              </Link>
            </div>
            {source === 'screenshot' && <p className="text-xs text-unclear">{t('home.captured_hint')}</p>}
            {!unlimited && (
              <p className="text-xs text-muted">
                {t('home.cost', { count: cost })} · {t('home.balance', { count: credits })}
              </p>
            )}
            {error && (
              <p className="text-sm text-ai" role="alert">
                {error}
              </p>
            )}
            <div className="flex gap-3">
              <button type="button" className="btn-primary flex-1" onClick={analyze} disabled={!canAnalyze}>
                {starting ? t('home.starting') : t('home.analyze')}
              </button>
              <button type="button" className="btn-secondary" onClick={() => setFile(null)} disabled={starting}>
                {t('home.change_file')}
              </button>
            </div>
          </>
        )}
        {mode === 'file' && !file && error && (
          <p className="text-sm text-ai" role="alert">
            {error}
          </p>
        )}
        {mode === 'file' && !file && !unlimited && credits <= 0 && (
          <p className="text-sm text-unclear">{t('home.no_credits')}</p>
        )}
      </section>

      {recent.data?.length > 0 && (
        <section className="mt-6">
          <div className="flex items-center justify-between mb-3">
            <h2 className="text-sm font-semibold text-muted uppercase tracking-wide">{t('home.recent')}</h2>
            <Link to="/history" className="text-sm text-accent hover:text-accent-hover">
              {t('home.see_all')}
            </Link>
          </div>
          <ul className="card divide-y divide-line">
            {recent.data.slice(0, 3).map((item) => {
              const band =
                item.mediaCategory === 'post'
                  ? item.verdict || 'unverifiable'
                  : deriveVerdict({ verdict: item.verdict, status: item.status, score: item.score })
              return (
                <li key={item.id}>
                  <Link
                    to={`/history/${item.id}`}
                    className="flex items-center gap-3 px-4 py-3 hover:bg-surface-2 transition-colors"
                  >
                    <span className="flex-1 min-w-0 truncate text-sm text-fg">{item.fileName}</span>
                    <span className={`text-xs font-semibold ${BAND_CLASS[band] ?? 'text-muted'}`}>
                      {bandLabel(t, item)}
                    </span>
                  </Link>
                </li>
              )
            })}
          </ul>
        </section>
      )}

      <input
        ref={fileInputRef}
        type="file"
        accept="image/*,video/*,audio/*"
        className="hidden"
        onChange={onInputChange}
      />
      <input ref={shotInputRef} type="file" accept="image/*" className="hidden" onChange={onShotChange} />
      <input
        ref={cameraInputRef}
        type="file"
        accept="image/*"
        capture="environment"
        className="hidden"
        onChange={onInputChange}
      />
    </div>
  )
}
