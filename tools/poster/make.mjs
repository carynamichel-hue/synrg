// Run from a folder with `npm i qrcode jsqr pngjs`, Chrome on :9336.
// SynRG '26 — QR code + printable how-to poster (EN page + ES page) + PDF,
// then decode the code back out of the FINISHED poster render.
import fs from 'node:fs'
import path from 'node:path'
import QRCode from 'qrcode'
import jsQR from 'jsqr'
import { PNG } from 'pngjs'

const URL_ = 'https://carynamichel-hue.github.io/synrg/'
const REPO = 'C:/Users/caryn/dev/synrg-pages'
const INK = '#1c2b21'
fs.mkdirSync(path.join(REPO, 'qr'), { recursive: true })
fs.mkdirSync(path.join(REPO, 'poster'), { recursive: true })

const opts = { errorCorrectionLevel: 'H', margin: 4, color: { dark: INK, light: '#ffffff' } }
const svg = await QRCode.toString(URL_, { ...opts, type: 'svg' })
fs.writeFileSync(path.join(REPO, 'qr/synrg-qr.svg'), svg)
await QRCode.toFile(path.join(REPO, 'qr/synrg-qr.png'), URL_, { ...opts, width: 1023 })

const T = {
  en: {
    lang: 'en', top: "SynRG '26 · October 6–8 · Hosted by Overdevest Nurseries",
    h1: 'Your schedule, on your phone',
    blurb: 'What’s on now, where it is, a map of the nursery — and where you mark your working groups.',
    kicker: 'Scan with your phone camera', or: 'or type',
    howTo: 'How to use it',
    steps: [
      ['Scan the code', 'Open your phone’s <b>Camera</b> and point it at the code. <b>Don’t press the button</b> — just tap the link that pops up.'],
      ['Right now', 'The top of the page shows what’s on <b>now</b>, where, and what’s next. The <b>Tue · Wed · Thu</b> buttons jump to each day.'],
      ['Pick your working groups', 'Under <b>Working groups</b>, find your name, then tap <b>I’m going</b> on one group for <b>Session 1</b> and one for <b>Session 2</b>. Each group shows how many are going. Changed your mind? Tap another group.'],
      ['Find your way', 'Tap any <b>📍 place</b> to see it on the map of the nursery.'],
      ['Rides', '<b>🚌 Ride provided</b> means we drive you. <b>🚗 On your own</b> means you get yourself there.'],
      ['Who to meet', 'At the bottom of the page, <b>Who to meet</b> opens Common Ground: the people who share your topics.'],
    ],
    foot: 'Tap <b>Español</b> at the top of the page for Spanish. Once it has opened, the schedule works without a signal — the map and the group sign-ups need one.',
  },
  es: {
    lang: 'es', top: 'SynRG ’26 · 6–8 de octubre · Organizado por Overdevest Nurseries',
    h1: 'Su programa, en su teléfono',
    blurb: 'Qué está pasando ahora, dónde, un mapa del vivero — y dónde marca sus grupos de trabajo.',
    kicker: 'Escanee con la cámara de su teléfono', or: 'o escriba',
    howTo: 'Cómo usarlo',
    steps: [
      ['Escanee el código', 'Abra la <b>Cámara</b> de su teléfono y apúntela al código. <b>No presione el botón</b> — solo toque el enlace que aparece.'],
      ['Ahora', 'Arriba de la página verá qué está pasando <b>ahora</b>, dónde, y qué sigue. Los botones <b>Mar · Mié · Jue</b> lo llevan a cada día.'],
      ['Elija sus grupos de trabajo', 'En <b>Grupos de trabajo</b>, busque su nombre y toque <b>Voy</b> en un grupo para la <b>Sesión 1</b> y uno para la <b>Sesión 2</b>. Cada grupo muestra cuántos van. ¿Cambió de idea? Toque otro grupo.'],
      ['Encuentre el lugar', 'Toque cualquier <b>📍 lugar</b> para verlo en el mapa del vivero.'],
      ['Transporte', '<b>🚌 Transporte incluido</b> significa que nosotros lo llevamos. <b>🚗 Por su cuenta</b> significa que usted llega por sí mismo.'],
      ['A quién conocer', 'Al final de la página, <b>A quién conocer</b> abre Common Ground: las personas con sus mismos temas.'],
    ],
    foot: 'Si la página sale en inglés, toque <b>Español</b> arriba. Una vez abierta, el programa funciona sin señal — el mapa y la inscripción a los grupos necesitan señal.',
  },
}

