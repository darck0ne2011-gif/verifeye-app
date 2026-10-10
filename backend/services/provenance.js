/**
 * Provenance: who says this file was made, and how.
 *
 * Two independent sources, both local and free:
 *  - C2PA / Content Credentials: a signed manifest embedded by the tool that
 *    created or edited the file (Adobe Firefly, OpenAI, Google, Leica, ...).
 *    When the signature validates, the manifest is strong evidence; when the
 *    file was changed after signing, the manifest reports that too.
 *  - Unsigned metadata: XMP/EXIF/PNG text chunks and container tags that AI
 *    tools leave behind (Stable Diffusion parameters, Midjourney job ids,
 *    IPTC digital source type, ...). Easy to strip, hard to fake by accident.
 *
 * Screenshots and most social networks strip both, which the UI explains.
 */
import fs from 'fs'
import zlib from 'zlib'
import exifParser from 'exif-parser'
import { fileTypeFromBuffer, fileTypeFromFile } from 'file-type'
import { Reader } from '@contentauth/c2pa-node'
import { probe } from './media.js'

const C2PA_MIMES = new Set([
  'image/jpeg',
  'image/png',
  'image/webp',
  'image/heic',
  'image/heif',
  'image/avif',
  'image/tiff',
  'image/gif',
  'video/mp4',
  'video/quicktime',
  'video/x-m4v',
  'audio/mpeg',
  'audio/mp3',
  'audio/wav',
  'audio/x-wav',
  'audio/mp4',
  'audio/x-m4a',
])

const SOURCE_TYPE_PREFIX = 'http://cv.iptc.org/newscodes/digitalsourcetype/'
const AI_SOURCE_TYPES = new Set(['trainedAlgorithmicMedia', 'compositeWithTrainedAlgorithmicMedia'])
const CAPTURE_SOURCE_TYPES = new Set(['digitalCapture', 'negativeFilm', 'positiveFilm', 'print'])

/** Text patterns that identify a generator in unsigned metadata. */
const GENERATOR_MARKERS = [
  { id: 'midjourney', label: 'Midjourney', re: /midjourney/i },
  { id: 'dalle', label: 'DALL·E (OpenAI)', re: /dall[-·. ]?e/i },
  { id: 'gpt', label: 'GPT image (OpenAI)', re: /gpt-?image|chatgpt|openai/i },
  {
    id: 'stable_diffusion',
    label: 'Stable Diffusion',
    re: /stable[- ]?diffusion|sd-?xl|automatic1111|sd-webui|comfyui|invokeai|fooocus|novelai|dreamstudio/i,
  },
  { id: 'firefly', label: 'Adobe Firefly', re: /firefly/i },
  { id: 'imagen', label: 'Google Imagen / Gemini', re: /imagen|gemini|nano banana|made with google ai|synthid/i },
  { id: 'flux', label: 'Flux', re: /\bflux(\.1| pro| dev| schnell|\b)/i },
  { id: 'ideogram', label: 'Ideogram', re: /ideogram/i },
  { id: 'leonardo', label: 'Leonardo', re: /leonardo\.?ai/i },
  { id: 'recraft', label: 'Recraft', re: /recraft/i },
  { id: 'runway', label: 'Runway', re: /runway(ml)?/i },
  { id: 'kling', label: 'Kling', re: /\bkling\b/i },
  { id: 'sora', label: 'Sora (OpenAI)', re: /\bsora\b/i },
  { id: 'pika', label: 'Pika', re: /\bpika(labs)?\b/i },
  { id: 'luma', label: 'Luma Dream Machine', re: /luma ?ai|dream machine/i },
  { id: 'veo', label: 'Google Veo', re: /\bveo\b/i },
  { id: 'elevenlabs', label: 'ElevenLabs', re: /elevenlabs/i },
  { id: 'suno', label: 'Suno', re: /\bsuno\b/i },
  { id: 'udio', label: 'Udio', re: /\budio\b/i },
  { id: 'bing', label: 'Bing Image Creator / Designer', re: /bing image creator|microsoft designer/i },
  { id: 'meta_ai', label: 'Meta AI', re: /meta ai|imagine with meta/i },
  { id: 'canva', label: 'Canva Magic Media', re: /magic media/i },
]

