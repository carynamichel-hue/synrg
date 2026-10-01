// Check the schedule page in a phone-sized headless Chrome at chosen moments.
//   node tools/check.mjs [outDir]      (needs Chrome with --remote-debugging-port=9336)
// The page's clock is replaced before any script runs, so "Right now" can be
// checked for a Wednesday morning today. Fails on page errors, sideways scroll,
// or a "Right now" panel that says the wrong thing.
import fs from 'node:fs'
import path from 'node:path'
import { fileURLToPath, pathToFileURL } from 'node:url'

const here = path.dirname(fileURLToPath(import.meta.url))
const PAGE = pathToFileURL(path.join(here, '..', 'index.html')).href
const out = process.argv[2] || path.join(here, 'shots')
fs.mkdirSync(out, { recursive: true })
const sleep = (ms) => new Promise(r => setTimeout(r, ms))

const list = await (await fetch('http://127.0.0.1:9336/json/list')).json()
const ws = new WebSocket(list.find(t => t.type === 'page').webSocketDebuggerUrl)
await new Promise(r => { ws.onopen = r })
let seq = 0; const pending = new Map(); const problems = []
ws.onmessage = (m) => {
  const d = JSON.parse(m.data)
  if (d.id && pending.has(d.id)) { pending.get(d.id)(d.result); pending.delete(d.id) }
  else if (d.method === 'Runtime.exceptionThrown') problems.push(d.params.exceptionDetails.exception?.description || d.params.exceptionDetails.text)
  else if (d.method === 'Runtime.consoleAPICalled' && d.params.type === 'error') problems.push(d.params.args.map(a => a.value ?? a.description).join(' '))
}
const send = (method, params = {}) => new Promise(res => { const id = ++seq; pending.set(id, res); ws.send(JSON.stringify({ id, method, params })) })
const js = async (e) => (await send('Runtime.evaluate', { expression: e, awaitPromise: true, returnByValue: true }))?.result?.value
let pass = 0, fail = 0
const ok = (n, c, x) => { if (c) pass++; else { fail++; console.log('  FAIL: ' + n + (x !== undefined ? '  ' + JSON.stringify(x).slice(0, 240) : '')) } }

await send('Runtime.enable'); await send('Page.enable')
await send('Emulation.setDeviceMetricsOverride', { width: 390, height: 844, deviceScaleFactor: 1, mobile: true })

let clockScript = null
async function at(iso, lang = 'en') {
  if (clockScript) await send('Page.removeScriptToEvaluateOnNewDocument', { identifier: clockScript })
  const t = new Date(iso).getTime()
  clockScript = (await send('Page.addScriptToEvaluateOnNewDocument', { source: `
    (() => { const T = ${t}, start = Date.now(), R = Date;
      class F extends R { constructor(...a) { if (a.length) super(...a); else super(T + (R.now() - start)); } static now() { return T + (R.now() - start); } }
      globalThis.Date = F; try { localStorage.setItem('synrg26.lang', '${lang}') } catch (e) {} })();` })).identifier
  await send('Page.navigate', { url: PAGE }); await sleep(900)
}
// headings are text-transform: uppercase and innerText reports caps, so read textContent
const now = () => js('document.querySelector("#now-card").textContent')
const fits = () => js('document.documentElement.scrollWidth <= innerWidth')
const shot = async (name) => { const h = await js('document.documentElement.scrollHeight'); const s = await send('Page.captureScreenshot', { format: 'png', captureBeyondViewport: true, clip: { x: 0, y: 0, width: 390, height: Math.min(h, 4200), scale: 1 } }); fs.writeFileSync(path.join(out, name), Buffer.from(s.data, 'base64')) }

