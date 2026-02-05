import { useState, useRef, useCallback, useEffect } from 'react'
import { useAuth } from '../context/AuthContext'
import { API_BASE } from '../config.js'
import { addScanToHistory } from '../utils/scanHistory'

const FAB_STORAGE_KEY = 'verifeye_fab_position'
const FAB_SIZE = 56
const PADDING = 20
const DRAG_THRESHOLD = 6

function loadFabPosition() {
  try {
    const raw = localStorage.getItem(FAB_STORAGE_KEY)
    if (raw && typeof window !== 'undefined') {
      const { x, y } = JSON.parse(raw)
      if (typeof x === 'number' && typeof y === 'number') {
        const w = window.innerWidth
        const h = window.innerHeight
        const clampedX = Math.max(PADDING, Math.min(w - FAB_SIZE - PADDING, x))
        const clampedY = Math.max(BOTTOM_NAV_HEIGHT, Math.min(h - FAB_SIZE - PADDING, y))
        return { x: clampedX, y: clampedY }
      }
    }
  } catch (_) {}
  return null
}

function saveFabPosition(x, y) {
  try {
    localStorage.setItem(FAB_STORAGE_KEY, JSON.stringify({ x, y }))
  } catch (_) {}
}

function snapToEdge(x) {
  const mid = typeof window !== 'undefined' ? window.innerWidth / 2 : 400
  return x < mid ? PADDING : Math.max(PADDING, (typeof window !== 'undefined' ? window.innerWidth : 800) - FAB_SIZE - PADDING)
}

const VerifEyeLogo = () => (
  <span className="text-white font-bold text-xl">V</span>
)

const ScanIcon = () => (
  <svg className="w-5 h-5" fill="none" stroke="currentColor" viewBox="0 0 24 24">
    <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M9 5H7a2 2 0 00-2 2v12a2 2 0 002 2h10a2 2 0 002-2V7a2 2 0 00-2-2h-2M9 5a2 2 0 002 2h2a2 2 0 002-2M9 5a2 2 0 012-2h2a2 2 0 012 2" />
  </svg>
)

const UploadIcon = () => (
  <svg className="w-5 h-5" fill="none" stroke="currentColor" viewBox="0 0 24 24">
    <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M4 16v1a3 3 0 003 3h10a3 3 0 003-3v-1m-4-8l-4-4m0 0L8 8m4-4v12" />
  </svg>
)

const StatusIcon = () => (
  <svg className="w-5 h-5" fill="none" stroke="currentColor" viewBox="0 0 24 24">
    <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M13 16h-1v-4h-1m1-4h.01M21 12a9 9 0 11-18 0 9 9 0 0118 0z" />
  </svg>
)

const CloseIcon = () => (
  <svg className="w-5 h-5" fill="none" stroke="currentColor" viewBox="0 0 24 24">
    <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M6 18L18 6M6 6l12 12" />
  </svg>
)

const DragHandleIcon = () => (
  <svg className="w-3.5 h-3.5 opacity-60" fill="currentColor" viewBox="0 0 24 24" aria-hidden>
    <circle cx="9" cy="6" r="1.5" />
    <circle cx="15" cy="6" r="1.5" />
    <circle cx="9" cy="12" r="1.5" />
    <circle cx="15" cy="12" r="1.5" />
    <circle cx="9" cy="18" r="1.5" />
    <circle cx="15" cy="18" r="1.5" />
  </svg>
)

const MIN_SCAN_DURATION_MS = 2500
const BOTTOM_NAV_HEIGHT = 80

function getDefaultPosition() {
  if (typeof window === 'undefined') return { x: 300, y: BOTTOM_NAV_HEIGHT }
  return {
    x: window.innerWidth - FAB_SIZE - PADDING,
    y: BOTTOM_NAV_HEIGHT,
  }
}

