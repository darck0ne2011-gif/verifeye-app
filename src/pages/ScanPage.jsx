import { useState, useCallback, useRef } from 'react'
import { useTranslation } from 'react-i18next'
import { useAuth } from '../context/AuthContext'
import { API_BASE } from '../config.js'
import { addScanToHistory } from '../utils/scanHistory'
import DashboardHeader from '../components/DashboardHeader'
import OverlayButton from '../components/OverlayButton'
import GlobalAlerts from '../components/GlobalAlerts'
import DropZone from '../components/DropZone'
import CircularProgressLoader from '../components/CircularProgressLoader'
import VerdictScreen from '../components/VerdictScreen'
const MIN_SCAN_DURATION_MS = 3000
const PROGRESS_UPDATE_INTERVAL_MS = 30

export default function ScanPage({ onSettingsClick }) {
  const { t } = useTranslation()
  const { user, getAuthHeaders, refreshUser, logout } = useAuth()
  const scansCount = user?.scanCredits ?? 0

  const [selectedFile, setSelectedFile] = useState(null)
  const [view, setView] = useState('idle')
  const [verdictVisible, setVerdictVisible] = useState(false)
  const [deepfakeScore, setDeepfakeScore] = useState(0)
  const [verdictMetadata, setVerdictMetadata] = useState(null)
  const [verdictAiSignatures, setVerdictAiSignatures] = useState(null)
  const [verdictMediaCategory, setVerdictMediaCategory] = useState(null)
  const [uploadError, setUploadError] = useState(null)
  const [scanProgress, setScanProgress] = useState(0)
  const fileInputRef = useRef(null)
  const scansCountRef = useRef(scansCount)
  scansCountRef.current = scansCount

  const handleFileSelect = useCallback((files) => {
    const file = files?.[0]
    if (!file) return
    if (scansCountRef.current <= 0) return

    setSelectedFile(file)
    setUploadError(null)
  }, [])

  const handleStartScan = useCallback(async () => {
    const file = selectedFile
    if (!file || scansCountRef.current <= 0) return

    setUploadError(null)
    setView('scanning')
    setScanProgress(0)

    let apiResult = null

    const runScan = async () => {
      try {
        const formData = new FormData()
        formData.append('file', file)

        const res = await fetch(`${API_BASE}/api/analyze`, {
          method: 'POST',
          headers: getAuthHeaders(),
          body: formData,
        })

        const contentType = res.headers.get('content-type')
        let data = {}
        if (contentType?.includes('application/json')) {
          data = await res.json()
        }

        if (res.status === 401) {
          logout()
          apiResult = { score: 0, error: t('scan.session_expired') }
          return
        }

        if (!res.ok) {
          throw new Error(data.error || `Verification failed (${res.status})`)
        }

        if (!data.success) {
          throw new Error(data.error || 'Verification failed')
        }

        refreshUser()
        apiResult = {
          score: data.fakeProbability ?? 0,
          metadata: data.metadata ?? null,
          aiSignatures: data.aiSignatures ?? null,
          mediaCategory: data.mediaCategory ?? data.metadata?.mediaCategory ?? null,
          error: null,
        }
      } catch (err) {
        console.error(err)
        apiResult = {
          score: 0,
          error: err.message || t('scan.network_error'),
        }
      }
    }

    const startTime = Date.now()
    const progressInterval = setInterval(() => {
      const elapsed = Date.now() - startTime
      const progress = Math.min(100, (elapsed / MIN_SCAN_DURATION_MS) * 100)
      setScanProgress(progress)
    }, PROGRESS_UPDATE_INTERVAL_MS)

    await runScan()

    const elapsed = Date.now() - startTime
    const remaining = Math.max(0, MIN_SCAN_DURATION_MS - elapsed)

    await new Promise((resolve) => setTimeout(resolve, remaining))

    clearInterval(progressInterval)
    setScanProgress(100)

    setDeepfakeScore(apiResult.score)
    setVerdictMetadata(apiResult.metadata ?? null)
    setVerdictAiSignatures(apiResult.aiSignatures ?? null)
    setVerdictMediaCategory(apiResult.mediaCategory ?? null)
    if (apiResult.error) setUploadError(apiResult.error)
    setView('verdict')
    setVerdictVisible(true)

    if (!apiResult.error) addScanToHistory({
      fileName: file.name,
      score: apiResult.score,
      status: apiResult.score >= 50 ? 'FAKE' : 'REAL',
    })
  }, [selectedFile, getAuthHeaders, refreshUser, logout, t])

  const handleBackToScan = useCallback(() => {
    setVerdictVisible(false)
    setUploadError(null)
    setScanProgress(0)
    setVerdictMetadata(null)
    setVerdictAiSignatures(null)
    setVerdictMediaCategory(null)
    setSelectedFile(null)
    setTimeout(() => setView('idle'), 300)
  }, [])

  const handleOverlayClick = useCallback(() => {
    if (view === 'verdict') {
      handleBackToScan()
    } else if (view === 'idle' && selectedFile && scansCountRef.current > 0) {
      handleStartScan()
    }
  }, [view, selectedFile, handleBackToScan, handleStartScan])

  const triggerFileSelect = useCallback(() => {
    if (scansCountRef.current <= 0) return
    fileInputRef.current?.click()
  }, [])

  const overlayDisabled = scansCount <= 0 || (view === 'idle' && !selectedFile)
  const overlayFaded = view === 'idle' && !selectedFile && scansCount > 0

  return (
    <div className="min-h-screen bg-[#0d0d0d] flex flex-col pb-20">
      <DashboardHeader
          scansCount={scansCount}
          userEmail={user?.email}
          onSettingsClick={onSettingsClick}
        />

      <main className="flex-1 flex flex-col items-center px-4 pt-6 pb-8 overflow-y-auto min-h-0">
        {(view === 'idle' || view === 'verdict') && (
          <OverlayButton
            onClick={handleOverlayClick}
            disabled={view === 'verdict' ? false : overlayDisabled}
            faded={view === 'verdict' ? false : overlayFaded}
            mode={view === 'verdict' ? 'newScan' : 'default'}
          />
        )}

        {view === 'idle' && (
          <p className="mt-6 text-slate-400 text-sm text-center max-w-xs shrink-0">
            {t('scan.protection_active')}
          </p>
        )}

        <div className="flex-1 w-full max-w-2xl mt-8 flex flex-col items-center gap-4 min-h-0">
          {view === 'scanning' && (
            <div className="w-full animate-fade-in">
              <CircularProgressLoader progress={scanProgress} fileType={selectedFile} />
            </div>
          )}
          {view === 'verdict' && verdictVisible && (
            <VerdictScreen
              score={deepfakeScore}
              metadata={verdictMetadata}
              aiSignatures={verdictAiSignatures}
              mediaCategory={verdictMediaCategory}
              error={uploadError}
              onBack={handleBackToScan}
            />
          )}
        </div>

        {view === 'idle' && (
          <>
            <div className="w-full max-w-2xl pt-4 shrink-0">
              <DropZone
                disabled={scansCount <= 0}
                selectedFile={selectedFile}
                onDrop={(files) => handleFileSelect(files)}
                onTriggerClick={triggerFileSelect}
                onClearFile={() => setSelectedFile(null)}
              />
            </div>
            <div className="w-full max-w-2xl shrink-0 mt-4">
              <GlobalAlerts />
            </div>
          </>
        )}
      </main>

      <input
        ref={fileInputRef}
        type="file"
        accept="video/*,audio/*,image/*"
        className="hidden"
        onChange={(e) => {
          const files = e.target.files
          if (files?.length) handleFileSelect(files)
          e.target.value = ''
        }}
      />
    </div>
  )
}