await at('2026-09-30T10:00:00-04:00')
ok('before the event: not started, first up = arrival', /Not started yet/.test(await now()) && /Arrival and welcome/.test(await now()), await now())
ok('fits a phone', await fits())
ok('three days, all on the page', (await js('document.querySelectorAll(".day").length')) === 3)
ok('every ride block is labelled', (await js('document.querySelectorAll(".ride").length')) === 7, await js('document.querySelectorAll(".ride").length'))
ok('provided vs own counts', (await js('document.querySelectorAll(".ride.provided").length')) === 4 && (await js('document.querySelectorAll(".ride.own").length')) === 3)
ok('Lucas and the brewery link to their websites', await js(`[...document.querySelectorAll('.b-where a')].some(a => a.href.includes('lucasgreenhouses.com')) && [...document.querySelectorAll('.b-where a')].some(a => a.href.includes('farmersandbankersbrewing.com'))`))
ok('seven working groups in the table', (await js('document.querySelectorAll(".grp").length')) === 7)
ok('each group: two sessions, each with its room, a summary line and its own Agenda drop-down (coming soon until filled); no Lean side note', await js(`(() => { const g = [...document.querySelectorAll('.grp')]; return g.every(x => { const s = x.querySelectorAll('.sess'); return s.length === 2 && [...s].every(e => e.querySelector('.room') && /Topic coming soon/.test(e.querySelector('.sum').textContent) && e.querySelector('details.agenda summary') && /Agenda coming soon/.test(e.querySelector('details.agenda').textContent)) }) && !/separate area near Shipping/.test(document.getElementById('group-list').textContent) })()`))
ok('Session 2: Trialing in the conference room, Marketing in the trial garden', await js(`(() => { const s2 = n => [...document.querySelectorAll('.grp')].find(x => x.querySelector('h3').textContent === n).querySelectorAll('.sess')[1].querySelector('.room').textContent; return /Conference room/.test(s2('Trialing')) && /Trial garden/.test(s2('Marketing')) })()`))
ok('the satellite map names its spots (6 places + parking + entrance + Greenhouse 1), 2 restroom icons (WCs at the barn + the dock), 9 legend rows', (await js('document.querySelectorAll("#sitemap .maplbl-in").length')) === 9 && (await js('document.querySelectorAll("#sitemap .pinb.wc").length')) === 2 && (await js('[...document.querySelectorAll("#sitemap .pinb.wc")].map(e => e.textContent).sort().join()')) === "WC,WCs" && (await js('document.querySelectorAll("#legend li").length')) === 9)
ok('names, not numbers, on the map', /Tractor barn/.test(await js('document.getElementById("sitemap").textContent')) && !/[1-6]/.test(await js('[...document.querySelectorAll("#sitemap .maplbl-in")].map(e => e.textContent).join(" ")')))
ok('check-in, the entrance and the conference room are dots, not outlines', await js(`['checkin', 'conference', 'entrance'].every(k => _shapes[k] && _shapes[k].getLatLng) && !CONFIG.map.areas.office && !CONFIG.map.areas['x-check-in']`))
ok('a name placed off its spot gets a line back to it, a name on its spot none', await js(`(() => { const n = document.querySelectorAll('#sitemap path.leader').length; const ends = _labels.filter(l => !l.dir && _leaderEnd(l.at, l.anchor, l.poly)).map(l => L_(l.text)); return n > 0 && n === ends.length && !ends.includes('Loading dock') })()`))
ok('no map label overlaps another (at the opening view)', await js(`(() => { const r = [...document.querySelectorAll('#sitemap .maplbl-in, #sitemap .pinb')].map(e => e.getBoundingClientRect()).filter(b => b.width && b.bottom > 0); for (let i = 0; i < r.length; i++) for (let j = i + 1; j < r.length; j++) { const a = r[i], b = r[j]; if (a.left < b.right - 2 && b.left < a.right - 2 && a.top < b.bottom - 2 && b.top < a.bottom - 2) return false } return true })()`))
ok('no map name is cut off at the map edge (the ones in view)', await js(`(() => { const m = document.getElementById('sitemap').getBoundingClientRect(); return [...document.querySelectorAll('#sitemap .maplbl-in')].map(e => e.getBoundingClientRect()).filter(b => b.right > m.left && b.left < m.right && b.bottom > m.top && b.top < m.bottom).every(b => b.left >= m.left && b.right <= m.right && b.top >= m.top && b.bottom <= m.bottom) })()`))
// a finger drag moves the map on a phone; ⌂ brings the whole map back
{
  await send('Emulation.setTouchEmulationEnabled', { enabled: true, maxTouchPoints: 1 })
  const c0 = await js('JSON.stringify(_map.getCenter())')
  const r = await js(`(() => { document.getElementById('sitemap').scrollIntoView({ block: 'center' }); const b = document.getElementById('sitemap').getBoundingClientRect(); return [b.left + b.width / 2, b.top + b.height / 2] })()`)
  await new Promise(res => setTimeout(res, 300))
  const r2 = await js(`(() => { const b = document.getElementById('sitemap').getBoundingClientRect(); return [b.left + b.width / 2, b.top + b.height / 2] })()`)
  const [x, y] = r2
  await send('Input.dispatchTouchEvent', { type: 'touchStart', touchPoints: [{ x, y }] })
  for (let k = 1; k <= 8; k++) await send('Input.dispatchTouchEvent', { type: 'touchMove', touchPoints: [{ x: x + k * 12, y: y + k * 6 }] })
  await send('Input.dispatchTouchEvent', { type: 'touchEnd', touchPoints: [] })
  await new Promise(res => setTimeout(res, 500))
  const c1 = await js('JSON.stringify(_map.getCenter())')
  ok('a one-finger drag moves the map on a phone', c1 !== c0, [c0, c1])
  await js(`document.querySelector('#sitemap .home-btn').click(); 1`); await new Promise(res => setTimeout(res, 500))
  const c2 = JSON.parse(await js('JSON.stringify(_map.getCenter())')), a = JSON.parse(c0)
  ok('⌂ brings the whole map back (same spot to ~10 m, same zoom; the drag moved it ~90 m)', Math.abs(c2.lat - a.lat) < 1e-4 && Math.abs(c2.lng - a.lng) < 1e-4 && (Math.abs(JSON.parse(c1).lat - a.lat) > 1e-4 || Math.abs(JSON.parse(c1).lng - a.lng) > 1e-4) && (await js('_map.getZoom()')) === 17, [c0, c1, c2])
  ok('the map leaves page to scroll by (no taller than 60% of the screen)', await js('document.getElementById("sitemap").getBoundingClientRect().height <= innerHeight * 0.6 + 1'))
  await send('Emulation.setTouchEmulationEnabled', { enabled: false })
}
ok('every Wednesday and Thursday block has a place (or points at the groups table / the ride list)', await js(`[...document.querySelectorAll('.day')].slice(1).every(d => [...d.querySelectorAll('.card')].every(c => c.querySelector('.b-where') || c.querySelector('.go') || c.querySelector('.stops')))`))
ok('the WF partner update is a small note under Break, in the conference room', /WF partner sales update in the conference room/.test(await js('document.body.textContent')))
ok('the traced outlines are drawn (8 shapes + the entrance hit area)', (await js('document.querySelectorAll("#sitemap path.leaflet-interactive, #sitemap path").length')) >= 8)
ok('satellite tiles load', (await js('document.querySelectorAll("#sitemap .leaflet-tile").length')) > 0)
{ const z0 = await js('_map.getZoom()'); await js('document.getElementById("place-dock").click(); 1'); await sleep(900); const z1 = await js('_map.getZoom()'); ok('tapping a spot in the legend zooms the map to it', z1 > z0, [z0, z1]) }
ok('Tuesday arrival points at check-in', /Check-in/.test(await js('document.getElementById("b-0-0").textContent')))
ok('no break room anywhere (not used)', !/break room|sala de descanso/i.test(await js('document.body.textContent')))
ok('a schedule place links to its spot on the map', await js(`[...document.querySelectorAll('.b-where a')].some(a => a.getAttribute('href') === '#place-barn') && !!document.getElementById('place-barn')`))
ok('the map fits a phone', await js('document.getElementById("sitemap").getBoundingClientRect().right <= innerWidth'))
ok('no Wi-Fi, no coin game, no Women in Hort on the page', !/wi-?fi|password|coin|women in hort/i.test(await js('document.body.textContent')))
await shot('before.png')

