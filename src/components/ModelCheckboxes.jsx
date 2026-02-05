import { useTranslation } from 'react-i18next'

export const MODEL_IDS = {
  deepfake: 'deepfake',
  genai: 'genai',
  type: 'type',
  quality: 'quality',
}

const DEFAULT_MODELS = [MODEL_IDS.genai]

export default function ModelCheckboxes({ selected, onChange, disabled }) {
  const { t } = useTranslation()
  const options = [
    { id: MODEL_IDS.deepfake, labelKey: 'scan.model_deepfake' },
    { id: MODEL_IDS.genai, labelKey: 'scan.model_genai' },
    { id: MODEL_IDS.type, labelKey: 'scan.model_metadata' },
    { id: MODEL_IDS.quality, labelKey: 'scan.model_quality' },
  ]

  const toggle = (id) => {
    if (disabled) return
    const next = selected.includes(id)
      ? selected.filter((m) => m !== id)
      : [...selected, id]
    if (next.length > 0) onChange(next)
  }

  const models = selected.length ? selected : DEFAULT_MODELS

  return (
    <div className="w-full max-w-2xl rounded-xl bg-slate-800/60 border border-slate-600/60 p-4">
      <p className="text-slate-300 text-sm font-medium mb-3">{t('scan.select_models')}</p>
      <p className="text-slate-500 text-xs mb-3">{t('scan.credits_per_model')}</p>
      <div className="flex flex-wrap gap-3">
        {options.map((opt) => {
          const isChecked = models.includes(opt.id)
          return (
            <label
              key={opt.id}
              className={`flex items-center gap-2 px-3 py-2 rounded-lg border cursor-pointer transition-colors ${
                isChecked
                  ? 'bg-cyan-500/20 border-cyan-500/50 text-white'
                  : 'bg-slate-700/40 border-slate-600 text-slate-400 hover:border-slate-500'
              } ${disabled ? 'opacity-60 cursor-not-allowed' : ''}`}
            >
              <input
                type="checkbox"
                checked={isChecked}
                onChange={() => toggle(opt.id)}
                disabled={disabled}
                className="rounded border-slate-500 bg-slate-700 text-cyan-500 focus:ring-cyan-500"
              />
              <span className="text-sm">{t(opt.labelKey)}</span>
            </label>
          )
        })}
      </div>
    </div>
  )
}
