import { useTranslation } from 'react-i18next'

function formatTime(sec) {
  const s = Math.max(0, Math.round(sec))
  return `${Math.floor(s / 60)}:${String(s % 60).padStart(2, '0')}`
}

/** Per-frame scores for a video scan, as a small bar chart. */
export default function FrameTimeline({ timeline }) {
  const { t } = useTranslation()
  if (!Array.isArray(timeline) || timeline.length === 0) return null
  const frames = timeline.map((f) => ({
    positionSec: f.positionSec ?? 0,
    score: Math.max(Number(f.ai_generated ?? 0), Number(f.deepfake ?? 0)),
  }))

  return (
    <section className="w-full rounded-xl bg-slate-800/60 border border-slate-600/60 p-4">
      <h3 className="text-sm font-medium text-slate-300 mb-1">{t('verdict.timeline_title')}</h3>
      <p className="text-xs text-slate-500 mb-3">{t('verdict.timeline_hint', { count: frames.length })}</p>
      <ol className="flex items-end gap-1 h-24" aria-label={t('verdict.timeline_title')}>
        {frames.map((f, i) => {
          const pct = Math.round(f.score * 100)
          const color = pct >= 70 ? 'bg-red-500' : pct > 30 ? 'bg-amber-400' : 'bg-green-500'
          return (
            <li
              key={i}
              className="flex-1 flex flex-col items-center justify-end h-full min-w-0"
              title={`${formatTime(f.positionSec)} — ${pct}%`}
            >
              <div className={`w-full rounded-t ${color}`} style={{ height: `${Math.max(4, pct)}%` }} />
              <span className="text-[10px] text-slate-500 mt-1 truncate">{formatTime(f.positionSec)}</span>
            </li>
          )
        })}
      </ol>
    </section>
  )
}
