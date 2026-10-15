// SynRG '26 — name-badge backs: ten business-card-size cards (3.5 in x 2 in) on a
// Letter sheet, each with the schedule QR code. Laid out like a standard
// business-card sheet (0.5 in top/bottom, 0.75 in sides, no gaps), so it also cuts
// cleanly from plain paper.
// Run from a folder with `npm i qrcode jsqr pngjs`:  node <repo>/tools/sticker/make-badge.mjs
// Needs Chrome at the usual path. Writes sticker/synrg-badge-back-card.{html,pdf,png},
// then decodes the code back out of every card of the FINISHED PDF.
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
const INK = '#1c2b21';
const COLS = 2, ROWS = 5, W = 3.5, H = 2, LEFT = 0.75, TOP = 0.5;   // inches
const root = path.resolve(path.dirname(fileURLToPath(import.meta.url)), '..', '..');
const outDir = path.join(root, 'sticker');
fs.mkdirSync(outDir, { recursive: true });

// Level H like the poster (a badge gets scuffed), drawn as ONE filled shape: the
// library's SVG is a stroke per row and PDF viewers leave hairlines between rows.
const qr = QRCode.create(URL_, { errorCorrectionLevel: 'H' });
const N = qr.modules.size, Q = 4;
const dark = (r, c) => r >= 0 && c >= 0 && r < N && c < N && qr.modules.get(r, c);
let d = '';
for (let r = 0; r < N; r++) for (let c = 0; c < N; c++) {
  if (dark(r, c) && !dark(r, c - 1)) { let n = 1; while (dark(r, c + n)) n++; d += `M${c + Q} ${r + Q}h${n}v1h-${n}z`; }
  if (dark(r, c) && !dark(r - 1, c) && dark(r + 1, c)) { let n = 2; while (dark(r + n, c)) n++; d += `M${c + Q} ${r + Q}h1v${n}h-1z`; }
}
const svg = `<svg xmlns="http://www.w3.org/2000/svg" viewBox="0 0 ${N + 2 * Q} ${N + 2 * Q}"><path fill="${INK}" d="${d}"/></svg>`;

const card = `
  <div class="card">
    <div class="code">${svg}</div>
    <div class="txt">
      <p class="name">Syn-RG ’26</p>
      <p class="what"><b>Schedule + map</b><br><span lang="es">Programa + mapa</span></p>
      <p class="scan">Scan with your phone camera</p>
      <p class="scan es" lang="es">Escanee con la cámara de su teléfono</p>
      <p class="url">carynamichel-hue.github.io/synrg</p>
    </div>
  </div>`;

const html = `<!DOCTYPE html>
<html lang="en">
<head>
<meta charset="utf-8">
<title>Syn-RG '26 — name-badge backs (business-card size, ten to a sheet)</title>
<style>
  @page { size: 8.5in 11in; margin: 0; }
  *{box-sizing:border-box}
  html,body{margin:0;padding:0;background:#fff}
  body{font-family:"Segoe UI",Arial,Helvetica,sans-serif;color:${INK};-webkit-print-color-adjust:exact;print-color-adjust:exact}
  .sheet{width:8.5in;height:11in;padding:${TOP}in ${LEFT}in;display:grid;grid-template-columns:repeat(${COLS},${W}in);grid-template-rows:repeat(${ROWS},${H}in);overflow:hidden}
  .card{width:${W}in;height:${H}in;padding:0 .17in 0 .08in;display:flex;align-items:center;gap:.03in;overflow:hidden;outline:.5pt dashed #b5b5b5;outline-offset:-.25pt}
  p{margin:0}
  .code{flex:none;width:1.74in;height:1.74in}
  .code svg{display:block;width:100%;height:100%}
  .txt{flex:1;min-width:0}
  .name{font-size:17pt;font-weight:700;line-height:1;color:#244f2c;white-space:nowrap}
  .what{font-size:10pt;line-height:1.2;margin-top:4pt;padding-bottom:5pt;border-bottom:1pt solid #2f6b3a;white-space:nowrap}
  .scan{font-size:8.5pt;font-weight:700;line-height:1.2;margin-top:5pt;text-wrap:balance}
  .scan.es{font-weight:400;margin-top:2pt}
  .url{font-family:Consolas,"Courier New",monospace;font-size:5.7pt;color:#244f2c;white-space:nowrap;margin-top:6pt}
</style>
</head>
<body>
<div class="sheet">${card.repeat(COLS * ROWS)}
</div>
</body>
</html>`;
const htmlPath = path.join(outDir, 'synrg-badge-back-card.html');
const pdfPath = path.join(outDir, 'synrg-badge-back-card.pdf');
const pngPath = path.join(outDir, 'synrg-badge-back-card.png');
fs.writeFileSync(htmlPath, html);

