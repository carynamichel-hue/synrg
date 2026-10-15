// SynRG '26 — 2 in x 1 in sticker with the schedule QR code.
// Run from a folder with `npm i qrcode jsqr pngjs`:  node <repo>/tools/sticker/make.mjs
// Needs Chrome at the usual path. Writes sticker/synrg-sticker-2x1.{html,pdf,png},
// then decodes the code back out of the FINISHED PDF (at 600 dpi and at 203 dpi,
// the resolution of a thermal label printer).
import fs from 'node:fs';
import path from 'node:path';
import os from 'node:os';
import { spawnSync } from 'node:child_process';
import { fileURLToPath } from 'node:url';
import { createRequire } from 'node:module';

const require = createRequire(path.join(process.cwd(), 'x.js'));
const QRCode = require('qrcode');
const jsQR = require('jsqr');
const { PNG } = require('pngjs');

const URL_ = 'https://carynamichel-hue.github.io/synrg/';
const root = path.resolve(path.dirname(fileURLToPath(import.meta.url)), '..', '..');
const outDir = path.join(root, 'sticker');
fs.mkdirSync(outDir, { recursive: true });

// Level M, not the poster's H: at one inch the squares have to be as big as
// possible (29 x 29 instead of 37 x 37). Pure black — label printers have no green.
// Drawn here as ONE filled shape: the library's SVG is a stroke per row, and a PDF
// viewer leaves white hairlines between the rows at this size (the code then fails
// to read). Runs across cover every square; runs down close the seams between rows.
const qr = QRCode.create(URL_, { errorCorrectionLevel: 'M' });
const N = qr.modules.size, Q = 4;
const dark = (r, c) => r >= 0 && c >= 0 && r < N && c < N && qr.modules.get(r, c);
let d = '';
for (let r = 0; r < N; r++) for (let c = 0; c < N; c++) {
  if (dark(r, c) && !dark(r, c - 1)) { let n = 1; while (dark(r, c + n)) n++; d += `M${c + Q} ${r + Q}h${n}v1h-${n}z`; }
  if (dark(r, c) && !dark(r - 1, c) && dark(r + 1, c)) { let n = 2; while (dark(r + n, c)) n++; d += `M${c + Q} ${r + Q}h1v${n}h-1z`; }
}
const svg = `<svg xmlns="http://www.w3.org/2000/svg" viewBox="0 0 ${N + 2 * Q} ${N + 2 * Q}"><path fill="#000" d="${d}"/></svg>`;

const html = `<!DOCTYPE html>
<html lang="en">
<head>
<meta charset="utf-8">
<title>Syn-RG '26 — schedule sticker (2 x 1 in)</title>
<style>
  @page { size: 2in 1in; margin: 0; }
  *{box-sizing:border-box}
  html,body{margin:0;padding:0;background:#fff}
  body{font-family:"Segoe UI",Arial,Helvetica,sans-serif;color:#000;-webkit-print-color-adjust:exact;print-color-adjust:exact}
  .st{width:2in;height:1in;overflow:hidden;display:flex;align-items:center}
  .code{flex:none;width:.94in;height:.94in;margin-left:.03in}
  .code svg{display:block;width:100%;height:100%}
  .txt{flex:1;min-width:0;padding:0 .07in 0 .02in}
  p{margin:0;white-space:nowrap}
  .name{font-size:12pt;font-weight:700;line-height:1.1}
  .what{font-size:8pt;font-weight:700;line-height:1.2;margin-top:2pt}
  .what.es{font-weight:400;margin-top:0}
  .scan{font-size:6.2pt;line-height:1.25}
  .rule{height:.6pt;background:#000;margin:3pt 0 2.5pt}
</style>
</head>
<body>
<div class="st">
  <div class="code">${svg}</div>
  <div class="txt">
    <p class="name">Syn-RG ’26</p>
    <p class="what">Schedule + map</p>
    <p class="what es" lang="es">Programa + mapa</p>
    <div class="rule"></div>
    <p class="scan">Scan with your camera</p>
    <p class="scan" lang="es">Escanee con su cámara</p>
  </div>
</div>
</body>
</html>`;
const htmlPath = path.join(outDir, 'synrg-sticker-2x1.html');
const pdfPath = path.join(outDir, 'synrg-sticker-2x1.pdf');
const pngPath = path.join(outDir, 'synrg-sticker-2x1.png');
fs.writeFileSync(htmlPath, html);

