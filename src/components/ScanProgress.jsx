import { useTranslation } from 'react-i18next'

const STEPS = ['uploading', 'queued', 'analyzing', 'scoring', 'done']

function stepIndex(stage) {
  if (!stage || stage === 'uploading') return 0
  if (stage === 'queued' || stage === 'starting' || stage === 'hashing') return 1
  if (stage === 'scoring' || stage === 'summarizing') return 3
  if (stage === 'done') return 4
  return 2
}

/** Live progress of a scan job: ring, stage label and a 5-step rail. */
export default function ScanProgress({ stage = 'queued', progress = 0, fileName }) {
  const { t } = useTranslation()
  const pct = Math.min(100, Math.max(0, Math.round(progress)))
  const label = t(`scan.stage.${stage}`, { defaultValue: t('scan.stage.processing') })
  const current = stepIndex(stage)
  const r = 44
  const c = 2 * Math.PI * r

  return (
    <section
      className="card p-6 flex flex-col items-center text-center animate-fade-in"
      role="status"
      aria-live="polite"
    >
      <div className="relative w-28 h-28">
        <svg viewBox="0 0 100 100" className="w-full h-full -rotate-90">
          <circle cx="50" cy="50" r={r} fill="none" stroke="rgba(255,255,255,0.08)" strokeWidth="8" />
          <circle
            cx="50"
            cy="50"
            r={r}
            fill="none"
            stroke="#22d3ee"
            strokeWidth="8"
            strokeLinecap="round"
            strokeDasharray={`${(pct / 100) * c} ${c}`}
            style={{ transition: 'stroke-dasharray 0.4s ease-out' }}
          />
        </svg>
        <span className="absolute inset-0 flex items-center justify-center text-xl font-bold text-fg">{pct}%</span>
      </div>
      <p className="mt-4 text-fg font-medium">{label}</p>
      {fileName && <p className="text-xs text-muted mt-1 truncate max-w-full">{fileName}</p>}
      <ol className="mt-5 flex items-center gap-2 w-full max-w-sm" aria-hidden="true">
        {STEPS.map((s, i) => (
          <li key={s} className="flex-1 flex flex-col items-center gap-1">
            <span
              className={`h-1.5 w-full rounded-full ${i < current ? 'bg-accent' : i === current ? 'bg-accent/60 animate-pulse' : 'bg-surface-3'}`}
            />
            <span className={`text-[10px] ${i <= current ? 'text-fg' : 'text-muted'}`}>{t(`scan.step.${s}`)}</span>
          </li>
        ))}
      </ol>
    </section>
  )
}
