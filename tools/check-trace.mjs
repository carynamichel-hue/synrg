// Drive trace.html with real mouse clicks (Chrome on 9336): outline the tractor
// barn, drop a restroom pin, set the view, and check what "Copy for Claude"
// would send. Local file; starts from an empty trace.
import path from 'node:path'
import { fileURLToPath, pathToFileURL } from 'node:url'
const here = path.dirname(fileURLToPath(import.meta.url))
const PAGE = pathToFileURL(path.join(here, '..', 'trace.html')).href
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
let pass = 0, fail = 0
const ok = (n, c, x) => { if (c) pass++; else { fail++; console.log('  FAIL: ' + n + (x !== undefined ? '  ' + JSON.stringify(x).slice(0, 300) : '')) } }

await send('Runtime.enable'); await send('Page.enable')
await send('Emulation.setDeviceMetricsOverride', { width: 1280, height: 800, deviceScaleFactor: 1, mobile: false })
await send('Page.navigate', { url: PAGE }); await sleep(1500)
await js('localStorage.removeItem("synrg26.trace.v1"); location.reload(); 1'); await sleep(2500)
ok('the map and the list render', (await js('document.querySelectorAll(".item").length')) === 8 && (await js('!!document.querySelector(".leaflet-tile-pane")')))
ok('imagery tiles load', (await js('document.querySelectorAll(".leaflet-tile-loaded").length')) > 0, await js('document.querySelectorAll(".leaflet-tile").length'))

// outline the barn: four corners, then the first again
await js(`document.querySelector('.item[data-id=barn]').click(); 1`); await sleep(300)
ok('choosing a spot starts drawing', /drawing/.test(await js(`document.querySelector('.item[data-id=barn]').textContent`)))
for (const [x, y] of [[400, 300], [520, 300], [520, 380], [400, 380], [400, 300]]) await click(x, y)
await sleep(400)
let s = await js('localStorage.getItem("synrg26.trace.v1")')
const st = JSON.parse(s || '{}')
ok('the barn outline is saved with its 4 corners', st.areas && st.areas.barn && st.areas.barn.length === 4, st.areas)
ok('its row says outlined', /outlined/.test(await js(`document.querySelector('.item[data-id=barn]').textContent`)))
ok('the outline is labelled on the picture', /Tractor barn/.test(await js('document.querySelector(".leaflet-tooltip-pane").textContent')))

// a restroom pin
await js(`document.querySelector('.item[data-id=wc]').click(); 1`); await sleep(300)
await click(650, 420); await sleep(400)
s = JSON.parse(await js('localStorage.getItem("synrg26.trace.v1")'))
ok('a restroom pin is saved', (s.markers.wc || []).length === 1, s.markers)

// a custom spot
await js(`document.getElementById('new-name').value = 'Check-in'; document.getElementById('add-btn').click(); 1`); await sleep(300)
for (const [x, y] of [[700, 200], [760, 200], [760, 250], [700, 200]]) await click(x, y)
await sleep(400)
s = JSON.parse(await js('localStorage.getItem("synrg26.trace.v1")'))
ok('a spot of her own can be added and outlined', s.custom.some(c => c.name === 'Check-in') && s.areas['x-check-in']?.length === 3, [s.custom, Object.keys(s.areas)])

await js(`document.getElementById('view-btn').click(); 1`); await sleep(200)
s = JSON.parse(await js('localStorage.getItem("synrg26.trace.v1")'))
ok('the view is saved with its bounds', s.view && s.view.zoom && s.view.bounds?.length === 2)

// survives a reload
await send('Page.navigate', { url: PAGE }); await sleep(2000)
ok('outlines come back after a reload', (await js('document.querySelectorAll(".leaflet-overlay-pane path").length')) >= 3)

// the copy payload (clipboard may be blocked headless: falls back to the box)
await js(`document.getElementById('copy-btn').click(); 1`); await sleep(400)
const box = await js(`document.getElementById('paste').value`)
const msg = await js(`document.getElementById('copy-msg').textContent`)
ok('Copy for Claude produces the map (clipboard or the box)', /Copied/.test(msg) || /^SYNRG-MAP \{/.test(box), msg)
console.log(problems.length ? 'PAGE PROBLEMS:\n  ' + problems.join('\n  ') : 'no page errors')
console.log(`trace: ${pass} passed, ${fail} failed`)
await js('localStorage.removeItem("synrg26.trace.v1"); 1')
ws.close(); process.exit(fail || problems.length ? 1 : 0)