/** Generator names as they appear in C2PA claim generators. */
const CLAIM_GENERATOR_LABELS = [
  { re: /firefly/i, label: 'Adobe Firefly', id: 'firefly' },
  { re: /openai|dall/i, label: 'OpenAI (DALL·E / GPT image)', id: 'dalle' },
  { re: /google|imagen|gemini|veo/i, label: 'Google (Imagen / Gemini / Veo)', id: 'imagen' },
  { re: /microsoft|bing|designer/i, label: 'Microsoft Designer / Bing', id: 'bing' },
  { re: /meta/i, label: 'Meta AI', id: 'meta_ai' },
  { re: /stability|stable/i, label: 'Stable Diffusion', id: 'stable_diffusion' },
  { re: /midjourney/i, label: 'Midjourney', id: 'midjourney' },
  { re: /adobe/i, label: 'Adobe', id: null },
  { re: /leica|nikon|sony|canon|samsung|pixel|truepic/i, label: null, id: null },
]

function sourceTypeName(url) {
  if (!url) return null
  const s = String(url)
  return s.startsWith(SOURCE_TYPE_PREFIX) ? s.slice(SOURCE_TYPE_PREFIX.length) : s
}

function str(v) {
  return v == null ? '' : String(v)
}

// --- C2PA -------------------------------------------------------------------

function summarizeActions(manifest) {
  const out = []
  for (const a of manifest.assertions ?? []) {
    if (!/^c2pa\.actions/.test(a.label)) continue
    for (const act of a.data?.actions ?? []) {
      out.push({
        action: str(act.action).replace(/^c2pa\./, ''),
        softwareAgent:
          typeof act.softwareAgent === 'object' ? str(act.softwareAgent?.name) : str(act.softwareAgent) || null,
        digitalSourceType: sourceTypeName(act.digitalSourceType),
        when: act.when ?? null,
      })
    }
  }
  return out
}

function classifyValidation(store) {
  const state = str(store.validation_state).toLowerCase()
  const failures = store.validation_results?.activeManifest?.failure ?? []
  const codes = failures.map((f) => str(f.code))
  if (state === 'valid' || state === 'trusted') return { status: 'valid', codes }
  if (codes.some((c) => /mismatch|hash/i.test(c))) return { status: 'tampered', codes }
  if (codes.length && codes.every((c) => /untrusted|ocsp|timeStamp/i.test(c))) return { status: 'untrusted', codes }
  return { status: 'invalid', codes }
}

function labelClaimGenerator(manifest) {
  const info = manifest.claim_generator_info?.[0]
  const raw = info?.name ? `${info.name}${info.version ? ' ' + info.version : ''}` : str(manifest.claim_generator)
  const name = raw.split(/\s+c2pa-rs/i)[0].trim() || null
  const match = CLAIM_GENERATOR_LABELS.find((m) => m.re.test(raw))
  return { name, generatorId: match?.id ?? null, generatorLabel: match?.label ?? null }
}

/**
 * Reads the embedded Content Credentials. Resolves with null when the file
 * carries none, or with a compact description of the active manifest.
 */
export async function readC2pa({ filePath, buffer, mimeType }) {
  if (!C2PA_MIMES.has(mimeType)) return { supported: false }
  let reader = null
  try {
    reader = buffer
      ? await Reader.fromAsset({ buffer, mimeType })
      : await Reader.fromAsset({ path: filePath, mimeType })
  } catch (err) {
    return { supported: true, present: false, error: str(err?.message).slice(0, 200) }
  }
  if (!reader) return { supported: true, present: false }

  let store
  try {
    store = JSON.parse(JSON.stringify(reader.json()))
  } catch {
    return { supported: true, present: true, validation: 'invalid', error: 'unreadable manifest' }
  }
  const manifest = store.manifests?.[store.active_manifest]
  if (!manifest) return { supported: true, present: true, validation: 'invalid', error: 'no active manifest' }

  const { status, codes } = classifyValidation(store)
  const actions = summarizeActions(manifest)
  const created = actions.find((a) => a.action === 'created')
  const sourceType = created?.digitalSourceType ?? actions.find((a) => a.digitalSourceType)?.digitalSourceType ?? null
  const aiGenerated = sourceType ? AI_SOURCE_TYPES.has(sourceType) : null
  const aiEdited = actions.some(
    (a) => a.action !== 'created' && a.digitalSourceType && AI_SOURCE_TYPES.has(a.digitalSourceType)
  )
  const capture = sourceType ? CAPTURE_SOURCE_TYPES.has(sourceType) : null
  const gen = labelClaimGenerator(manifest)
  const sig = manifest.signature_info ?? {}

  return {
    supported: true,
    present: true,
    validation: status,
    validationCodes: codes,
    claimGenerator: gen.name,
    generatorId: gen.generatorId,
    generatorLabel: gen.generatorLabel,
    title: manifest.title ?? null,
    signer: sig.issuer || sig.common_name ? { issuer: sig.issuer ?? null, commonName: sig.common_name ?? null } : null,
    signedAt: sig.time ?? null,
    sourceType,
    aiGenerated,
    aiEdited,
    capture,
    actions: actions.slice(0, 12),
    ingredients: (manifest.ingredients ?? []).length,
    manifestCount: Object.keys(store.manifests ?? {}).length,
  }
}

