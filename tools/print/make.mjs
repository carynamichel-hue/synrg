// Syn-RG '26 — PRINTABLE agenda (Letter, EN pages then ES pages) built from the
// live CONFIG block in index.html, so it can never drift from the phone page.
//   node tools/print/make.mjs            → print/synrg-agenda.html + print/synrg-agenda.pdf
// Needs Chrome at the usual path. Headless must run with its own user-data-dir
// while the real Chrome is open, otherwise nothing is written.
import fs from 'node:fs';
import path from 'node:path';
import vm from 'node:vm';
import os from 'node:os';
import { spawnSync } from 'node:child_process';
import { fileURLToPath } from 'node:url';

const root = path.resolve(path.dirname(fileURLToPath(import.meta.url)), '..', '..');
const html = fs.readFileSync(path.join(root, 'index.html'), 'utf8');
const a = html.indexOf('const CONFIG =');
const b = html.indexOf('/* ====================== END OF THE EDITABLE BLOCK');
if (a < 0 || b < 0) throw new Error('CONFIG block not found');
const CONFIG = vm.runInNewContext(html.slice(a, b) + '\nCONFIG', {});

const URL_ = 'carynamichel-hue.github.io/synrg';
const qrPng = fs.readFileSync(path.join(root, 'qr', 'synrg-qr.png')).toString('base64');

const T = {
  en: { sched: 'Schedule', groups: 'Working groups — Wednesday', agendas: 'Working group agendas',
        s1: 'Session 1 · 8:00–9:30', s2: 'Session 2 · 10:30–12:00', group: 'Group',
        provided: 'Ride provided', own: 'On your own', know: 'Good to know',
        scan: 'Scan for the live phone schedule (map, “Right now”, sign-ups):',
        time: 'Time', what: 'What', where: 'Where', page: 'Page', printed: 'Printed' },
  es: { sched: 'Programa', groups: 'Grupos de trabajo — miércoles', agendas: 'Agendas de los grupos de trabajo',
        s1: 'Sesión 1 · 8:00–9:30', s2: 'Sesión 2 · 10:30–12:00', group: 'Grupo',
        provided: 'Transporte incluido', own: 'Por su cuenta', know: 'Bueno saber',
        scan: 'Escanee para ver el programa en el teléfono (mapa, “Ahora”, inscripciones):',
        time: 'Hora', what: 'Qué', where: 'Dónde', page: 'Página', printed: 'Impreso' },
};

const esc = s => String(s ?? '').replace(/[&<>]/g, c => ({ '&': '&amp;', '<': '&lt;', '>': '&gt;' }[c]));
const tx = (v, L) => (v && typeof v === 'object') ? (v[L] ?? v.en ?? '') : (v ?? '');
function hm(t, L) {                       // "14:15" → "2:15 pm" (EN) / "14:15" (ES)
  const [h, m] = t.split(':').map(Number);
  if (L === 'es') return `${h}:${String(m).padStart(2, '0')}`;
  const h12 = ((h + 11) % 12) + 1;
  return `${h12}:${String(m).padStart(2, '0')}${h < 12 ? ' am' : ' pm'}`;
}
function placeName(id, L) {
  const p = CONFIG.places[id];
  if (!p) return '';
  let s = esc(tx(p.name, L));
  if (p.hint) s += ` <span class="hint">· ${esc(tx(p.hint, L))}</span>`;
  return s;
}

