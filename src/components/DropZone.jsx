import { useState } from 'react'
import { useTranslation } from 'react-i18next'
import MediaPreview from './MediaPreview'

const FolderIcon = () => (
  <svg className="w-12 h-12 text-slate-400 flex-shrink-0" fill="none" stroke="currentColor" viewBox="0 0 24 24">
    <path
      strokeLinecap="round"
      strokeLinejoin="round"
      strokeWidth={1.5}
      d="M3 7v10a2 2 0 002 2h14a2 2 0 002-2V9a2 2 0 00-2-2h-6l-2-2H5a2 2 0 00-2 2z"
    />
  </svg>
)

const CameraIcon = () => (
  <svg className="w-5 h-5" fill="none" stroke="currentColor" viewBox="0 0 24 24">
    <path
      strokeLinecap="round"
      strokeLinejoin="round"
      strokeWidth={2}
      d="M3 9a2 2 0 012-2h.93a2 2 0 001.664-.89l.812-1.22A2 2 0 0110.07 4h3.86a2 2 0 011.664.89l.812 1.22A2 2 0 0018.07 7H19a2 2 0 012 2v9a2 2 0 01-2 2H5a2 2 0 01-2-2V9z"
    />
    <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M15 13a3 3 0 11-6 0 3 3 0 016 0z" />
  </svg>
)

export default function DropZone({
  onDrop,
  onTriggerClick,
  onCameraClick,
  onClearFile,
  selectedFile,
  disabled = false,
  creditsNeeded = 1,
  showCredits = true,
}) {
  const { t } = useTranslation()
  const [isDragOver, setIsDragOver] = useState(false)

  const handleDragOver = (e) => {
    if (disabled) return
    e.preventDefault()
    setIsDragOver(true)
  }
  const handleDragLeave = () => setIsDragOver(false)
  const handleDrop = (e) => {
    e.preventDefault()
    setIsDragOver(false)
    if (disabled) return
    const files = e.dataTransfer?.files
    if (files?.length) onDrop?.(files)
  }

  if (selectedFile) {
    return (
      <div className="w-full space-y-3">
        <MediaPreview file={selectedFile} />
        <div className="flex items-center justify-between gap-3 text-sm">
          <span className="text-green-400 font-medium">{t('dropzone.file_ready')}</span>
          <div className="flex items-center gap-3">
            {showCredits && (
              <span className="text-slate-500 text-xs">{t('dropzone.credits_hint', { count: creditsNeeded })}</span>
            )}
            <button
              type="button"
              className="text-slate-300 hover:text-white underline underline-offset-2"
              onClick={() => onClearFile?.()}
            >
              {t('dropzone.change')}
            </button>
          </div>
        </div>
      </div>
    )
  }

  return (
    <div className="w-full space-y-3">
      <div
        role="button"
        tabIndex={disabled ? -1 : 0}
        aria-disabled={disabled}
        onDragOver={handleDragOver}
        onDragLeave={handleDragLeave}
        onDrop={handleDrop}
        onClick={() => !disabled && onTriggerClick?.()}
        onKeyDown={(e) => !disabled && (e.key === 'Enter' || e.key === ' ') && onTriggerClick?.()}
        className={`
          w-full border-2 border-dashed rounded-xl p-6 md:p-8
          flex items-center gap-4
          transition-all duration-200
          ${
            disabled
              ? 'border-slate-600 bg-slate-800/30 cursor-not-allowed opacity-60'
              : `cursor-pointer ${
                  isDragOver
                    ? 'border-cyan-400 bg-slate-800/80 shadow-[0_0_20px_rgba(34,211,238,0.2)]'
                    : 'border-slate-500 bg-slate-800/40 hover:border-slate-400'
                }`
          }
        `}
      >
        <FolderIcon />
        <div className="flex flex-col gap-1 flex-1 min-w-0">
          <p className="text-white font-medium">{t('dropzone.drag_drop')}</p>
          <p className="text-slate-400 text-sm">{t('dropzone.or_click')}</p>
          {showCredits && (
            <p className="text-slate-500 text-xs">{t('dropzone.credits_hint', { count: creditsNeeded })}</p>
          )}
        </div>
      </div>
      {onCameraClick && (
        <button
          type="button"
          disabled={disabled}
          onClick={onCameraClick}
          className="w-full flex items-center justify-center gap-2 py-3 rounded-xl bg-slate-800/60 border border-slate-600 text-white text-sm font-medium hover:bg-slate-700/60 disabled:opacity-50 disabled:cursor-not-allowed md:hidden"
        >
          <CameraIcon />
          {t('dropzone.take_photo')}
        </button>
      )}
    </div>
  )
}
