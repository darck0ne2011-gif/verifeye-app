// Generates PWA / favicon PNGs from public/icons/icon.svg. Run: node scripts/gen-icons.mjs
import sharp from 'sharp'
import { readFileSync } from 'fs'
const svg = readFileSync(new URL('../public/icons/icon.svg', import.meta.url))
const out = (name) => new URL(`../public/icons/${name}`, import.meta.url).pathname
const sizes = [48, 72, 96, 144, 192, 512]
for (const s of sizes)
  await sharp(svg)
    .resize(s, s)
    .png()
    .toFile(out(`icon-${s}.png`))
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

// --- Android launcher icons + splash (only when the android project exists) ---
import { existsSync, rmSync } from 'fs'
const res = new URL('../android/app/src/main/res/', import.meta.url).pathname
if (existsSync(res)) {
  const mark = svg.toString().replace(/<rect[^>]*\/>/, '') // the eye without the tile
  const densities = { mdpi: 1, hdpi: 1.5, xhdpi: 2, xxhdpi: 3, xxxhdpi: 4 }
  for (const [d, scale] of Object.entries(densities)) {
    const dir = `${res}mipmap-${d}/`
    const launcher = Math.round(48 * scale)
    await sharp(svg).resize(launcher, launcher).png().toFile(`${dir}ic_launcher.png`)
    await sharp(svg).resize(launcher, launcher).png().toFile(`${dir}ic_launcher_round.png`)
    // Adaptive foreground: 108dp canvas, mark inside the 66dp safe zone.
    const canvas = Math.round(108 * scale)
    const inner = Math.round(60 * scale)
    const fg = await sharp(Buffer.from(mark)).resize(inner, inner).png().toBuffer()
    await sharp({ create: { width: canvas, height: canvas, channels: 4, background: { r: 0, g: 0, b: 0, alpha: 0 } } })
      .composite([{ input: fg, gravity: 'centre' }])
      .png()
      .toFile(`${dir}ic_launcher_foreground.png`)
  }
  // One splash for every orientation/density: the mark centred on the brand background.
  const splashIcon = await sharp(Buffer.from(mark)).resize(400, 400).png().toBuffer()
  await sharp({ create: { width: 1600, height: 1600, channels: 4, background: '#0b1220' } })
    .composite([{ input: splashIcon, gravity: 'centre' }])
    .png()
    .toFile(`${res}drawable/splash.png`)
  for (const d of Object.keys(densities)) {
    for (const o of ['land', 'port']) rmSync(`${res}drawable-${o}-${d}`, { recursive: true, force: true })
  }
  console.log('android icons + splash generated')
}
