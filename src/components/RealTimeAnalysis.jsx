const PersonIcon = () => (
  <svg className="w-6 h-6 flex-shrink-0" fill="none" stroke="currentColor" viewBox="0 0 24 24">
    <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M16 7a4 4 0 11-8 0 4 4 0 018 0zM12 14a7 7 0 00-7 7h14a7 7 0 00-7-7z" />
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

export default function RealTimeAnalysis({ isComplete = true }) {
  return (
    <section className="w-full max-w-2xl">
      <h2 className="text-base font-medium text-white mb-4">Real-Time Analysis:</h2>
      <div className="space-y-4">
        <div className="flex items-start justify-between gap-3 py-3 px-4 bg-verifeye-card rounded-xl border border-slate-700/50">
          <div className="flex items-start gap-3 flex-1 min-w-0">
            <PersonIcon />
            <div>
              <p className="text-white font-medium">
                {isComplete ? 'Analysis complete: No AI cloning detected' : 'Biometric Integrity: Analysing eye movement...'}
              </p>
              {!isComplete && (
                <p className="text-slate-400 text-sm mt-0.5">Searching for AI cloning...</p>
              )}
            </div>
          </div>
          <CheckIcon />
        </div>
        <div className="flex items-start justify-between gap-3 py-3 px-4 bg-verifeye-card rounded-xl border border-slate-700/50">
          <div className="flex items-start gap-3 flex-1 min-w-0">
            <WaveformIcon />
            <div>
              <p className="text-white font-medium">
                {isComplete ? 'Analysis complete: Lip sync verified' : 'Vocalic Imprint: Comparing statements match'}
              </p>
              {!isComplete && (
                <p className="text-slate-400 text-sm mt-0.5">Lip movement is out of sync...</p>
              )}
            </div>
          </div>
          <CheckIcon />
        </div>
      </div>
    </section>
  )
}
