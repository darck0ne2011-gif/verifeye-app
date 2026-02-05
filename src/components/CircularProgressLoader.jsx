import { useState, useEffect } from 'react'

const STATUS_MESSAGES = [
  'Verifying Metadata...',
  'Checking Biometrics...',
  'Analyzing Audio Frequency...',
  'Consulting Primary Sources...',
]

export default function CircularProgressLoader({ progress = 0 }) {
  const [messageIndex, setMessageIndex] = useState(0)

  useEffect(() => {
    const interval = setInterval(() => {
      setMessageIndex((i) => (i + 1) % STATUS_MESSAGES.length)
    }, 800)
    return () => clearInterval(interval)
  }, [])

  return (
    <div className="w-full max-w-2xl flex flex-col items-center justify-center py-12 gap-6">
      <div className="relative w-24 h-24">
        <div className="absolute inset-0 rounded-full border-4 border-slate-700/80" />
        <div
          className="absolute inset-0 rounded-full border-4 animate-spin"
          style={{
            borderColor: 'transparent',
            borderTopColor: '#22d3ee',
            borderRightColor: '#a855f7',
            borderBottomColor: 'transparent',
            borderLeftColor: 'transparent',
          }}
        />
      </div>
      <p className="text-white font-medium text-lg animate-pulse transition-opacity duration-300">
        {STATUS_MESSAGES[messageIndex]}
      </p>
      <div className="w-full max-w-xs h-2 bg-slate-700 rounded-full overflow-hidden">
        <div
          className="h-full bg-verifeye-accent rounded-full transition-all duration-150 ease-out"
          style={{
            width: `${Math.min(100, Math.max(0, progress))}%`,
            boxShadow: '0 0 12px rgba(102, 255, 0, 0.5)',
          }}
        />
      </div>
    </div>
  )
}
