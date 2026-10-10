import { useEffect, useState } from 'react'

const AudioIcon = () => (
  <svg className="w-10 h-10 text-accent" fill="none" stroke="currentColor" viewBox="0 0 24 24">
    <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={1.5} d="M4 12h2l2-6 3 12 3-9 2 6 2-3h2" />
  </svg>
)

/**
 * Shows the selected file (image, video or audio) so the user can see what is
 * being analysed. Creates and revokes an object URL for the File.
 */
export default function MediaPreview({ file, mediaCategory, fileName, className = '' }) {
  const [url, setUrl] = useState(null)

  useEffect(() => {
    if (!file) {
      setUrl(null)
      return undefined
    }
    const objectUrl = URL.createObjectURL(file)
    setUrl(objectUrl)
    return () => URL.revokeObjectURL(objectUrl)
  }, [file])

  if (!file || !url) return null
  const category = mediaCategory || (file.type || '').split('/')[0]
  const name = fileName || file.name

  return (
    <figure className={`w-full rounded-xl overflow-hidden bg-black/40 border border-line ${className}`}>
      {category === 'image' && <img src={url} alt={name} className="w-full max-h-72 object-contain bg-black" />}
      {category === 'video' && (
        <video src={url} controls playsInline preload="metadata" className="w-full max-h-72 bg-black" />
      )}
      {category === 'audio' && (
        <div className="flex flex-col items-center gap-3 p-4">
          <AudioIcon />
          <audio src={url} controls preload="metadata" className="w-full" />
        </div>
      )}
      <figcaption className="px-3 py-2 text-xs text-muted truncate">{name}</figcaption>
    </figure>
  )
}
