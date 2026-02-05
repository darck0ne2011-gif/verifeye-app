const WarningIcon = () => (
  <svg className="w-6 h-6 flex-shrink-0" fill="currentColor" viewBox="0 0 20 20">
    <path fillRule="evenodd" d="M8.257 3.099c.765-1.36 2.722-1.36 3.486 0l5.58 9.92c.75 1.334-.213 2.98-1.742 2.98H4.42c-1.53 0-2.493-1.646-1.743-2.98l5.58-9.92zM11 13a1 1 0 11-2 0 1 1 0 012 0zm-1-8a1 1 0 00-1 1v3a1 1 0 002 0V6a1 1 0 00-1-1z" clipRule="evenodd" />
  </svg>
)

const defaultReason = 'At 0:04, the lighting on the face (98% ElevenLabs match) moves inconsistently with the head\'s movement, a clear sign of digital manipulation.'

export default function DeepfakeAlert({ probability = 92, reason = defaultReason }) {
  return (
    <section className="w-full max-w-2xl">
      <h2 className="text-base font-medium text-white mb-4">Why is this a fake?</h2>
      <div className="flex items-center gap-4 p-4 bg-red-600 rounded-xl">
        <span className="flex items-center justify-center w-12 h-12 rounded-full bg-white/20 text-white flex-shrink-0">
          <WarningIcon />
        </span>
        <p className="text-white font-bold text-lg">{probability}% PROBABILITY OF DEEPFAKE</p>
      </div>
      <p className="text-slate-400 text-sm mt-3">
        Reason: {reason}
      </p>
    </section>
  )
}
