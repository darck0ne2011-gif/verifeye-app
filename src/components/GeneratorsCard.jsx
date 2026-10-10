import { useTranslation } from 'react-i18next'

/** Human names for Sightengine's generator families; unknown ids are prettified. */
export const GENERATOR_LABELS = {
  dalle: 'DALL·E (OpenAI)',
  midjourney: 'Midjourney',
  stable_diffusion: 'Stable Diffusion',
  firefly: 'Adobe Firefly',
  imagen: 'Google Imagen',
  flux: 'Flux',
  ideogram: 'Ideogram',
  recraft: 'Recraft',
  leonardo: 'Leonardo',
  gan: 'GAN (StyleGAN etc.)',
  other: 'Other / unknown',
}

export function generatorLabel(id) {
  if (GENERATOR_LABELS[id]) return GENERATOR_LABELS[id]
  return String(id)
    .replace(/_/g, ' ')
    .replace(/\b\w/g, (c) => c.toUpperCase())
}

/**
 * Probable generator families from the detector's per-generator scores.
 * Shown only when the file looks AI-made enough for the attribution to mean
 * something.
 */
export default function GeneratorsCard({ generators, fakeProbability }) {
  const { t } = useTranslation()
  if (!Array.isArray(generators) || generators.length === 0) return null
  const top = generators.filter((g) => g.score > 0.02).slice(0, 4)
  if (top.length === 0) return null
  const weak = (fakeProbability ?? 0) < 30

  return (
    <section className="card p-4">
      <h3 className="text-sm font-medium text-fg mb-1">{t('verdict.generators_title')}</h3>
      <p className="text-xs text-muted mb-3">
        {weak ? t('verdict.generators_hint_weak') : t('verdict.generators_hint')}
      </p>
      <ul className="space-y-2">
        {top.map((g) => {
          const pct = Math.round(g.score * 100)
          return (
            <li key={g.id} className="text-sm">
              <div className="flex justify-between gap-3 mb-1">
                <span className="text-fg">{generatorLabel(g.id)}</span>
                <span className="text-muted tabular-nums">{pct}%</span>
              </div>
              <div className="h-1.5 rounded-full bg-surface-3 overflow-hidden">
                <div className="h-full rounded-full bg-accent" style={{ width: `${Math.max(2, pct)}%` }} />
              </div>
            </li>
          )
        })}
      </ul>
    </section>
  )
}