const chrome = 'C:\\Program Files\\Google\\Chrome\\Application\\chrome.exe';
const profile = fs.mkdtempSync(path.join(os.tmpdir(), 'synrg-sticker-'));
if (fs.existsSync(pdfPath)) fs.unlinkSync(pdfPath);
const r = spawnSync(chrome, [
  '--headless=new', `--user-data-dir=${profile}`, '--no-first-run', '--disable-gpu',
  '--no-pdf-header-footer', `--print-to-pdf=${pdfPath}`, 'file:///' + htmlPath.replace(/\\/g, '/'),
], { stdio: 'pipe', timeout: 60000 });
fs.rmSync(profile, { recursive: true, force: true });
if (!fs.existsSync(pdfPath)) { console.error(String(r.stderr)); throw new Error('PDF not written'); }

// ---- read the real PDF back: page count + size, the code, and the edges
const render = width => {
  const tmp = fs.mkdtempSync(path.join(os.tmpdir(), 'synrg-sticker-png-'));
  const out = spawnSync('powershell', ['-NoProfile', '-ExecutionPolicy', 'Bypass', '-File',
    path.join(root, 'tools', 'poster', 'pdf2png.ps1'), '-pdf', pdfPath, '-outdir', tmp, '-width', String(width)], { encoding: 'utf8' });
  const buf = fs.readFileSync(path.join(tmp, 'page1.png'));
  fs.rmSync(tmp, { recursive: true, force: true });
  return { buf, log: out.stdout };
};
let failed = 0;
const check = (name, ok, detail = '') => { console.log(ok ? 'ok  ' : 'FAIL', name, detail); if (!ok) failed++; };

const hi = render(1200);
fs.writeFileSync(pngPath, hi.buf);
// the Windows renderer reports the page in 1/96 in
check('one page, 2 x 1 in', /pages: 1\b/.test(hi.log) && /\b192x96\b/.test(hi.log), hi.log.trim().split(/\r?\n/).pop().replace(/^.*\s{2}/, ''));

const decode = (buf, label) => {
  const png = PNG.sync.read(buf);
  const c = jsQR(new Uint8ClampedArray(png.data), png.width, png.height);
  check(`code reads at ${label}`, !!c && c.data === URL_, c ? c.data : 'no code found');
  return png;
};
const png = decode(hi.buf, '600 dpi');
decode(render(406).buf, '203 dpi (thermal label printer)');

// nothing printed in the outer 0.04 in — a label that feeds a little crooked loses nothing
const m = Math.round(0.04 * 600);
let ink = 0;
for (let y = 0; y < png.height; y++) for (let x = 0; x < png.width; x++) {
  if (x >= m && x < png.width - m && y >= m && y < png.height - m) continue;
  const i = (y * png.width + x) * 4;
  if (png.data[i] < 200 || png.data[i + 1] < 200 || png.data[i + 2] < 200) ink++;
}
check('outer 0.04 in is blank', ink === 0, ink ? ink + ' dark pixels' : '');
// and the text column ends before the right-hand margin: the last inked column
let lastInk = 0;
for (let x = png.width - 1; x >= 0 && !lastInk; x--) for (let y = 0; y < png.height; y++) {
  if (png.data[(y * png.width + x) * 4] < 128) { lastInk = x; break; }
}
console.log('     text ends', ((png.width - 1 - lastInk) / 600).toFixed(3), 'in from the right edge');

console.log('wrote', pdfPath, fs.statSync(pdfPath).size, 'bytes');
console.log('wrote', pngPath, png.width + 'x' + png.height);
console.log(failed ? failed + ' failed' : '0 failed');
process.exit(failed ? 1 : 0);
