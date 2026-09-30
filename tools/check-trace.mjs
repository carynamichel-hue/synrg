// Drive trace.html with real mouse clicks (Chrome on 9336): outline the tractor
// barn, drop a restroom pin, add a spot, set the view, place the names, and
// check what "Copy for Claude" would send. Starts from an empty trace.
// Served over http, not file://: the name step fetches index.html, which a
// browser refuses to do from a file.
import path from 'node:path'
import fs from 'node:fs'
import http from 'node:http'
import { fileURLToPath } from 'node:url'
const here = path.dirname(fileURLToPath(import.meta.url))
const root = path.join(here, '..')
const TYPES = { '.html': 'text/html; charset=utf-8', '.js': 'text/javascript', '.css': 'text/css', '.svg': 'image/svg+xml' }
const server = http.createServer((q, r) => {
  const f = path.join(root, decodeURIComponent(q.url.split('?')[0]))
  if (!fs.existsSync(f) || fs.statSync(f).isDirectory()) { r.writeHead(404); return r.end() }
  r.setHeader('Content-Type', TYPES[path.extname(f)] || 'application/octet-stream'); fs.createReadStream(f).pipe(r)
})
await new Promise(r => server.listen(3018, r))
const PAGE = 'http://localhost:3018/trace.html'

const sleep = (ms) => new Promise(r => setTimeout(r, ms))
const list = await (await fetch('http://127.0.0.1:9336/json/list')).json()
const ws = new WebSocket(list.find(t => t.type === 'page').webSocketDebuggerUrl)
await new Promise(r => { ws.onopen = r })
let seq = 0; const pending = new Map(); const problems = []
ws.onmessage = (m) => { const d = JSON.parse(m.data); if (d.id && pending.has(d.id)) { pending.get(d.id)(d.result); pending.delete(d.id) }
  else if (d.method === 'Runtime.exceptionThrown') problems.push(d.params.exceptionDetails.exception?.description || d.params.exceptionDetails.text)
  else if (d.method === 'Page.javascriptDialogOpening') send('Page.handleJavaScriptDialog', { accept: true }) }
const send = (method, params = {}) => new Promise(res => { const id = ++seq; pending.set(id, res); ws.send(JSON.stringify({ id, method, params })) })
const js = async (e) => (await send('Runtime.evaluate', { expression: e, awaitPromise: true, returnByValue: true }))?.result?.value
const click = async (x, y) => { for (const type of ['mouseMoved', 'mousePressed', 'mouseReleased']) await send('Input.dispatchMouseEvent', { type, x, y, button: 'left', clickCount: 1 }); await sleep(250) }
const state = async () => JSON.parse(await js('localStorage.getItem("synrg26.trace.v1")') || '{}')
let pass = 0, fail = 0
const ok = (n, c, x) => { if (c) pass++; else { fail++; console.log('  FAIL: ' + n + (x !== undefined ? '  ' + JSON.stringify(x).slice(0, 300) : '')) } }

await send('Runtime.enable'); await send('Page.enable')
await send('Emulation.setDeviceMetricsOverride', { width: 1280, height: 800, deviceScaleFactor: 1, mobile: false })
await send('Page.navigate', { url: PAGE }); await sleep(1500)
await js('localStorage.removeItem("synrg26.trace.v1"); location.reload(); 1'); await sleep(2500)
ok('the map and the list render', (await js('document.querySelectorAll(".item").length')) === 10 && (await js('!!document.querySelector(".leaflet-tile-pane")')))
ok('imagery tiles load', (await js('document.querySelectorAll(".leaflet-tile-loaded").length')) > 0)

// outline the barn: four corners, then the first again
await js(`document.querySelector('.item[data-id=barn]').click(); 1`); await sleep(300)
ok('choosing a spot starts drawing', /drawing/.test(await js(`document.querySelector('.item[data-id=barn]').textContent`)))
for (const [x, y] of [[400, 300], [520, 300], [520, 380], [400, 380], [400, 300]]) await click(x, y)
await sleep(400)
let st = await state()
ok('the barn outline is saved with its 4 corners', st.areas && st.areas.barn && st.areas.barn.length === 4, st.areas)
ok('its row says outlined', /outlined/.test(await js(`document.querySelector('.item[data-id=barn]').textContent`)))
ok('the outline is labelled on the picture', /Tractor barn/.test(await js('document.querySelector(".leaflet-tooltip-pane").textContent')))

// a restroom pin
await js(`document.querySelector('.item[data-id=wc]').click(); 1`); await sleep(300)
await click(650, 420); await sleep(400)
st = await state()
ok('a restroom pin is saved', (st.markers.wc || []).length === 1, st.markers)