// --- Unsigned metadata ------------------------------------------------------

/** XMP packets, wherever the container put them (JPEG APP1, PNG iTXt, MP4 uuid box, ...). */
function extractXmp(buffer) {
  const head = buffer.subarray(0, Math.min(buffer.length, 4 * 1024 * 1024)).toString('latin1')
  const packets = []
  let from = 0
  for (;;) {
    const start = head.indexOf('<x:xmpmeta', from)
    if (start < 0) break
    const end = head.indexOf('</x:xmpmeta>', start)
    if (end < 0) break
    packets.push(head.slice(start, end + 12))
    from = end + 12
  }
  return packets
}

function xmpField(xmp, names) {
  for (const name of names) {
    const attr = xmp.match(new RegExp(`${name}="([^"]{1,500})"`, 'i'))
    if (attr) return attr[1]
    const el = xmp.match(new RegExp(`<${name}[^>]*>\\s*(?:<rdf:(?:Alt|Seq|Bag)>\\s*<rdf:li[^>]*>)?([^<]{1,500})`, 'i'))
    if (el) return el[1].trim()
  }
  return null
}

/** PNG tEXt / iTXt / zTXt chunks as { key: text }. */
function pngTextChunks(buffer) {
  const out = {}
  if (buffer.length < 8 || buffer.readUInt32BE(0) !== 0x89504e47) return out
  let pos = 8
  while (pos + 8 <= buffer.length) {
    const len = buffer.readUInt32BE(pos)
    const type = buffer.toString('latin1', pos + 4, pos + 8)
    const data = buffer.subarray(pos + 8, pos + 8 + len)
    if (type === 'IDAT' || type === 'IEND') break
    try {
      if (type === 'tEXt') {
        const nul = data.indexOf(0)
        out[data.toString('latin1', 0, nul)] = data.toString('latin1', nul + 1).slice(0, 4000)
      } else if (type === 'zTXt') {
        const nul = data.indexOf(0)
        out[data.toString('latin1', 0, nul)] = zlib
          .inflateSync(data.subarray(nul + 2))
          .toString('latin1')
          .slice(0, 4000)
      } else if (type === 'iTXt') {
        const nul = data.indexOf(0)
        const key = data.toString('latin1', 0, nul)
        const compressed = data[nul + 1] === 1
        let p = nul + 3
        p = data.indexOf(0, p) + 1 // language tag
        p = data.indexOf(0, p) + 1 // translated keyword
        const body = data.subarray(p)
        out[key] = (compressed ? zlib.inflateSync(body) : body).toString('utf8').slice(0, 4000)
      }
    } catch {
      // A broken chunk is simply skipped.
    }
    pos += 12 + len
  }
  return out
}

function exifSoftware(buffer, mimeType) {
  if (mimeType !== 'image/jpeg' && mimeType !== 'image/tiff') return {}
  try {
    const tags = exifParser.create(buffer).parse().tags ?? {}
    return {
      software: tags.Software ? str(tags.Software).trim() : null,
      description: tags.ImageDescription ? str(tags.ImageDescription).trim() : null,
      artist: tags.Artist ? str(tags.Artist).trim() : null,
    }
  } catch {
    return {}
  }
}

/**
 * Collects the text fields a generator might have left behind and matches
 * them against known markers.
 */
export function metadataHintsFromFields(fields) {
  const hints = []
  const seen = new Set()
  for (const [field, value] of Object.entries(fields)) {
    const text = str(value)
    if (!text) continue
    for (const m of GENERATOR_MARKERS) {
      if (seen.has(m.id) || !m.re.test(text)) continue
      seen.add(m.id)
      hints.push({ generatorId: m.id, generatorLabel: m.label, field, excerpt: text.slice(0, 120) })
    }
  }
  const sourceType = sourceTypeName(fields.digitalSourceType)
  return {
    hints,
    declaredAi: hints.length > 0 || (sourceType ? AI_SOURCE_TYPES.has(sourceType) : false),
    digitalSourceType: sourceType,
    creatorTool: fields.creatorTool ?? fields.software ?? null,
  }
}

