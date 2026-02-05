import { useState, useEffect } from 'react'
import { useTranslation } from 'react-i18next'
import { useAuth } from '../context/AuthContext'
import { getActiveModels, setActiveModels } from '../utils/scanSettings'
import { MODEL_IDS } from '../components/ModelCheckboxes'
import DashboardHeader from '../components/DashboardHeader'

function ToggleSwitch({ checked, onChange }) {
  return (
    <button
      type="button"
      role="switch"
      aria-checked={checked}
      onClick={() => onChange(!checked)}
      className={`relative inline-flex h-7 w-12 shrink-0 cursor-pointer rounded-full border-2 border-transparent transition-colors duration-200 ease-in-out focus:outline-none focus:ring-2 focus:ring-cyan-500 focus:ring-offset-2 focus:ring-offset-slate-900 ${
        checked ? 'bg-cyan-500' : 'bg-slate-600'
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

const OPTIONS = [
  { id: MODEL_IDS.deepfake, labelKey: 'scan.model_deepfake' },
  { id: MODEL_IDS.genai, labelKey: 'scan.model_genai' },
  { id: MODEL_IDS.type, labelKey: 'scan.model_metadata' },
  { id: MODEL_IDS.quality, labelKey: 'scan.model_quality' },
]

export default function ScanSettingsPage({ onSettingsClick }) {
  const { t } = useTranslation()
  const { user } = useAuth()
  const [activeModels, setActiveModelsState] = useState(() => getActiveModels())

  useEffect(() => {
    setActiveModels(activeModels)
  }, [activeModels])

  const toggle = (id) => {
    setActiveModelsState((prev) => {
      const next = prev.includes(id) ? prev.filter((m) => m !== id) : [...prev, id]
      return next.length > 0 ? next : [MODEL_IDS.genai]
    })
  }

  return (
    <div className="min-h-screen bg-[#0d0d0d] flex flex-col pb-20">
      <DashboardHeader
        scansCount={user?.scanCredits ?? 0}
        userEmail={user?.email}
        onSettingsClick={onSettingsClick}
      />
      <main className="flex-1 px-4 pt-6 pb-8 overflow-y-auto">
        <h1 className="text-xl font-semibold text-white mb-2">{t('scan_settings.title')}</h1>
        <p className="text-slate-400 text-sm mb-6">{t('scan_settings.subtitle')}</p>
        <ul className="space-y-1">
          {OPTIONS.map((opt) => {
            const isOn = activeModels.includes(opt.id)
            return (
              <li
                key={opt.id}
                className="flex items-center justify-between py-4 px-4 rounded-xl bg-slate-800/60 border border-slate-700/50"
              >
                <span className="text-white font-medium">{t(opt.labelKey)}</span>
                <ToggleSwitch checked={isOn} onChange={() => toggle(opt.id)} />
              </li>
            )
          })}
        </ul>
      </main>
    </div>
  )
}
