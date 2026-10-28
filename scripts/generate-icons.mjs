// Renders public/icons/icon.svg into the PNG sizes the manifest needs.
// Uses the Playwright Chromium available in the dev environment.
import { readFile } from 'node:fs/promises'
import { createRequire } from 'node:module'
const require = createRequire(import.meta.url)
// Resolves a local install first, then a global one (NODE_PATH).
const { chromium } = require('playwright')

const svg = await readFile(new URL('../public/icons/icon.svg', import.meta.url), 'utf8')
const targets = [
  { file: 'icon-192.png', size: 192, pad: 0 },
  { file: 'icon-512.png', size: 512, pad: 0 },
  { file: 'apple-touch-icon.png', size: 180, pad: 0, square: true },
  { file: 'icon-maskable-512.png', size: 512, pad: 0.12, square: true },
]
const browser = await chromium.launch()
const page = await browser.newPage()
for (const t of targets) {
  const inner = Math.round(t.size * (1 - t.pad * 2))
  const html = `<html><body style="margin:0;background:${t.square ? '#0d1117' : 'transparent'};width:${t.size}px;height:${t.size}px;display:grid;place-items:center">
    <div style="width:${inner}px;height:${inner}px">${svg.replace('<svg ', `<svg width="${inner}" height="${inner}" `).replace(t.square ? 'rx="112"' : '__', t.square ? 'rx="0"' : '__')}</div></body></html>`
  await page.setViewportSize({ width: t.size, height: t.size })
  await page.setContent(html)
  await page.screenshot({ path: new URL(`../public/icons/${t.file}`, import.meta.url).pathname, omitBackground: !t.square })
  console.log('wrote', t.file)
}
await browser.close()
