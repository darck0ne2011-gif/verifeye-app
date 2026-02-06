import { useState } from 'react'
import { useTranslation } from 'react-i18next'

const FolderIcon = () => (
  <svg className="w-12 h-12 text-slate-400 flex-shrink-0" fill="none" stroke="currentColor" viewBox="0 0 24 24">
    <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={1.5} d="M3 7v10a2 2 0 002 2h14a2 2 0 002-2V9a2 2 0 00-2-2h-6l-2-2H5a2 2 0 00-2 2z" />
  </svg>
)

const FileReadyIcon = () => (
  <svg className="w-5 h-5 text-green-500 flex-shrink-0" fill="none" stroke="currentColor" viewBox="0 0 24 24">
    <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M5 13l4 4L19 7" />
  </svg>
)

export default function DropZone({ onDrop, onTriggerClick, onClearFile, selectedFile, disabled = false }) {
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

  const handleClick = () => {
    if (disabled) return
    onTriggerClick?.()
  }

  return (
    <div className="w-full space-y-2">
      {selectedFile && (
        <div className="flex items-center gap-2 w-full py-2 px-3 mb-2 bg-slate-700/50 rounded-lg border border-slate-600">
          <FileReadyIcon />
          <span className="text-white text-sm font-medium truncate flex-1">
            {selectedFile.name}
          </span>
          <span className="text-green-500 text-xs font-medium whitespace-nowrap">{t('dropzone.file_ready')}</span>
          <button
            type="button"
            className="text-slate-400 hover:text-white text-xs px-2 py-1"
            onClick={(e) => {
              e.stopPropagation()
              onClearFile?.()
            }}
          >
            {t('dropzone.change')}
          </button>
        </div>
      )}
      <div
        onDragOver={handleDragOver}
        onDragLeave={handleDragLeave}
        onDrop={handleDrop}
        onClick={handleClick}
        className={`
          w-full border-2 border-dashed rounded-xl p-6 md:p-8
          flex items-center gap-4
          transition-all duration-200
          ${disabled
            ? 'border-slate-600 bg-slate-800/30 cursor-not-allowed opacity-60'
            : `cursor-pointer ${isDragOver
              ? 'border-cyan-400 bg-slate-800/80 shadow-[0_0_20px_rgba(34,211,238,0.2)]'
              : 'border-slate-500 bg-slate-800/40 hover:border-slate-400'
            }`
          }
        `}
      >
        <FolderIcon />
        <div className="flex flex-col gap-1 flex-1 min-w-0">
          <p className="text-white font-medium">{t('dropzone.drag_drop')}</p>
          <p className="text-slate-400 text-sm">{t('dropzone.or_click')} (MP4, MOV, images, audio)</p>
        </div>
      </div>
    </div>
  )
}
