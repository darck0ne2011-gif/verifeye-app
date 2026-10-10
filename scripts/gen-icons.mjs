// Generates PWA / favicon PNGs from public/icons/icon.svg. Run: node scripts/gen-icons.mjs
import sharp from 'sharp'
import { readFileSync } from 'fs'
const svg = readFileSync(new URL('../public/icons/icon.svg', import.meta.url))
const out = (name) => new URL(`../public/icons/${name}`, import.meta.url).pathname
const sizes = [48, 72, 96, 144, 192, 512]
for (const s of sizes) await sharp(svg).resize(s, s).png().toFile(out(`icon-${s}.png`))
// Maskable: icon on a solid background with safe-zone padding.
for (const s of [192, 512]) {
  const inner = Math.round(s * 0.7)
  const icon = await sharp(svg).resize(inner, inner).png().toBuffer()
  await sharp({ create: { width: s, height: s, channels: 4, background: '#0b1220' } })
    .composite([{ input: icon, gravity: 'centre' }])
    .png()
    .toFile(out(`maskable-${s}.png`))
}
await sharp(svg).resize(180, 180).png().toFile(out('apple-touch-icon.png'))
await sharp(svg).resize(32, 32).png().toFile(out('favicon-32.png'))
console.log('icons generated')
