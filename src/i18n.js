import i18n from 'i18next'
import { initReactI18next } from 'react-i18next'
import Backend from 'i18next-http-backend'
import LanguageDetector from 'i18next-browser-languagedetector'

i18n
  .use(Backend)
  .use(LanguageDetector)
  .use(initReactI18next)
  .init({
    fallbackLng: 'en',
    supportedLngs: ['en','ro','es','fr','de','zh','ar','pt','ru','id','ban','hi','bn','pa','jv','te','mr','ta','ur','ko','vi','tr','it','th','gu','kn','ml','or','my','am','fa','yo','ig','ha','sw','az','bg','cs','da','el','fi','he','hu','ms','nl','no','pl','sk','sv','uk','ja'],
    detection: {
      order: ['localStorage', 'navigator'],
      caches: ['localStorage'],
      lookupLocalStorage: 'verifeye_lng',
    },
    // Prefer Romanian when browser language is 'ro', else English
    load: 'languageOnly',
    interpolation: {
      escapeValue: false,
    },
    backend: {
      loadPath: '/locales/{{lng}}/translation.json',
    },
  })

export default i18n
