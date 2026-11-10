// يولّد أيقونات PWA من scripts/icon.svg باستخدام Chromium (Playwright).
// الاستخدام: npm run icons
import { readFile, writeFile, mkdir } from 'node:fs/promises'
import { fileURLToPath } from 'node:url'
import { createRequire } from 'node:module'

const require = createRequire(import.meta.url)
const { chromium } = require('playwright')
const root = fileURLToPath(new URL('..', import.meta.url))
const svg = await readFile(`${root}scripts/icon.svg`, 'utf8')
const out = `${root}public/icons`
await mkdir(out, { recursive: true })

// favicon/any: زوايا دائرية. maskable/apple: مربع كامل (النظام يقصّه).
const rounded = svg.replace('<rect width="512" height="512"', '<rect width="512" height="512" rx="112"')
await writeFile(`${out}/favicon.svg`, rounded)

const targets = [
  { file: 'icon-192.png', size: 192, src: rounded },
  { file: 'icon-512.png', size: 512, src: rounded },
  { file: 'icon-maskable-512.png', size: 512, src: svg },
  { file: 'apple-touch-icon.png', size: 180, src: svg },
]
const browser = await chromium.launch()
const page = await browser.newPage({ deviceScaleFactor: 1 })
for (const t of targets) {
  await page.setViewportSize({ width: t.size, height: t.size })
  await page.setContent(`<html><body style="margin:0;background:transparent">${t.src.replace('<svg ', `<svg width="${t.size}" height="${t.size}" `)}</body></html>`)
  await page.screenshot({ path: `${out}/${t.file}`, omitBackground: true, clip: { x: 0, y: 0, width: t.size, height: t.size } })
  console.log('wrote', t.file)
}
await browser.close()