const page = t => `
<section class="sheet" lang="${t.lang}">
  <p class="org">${t.top}</p>
  <h1>${t.h1}</h1>
  <p class="blurb">${t.blurb}</p>
  <div class="codewrap">
    <div class="code">${svg}</div>
    <p class="kicker">${t.kicker}</p>
    <p class="url"><span class="lead">${t.or}</span> carynamichel-hue.github.io/synrg</p>
  </div>
  <div class="how">
    <h2>${t.howTo}</h2>
    <ol>${t.steps.map(([h, p]) => `<li><b class="st">${h}</b><span>${p}</span></li>`).join('')}</ol>
  </div>
  <p class="foot">${t.foot}</p>
</section>`

const html = `<!DOCTYPE html>
<html lang="en">
<head>
<meta charset="utf-8">
<title>SynRG '26 — schedule poster</title>
<!-- Generated: page 1 English, page 2 Spanish. Print the one you need (or both). -->
<style>
  @page { size: 8.5in 11in; margin: 0.5in; }
  :root{
    --ink:#1c2b21; --g:#2f6b3a; --g-deep:#244f2c; --g-soft:#d8ead9; --wash:#f3f6f1; --amber:#f2b33d; --slate:#4a5a4f;
    --display:"Avenir Next Condensed","Roboto Condensed","Arial Narrow","Helvetica Neue",Helvetica,sans-serif;
    --body:system-ui,-apple-system,"Segoe UI",Roboto,sans-serif;
    --mono:ui-monospace,"SF Mono","Roboto Mono",Menlo,Consolas,monospace;
  }
  *{box-sizing:border-box}
  html,body{margin:0;padding:0}
  body{font-family:var(--body);color:var(--ink);background:#fff;-webkit-print-color-adjust:exact;print-color-adjust:exact}
  .sheet{width:7.5in;height:10in;margin:0 auto;display:flex;flex-direction:column;text-align:center;break-after:page;overflow:hidden}
  .sheet:last-child{break-after:auto}
  .org{font-family:var(--mono);font-size:10pt;letter-spacing:.14em;text-transform:uppercase;color:var(--g);margin:0}
  h1{font-family:var(--display);text-transform:uppercase;font-size:34pt;line-height:1;margin:6pt 0 0;color:var(--g-deep);font-weight:700;letter-spacing:.01em}
  .blurb{font-size:12.5pt;line-height:1.4;margin:8pt auto 0;max-width:6in;color:var(--slate)}
  .codewrap{margin:12pt auto 0}
  .code{width:3.55in;height:3.55in;margin:0 auto;padding:8pt;border:2.5pt solid var(--g-soft);border-radius:14pt;background:#fff}
  .code svg{display:block;width:100%;height:100%}
  .kicker{font-family:var(--display);text-transform:uppercase;letter-spacing:.05em;font-size:15pt;font-weight:700;color:var(--ink);margin:8pt 0 0}
  .url{font-family:var(--mono);font-size:11pt;color:var(--g-deep);margin:3pt 0 0}
  .url .lead{font-family:var(--body);color:var(--slate)}
  .how{margin:12pt 0 0;background:var(--wash);border:1.5pt solid var(--g-soft);border-radius:12pt;padding:11pt 16pt 10pt;text-align:left}
  .how h2{font-family:var(--display);text-transform:uppercase;letter-spacing:.04em;font-size:16pt;margin:0 0 6pt;color:var(--g-deep);text-align:center}
  ol{list-style:none;margin:0;padding:0;counter-reset:s;display:grid;grid-template-columns:1fr 1fr;gap:8pt 18pt}
  li{counter-increment:s;position:relative;padding-left:27pt;font-size:10.3pt;line-height:1.32;color:var(--ink)}
  li::before{content:counter(s);position:absolute;left:0;top:0;width:20pt;height:20pt;border-radius:50%;background:var(--g);color:#fff;
             font:700 11pt var(--body);display:grid;place-items:center}
  li:nth-child(3)::before{background:var(--amber);color:var(--ink)}
  li .st{display:block;font-family:var(--display);text-transform:uppercase;letter-spacing:.03em;font-size:12pt;color:var(--g-deep);margin-bottom:1pt}
  li span b{color:var(--g-deep)}
  .foot{margin:auto 0 0;font-size:10pt;line-height:1.4;color:var(--slate);padding-top:8pt}
  @media screen{body{background:#ccc;padding:20px 0}.sheet{background:#fff;padding:.5in;width:8.5in;height:11in;margin:0 auto 20px;box-shadow:0 2px 12px rgba(0,0,0,.25)}}
</style>
</head>
<body>
${page(T.en)}
${page(T.es)}
</body>
</html>`
const posterHtml = path.join(REPO, 'poster/poster-synrg-schedule.html')
fs.writeFileSync(posterHtml, html)

