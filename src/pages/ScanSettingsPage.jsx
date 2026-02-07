import { useState, useEffect } from 'react'
import { useTranslation } from 'react-i18next'
import { useAuth } from '../context/AuthContext'
import { getActiveModelsForCategory, setActiveModelsForCategory, getVideoAnalysisEngine, setVideoAnalysisEngine } from '../utils/scanSettings'
import DashboardHeader from '../components/DashboardHeader'

const PHOTO_OPTIONS = [
  { id: 'deepfake', labelKey: 'scan_settings.model_deepfake' },
  { id: 'genai', labelKey: 'scan_settings.model_genai' },
  { id: 'type', labelKey: 'scan_settings.model_metadata' },
  { id: 'quality', labelKey: 'scan_settings.model_quality' },
]

const VIDEO_OPTIONS = [
  { id: 'temporal_ai', labelKey: 'scan_settings.model_temporal_ai' },
  { id: 'video_deepfake', labelKey: 'scan_settings.model_video_deepfake' },
  { id: 'frame_integrity', labelKey: 'scan_settings.model_frame_integrity' },
  { id: 'video_voice_clone', labelKey: 'scan_settings.model_video_voice_clone', eliteOnly: true },
  { id: 'video_lip_sync', labelKey: 'scan_settings.model_video_lip_sync', eliteOnly: true },
]

const AUDIO_OPTIONS = [
  { id: 'voice_cloning', labelKey: 'scan_settings.model_voice_cloning' },
  { id: 'synthetic_speech', labelKey: 'scan_settings.model_synthetic_speech' },
  { id: 'background_noise', labelKey: 'scan_settings.model_background_noise' },
]

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

function SectionToggle({ id, labelKey, isOn, onToggle, t, disabled, eliteBadge }) {
  return (
    <li className={`w-full flex justify-between items-center p-4 rounded-xl border ${disabled ? 'bg-slate-800/30 border-slate-700/30 opacity-75' : 'bg-slate-800/50 border-slate-700/50'}`}>
      <span className="text-white font-medium flex-1 min-w-0 flex items-center gap-2">
        {t(labelKey)}
        {eliteBadge && (
          <span className="text-[10px] uppercase tracking-wider px-1.5 py-0.5 rounded bg-amber-500/20 text-amber-400">
            Elite
          </span>
        )}
      </span>
      <div className="shrink-0">
        <ToggleSwitch checked={disabled ? false : isOn} onChange={() => !disabled && onToggle(id)} />
      </div>
    </li>
  )
}