export async function readMetadataHints({ filePath, buffer, mimeType, mediaCategory }) {
  const fields = {}
  const bytes = buffer ?? (await fs.promises.readFile(filePath))

  for (const xmp of extractXmp(bytes)) {
    fields.creatorTool ??= xmpField(xmp, ['xmp:CreatorTool', 'CreatorTool'])
    fields.xmpDescription ??= xmpField(xmp, ['dc:description', 'exif:UserComment'])
    fields.xmpCreator ??= xmpField(xmp, ['dc:creator'])
    fields.xmpTitle ??= xmpField(xmp, ['dc:title'])
    fields.digitalSourceType ??= xmpField(xmp, ['Iptc4xmpExt:DigitalSourceType', 'DigitalSourceType'])
    fields.credit ??= xmpField(xmp, ['photoshop:Credit', 'Credit'])
    fields.midjourneyJob ??= xmpField(xmp, ['iptcExt:DigImageGUID', 'DigImageGUID'])
  }
  if (mimeType === 'image/png') {
    const chunks = pngTextChunks(bytes)
    for (const key of [
      'parameters',
      'prompt',
      'workflow',
      'Software',
      'Comment',
      'Description',
      'Title',
      'invokeai_metadata',
      'sd-metadata',
      'Source',
    ]) {
      if (chunks[key]) fields[`png:${key}`] = chunks[key]
    }
    if (chunks.parameters || chunks.prompt || chunks.workflow || chunks['sd-metadata'] || chunks.invokeai_metadata) {
      fields['png:sdGenerationData'] = 'stable diffusion generation parameters'
    }
  }
  Object.assign(fields, exifSoftware(bytes, mimeType))

  if (mediaCategory === 'video' || mediaCategory === 'audio') {
    try {
      const info = await probe(filePath)
      for (const [k, v] of Object.entries(info.tags ?? {})) fields[`tag:${k}`] = v
    } catch {
      // Tags are optional; the main analysis already validated the file.
    }
  }

  const summary = metadataHintsFromFields(fields)
  return {
    ...summary,
    fields: Object.fromEntries(
      Object.entries(fields)
        .filter(([, v]) => v)
        .map(([k, v]) => [k, str(v).slice(0, 200)])
    ),
  }
}

// --- Combined ---------------------------------------------------------------

/**
 * @returns {Promise<{
 *   c2pa: object, metadata: object,
 *   signedAi: boolean, signedCapture: boolean, declaredAi: boolean, tampered: boolean,
 *   generator: { id: string|null, label: string|null, source: 'c2pa'|'metadata' } | null
 * }>}
 */
export async function analyzeProvenance({ filePath, buffer = null, mimeType, mediaCategory }) {
  if (!/^[a-z]+\/[a-z0-9.+-]+$/i.test(str(mimeType))) {
    // Callers for video/audio only know the category; sniff the container.
    const detected = buffer
      ? await fileTypeFromBuffer(buffer).catch(() => null)
      : await fileTypeFromFile(filePath).catch(() => null)
    mimeType = detected?.mime ?? 'application/octet-stream'
  }
  const [c2pa, metadata] = await Promise.all([
    readC2pa({ filePath, buffer, mimeType }).catch((err) => ({
      supported: true,
      present: false,
      error: str(err?.message),
    })),
    readMetadataHints({ filePath, buffer, mimeType, mediaCategory }).catch(() => ({
      hints: [],
      declaredAi: false,
      fields: {},
    })),
  ])

  const valid = c2pa.present && c2pa.validation === 'valid'
  const signedAi = valid && (c2pa.aiGenerated === true || c2pa.aiEdited === true)
  const signedCapture = valid && c2pa.capture === true && !c2pa.aiEdited
  const tampered = c2pa.present && c2pa.validation === 'tampered'
  const declaredAi = !signedAi && metadata.declaredAi === true

  let generator = null
  if (c2pa.present && (c2pa.generatorId || c2pa.generatorLabel)) {
    generator = {
      id: c2pa.generatorId,
      label: c2pa.generatorLabel ?? c2pa.claimGenerator,
      source: 'c2pa',
      signed: valid,
    }
  } else if (metadata.hints?.length) {
    const h = metadata.hints[0]
    generator = { id: h.generatorId, label: h.generatorLabel, source: 'metadata', signed: false }
  }

  return { c2pa, metadata, signedAi, signedCapture, declaredAi, tampered, generator }
}
