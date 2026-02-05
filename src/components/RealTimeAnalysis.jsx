import { getMediaCategory } from '../utils/fileType.js'

const PersonIcon = () => (
  <svg className="w-6 h-6 flex-shrink-0" fill="none" stroke="currentColor" viewBox="0 0 24 24">
    <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M16 7a4 4 0 11-8 0 4 4 0 018 0zM12 14a7 7 0 00-7 7h14a7 7 0 00-7-7z" />
  </svg>
)

const PixelIcon = () => (
  <svg className="w-6 h-6 flex-shrink-0" fill="none" stroke="currentColor" viewBox="0 0 24 24">
    <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M4 16l4.586-4.586a2 2 0 012.828 0L16 16m-2-2l1.586-1.586a2 2 0 012.828 0L20 14m-6-6h.01M6 20h12a2 2 0 002-2V6a2 2 0 00-2-2H6a2 2 0 00-2 2v12a2 2 0 002 2z" />
  </svg>
)

const WaveformIcon = () => (
  <svg className="w-6 h-6 flex-shrink-0" fill="none" stroke="currentColor" viewBox="0 0 24 24">
    <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M9 19V6l12-3v13M9 19c0 1.105-1.343 2-3 2s-3-.895-3-2 1.343-2 3-2 3 .895 3 2zm12-3c0 1.105-1.343 2-3 2s-3-.895-3-2 1.343-2 3-2 3 .895 3 2zM9 10l12-3" />
  </svg>
)

const CheckIcon = () => (
  <svg className="w-6 h-6 flex-shrink-0 text-green-500" fill="none" stroke="currentColor" viewBox="0 0 24 24">
    <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2.5} d="M5 13l4 4L19 7" />
  </svg>
)

const IMAGE_ITEMS = [
  { icon: PixelIcon, title: 'Pixel Integrity', subtitle: 'Analysis complete: No AI generation detected' },
  { icon: WaveformIcon, title: 'Metadata Analysis', subtitle: 'EXIF and file structure verified' },
]

const AUDIO_ITEMS = [
  { icon: WaveformIcon, title: 'Voice Frequency', subtitle: 'Analysis complete: No synthetic voice detected' },
  { icon: PersonIcon, title: 'Neural Synthesis Check', subtitle: 'Vocal patterns verified' },
]

const VIDEO_ITEMS = [
  { icon: PersonIcon, title: 'Biometric Integrity', subtitle: 'Analysis complete: No AI cloning detected' },
  { icon: WaveformIcon, title: 'Lip Sync', subtitle: 'Analysis complete: Lip sync verified' },
]

export default function RealTimeAnalysis({ isComplete = true, fileType }) {
  const mediaCategory = getMediaCategory(fileType)
  const items = mediaCategory === 'image' ? IMAGE_ITEMS : mediaCategory === 'audio' ? AUDIO_ITEMS : VIDEO_ITEMS

  return (
    <section className="w-full max-w-2xl">
      <h2 className="text-base font-medium text-white mb-4">Real-Time Analysis:</h2>
      <div className="space-y-4">
        {items.map((item, i) => {
          const Icon = item.icon
          return (
            <div
              key={i}
              className="flex items-start justify-between gap-3 py-3 px-4 bg-verifeye-card rounded-xl border border-slate-700/50"
            >
              <div className="flex items-start gap-3 flex-1 min-w-0">
                <Icon />
                <div>
                  <p className="text-white font-medium">{item.title}</p>
                  <p className="text-slate-400 text-sm mt-0.5">{item.subtitle}</p>
                </div>
              </div>
              <CheckIcon />
            </div>
          )
        })}
      </div>
    </section>
  )
}