function schedulePage(L, days, { header = false, tail = '' } = {}) {
  const t = T[L];
  let out = `<section class="page ${L}">`;
  if (header) out += `
  <header class="top">
    <div>
      <h1>${esc(CONFIG.eventName)}</h1>
      <p class="sub">${esc(tx(CONFIG.dateLabel, L))} · ${esc(tx(CONFIG.orgName, L))}</p>
    </div>
    <div class="qr"><img src="data:image/png;base64,${qrPng}" alt="QR"><div>${esc(t.scan)}<br><b>${URL_}</b><br><span class="printed">${t.printed} ${printed}</span></div></div>
  </header>`;
  for (const day of days) {
    out += `<h2>${esc(tx(day.label, L))}</h2>
    <table class="sched"><colgroup><col class="c-time"><col class="c-what"><col class="c-where"></colgroup>
    <thead><tr><th>${t.time}</th><th>${t.what}</th><th>${t.where}</th></tr></thead><tbody>`;
    for (const bl of day.blocks) {
      let what = `<b>${esc(tx(bl.title, L))}</b>`;
      if (bl.details) what += `<div class="det">${esc(tx(bl.details, L))}</div>`;
      if (bl.stops) for (const s of bl.stops)
        what += `<div class="det">• <b>${esc(tx(s.name, L))}</b>${s.details ? ' — ' + esc(tx(s.details, L)) : ''}</div>`;
      if (bl.note) what += `<div class="note">${esc(tx(bl.note, L))}</div>`;
      let where = bl.groups ? `<i>${esc(L === 'es' ? 'Vea la tabla de grupos' : 'See the groups table')}</i>` : placeName(bl.where, L);
      if (bl.ride) where += `<div class="ride ${bl.ride}">${bl.ride === 'provided' ? '🚌 ' + t.provided : '🚗 ' + t.own}</div>`;
      out += `<tr><td class="time">${hm(bl.start, L)}<span class="dash">–</span>${hm(bl.end, L)}</td><td>${what}</td><td>${where}</td></tr>`;
    }
    out += `</tbody></table>`;
  }
  out += tail + `</section>`;
  return out;
}
function knowBlock(L) {
  const t = T[L];
  return `<h2>${t.know}</h2><ul class="know">${CONFIG.goodToKnow.filter(g => !tx(g, L).startsWith('📷')).map(g => `<li>${esc(tx(g, L))}</li>`).join('')}</ul>`;
}

function groupsTable(L) {
  const t = T[L];
  let out = `<h2 class="gap">${t.groups}</h2>
  <table class="groups"><colgroup><col class="g-name"><col><col></colgroup>
  <thead><tr><th>${t.group}</th><th>${t.s1}</th><th>${t.s2}</th></tr></thead><tbody>`;
  for (const g of CONFIG.groups) {
    out += `<tr><td><b>${esc(tx(g.name, L))}</b></td>
      <td><div class="room">${placeName(g.s1, L)}</div><div class="theme">${esc(tx(g.summary1, L))}</div></td>
      <td><div class="room">${placeName(g.s2, L)}</div><div class="theme">${esc(tx(g.summary2, L))}</div></td></tr>`;
  }
  out += `</tbody></table>`;
  return out;
}
function agendasPage(L) {
  const t = T[L];
  let out = `<section class="page"><h1 class="small">${esc(CONFIG.eventName)} · ${t.agendas}</h1>`;
  for (const g of CONFIG.groups) {
    out += `<div class="agenda">
      <h3>${esc(tx(g.name, L))}</h3>
      <div class="cols">
        <div><div class="sess">${t.s1} · <span class="room">${placeName(g.s1, L)}</span></div>
          <ul>${(tx(g.agenda1, L) || []).map(l => `<li>${esc(l)}</li>`).join('')}</ul></div>
        <div><div class="sess">${t.s2} · <span class="room">${placeName(g.s2, L)}</span></div>
          <ul>${(tx(g.agenda2, L) || []).map(l => `<li>${esc(l)}</li>`).join('')}</ul></div>
      </div></div>`;
  }
  out += `</section>`;
  return out;
}