const chrome = 'C:\\Program Files\\Google\\Chrome\\Application\\chrome.exe';
const profile = fs.mkdtempSync(path.join(os.tmpdir(), 'synrg-badge-'));
if (fs.existsSync(pdfPath)) fs.unlinkSync(pdfPath);
const r = spawnSync(chrome, [
  '--headless=new', `--user-data-dir=${profile}`, '--no-first-run', '--disable-gpu',
  '--no-pdf-header-footer', `--print-to-pdf=${pdfPath}`, 'file:///' + htmlPath.replace(/\\/g, '/'),
], { stdio: 'pipe', timeout: 60000 });
fs.rmSync(profile, { recursive: true, force: true });
if (!fs.existsSync(pdfPath)) { console.error(String(r.stderr)); throw new Error('PDF not written'); }

// ---- read the real PDF back
const DPI = 200;
const tmp = fs.mkdtempSync(path.join(os.tmpdir(), 'synrg-badge-png-'));
const out = spawnSync('powershell', ['-NoProfile', '-ExecutionPolicy', 'Bypass', '-File',
  path.join(root, 'tools', 'poster', 'pdf2png.ps1'), '-pdf', pdfPath, '-outdir', tmp, '-width', String(8.5 * DPI)], { encoding: 'utf8' });
const buf = fs.readFileSync(path.join(tmp, 'page1.png'));
fs.rmSync(tmp, { recursive: true, force: true });
fs.writeFileSync(pngPath, buf);
const png = PNG.sync.read(buf);

let failed = 0;
const check = (name, ok, detail = '') => { console.log(ok ? 'ok  ' : 'FAIL', name, detail); if (!ok) failed++; };
// the Windows renderer reports the page in 1/96 in
check('one Letter page', /pages: 1\b/.test(out.stdout) && /\b816x1056\b/.test(out.stdout));

const px = inch => Math.round(inch * DPI);
const isInk = (x, y) => { const i = (y * png.width + x) * 4; return png.data[i] < 150 || png.data[i + 1] < 150 || png.data[i + 2] < 150; };
for (let row = 0; row < ROWS; row++) for (let col = 0; col < COLS; col++) {
  const x0 = px(LEFT + col * W), y0 = px(TOP + row * H), w = px(W), h = px(H);
  const crop = new Uint8ClampedArray(w * h * 4);
  for (let y = 0; y < h; y++) crop.set(png.data.subarray(((y0 + y) * png.width + x0) * 4, ((y0 + y) * png.width + x0 + w) * 4), y * w * 4);
  const c = jsQR(crop, w, h);
  // a band just inside the cut line must be blank: nothing runs off the card
  let ink = 0;
  const a = px(0.05), b = px(0.12);
  for (let y = 0; y < h; y++) for (let x = 0; x < w; x++) {
    const e = Math.min(x, y, w - 1 - x, h - 1 - y);
    if (e >= a && e < b && isInk(x0 + x, y0 + y)) ink++;
  }
  check(`card ${row * COLS + col + 1}: code reads, edge band blank`, !!c && c.data === URL_ && ink === 0, (c ? '' : 'no code found ') + (ink ? ink + ' dark pixels near the edge' : ''));
}

console.log('wrote', pdfPath, fs.statSync(pdfPath).size, 'bytes');
console.log('wrote', pngPath, png.width + 'x' + png.height);
console.log(failed ? failed + ' failed' : '0 failed');
process.exit(failed ? 1 : 0);
