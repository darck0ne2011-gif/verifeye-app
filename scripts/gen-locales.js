import fs from 'fs'
import path from 'path'
import { fileURLToPath } from 'url'

const __dirname = path.dirname(fileURLToPath(import.meta.url))
const localesDir = path.join(__dirname, '../public/locales')
const enPath = path.join(localesDir, 'en/translation.json')
const en = JSON.parse(fs.readFileSync(enPath, 'utf8'))

const ALL_LANGS = ['hi','bn','pa','jv','te','mr','ta','ur','ko','vi','tr','it','th','gu','kn','ml','or','my','am','fa','yo','ig','ha','sw','az','bg','cs','da','el','fi','he','hu','ms','nl','no','pl','sk','sv','uk','ja']

for (const lng of ALL_LANGS) {
  const dir = path.join(localesDir, lng)
  if (!fs.existsSync(dir)) fs.mkdirSync(dir, { recursive: true })
  const file = path.join(dir, 'translation.json')
  if (!fs.existsSync(file)) {
    fs.writeFileSync(file, JSON.stringify(en, null, 2))
    console.log('Created:', lng)
  }
}
console.log('Done.')
