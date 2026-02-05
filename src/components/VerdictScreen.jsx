import RealTimeAnalysis from './RealTimeAnalysis'
import DeepfakeAlert from './DeepfakeAlert'
import VerifiedBadge from './VerifiedBadge'

export default function VerdictScreen({ score = 0, error, onBack }) {
  const isDeepfake = score >= 50

  return (
    <div className="w-full max-w-2xl flex flex-col gap-6 animate-fade-in">
      <RealTimeAnalysis isComplete />
      <div className="flex gap-3 flex-wrap">
        <button className="flex-1 min-w-[140px] py-3 px-4 bg-slate-800 border border-slate-600 rounded-xl text-white font-medium hover:bg-slate-700 transition-colors">
          View Original Source
        </button>
      </div>
      {isDeepfake ? (
        <DeepfakeAlert probability={score} />
      ) : (
        <VerifiedBadge probability={score} />
      )}
      {error && (
        <p className="text-amber-400 text-sm">
          API error (using fallback): {error}
        </p>
      )}
    </div>
  )
}
