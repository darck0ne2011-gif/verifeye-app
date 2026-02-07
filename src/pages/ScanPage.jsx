import { useState, useCallback, useRef, useEffect } from 'react'
import { useTranslation } from 'react-i18next'
import { useAuth } from '../context/AuthContext'
import { API_BASE } from '../config.js'
import { getLastScanResult, setLastScanResult, clearLastScanResult } from '../utils/lastScanResult'
import DashboardHeader from '../components/DashboardHeader'
import OverlayButton from '../components/OverlayButton'
import GlobalAlerts from '../components/GlobalAlerts'
import DropZone from '../components/DropZone'
import CircularProgressLoader from '../components/CircularProgressLoader'
import { getActiveModels, getActiveModelsForCategory, getMaxCreditsPerScan, getVideoAnalysisEngine } from '../utils/scanSettings'
import { getMediaCategory } from '../utils/fileType'
import { getWinningDisplay } from '../utils/verdictScore'
import VerdictScreen from '../components/VerdictScreen'
const MIN_SCAN_DURATION_MS = 3000
const MIN_SCAN_DURATION_MS_VIDEO = 8000

function getMinScanDurationMs(file) {
  const isVideo = file?.type && /^video\//i.test(file.type)
  return isVideo ? MIN_SCAN_DURATION_MS_VIDEO : MIN_SCAN_DURATION_MS
}
const PROGRESS_UPDATE_INTERVAL_MS = 30

