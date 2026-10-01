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

// A fake of Common Ground's /api/sessions, inside the page: the sign-up checks
// never touch the live data and give the same answer every run. Its state
// starts over on each page load (Bob already picked Propagation for S1);
// localStorage 'fakeOff' makes every call fail like a phone with no signal.
await send('Page.addScriptToEvaluateOnNewDocument', { source: `(() => {
  const people = [{ id: 'p1', name: 'Ana López', company: 'Prides Corner' }, { id: 'p2', name: 'Bob Smith', company: 'Willoway' }];
  const keys = ['grower','plant-health','propagation','shipping','lean','trialing','marketing'];
  const picks = { 'p2|s1': 'propagation' };
  const counts = () => { const o = { s1: {}, s2: {} }; for (const s of ['s1','s2']) for (const k of keys) o[s][k] = 0; for (const [k, g] of Object.entries(picks)) o[k.split('|')[1]][g]++; return o };
  const mine = id => { const m = {}; for (const [k, g] of Object.entries(picks)) { const [pp, s] = k.split('|'); if (pp === id) m[s] = g } return m };
  window.__posts = 0;
  const real = window.fetch;
  window.fetch = async (url, o = {}) => {
    if (!String(url).includes('/api/sessions')) return real(url, o);
    if (localStorage.getItem('fakeOff')) throw new TypeError('Failed to fetch');
    const J = (b, st = 200) => new Response(JSON.stringify(b), { status: st, headers: { 'Content-Type': 'application/json' } });
    if ((o.method || 'GET') === 'GET') { const id = new URL(url).searchParams.get('person'); return J({ counts: counts(), people, mine: mine(id), known: people.some(x => x.id === id) }) }
    window.__posts++;
    const b = JSON.parse(o.body);
    if (b.join) { const np = { id: 'p' + (people.length + 1), name: b.join.name, company: b.join.company }; people.push(np); return J({ person: np }) }
    if (!people.some(x => x.id === b.personId)) return J({ statusMessage: 'gone' }, 404);
    if (b.group) picks[b.personId + '|' + b.session] = b.group; else delete picks[b.personId + '|' + b.session];
    return J({ counts: counts(), mine: mine(b.personId) });
  };
})();` })
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
ok('working groups by session: two session headings, seven groups under each', (await js('document.querySelectorAll(".sess-h").length')) === 2 && (await js('document.querySelectorAll(".grp[data-s=s1]").length')) === 7 && (await js('document.querySelectorAll(".grp[data-s=s2]").length')) === 7)
ok('session headings carry their times', /Session 1 · 8am–9:30am/.test(await js('document.getElementById("groups-s1").textContent')) && /Session 2 · 10:30am–12pm/.test(await js('document.getElementById("groups-s2").textContent')), await js('document.getElementById("groups-s1").textContent'))
ok('each group card: its room, a summary line, its own Agenda drop-down (coming soon until filled) and an I’m going button', await js(`[...document.querySelectorAll('.grp')].every(x => x.querySelector('.room') && /Topic coming soon/.test(x.querySelector('.sum').textContent) && x.querySelector('details.agenda summary') && /Agenda coming soon/.test(x.querySelector('details.agenda').textContent) && x.querySelector('.pick'))`))
ok('Session 2: Trialing in the conference room, Marketing in the trial garden', await js(`(() => { const r = (k, g) => document.querySelector('.grp[data-s=' + k + '][data-g=' + g + '] .room').textContent; return /Conference room/.test(r('s2', 'trialing')) && /Trial garden/.test(r('s2', 'marketing')) && /Trial garden/.test(r('s1', 'trialing')) })()`))
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