// a spot of her own
await js(`document.getElementById('new-name').value = 'Tent'; document.getElementById('add-btn').click(); 1`); await sleep(300)
for (const [x, y] of [[700, 200], [760, 200], [760, 250], [700, 200]]) await click(x, y)
await sleep(400)
st = await state()
ok('a spot of her own can be added and outlined', st.custom.some(c => c.name === 'Tent') && st.areas['x-tent']?.length === 3, [st.custom, Object.keys(st.areas)])

await js(`document.getElementById('view-btn').click(); 1`); await sleep(200)
st = await state()
ok('the view is saved with its bounds', st.view && st.view.zoom && st.view.bounds?.length === 2)

// survives a reload
await send('Page.navigate', { url: PAGE }); await sleep(2500)
ok('outlines come back after a reload', (await js('document.querySelectorAll(".leaflet-overlay-pane path").length')) >= 2)

// the dots: seeded from the schedule page, and a dragged dot saves its spot
{
  const n = await js('document.querySelectorAll(".tdot").length')
  ok('check-in, entrance and conference room show as 3 dots', n === 3, n)
  const before = (await state()).dots?.conference
  const pos = await js(`(() => { const b = [...document.querySelectorAll('.tdot')].find(e => e.style.background.includes('255, 255, 255')).getBoundingClientRect(); return [b.left + b.width / 2, b.top + b.height / 2] })()`)
  await send('Input.dispatchMouseEvent', { type: 'mouseMoved', x: pos[0], y: pos[1] })
  await send('Input.dispatchMouseEvent', { type: 'mousePressed', x: pos[0], y: pos[1], button: 'left', clickCount: 1 })
  for (let k = 1; k <= 6; k++) await send('Input.dispatchMouseEvent', { type: 'mouseMoved', x: pos[0] + k * 8, y: pos[1] + k * 5, button: 'left' })
  await send('Input.dispatchMouseEvent', { type: 'mouseReleased', x: pos[0] + 48, y: pos[1] + 30, button: 'left', clickCount: 1 })
  await sleep(400)
  const after = (await state()).dots?.conference
  ok('dragging the conference-room dot saves its new spot', before && after && (after[0] !== before[0] || after[1] !== before[1]), [before, after])
}

// placing the names: every schedule-map name appears; dragging one saves it
{
  await js(`document.getElementById('names-btn').click(); 1`); await sleep(500)
  const n = await js('document.querySelectorAll(".namepin").length')
  ok('Place the names shows every name from the schedule map (9)', n === 9, n)
  ok('names are placed at the phone map zoom (17)', await js(`!!document.querySelector('.leaflet-tile-container img[src*="/tile/17/"]')`))
  ok('the schedule map names placed now do not touch (no red rings)', (await js('document.querySelectorAll(".namepin.clash").length')) === 0, await js('[...document.querySelectorAll(".namepin.clash")].map(e => e.textContent)'))
  const r0 = await js(`(() => { const e = [...document.querySelectorAll('.namepin')].find(x => x.textContent === 'Loading dock'); const b = e.getBoundingClientRect(); return [b.left + b.width / 2, b.top + b.height / 2] })()`)
  await send('Input.dispatchMouseEvent', { type: 'mouseMoved', x: r0[0], y: r0[1] })
  await send('Input.dispatchMouseEvent', { type: 'mousePressed', x: r0[0], y: r0[1], button: 'left', clickCount: 1 })
  for (let k = 1; k <= 8; k++) await send('Input.dispatchMouseEvent', { type: 'mouseMoved', x: r0[0] + k * 10, y: r0[1] - k * 6, button: 'left' })
  await send('Input.dispatchMouseEvent', { type: 'mouseReleased', x: r0[0] + 80, y: r0[1] - 48, button: 'left', clickCount: 1 })
  await sleep(400)
  st = await state()
  ok('dragging a name saves its new spot', st.labels && Array.isArray(st.labels.dock) && st.labels.dock.length === 2, st.labels)
  await js(`document.getElementById('names-btn').click(); 1`); await sleep(200)
  ok('Done placing names hides them again', (await js('document.querySelectorAll(".namepin").length')) === 0)
}

// the copy payload (clipboard may be blocked headless: then it lands in the box)
await js(`document.getElementById('copy-btn').click(); 1`); await sleep(400)
const box = await js(`document.getElementById('paste').value`)
const msg = await js(`document.getElementById('copy-msg').textContent`)
ok('Copy for Claude produces the map (clipboard or the box)', /Copied/.test(msg) || /^SYNRG-MAP \{/.test(box), msg)
ok('…with the placed names in it', !box || /"labels":\{"dock"/.test(box), box.slice(0, 160))
console.log(problems.length ? 'PAGE PROBLEMS:\n  ' + problems.join('\n  ') : 'no page errors')
console.log(`trace: ${pass} passed, ${fail} failed`)
await js('localStorage.removeItem("synrg26.trace.v1"); 1')
ws.close(); server.close(); process.exit(fail || problems.length ? 1 : 0)
