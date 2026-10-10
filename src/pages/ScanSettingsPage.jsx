import { useState } from 'react'
import { useTranslation } from 'react-i18next'
import { MODEL_OPTIONS, getActiveModelsForCategory, setActiveModelsForCategory } from '../utils/scanSettings'
import PageHeader from '../components/PageHeader'

const MODEL_LABEL_KEYS = {
  image: {
    genai: 'scan_settings.model_genai',
    deepfake: 'scan_settings.model_deepfake',
    type: 'scan_settings.model_metadata',
    quality: 'scan_settings.model_quality',
  },
  video: {
    genai: 'scan_settings.model_video_genai',
    deepfake: 'scan_settings.model_video_deepfake',
    ai_speech: 'scan_settings.model_video_speech',
  },
  audio: {
    ai_speech: 'scan_settings.model_audio_speech',
  },
}

const MODEL_HINT_KEYS = {
  video: { ai_speech: 'scan_settings.hint_ai_speech_beta' },
  audio: { ai_speech: 'scan_settings.hint_ai_speech_beta' },
}

const TABS = [
  { id: 'image', labelKey: 'scan_settings.tab_photo', sectionKey: 'scan_settings.section_photo', icon: '📷' },
  { id: 'video', labelKey: 'scan_settings.tab_video', sectionKey: 'scan_settings.section_video', icon: '🎬' },
  { id: 'audio', labelKey: 'scan_settings.tab_audio', sectionKey: 'scan_settings.section_audio', icon: '🎙️' },
]

function ToggleSwitch({ checked, onChange }) {
  return (
    <button
      type="button"
      role="switch"
      aria-checked={checked}
      onClick={() => onChange(!checked)}
      className={`relative inline-flex h-7 w-12 shrink-0 cursor-pointer rounded-full border-2 border-transparent transition-colors duration-200 ease-in-out focus:outline-none focus:ring-2 focus:ring-accent focus:ring-offset-2 focus:ring-offset-bg ${
        checked ? 'bg-accent' : 'bg-surface-3'
      }`}
    >
      <span
        className={`pointer-events-none inline-block h-6 w-6 transform rounded-full bg-white shadow ring-0 transition duration-200 ease-in-out ${
          checked ? 'translate-x-5' : 'translate-x-1'
        }`}
      />
    </button>
  )
}

export default function ScanSettingsPage() {
  const { t } = useTranslation()
  const [activeTab, setActiveTab] = useState('image')
  const [models, setModels] = useState(() =>
    Object.fromEntries(TABS.map((tab) => [tab.id, getActiveModelsForCategory(tab.id)]))
  )

  const toggle = (category, id) => {
    const current = models[category]
    const next = current.includes(id) ? current.filter((m) => m !== id) : [...current, id]
    const saved = setActiveModelsForCategory(category, next)
    setModels((prev) => ({ ...prev, [category]: saved }))
  }

  const tab = TABS.find((x) => x.id === activeTab)

  return (
    <div className="animate-fade-in">
      <PageHeader title={t('scan_settings.title')} subtitle={t('scan_settings.subtitle')} />

      <div className="flex gap-1 p-1 rounded-xl bg-surface-2 border border-line mb-6" role="tablist">
        {TABS.map((item) => (
          <button
            key={item.id}
            type="button"
            role="tab"
            aria-selected={activeTab === item.id}
            onClick={() => setActiveTab(item.id)}
            className={`flex-1 flex items-center justify-center gap-2 py-2.5 px-4 rounded-lg text-sm font-medium transition-colors ${
              activeTab === item.id
                ? 'bg-accent-soft text-accent border border-accent/40'
                : 'text-muted hover:text-fg hover:bg-surface-3 border border-transparent'
            }`}
          >
            <span aria-hidden>{item.icon}</span>
            {t(item.labelKey)}
          </button>
        ))}
      </div>

      <section key={tab.id} className="space-y-3 animate-fade-in" role="tabpanel">
        <h2 className="text-sm font-semibold text-muted uppercase tracking-wider mb-3">{t(tab.sectionKey)}</h2>
        <ul className="space-y-3 w-full">
          {MODEL_OPTIONS[tab.id].map((id) => {
            const hintKey = MODEL_HINT_KEYS[tab.id]?.[id]
            return (
              <li key={id} className="card w-full flex justify-between items-center gap-4 p-4">
                <div className="flex-1 min-w-0">
                  <span className="text-fg font-medium">{t(MODEL_LABEL_KEYS[tab.id][id])}</span>
                  {hintKey && <p className="text-xs text-unclear mt-1">{t(hintKey)}</p>}
                </div>
                <ToggleSwitch checked={models[tab.id].includes(id)} onChange={() => toggle(tab.id, id)} />
              </li>
            )
          })}
        </ul>
      </section>

      <p className="text-muted text-xs mt-6">{t('scan_settings.credits_note')}</p>
    </div>
  )
}
