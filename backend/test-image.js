/**
 * Test image analysis with all 4 photo models: genai, deepfake, type, quality.
 * Usage: node test-image.js <path-to-image>
 */
import 'dotenv/config'
import { readFileSync } from 'fs'
import { resolve } from 'path'
import { analyzeFile } from './analysis.js'

const IMAGE_PATH = process.argv[2] || resolve(process.cwd(), '../assets/c__Users_kalib_AppData_Roaming_Cursor_User_workspaceStorage_8179bb9453ba840b22fed9d07dc51614_images_test2-61ef6a90-aed9-4b74-a5d1-7dc13914420f.png')
const MODELS = ['genai', 'deepfake', 'type', 'quality']

async function run() {
  console.log('=== VerifEye Image Test (4 options) ===\n')
  console.log('Image:', IMAGE_PATH)
  console.log('Models:', MODELS.join(', '))
  console.log('')

  let buffer
  try {
    buffer = readFileSync(IMAGE_PATH)
  } catch (e) {
    console.error('Could not read image:', e.message)
    process.exit(1)
  }

  const ext = IMAGE_PATH.split('.').pop()?.toLowerCase() || 'png'
  const mime = ext === 'jpg' || ext === 'jpeg' ? 'image/jpeg' : ext === 'png' ? 'image/png' : 'image/png'
  const name = `test.${ext}`

  const result = await analyzeFile(buffer, name, mime, MODELS)
  console.log('--- Results ---')
  console.log('Fake Probability:', result.fakeProbability + '%')
  console.log('AI Probability:', result.aiProbability + '%')
  console.log('')
  console.log('Model scores:')
  if (result.modelScores) {
    for (const [k, v] of Object.entries(result.modelScores)) {
      if (typeof v === 'object' && v !== null) {
        console.log('  ' + k + ':', JSON.stringify(v))
      } else {
        console.log('  ' + k + ':', v)
      }
    }
  }
  console.log('')
  if (result.metadata) {
    console.log('Metadata:', JSON.stringify(result.metadata, null, 2))
  }
  if (result.aiSignatures) {
    console.log('AI Signatures:', JSON.stringify(result.aiSignatures, null, 2))
  }
}

run().catch((e) => {
  console.error(e)
  process.exit(1)
})