export default function ScanSettingsPage({ onSettingsClick }) {
  const { t } = useTranslation()
  const { user } = useAuth()
  const isElite = user?.subscriptionTier === 'elite' || user?.isPremium === true
  const [activeTab, setActiveTab] = useState('photo')

  const [photoModels, setPhotoModels] = useState(() => getActiveModelsForCategory('photo'))
  const [videoModels, setVideoModels] = useState(() => getActiveModelsForCategory('video'))
  const [audioModels, setAudioModels] = useState(() => getActiveModelsForCategory('audio'))
  const [videoAnalysisEngine, setVideoAnalysisEngineState] = useState(() => getVideoAnalysisEngine())

  useEffect(() => {
    setPhotoModels(getActiveModelsForCategory('photo'))
    setVideoModels(getActiveModelsForCategory('video'))
    setAudioModels(getActiveModelsForCategory('audio'))
    setVideoAnalysisEngineState(getVideoAnalysisEngine())
  }, [])

  const togglePhoto = (id) => {
    const next = photoModels.includes(id) ? photoModels.filter((m) => m !== id) : [...photoModels, id]
    const arr = next.length > 0 ? next : ['genai']
    setActiveModelsForCategory('photo', arr)
    setPhotoModels(arr)
  }

  const toggleVideo = (id) => {
    const next = videoModels.includes(id) ? videoModels.filter((m) => m !== id) : [...videoModels, id]
    const arr = next.length > 0 ? next : ['temporal_ai']
    setActiveModelsForCategory('video', arr)
    setVideoModels(arr)
  }

  const toggleAudio = (id) => {
    const next = audioModels.includes(id) ? audioModels.filter((m) => m !== id) : [...audioModels, id]
    const arr = next.length > 0 ? next : ['voice_cloning']
    setActiveModelsForCategory('audio', arr)
    setAudioModels(arr)
  }

  const tabs = [
    { id: 'photo', labelKey: 'scan_settings.tab_photo', icon: '📷' },
    { id: 'video', labelKey: 'scan_settings.tab_video', icon: '🎬' },
    { id: 'audio', labelKey: 'scan_settings.tab_audio', icon: '🎙️' },
  ]

  return (
    <div className="min-h-screen bg-[#0d0d0d] flex flex-col pb-20">
      <DashboardHeader
        scansCount={user?.scanCredits ?? 0}
        userEmail={user?.email}
        subscriptionTier={user?.subscriptionTier}
        onSettingsClick={onSettingsClick}
      />
      <main className="flex-1 flex flex-col w-full max-w-4xl mx-auto px-4 pt-6 pb-8 overflow-y-auto">
        <h1 className="text-xl font-bold text-white text-left mb-2">{t('scan_settings.title')}</h1>
        <p className="text-slate-400 text-sm mb-6">{t('scan_settings.subtitle')}</p>

        {/* Tab bar */}
        <div className="flex gap-1 p-1 rounded-xl bg-slate-800/50 border border-slate-700/50 mb-6">
          {tabs.map((tab) => (
            <button
              key={tab.id}
              type="button"
              onClick={() => setActiveTab(tab.id)}
              className={`flex-1 flex items-center justify-center gap-2 py-2.5 px-4 rounded-lg text-sm font-medium transition-colors ${
                activeTab === tab.id
                  ? 'bg-cyan-500/20 text-cyan-400 border border-cyan-500/40'
                  : 'text-slate-400 hover:text-white hover:bg-slate-700/50 border border-transparent'
              }`}
            >
              <span>{tab.icon}</span>
              {t(tab.labelKey)}
            </button>
          ))}
        </div>

        {/* Photo section */}
        {activeTab === 'photo' && (
          <section className="space-y-3 animate-fade-in">
            <h2 className="text-sm font-semibold text-slate-400 uppercase tracking-wider mb-3">
              {t('scan_settings.section_photo')}
            </h2>
            <ul className="space-y-3 w-full">
              {PHOTO_OPTIONS.map((opt) => (
                <SectionToggle
                  key={opt.id}
                  id={opt.id}
                  labelKey={opt.labelKey}
                  isOn={photoModels.includes(opt.id)}
                  onToggle={togglePhoto}
                  t={t}
                  disabled={opt.eliteOnly && !isElite}
                  eliteBadge={opt.eliteOnly}
                />
              ))}
            </ul>
          </section>
        )}

        {/* Video section */}
        {activeTab === 'video' && (
          <section className="space-y-3 animate-fade-in">
            <h2 className="text-sm font-semibold text-slate-400 uppercase tracking-wider mb-3">
              {t('scan_settings.section_video')}
            </h2>
            <div className="mb-4 p-4 bg-slate-800/50 rounded-xl border border-slate-700/50">
              <p className="text-sm font-medium text-white mb-2">{t('scan_settings.video_analysis_engine')}</p>
              <div className="flex gap-2">
                <button
                  type="button"
                  onClick={() => { setVideoAnalysisEngine('frame_based'); setVideoAnalysisEngineState('frame_based') }}
                  className={`flex-1 py-2 px-3 rounded-lg text-sm font-medium transition-colors ${
                    videoAnalysisEngine === 'frame_based'
                      ? 'bg-cyan-500/20 text-cyan-400 border border-cyan-500/40'
                      : 'bg-slate-700/40 text-slate-400 border border-slate-600 hover:border-slate-500'
                  }`}
                >
                  {t('scan_settings.video_engine_frame')}
                </button>
                <button
                  type="button"
                  onClick={() => { setVideoAnalysisEngine('native_video'); setVideoAnalysisEngineState('native_video') }}
                  className={`flex-1 py-2 px-3 rounded-lg text-sm font-medium transition-colors ${
                    videoAnalysisEngine === 'native_video'
                      ? 'bg-cyan-500/20 text-cyan-400 border border-cyan-500/40'
                      : 'bg-slate-700/40 text-slate-400 border border-slate-600 hover:border-slate-500'
                  }`}
                >
                  {t('scan_settings.video_engine_native')}
                </button>
              </div>
              <p className="text-xs text-slate-500 mt-2">{t('scan_settings.video_engine_hint')}</p>
            </div>
            <ul className="space-y-3 w-full">
              {VIDEO_OPTIONS.map((opt) => (
                <SectionToggle
                  key={opt.id}
                  id={opt.id}
                  labelKey={opt.labelKey}
                  isOn={videoModels.includes(opt.id)}
                  onToggle={toggleVideo}
                  t={t}
                  disabled={opt.eliteOnly && !isElite}
                  eliteBadge={opt.eliteOnly}
                />
              ))}
            </ul>
          </section>
        )}

        {/* Audio section */}
        {activeTab === 'audio' && (
          <section className="space-y-3 animate-fade-in">
            <h2 className="text-sm font-semibold text-slate-400 uppercase tracking-wider mb-3">
              {t('scan_settings.section_audio')}
            </h2>
            <ul className="space-y-3 w-full">
              {AUDIO_OPTIONS.map((opt) => (
                <SectionToggle
                  key={opt.id}
                  id={opt.id}
                  labelKey={opt.labelKey}
                  isOn={audioModels.includes(opt.id)}
                  onToggle={toggleAudio}
                  t={t}
                />
              ))}
            </ul>
          </section>
        )}

        <p className="text-slate-500 text-xs mt-6">{t('scan_settings.credits_note')}</p>
      </main>
    </div>
  )
}
