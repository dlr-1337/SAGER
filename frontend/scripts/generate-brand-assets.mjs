// Regenerates the versioned icons from public/favicon.svg: node scripts/generate-brand-assets.mjs
// Run once by hand and commit the result, so the gateway build does not need a browser.
import assert from 'node:assert/strict';
import { readFileSync, writeFileSync } from 'node:fs';
import { chromium } from '@playwright/test';

const root = new URL('../', import.meta.url);
const pub = (file) => new URL(`public/${file}`, root);
const svg = readFileSync(pub('favicon.svg'), 'utf8');
// Platforms apply their own mask, so these variants are square.
const square = svg.replace(' rx="7"', '');
// Scale 0.8 keeps the farthest corner at radius 12.5, inside the 12.8 maskable safe zone.
const maskable = square
  .replace(/(<rect [^>]*>)/, '$1<g transform="translate(3.2 3.2) scale(.8)">')
  .replace('</svg>', '</g></svg>');
const font = (weight) => {
  const file = `node_modules/@fontsource/open-sans/files/open-sans-latin-${weight}-normal.woff2`;
  const data = readFileSync(new URL(file, root)).toString('base64');
  return `@font-face{font-family:OS;font-weight:${weight};src:url(data:font/woff2;base64,${data})}`;
};

const browser = await chromium.launch({ channel: 'chrome' });
async function shot(width, height, html, omitBackground = false) {
  const page = await browser.newPage({ viewport: { width, height } });
  await page.setContent(
    `<!doctype html><style>*{margin:0}svg{display:block;width:100vw;height:100vh}</style>${html}`,
  );
  await page.evaluate(() => document.fonts.ready);
  const png = await page.screenshot({ omitBackground });
  await page.close();
  assert.deepEqual([png.readUInt32BE(16), png.readUInt32BE(20)], [width, height]);
  return png;
}

const og = `<style>${font(800)}${font(600)}
body{width:1200px;height:630px;background:#0c4837;color:#fff;font-family:OS;display:flex;align-items:center;gap:72px;padding:0 96px;box-sizing:border-box}
.m{flex:none;width:240px;height:240px}.m svg{width:240px;height:240px}
h1{font-size:112px;font-weight:800;line-height:1;letter-spacing:.02em}
p{font-size:40px;font-weight:600;line-height:1.3;margin-top:24px}
small{display:block;font-size:30px;font-weight:600;margin-top:28px;color:#d9eadf}</style>
<div class=m>${svg.replace('fill="#0c4837"', 'fill="#073b2d"')}</div><div><h1>SAGER</h1><p>Sistema de Apoio à<br>Gestão de Residentes</p><small>IF Goiano · Campus Urutaí</small></div>`;

const favicon = await shot(32, 32, svg, true);
writeFileSync(pub('apple-touch-icon.png'), await shot(180, 180, square));
writeFileSync(pub('icon-192.png'), await shot(192, 192, maskable));
writeFileSync(pub('icon-512.png'), await shot(512, 512, maskable));
writeFileSync(pub('og-image.png'), await shot(1200, 630, og));
await browser.close();

// A PNG inside an ICO container needs no image library.
const header = Buffer.alloc(22);
header.writeUInt16LE(1, 2); // type: icon
header.writeUInt16LE(1, 4); // one image
header[6] = header[7] = 32;
header.writeUInt16LE(1, 10); // colour planes
header.writeUInt16LE(32, 12); // bits per pixel
header.writeUInt32LE(favicon.length, 14);
header.writeUInt32LE(22, 18); // image offset
writeFileSync(pub('favicon.ico'), Buffer.concat([header, favicon]));