export default function ScanPage({ onSettingsClick, onUpgradeClick }) {
  const { t, i18n } = useTranslation()
  const { user, getAuthHeaders, refreshUser, logout } = useAuth()
  const scansCount = user?.scanCredits ?? 0

  const [selectedFile, setSelectedFile] = useState(null)
  const [view, setView] = useState('idle')
  const [verdictVisible, setVerdictVisible] = useState(false)
  const [deepfakeScore, setDeepfakeScore] = useState(0)
  const [verdictStatus, setVerdictStatus] = useState(null)
  const [verdictModelScores, setVerdictModelScores] = useState(null)
  const [verdictMetadata, setVerdictMetadata] = useState(null)
  const [verdictAiSignatures, setVerdictAiSignatures] = useState(null)
  const [verdictMediaCategory, setVerdictMediaCategory] = useState(null)
  const [verdictScannedModels, setVerdictScannedModels] = useState(null)
  const [verdictFileHash, setVerdictFileHash] = useState(null)
  const [verdictFileName, setVerdictFileName] = useState(null)
  const [verdictExpertSummary, setVerdictExpertSummary] = useState(null)
  const [uploadError, setUploadError] = useState(null)
  const [scanProgress, setScanProgress] = useState(0)
  const fileInputRef = useRef(null)
  const scansCountRef = useRef(scansCount)
  scansCountRef.current = scansCount

  useEffect(() => {
    const saved = getLastScanResult()
    if (saved) {
      setDeepfakeScore(saved.score ?? 0)
      setVerdictStatus(saved.status ?? (saved.score >= 50 ? 'FAKE' : 'REAL'))
      setVerdictModelScores(saved.modelScores ?? null)
      setVerdictMetadata(saved.metadata ?? null)
      setVerdictAiSignatures(saved.aiSignatures ?? null)
      setVerdictMediaCategory(saved.mediaCategory ?? null)
      setVerdictScannedModels(saved.scannedModels ?? null)
      setVerdictFileHash(saved.fileHash ?? null)
      setVerdictFileName(saved.fileName ?? null)
      setVerdictExpertSummary(saved.expertSummary ?? saved.metadata?.expertSummary ?? null)
      setUploadError(saved.error ?? null)
      setView('verdict')
      setVerdictVisible(true)
    }
  }, [])

  const handleFileSelect = useCallback((files) => {
    const file = files?.[0]
    if (!file) return
    if (scansCountRef.current <= 0) return

    setSelectedFile(file)
    setUploadError(null)
  }, [])

  const handleStartScan = useCallback(async () => {
    const file = selectedFile
    const mediaCat = getMediaCategory(file)
    const models = getActiveModels(mediaCat)
    const creditsNeeded = models.length
    if (!file || scansCountRef.current < creditsNeeded) return

    setUploadError(null)
    setView('scanning')
    setScanProgress(0)

    let apiResult = null

    const runScan = async () => {
      try {
        const formData = new FormData()
        formData.append('file', file)
        formData.append('models', models.join(','))
        formData.append('language', i18n.language || 'en')
        if (getMediaCategory(file) === 'video') {
          formData.append('videoAnalysisEngine', getVideoAnalysisEngine())
          formData.append('videoModelIds', getActiveModelsForCategory('video').join(','))
        }

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
        const { status, displayScore } = getWinningDisplay(data.fakeProbability ?? 0)
        apiResult = {
          score: displayScore,
          status,
          metadata: data.metadata ?? null,
          aiSignatures: data.aiSignatures ?? null,
          mediaCategory: data.mediaCategory ?? data.metadata?.mediaCategory ?? null,
          scannedModels: data.scannedModels ?? models,
          modelScores: data.modelScores ?? null,
          fileHash: data.fileHash ?? null,
          fileName: file?.name ?? null,
          expertSummary: data.expertSummary ?? data.metadata?.expertSummary ?? null,
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

    const minDuration = getMinScanDurationMs(file)
    const startTime = Date.now()
    const progressInterval = setInterval(() => {
      const elapsed = Date.now() - startTime
      const progress = Math.min(100, (elapsed / minDuration) * 100)
      setScanProgress(progress)
    }, PROGRESS_UPDATE_INTERVAL_MS)

    await runScan()

    const elapsed = Date.now() - startTime
    const remaining = Math.max(0, minDuration - elapsed)

    await new Promise((resolve) => setTimeout(resolve, remaining))

    clearInterval(progressInterval)
    setScanProgress(100)

    setDeepfakeScore(apiResult.score)
    setVerdictStatus(apiResult.status ?? (apiResult.score >= 50 ? 'FAKE' : 'REAL'))
    setVerdictModelScores(apiResult.modelScores ?? null)
    setVerdictMetadata(apiResult.metadata ?? null)
    setVerdictAiSignatures(apiResult.aiSignatures ?? null)
    setVerdictMediaCategory(apiResult.mediaCategory ?? null)
    setVerdictScannedModels(apiResult.scannedModels ?? null)
    setVerdictFileHash(apiResult.fileHash ?? null)
    setVerdictFileName(apiResult.fileName ?? null)
    setVerdictExpertSummary(apiResult.expertSummary ?? null)
    if (apiResult.error) setUploadError(apiResult.error)
    setView('verdict')
    setVerdictVisible(true)

    const status = apiResult.status ?? (apiResult.score >= 50 ? 'FAKE' : 'REAL')
    setLastScanResult({
      score: apiResult.score,
      status,
      modelScores: apiResult.modelScores ?? null,
      metadata: apiResult.metadata ?? null,
      aiSignatures: apiResult.aiSignatures ?? null,
      mediaCategory: apiResult.mediaCategory ?? null,
      scannedModels: apiResult.scannedModels ?? null,
      fileHash: apiResult.fileHash ?? null,
      fileName: apiResult.fileName ?? null,
      expertSummary: apiResult.expertSummary ?? null,
      error: apiResult.error ?? null,
    })

  }, [selectedFile, getAuthHeaders, refreshUser, logout, t])

  const handleBackToScan = useCallback(() => {
    clearLastScanResult()
    setVerdictVisible(false)
    setUploadError(null)
    setScanProgress(0)
    setVerdictStatus(null)
    setVerdictModelScores(null)
    setVerdictMetadata(null)
    setVerdictAiSignatures(null)
    setVerdictMediaCategory(null)
    setVerdictScannedModels(null)
    setVerdictFileHash(null)
    setVerdictFileName(null)
    setVerdictExpertSummary(null)
    setSelectedFile(null)
    setTimeout(() => setView('idle'), 300)
  }, [])

  const handleOverlayClick = useCallback(() => {
    if (view === 'verdict') {
      handleBackToScan()
    } else if (view === 'idle' && selectedFile && scansCountRef.current >= getActiveModels(getMediaCategory(selectedFile)).length) {
      handleStartScan()
    }
  }, [view, selectedFile, handleBackToScan, handleStartScan])

  const triggerFileSelect = useCallback(() => {
    if (scansCountRef.current <= 0) return
    fileInputRef.current?.click()
  }, [])

  const creditsNeeded = selectedFile ? getActiveModels(getMediaCategory(selectedFile)).length : getMaxCreditsPerScan()
  const overlayDisabled = scansCount < creditsNeeded || (view === 'idle' && !selectedFile)
  const overlayFaded = view === 'idle' && !selectedFile && scansCount >= creditsNeeded

  return (
    <div className="min-h-screen bg-[#0d0d0d] flex flex-col pb-20">
      <DashboardHeader
          scansCount={scansCount}
          userEmail={user?.email}
          subscriptionTier={user?.subscriptionTier}
          onSettingsClick={onSettingsClick}
        />

      <main className="flex-1 flex flex-col items-center px-4 pt-6 pb-8 overflow-y-auto min-h-0">
        <div className="w-full max-w-4xl mx-auto flex flex-col items-center">
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

        <div className="flex-1 w-full mt-8 flex flex-col items-center gap-4 min-h-0">
          {view === 'scanning' && (
            <div className="w-full animate-fade-in">
              <CircularProgressLoader progress={scanProgress} fileType={selectedFile} />
            </div>
          )}
          {view === 'verdict' && verdictVisible && (
            <VerdictScreen
              score={deepfakeScore}
              status={verdictStatus}
              modelScores={verdictModelScores}
              metadata={verdictMetadata}
              aiSignatures={verdictAiSignatures}
              mediaCategory={verdictMediaCategory}
              scannedModels={verdictScannedModels}
              fileHash={verdictFileHash}
              fileName={verdictFileName}
              expertSummary={verdictExpertSummary}
              error={uploadError}
              canDownloadPdf={true}
              onUpgradeClick={onUpgradeClick}
              onBack={handleBackToScan}
            />
          )}
        </div>

        {view === 'idle' && (
          <>
            <div className="w-full pt-4 shrink-0">
              <DropZone
                disabled={scansCount < creditsNeeded}
                selectedFile={selectedFile}
                onDrop={(files) => handleFileSelect(files)}
                onTriggerClick={triggerFileSelect}
                onClearFile={() => setSelectedFile(null)}
              />
            </div>
            <div className="w-full max-w-4xl mx-auto shrink-0 mt-4">
              <GlobalAlerts />
            </div>
          </>
        )}
        </div>
      </main>

      <input
        ref={fileInputRef}
        type="file"
        accept="video/mp4,video/quicktime,video/x-msvideo,video/webm,.mp4,.mov,.avi,.webm,audio/*,image/*"
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