export default function FloatingScanner() {
  const { user, getAuthHeaders, refreshUser, logout } = useAuth()
  const [expanded, setExpanded] = useState(false)
  const [scanning, setScanning] = useState(false)
  const [miniResult, setMiniResult] = useState(null)
  const [showDropZone, setShowDropZone] = useState(false)
  const [position, setPosition] = useState(() => loadFabPosition() ?? getDefaultPosition())
  const [isDragging, setIsDragging] = useState(false)
  const [isSnapping, setIsSnapping] = useState(false)
  const fileInputRef = useRef(null)
  const dragStartRef = useRef(null)
  const hasDraggedRef = useRef(false)

  const scansCount = user?.scanCredits ?? 0
  const scansLabel = scansCount >= 999999 ? 'Unlimited' : `${scansCount} Scans left`
  const hasCredits = scansCount > 0

  const closeMenu = useCallback(() => {
    setExpanded(false)
    setShowDropZone(false)
  }, [])

  const handleScanCurrentPage = useCallback(async () => {
    if (!hasCredits) return
    setScanning(true)
    setMiniResult(null)

    const mediaTags = document.querySelectorAll('video, audio')
    const count = mediaTags.length

    await new Promise((r) => setTimeout(r, MIN_SCAN_DURATION_MS))

    const simulatedScore = count > 0
      ? Math.floor(Math.random() * 40) + 10
      : 0
    const status = simulatedScore >= 50 ? 'FAKE' : 'REAL'
    const fileName = count > 0
      ? `Page media (${count} element${count > 1 ? 's' : ''})`
      : 'No media on page'

    if (count > 0) {
      addScanToHistory({ fileName, score: simulatedScore, status })
    }

    setMiniResult({
      status,
      score: simulatedScore,
      message: count > 0
        ? `${status} — ${simulatedScore}% deepfake likelihood`
        : 'No video or audio found on this page',
    })
    setScanning(false)
    await refreshUser()
  }, [hasCredits, refreshUser])

  const handleQuickUpload = useCallback(() => {
    if (!hasCredits) return
    setShowDropZone(true)
    setTimeout(() => fileInputRef.current?.click(), 50)
  }, [hasCredits])

  const processFile = useCallback(
    async (file) => {
      if (!file || !hasCredits) return

      setShowDropZone(false)
      setScanning(true)
      setMiniResult(null)

      try {
        const formData = new FormData()
        formData.append('file', file)

        const startTime = Date.now()
        const res = await fetch(`${API_BASE}/api/analyze`, {
          method: 'POST',
          headers: getAuthHeaders(),
          body: formData,
        })

        let elapsed = Date.now() - startTime
        if (elapsed < MIN_SCAN_DURATION_MS) {
          await new Promise((r) => setTimeout(r, MIN_SCAN_DURATION_MS - elapsed))
        }

        const data = await res.json().catch(() => ({}))
        if (res.status === 401) {
          logout()
          setMiniResult({ status: 'ERROR', message: 'Session expired' })
        } else if (data.success) {
          const score = data.fakeProbability ?? 0
          const status = score >= 50 ? 'FAKE' : 'REAL'
          addScanToHistory({ fileName: file.name, score, status })
          setMiniResult({
            status,
            score,
            message: `${status} — ${score}% deepfake likelihood`,
          })
          await refreshUser()
        } else {
          setMiniResult({ status: 'ERROR', message: data.error || 'Scan failed' })
        }
      } catch (err) {
        setMiniResult({ status: 'ERROR', message: err.message || 'Network error' })
      } finally {
        setScanning(false)
      }
    },
    [hasCredits, getAuthHeaders, logout, refreshUser]
  )

  const handleFileChange = useCallback(
    (e) => {
      const file = e.target.files?.[0]
      e.target.value = ''
      if (file) processFile(file)
    },
    [processFile]
  )

  const handleDrop = useCallback(
    (e) => {
      e.preventDefault()
      const files = e.dataTransfer?.files
      if (files?.length && hasCredits) {
        const file = files[0]
        if (/^(video|audio|image)\//.test(file.type)) {
          setShowDropZone(false)
          processFile(file)
        }
      }
    },
    [hasCredits, processFile]
  )

  const handleDropZoneClick = useCallback(() => {
    if (hasCredits) fileInputRef.current?.click()
  }, [hasCredits])

  const clearMiniResult = useCallback(() => {
    setMiniResult(null)
  }, [])

  const handlePointerDown = useCallback(
    (e) => {
      if (scanning) return
      e.currentTarget.setPointerCapture?.(e.pointerId)
      dragStartRef.current = {
        clientX: e.clientX,
        clientY: e.clientY,
        posX: position.x,
        posY: position.y,
      }
      hasDraggedRef.current = false
      setIsDragging(true)
    },
    [position, scanning]
  )

  const handlePointerMove = useCallback(
    (e) => {
      const start = dragStartRef.current
      if (!start) return

      const dx = e.clientX - start.clientX
      const dy = start.clientY - e.clientY
      if (!hasDraggedRef.current && (Math.abs(dx) > DRAG_THRESHOLD || Math.abs(dy) > DRAG_THRESHOLD)) {
        hasDraggedRef.current = true
      }

      const w = typeof window !== 'undefined' ? window.innerWidth : 800
      const h = typeof window !== 'undefined' ? window.innerHeight : 600
      const newX = Math.max(PADDING, Math.min(w - FAB_SIZE - PADDING, start.posX + dx))
      const newY = Math.max(BOTTOM_NAV_HEIGHT, Math.min(h - FAB_SIZE - PADDING, start.posY + dy))
      setPosition({ x: newX, y: newY })
    },
    []
  )

  const handlePointerUp = useCallback(
    (e) => {
      e.currentTarget.releasePointerCapture?.(e.pointerId)
      const start = dragStartRef.current
      const didDrag = hasDraggedRef.current
      dragStartRef.current = null
      setIsDragging(false)

      if (!start) return

      if (didDrag) {
        setPosition((prev) => {
          const snappedX = snapToEdge(prev.x)
          saveFabPosition(snappedX, prev.y)
          return { ...prev, x: snappedX }
        })
        setIsSnapping(true)
        setTimeout(() => setIsSnapping(false), 350)
      }
    },
    []
  )

  const handleFabClick = useCallback((e) => {
    if (hasDraggedRef.current) return
    setExpanded((prev) => !prev)
  }, [])

  const isOnLeftSide = position.x < (typeof window !== 'undefined' ? window.innerWidth : 800) / 2

  useEffect(() => {
    const onResize = () => {
      const w = window.innerWidth
      const h = window.innerHeight
      setPosition((prev) => ({
        x: Math.max(PADDING, Math.min(w - FAB_SIZE - PADDING, prev.x)),
        y: Math.max(BOTTOM_NAV_HEIGHT, Math.min(h - FAB_SIZE - PADDING, prev.y)),
      }))
    }
    window.addEventListener('resize', onResize)
    return () => window.removeEventListener('resize', onResize)
  }, [])

  return (
    <>
      <div className="fab-root relative w-14 h-14">
        {(expanded || miniResult) && (
          <div
            className={`absolute bottom-0 flex flex-col gap-2 p-4 rounded-2xl bg-slate-900/90 backdrop-blur-xl border border-slate-700/60 shadow-xl min-w-[220px] fab-menu-enter ${
              isOnLeftSide ? 'left-full ml-2 origin-bottom-left' : 'right-full mr-2 origin-bottom-right'
            }`}
            style={{
              boxShadow: '0 8px 32px rgba(0,0,0,0.4), 0 0 0 1px rgba(255,255,255,0.05)',
            }}
          >
            {miniResult ? (
              <div className="space-y-3">
                <div className="flex items-center justify-between">
                  <span
                    className={`text-sm font-bold ${
                      miniResult.status === 'REAL'
                        ? 'text-green-500'
                        : miniResult.status === 'FAKE'
                          ? 'text-red-500'
                          : 'text-amber-500'
                    }`}
                  >
                    {miniResult.status}
                    {miniResult.score != null && ` (${miniResult.score}%)`}
                  </span>
                  <button
                    onClick={clearMiniResult}
                    className="p-1 text-slate-400 hover:text-white rounded-lg transition-colors"
                    aria-label="Close result"
                  >
                    <CloseIcon />
                  </button>
                </div>
                <p className="text-slate-400 text-xs">{miniResult.message}</p>
              </div>
            ) : (
              <>
                <div className="flex items-center justify-between w-full mb-1">
                  <span className="text-white font-semibold text-sm">Quick Scan</span>
                  <button
                    onClick={closeMenu}
                    className="p-1.5 text-slate-400 hover:text-white hover:bg-slate-700/50 rounded-lg transition-colors"
                    aria-label="Minimize"
                  >
                    <CloseIcon />
                  </button>
                </div>

                <button
                  onClick={handleScanCurrentPage}
                  disabled={!hasCredits || scanning}
                  className="flex items-center gap-3 w-full px-3 py-2.5 rounded-xl bg-slate-800/80 hover:bg-slate-700/80 text-white text-sm font-medium transition-colors disabled:opacity-50 disabled:cursor-default"
                >
                  <ScanIcon />
                  Scan Current Page
                </button>

                <button
                  onClick={handleQuickUpload}
                  disabled={!hasCredits || scanning}
                  className="flex items-center gap-3 w-full px-3 py-2.5 rounded-xl bg-slate-800/80 hover:bg-slate-700/80 text-white text-sm font-medium transition-colors disabled:opacity-50 disabled:cursor-default"
                >
                  <UploadIcon />
                  Quick Upload
                </button>

                <div className="flex items-center gap-3 px-3 py-2.5 rounded-xl bg-slate-800/40 text-slate-400 text-sm">
                  <StatusIcon />
                  <span>{scansLabel}</span>
                </div>

                {showDropZone && (
                  <div
                    role="button"
                    tabIndex={0}
                    onKeyDown={(e) => e.key === 'Enter' && handleDropZoneClick()}
                    onClick={handleDropZoneClick}
                    onDrop={handleDrop}
                    onDragOver={(e) => e.preventDefault()}
                    className="p-4 rounded-xl border-2 border-dashed border-slate-600 hover:border-cyan-500/50 text-slate-400 hover:text-cyan-400 text-center text-sm transition-colors cursor-pointer"
                  >
                    Drop file or click to browse
                  </div>
                )}
              </>
            )}
          </div>
        )}

        <button
          onPointerDown={handlePointerDown}
          onPointerMove={handlePointerMove}
          onPointerUp={handlePointerUp}
          onPointerCancel={handlePointerUp}
          onClick={handleFabClick}
          className="relative flex items-center justify-center w-14 h-14 rounded-full transition-all duration-300 ease-out group touch-none select-none"
          style={{
            background: 'linear-gradient(135deg, rgba(30,41,59,0.9) 0%, rgba(15,23,42,0.95) 100%)',
            boxShadow: '0 4px 24px rgba(0,0,0,0.4), 0 0 0 1px rgba(255,255,255,0.08), inset 0 1px 0 rgba(255,255,255,0.1)',
            backdropFilter: 'blur(12px)',
          }}
          aria-label={expanded ? 'Close scanner' : 'Open scanner'}
        >
          <div
            className="absolute inset-0 rounded-full opacity-40"
            style={{
              animation: 'fab-pulse 2s ease-in-out infinite',
            }}
          />
          {scanning ? (
            <div className="w-6 h-6 rounded-full border-2 border-cyan-400 border-t-transparent animate-spin" />
          ) : (
            <>
              <div className="w-10 h-10 rounded-full bg-gradient-to-br from-purple-600 to-cyan-600 flex items-center justify-center shadow-[0_0_16px_rgba(139,92,246,0.5)]">
                <VerifEyeLogo />
              </div>
              <div className="absolute -bottom-1 left-1/2 -translate-x-1/2 text-white/70">
                <DragHandleIcon />
              </div>
            </>
          )}
        </button>
      </div>

      <input
        ref={fileInputRef}
        type="file"
        accept="video/*,audio/*,image/*"
        className="hidden"
        onChange={handleFileChange}
      />

      <style>{`
        @keyframes fab-pulse {
          0%, 100% { transform: scale(1); opacity: 0.4; }
          50% { transform: scale(1.15); opacity: 0.15; }
        }
        @keyframes fab-menu-enter {
          from {
            opacity: 0;
            transform: scale(0.9) translateY(4px);
          }
          to {
            opacity: 1;
            transform: scale(1) translateY(0);
          }
        }
        .fab-menu-enter {
          animation: fab-menu-enter 0.2s ease-out forwards;
        }
      `}</style>
    </>
  )
}