await at('2026-10-07T08:20:00-04:00')
ok('Wed 8:20: Session 1 is on, next is the break', /Working groups · Session 1/.test(await now()) && /Next 9:30am: Break/.test(await now()), await now())
ok('Wednesday chip is today', /Wed/.test(await js('document.querySelector(".days a.today")?.textContent')))
ok('the running block is marked', (await js('document.querySelectorAll(".block.is-now").length')) === 1)
await shot('wed-0820.png')

await at('2026-10-07T20:10:00-04:00')
ok('Wed 8:10pm: rides back, ride provided', /Rides back/.test(await now()) && /Ride provided/.test(await now()), await now())

await at('2026-10-06T22:00:00-04:00')
ok('Tue 10pm: overnight, next is Wednesday 7:15 ride', /See you tomorrow/.test(await now()) && /Wed 7:15am/.test(await now()), await now())

await at('2026-10-07T13:00:00-04:00')
ok('Wed 1pm: lunch, next ride to Lucas', /Lunch/.test(await now()) && /Ride to Lucas/.test(await now()), await now())

await at('2026-10-08T13:00:00-04:00')
ok('after the event: a wrap', /That’s a wrap/.test(await now()), await now())

await at('2026-10-07T08:20:00-04:00', 'es')
ok('Spanish: labels and content', /Grupos de trabajo · Sesión 1/.test(await now()) && /Transporte incluido/.test(await js('document.body.textContent')) && (await js('document.documentElement.lang')) === 'es')
ok('Spanish fits a phone', await fits())
await shot('wed-0820-es.png')
await js(`document.querySelector('#lang-btn').click(); 1`); await sleep(200)
ok('the switch goes back to English', /Working groups · Session 1/.test(await now()))

console.log(problems.length ? 'PAGE PROBLEMS:\n  ' + [...new Set(problems)].join('\n  ') : 'no page errors')
console.log(`check: ${pass} passed, ${fail} failed`)
ws.close(); process.exit(fail || problems.length ? 1 : 0)