const css = `
@page { size: letter; margin: 0.45in 0.55in 0.5in; }
* { box-sizing: border-box; }
html, body { margin: 0; color: #1c2b21; font: 10.5pt/1.3 "Segoe UI", Arial, Helvetica, sans-serif; background: #fff; }
.page { page-break-after: always; }
.page:last-child { page-break-after: auto; }
.top { display: flex; justify-content: space-between; align-items: center; gap: 16px; border-bottom: 3px solid #2f6b3a; padding-bottom: 4px; margin-bottom: 2px; }
h1 { margin: 0; font-size: 21pt; color: #244f2c; letter-spacing: .3px; }
h1.small { font-size: 16pt; border-bottom: 3px solid #2f6b3a; padding-bottom: 4px; margin-bottom: 8px; }
h1.agendas-h { margin-top: 14px; }
.sub { margin: 2px 0 0; color: #4a5a4f; font-size: 11pt; }
.printed { font-size: 8.5pt; }
h2.gap { margin-top: 16px; }
.page.es { font-size: 10pt; }
.page.es .det { font-size: 8.6pt; }
.page.es .note { font-size: 8.3pt; }
.page.es h2 { margin: 7px 0 2px; }
.page.es td { padding: 2px 6px 2px 0; }
.qr { display: flex; align-items: center; gap: 8px; font-size: 8pt; color: #4a5a4f; max-width: 2.9in; }
.qr img { width: 0.85in; height: 0.85in; }
h2 { font-size: 12.5pt; margin: 9px 0 3px; color: #244f2c; text-transform: uppercase; letter-spacing: .6px; }
table { width: 100%; border-collapse: collapse; }
th { text-align: left; font-size: 8pt; text-transform: uppercase; letter-spacing: .5px; color: #4a5a4f; border-bottom: 1px solid #9fb3a3; padding: 2px 6px 2px 0; }
td { vertical-align: top; padding: 2.5px 6px 2.5px 0; border-bottom: 1px solid #dde5da; }
tr { page-break-inside: avoid; }
.c-time { width: 1.35in; } .c-where { width: 2.1in; }
.time { font-weight: 700; white-space: nowrap; font-variant-numeric: tabular-nums; }
.time .dash { color: #9fb3a3; padding: 0 1px; }
.det { color: #4a5a4f; font-size: 9pt; margin-top: 0; }
.note { color: #4a5a4f; font-size: 8.6pt; font-style: italic; margin-top: 2px; }
.hint { color: #4a5a4f; font-size: 9pt; }
.ride { display: inline-block; margin-left: 6px; vertical-align: 1px; font-size: 8pt; padding: 0 5px; border-radius: 3px; border: 1px solid #c8d3cb; }
.ride.provided { background: #fdf0d5; border-color: #e3c47a; }
ul.know { margin: 2px 0 0; padding-left: 0; list-style: none; font-size: 9.3pt; }
ul.know li { margin: 2px 0; }
table.groups th, table.groups td { padding: 5px 8px 5px 0; }
.g-name { width: 1.7in; }
.room { font-weight: 600; }
.theme { color: #4a5a4f; font-size: 9.3pt; }
.agenda { page-break-inside: avoid; margin: 0 0 9px; border-left: 3px solid #d8ead9; padding-left: 8px; }
.agenda h3 { margin: 0 0 2px; font-size: 11.5pt; color: #244f2c; }
.cols { display: grid; grid-template-columns: 1fr 1fr; gap: 14px; }
.sess { font-size: 8.3pt; text-transform: uppercase; letter-spacing: .4px; color: #4a5a4f; border-bottom: 1px solid #dde5da; padding-bottom: 1px; margin-bottom: 2px; }
.sess .room { text-transform: none; letter-spacing: 0; color: #1c2b21; }
.agenda ul { margin: 0; padding-left: 0; list-style: none; font-size: 9.2pt; }
.agenda li { margin: 1px 0; padding-left: 2.6em; text-indent: -2.6em; }
`;

const printed = new Date().toLocaleDateString('en-US', { month: 'short', day: 'numeric', year: 'numeric' });
const doc = `<!doctype html><html lang="en"><head><meta charset="utf-8"><title>Syn-RG '26 — printable agenda</title><style>${css}</style></head><body>
${['en', 'es'].map(L => schedulePage(L, CONFIG.days.slice(0, 2), { header: true })
  + schedulePage(L, CONFIG.days.slice(2), { tail: knowBlock(L) + groupsTable(L) })
  + agendasPage(L)).join('')}
</body></html>`;

const outDir = path.join(root, 'print');
fs.mkdirSync(outDir, { recursive: true });
const htmlPath = path.join(outDir, 'synrg-agenda.html');
const pdfPath = path.join(outDir, 'synrg-agenda.pdf');
fs.writeFileSync(htmlPath, doc);

const chrome = 'C:\\Program Files\\Google\\Chrome\\Application\\chrome.exe';
const profile = fs.mkdtempSync(path.join(os.tmpdir(), 'synrg-print-'));
if (fs.existsSync(pdfPath)) fs.unlinkSync(pdfPath);
const r = spawnSync(chrome, [
  '--headless=new', `--user-data-dir=${profile}`, '--no-first-run', '--disable-gpu',
  '--no-pdf-header-footer', `--print-to-pdf=${pdfPath}`, 'file:///' + htmlPath.replace(/\\/g, '/'),
], { stdio: 'pipe', timeout: 60000 });
fs.rmSync(profile, { recursive: true, force: true });
if (!fs.existsSync(pdfPath)) { console.error(String(r.stderr)); throw new Error('PDF not written'); }
console.log('wrote', htmlPath);
console.log('wrote', pdfPath, fs.statSync(pdfPath).size, 'bytes');