/* ── session sign-ups (against the fake above) ── */
await js('localStorage.removeItem("synrg26.me"); localStorage.removeItem("synrg26.mine"); localStorage.removeItem("fakeOff"); 1')
await at('2026-10-01T10:00:00-04:00')
const card = (k, g) => `document.querySelector('.grp[data-s=${k}][data-g=${g}]')`
const count = (k, g) => js(card(k, g) + '.querySelector(".count").textContent')
ok('counts show for every group, zeros included', (await count('s1', 'propagation')) === '1 going' && (await count('s1', 'shipping')) === '0 going' && (await count('s2', 'propagation')) === '0 going', await count('s1', 'propagation'))
ok('the name box asks for a name first', /First, find your name/.test(await js('document.getElementById("me-box").textContent')))
await js(card('s1', 'shipping') + '.querySelector(".pick").click(); 1'); await sleep(300)
ok('I’m going with no name: asks for the name, saves nothing', /Find your name first/.test(await js('document.getElementById("me-box").textContent')) && (await js('__posts')) === 0 && (await count('s1', 'shipping')) === '0 going')
await js('const q = document.getElementById("me-q"); q.value = "lop"; q.dispatchEvent(new Event("input")); 1'); await sleep(100)
ok('typing part of a name finds it, accents ignored', /Ana López/.test(await js('document.getElementById("me-hits").textContent')) && !/Bob/.test(await js('document.getElementById("me-hits").textContent')))
await js('document.querySelector("#me-hits button").click(); 1'); await sleep(300)
ok('picking the name: "Marking your groups as Ana López"', /Marking your groups as Ana López/.test(await js('document.getElementById("me-box").textContent')))
await js(card('s1', 'shipping') + '.querySelector(".pick").click(); 1'); await sleep(300)
ok('I’m going: the button turns on, the count goes up, the card is marked', (await js(card('s1', 'shipping') + '.querySelector(".pick").textContent')) === '✓ You’re going' && (await count('s1', 'shipping')) === '1 going' && (await js(card('s1', 'shipping') + '.classList.contains("mine")')))
ok('the Session 1 block in the schedule says "Your group: Shipping · Loading dock"', /Your group: Shipping · 📍 Loading dock/.test(await js('document.querySelector(".b-mine[data-s=s1]").textContent')) && !(await js('document.querySelector(".b-mine[data-s=s1]").hidden')))
await js(card('s1', 'propagation') + '.querySelector(".pick").click(); 1'); await sleep(300)
ok('tapping another group switches (one per session): Shipping 0, Propagation 2', (await count('s1', 'shipping')) === '0 going' && (await count('s1', 'propagation')) === '2 going' && (await js('document.querySelectorAll(".grp[data-s=s1] .pick.on").length')) === 1)
await js(card('s2', 'lean') + '.querySelector(".pick").click(); 1'); await sleep(300)
ok('Session 2 is its own pick', (await count('s2', 'lean')) === '1 going' && (await count('s1', 'propagation')) === '2 going')
await js(card('s1', 'propagation') + '.querySelector(".pick").click(); 1'); await sleep(300)
ok('tapping yours again undoes it', (await count('s1', 'propagation')) === '1 going' && (await js('document.querySelectorAll(".grp[data-s=s1] .pick.on").length')) === 0 && (await js('document.querySelector(".b-mine[data-s=s1]").hidden')))
ok('sign-ups fit a phone', await fits())
await shot('signup.png')

// the page reloads: the fake server starts over, the name is remembered
await at('2026-10-07T10:40:00-04:00')
ok('the name is remembered on the next visit', /Marking your groups as Ana López/.test(await js('document.getElementById("me-box").textContent')))
await js(card('s2', 'marketing') + '.querySelector(".pick").click(); 1'); await sleep(300)
ok('Wed 10:40, Session 2 on: Right now shows your group and its room', /Your group: Marketing · 📍 Trial garden/.test(await now()), await now())
await js('document.getElementById("me-out").click(); 1'); await sleep(200)
ok('Not you? forgets the name', /First, find your name/.test(await js('document.getElementById("me-box").textContent')))
await js('document.getElementById("me-new").click(); 1'); await sleep(100)
await js('document.getElementById("me-new-name").value = "Cy New"; document.getElementById("me-new-co").value = "Bylands"; document.getElementById("me-add").click(); 1'); await sleep(400)
ok('not on the list: add your name, then you are marking as them', /Marking your groups as Cy New · Bylands/.test(await js('document.getElementById("me-box").textContent')))

await at('2026-10-01T10:00:00-04:00', 'es')
ok('Spanish: Voy / van', (await js(card('s1', 'grower') + '.querySelector(".pick").textContent')) === 'Voy' && /^\d+ van$/.test(await count('s1', 'grower')))

await js('localStorage.setItem("fakeOff", "1"); 1')
await at('2026-10-01T10:00:00-04:00')
ok("no signal: says so, buttons off, no count badges, the rest of the page still works", !(await js("!!document.querySelector(\".count\")")) && /needs a signal/.test(await js('document.getElementById("me-box").textContent')) && (await js('[...document.querySelectorAll(".pick")].every(b => b.disabled)')) && (await js('document.querySelectorAll(".day").length')) === 3)
await js('localStorage.removeItem("fakeOff"); localStorage.removeItem("synrg26.me"); localStorage.removeItem("synrg26.mine"); 1')

console.log(problems.length ? 'PAGE PROBLEMS:\n  ' + [...new Set(problems)].join('\n  ') : 'no page errors')
console.log(`check: ${pass} passed, ${fail} failed`)
ws.close(); process.exit(fail || problems.length ? 1 : 0)