// ---- render: PDF + a picture per page, and decode the code out of each picture
const list = await (await fetch('http://127.0.0.1:9336/json/list')).json()
const ws = new WebSocket(list.find(t => t.type === 'page').webSocketDebuggerUrl); await new Promise(r => ws.onopen = r)
let id = 0; const pend = {}; ws.onmessage = e => { const m = JSON.parse(e.data); if (pend[m.id]) { pend[m.id](m.result); delete pend[m.id] } }
const send = (method, params = {}) => new Promise(r => { pend[++id] = r; ws.send(JSON.stringify({ id, method, params })) })
const ev = async x => (await send('Runtime.evaluate', { expression: x, returnByValue: true, awaitPromise: true })).result?.value
const sleep = ms => new Promise(r => setTimeout(r, ms))
await send('Page.enable')
await send('Emulation.clearDeviceMetricsOverride')
await send('Emulation.setDeviceMetricsOverride', { width: 900, height: 1200, deviceScaleFactor: 1, mobile: false })
await send('Page.navigate', { url: 'file:///' + posterHtml.replace(/\\/g, '/') }); await sleep(1500)

// nothing may spill out of a sheet (each is a fixed Letter box with overflow hidden)
const spill = await ev(`[...document.querySelectorAll('.sheet')].map(s => { const r = s.getBoundingClientRect(); const pad = parseFloat(getComputedStyle(s).paddingBottom); return [...s.querySelectorAll('*')].some(e => e.getBoundingClientRect().bottom > r.bottom - pad + 1) })`)
console.log('content spills past the page:', JSON.stringify(spill))

const pdf = await send('Page.printToPDF', { paperWidth: 8.5, paperHeight: 11, marginTop: 0, marginBottom: 0, marginLeft: 0, marginRight: 0, preferCSSPageSize: true, printBackground: true })
fs.writeFileSync(path.join(REPO, 'poster/poster-synrg-schedule.pdf'), Buffer.from(pdf.data, 'base64'))

await send('Emulation.setEmulatedMedia', { media: 'print' })
await sleep(300)
const n = await ev('document.querySelectorAll(".sheet").length')
for (let i = 0; i < n; i++) {
  const r = JSON.parse(await ev(`JSON.stringify(document.querySelectorAll('.sheet')[${i}].getBoundingClientRect())`))
  const y = r.y + await ev('scrollY')
  const shot = await send('Page.captureScreenshot', { captureBeyondViewport: true, clip: { x: r.x, y, width: r.width, height: r.height, scale: 1.4 } })
  const buf = Buffer.from(shot.data, 'base64')
  const name = i === 0 ? 'printview-en.png' : 'printview-es.png'
  fs.writeFileSync(path.join(REPO, 'poster', name), buf)
  const png = PNG.sync.read(buf)
  const code = jsQR(new Uint8ClampedArray(png.data), png.width, png.height)
  console.log(name, 'decodes to:', code && code.data, code && code.data === URL_ ? 'MATCH' : 'NO MATCH')
}
// and the standalone PNG
{ const png = PNG.sync.read(fs.readFileSync(path.join(REPO, 'qr/synrg-qr.png'))); const c = jsQR(new Uint8ClampedArray(png.data), png.width, png.height); console.log('qr png decodes to:', c && c.data, c && c.data === URL_ ? 'MATCH' : 'NO MATCH') }
console.log('pdf bytes', fs.statSync(path.join(REPO, 'poster/poster-synrg-schedule.pdf')).size)
process.exit(0)
