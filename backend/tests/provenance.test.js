import { describe, it, expect } from 'vitest'
import path from 'path'
import zlib from 'zlib'
import { fileURLToPath } from 'url'
import { analyzeProvenance, readC2pa, metadataHintsFromFields } from '../services/provenance.js'
import { computeVerdict } from '../services/verdict.js'

const here = path.dirname(fileURLToPath(import.meta.url))
const fixture = (name) => path.join(here, 'fixtures', 'c2pa', name)

// 1x1 PNG with a Stable Diffusion style "parameters" text chunk.
function pngWithText(key, text) {
  const crcTable = []
  for (let n = 0; n < 256; n++) {
    let c = n
    for (let k = 0; k < 8; k++) c = c & 1 ? 0xedb88320 ^ (c >>> 1) : c >>> 1
    crcTable[n] = c >>> 0
  }
  const crc = (buf) => {
    let c = 0xffffffff
    for (const b of buf) c = crcTable[(c ^ b) & 0xff] ^ (c >>> 8)
    return (c ^ 0xffffffff) >>> 0
  }
  const chunk = (type, data) => {
    const len = Buffer.alloc(4)
    len.writeUInt32BE(data.length)
    const td = Buffer.concat([Buffer.from(type, 'latin1'), data])
    const c = Buffer.alloc(4)
    c.writeUInt32BE(crc(td))
    return Buffer.concat([len, td, c])
  }
  const ihdr = Buffer.alloc(13)
  ihdr.writeUInt32BE(1, 0)
  ihdr.writeUInt32BE(1, 4)
  ihdr[8] = 8
  ihdr[9] = 2
  const idat = zlib.deflateSync(Buffer.from([0, 0, 0, 0]))
  return Buffer.concat([
    Buffer.from([0x89, 0x50, 0x4e, 0x47, 0x0d, 0x0a, 0x1a, 0x0a]),
    chunk('IHDR', ihdr),
    chunk('tEXt', Buffer.concat([Buffer.from(key, 'latin1'), Buffer.from([0]), Buffer.from(text, 'latin1')])),
    chunk('IDAT', idat),
    chunk('IEND', Buffer.alloc(0)),
  ])
}

// Minimal JPEG: SOI, an APP1 XMP packet, EOI. Enough for the metadata scan.
function jpegWithXmp(xmpBody) {
  const xmp = Buffer.from(
    `http://ns.adobe.com/xap/1.0/\0<x:xmpmeta xmlns:x="adobe:ns:meta/"><rdf:RDF xmlns:rdf="http://www.w3.org/1999/02/22-rdf-syntax-ns#">${xmpBody}</rdf:RDF></x:xmpmeta>`,
    'utf8'
  )
  const len = Buffer.alloc(2)
  len.writeUInt16BE(xmp.length + 2)
  return Buffer.concat([Buffer.from([0xff, 0xd8, 0xff, 0xe1]), len, xmp, Buffer.from([0xff, 0xd9])])
}

describe('C2PA / Content Credentials', () => {
  it('reads a validly signed manifest and its digital source type', async () => {
    const c2pa = await readC2pa({ filePath: fixture('signed-algorithmic.jpg'), mimeType: 'image/jpeg' })
    expect(c2pa.present).toBe(true)
    expect(c2pa.validation).toBe('valid')
    expect(c2pa.sourceType).toBe('algorithmicMedia')
    expect(c2pa.aiGenerated).toBe(false)
    expect(c2pa.signer?.issuer).toBeTruthy()
    expect(c2pa.actions[0].action).toBe('created')
  })

  it('reports a manifest whose signature no longer matches the pixels as tampered', async () => {
    const c2pa = await readC2pa({ filePath: fixture('tampered.jpg'), mimeType: 'image/jpeg' })
    expect(c2pa.present).toBe(true)
    expect(c2pa.validation).toBe('tampered')
  })

  it('says none for a file without a manifest and unsupported for odd formats', async () => {
    const png = pngWithText('Comment', 'plain')
    expect((await readC2pa({ buffer: png, mimeType: 'image/png' })).present).toBe(false)
    expect((await readC2pa({ buffer: png, mimeType: 'application/pdf' })).supported).toBe(false)
  })
})

describe('unsigned generator metadata', () => {
  it('finds Stable Diffusion parameters in PNG text chunks', async () => {
    const png = pngWithText('parameters', 'a cat, Steps: 20, Sampler: Euler a, Model: sd_xl_base_1.0')
    const prov = await analyzeProvenance({ buffer: png, mimeType: 'image/png', mediaCategory: 'image' })
    expect(prov.declaredAi).toBe(true)
    expect(prov.generator).toMatchObject({ id: 'stable_diffusion', source: 'metadata', signed: false })
    expect(prov.c2pa.present).toBe(false)
  })

  it('finds a Midjourney job in XMP and an IPTC AI source type', async () => {
    const jpg = jpegWithXmp(
      '<rdf:Description xmlns:dc="http://purl.org/dc/elements/1.1/" xmlns:Iptc4xmpExt="http://iptc.org/std/Iptc4xmpExt/2008-02-29/" Iptc4xmpExt:DigitalSourceType="http://cv.iptc.org/newscodes/digitalsourcetype/trainedAlgorithmicMedia"><dc:description><rdf:Alt><rdf:li xml:lang="x-default">a city at dusk --v 6 Job ID: 1234</rdf:li></rdf:Alt></dc:description><dc:creator><rdf:Seq><rdf:li>Midjourney</rdf:li></rdf:Seq></dc:creator></rdf:Description>'
    )
    const prov = await analyzeProvenance({ buffer: jpg, mimeType: 'image/jpeg', mediaCategory: 'image' })
    expect(prov.declaredAi).toBe(true)
    expect(prov.generator?.id).toBe('midjourney')
    expect(prov.metadata.digitalSourceType).toBe('trainedAlgorithmicMedia')
  })

  it('ignores ordinary camera metadata', () => {
    const r = metadataHintsFromFields({
      software: 'Adobe Lightroom 7.2',
      creatorTool: 'Lightroom',
      xmpDescription: 'Family trip',
    })
    expect(r.declaredAi).toBe(false)
    expect(r.hints).toEqual([])
  })
})

describe('verdict with provenance', () => {
  it('lets signed Content Credentials settle an AI verdict', () => {
    const v = computeVerdict({ fakeProbability: 12, provenance: { signedAi: true } })
    expect(v.verdict).toBe('likely_ai')
    expect(v.fakeProbability).toBeGreaterThanOrEqual(97)
    expect(v.evidence).toEqual(['c2pa_ai'])
    expect(v.confidence).toBeGreaterThanOrEqual(95)
  })

  it('treats unsigned generator metadata as strong but weaker evidence', () => {
    const v = computeVerdict({ fakeProbability: 40, provenance: { declaredAi: true } })
    expect(v.verdict).toBe('likely_ai')
    expect(v.evidence).toEqual(['metadata_ai'])
    expect(v.confidence).toBeGreaterThanOrEqual(80)
  })

  it('never hides a detector hit behind a signed capture, but flags the conflict', () => {
    const v = computeVerdict({ fakeProbability: 92, provenance: { signedCapture: true } })
    expect(v.verdict).toBe('likely_ai')
    expect(v.evidence).toEqual(['c2pa_capture'])
    expect(v.confidenceFactors).toContain('provenance_conflict')
    const ok = computeVerdict({ fakeProbability: 5, provenance: { signedCapture: true } })
    expect(ok.confidence).toBeGreaterThanOrEqual(90)
  })
})
