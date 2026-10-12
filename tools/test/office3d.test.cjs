/* The office floor in 3D (office3d in office-world.cjs): one podium per
 * person with a card and a character, a camera that survives the page's
 * redraw, the flat office when there is no WebGL, and a built file that stays
 * flat and carries no three.js.
 *
 * The floor is drawn by script with WebGL, so these tests open it in a
 * headless Chrome or Edge (test/browser.cjs). With none installed they skip. */
const test = require('node:test')
const assert = require('node:assert/strict')
const fs = require('fs')
const path = require('path')
const { makeSandbox, startServer } = require('./helpers.cjs')
const browser = require('./browser.cjs')
const { fixture } = require('./language-fixture.cjs')

const SKIP = browser.unavailable()
const sleep = (ms) => new Promise((r) => setTimeout(r, ms))

let shared = null
async function world() {
  if (shared) return shared
  const sb = fixture()
  // a file of tester's own in the data folder replaces the default character for tester only
  fs.mkdirSync(path.join(sb.root, 'characters'), { recursive: true })
  fs.copyFileSync(path.join(sb.tools, 'characters', 'default.glb'), path.join(sb.root, 'characters', 'tester.glb'))
  const s = await startServer(sb, { portBase: 43000 })
  const page = await browser.launch()
  const log = await page.logEvents()
  await page.goto(s.url.replace('localhost', '127.0.0.1')) // trades the key for the cookie
  shared = { sb, s, page, log, base: 'http://127.0.0.1:' + s.port }
  return shared
}
test.after(async () => {
  if (!shared) return
  await shared.page.close()
  shared.s.child.kill()
  shared.sb.cleanup()
})

const READY = "window.__office3d && window.__office3d.info().podiums.some((p) => p.character)"
const pageErrors = (log) => log.filter((m) => m.method === 'Runtime.exceptionThrown' || (m.method === 'Log.entryAdded' && m.params.entry.level === 'error')).map((m) => JSON.stringify(m.params).slice(0, 300))

test('office 3D: every person of the office has a podium, a card and a character; the tray is there', { skip: SKIP || false }, async () => {
  const { page, base, log } = await world()
  await page.goto(base + '/?lang=en#/office/engineering')
  await page.waitFor(READY, 15000)
  await sleep(300)
  const got = await page.eval(`(() => {
    const info = window.__office3d.info()
    const office = 'engineering'
    const working = [...new Set(DATA.active.filter((a) => a.officeId === office).map((a) => a.agent))]
    const home = COMPANY.employees.filter((e) => e.kind === 'employee' && e.homeOfficeId === office && e.id !== 'supervisor').map((e) => e.id)
    const lead = (COMPANY.offices.find((o) => o.id === office) || {}).leadEmployeeId
    return {
      on: document.getElementById('stage').classList.contains('w3on'),
      flat: document.querySelectorAll('#stage-in svg').length,
      ids: info.podiums.map((p) => p.id), working, home, lead,
      withChar: info.podiums.filter((p) => p.character).map((p) => p.id),
      cards: [...document.querySelectorAll('.w3card')].map((c) => c.dataset.anchor),
      states: Object.fromEntries(info.podiums.map((p) => [p.id, p.state])),
      kinds: Object.fromEntries(info.podiums.map((p) => [p.id, p.kind])),
      cells: info.podiums.map((p) => p.cell.join(',')),
      glb: !!document.querySelector('.w3card.glb[data-anchor="tester"]'),
    }
  })()`)
  assert.ok(got.on, 'the 3D floor is on')
  assert.equal(got.flat, 0, 'and the flat office is not drawn under it')
  assert.ok(got.working.length > 0, 'the fixture has someone working here')
  for (const a of got.working) {
    assert.ok(got.ids.includes(a), a + ' works here and has a podium')
    assert.ok(got.withChar.includes(a), a + ' sits at it')
    assert.ok(['working', 'quiet'].includes(got.states[a]), a + ' is shown working: ' + got.states[a])
  }
  for (const a of got.home) assert.ok(got.ids.includes(a), a + ' (home staff) has a podium')
  if (got.lead) assert.equal(got.kinds[got.lead], 'lead', 'the lead has the big podium')
  assert.ok(got.ids.includes('~tray'), 'the handed-in tray')
  assert.deepEqual([...got.cards].sort(), [...got.ids].sort(), 'one card per podium')
  assert.equal(new Set(got.cells).size, got.cells.length, 'no two podiums share a cell')
  assert.ok(got.glb, 'characters/tester.glb in the data folder replaces the default character for tester')
  assert.deepEqual(pageErrors(log), [], 'no page or CSP errors')
})

test('office 3D: the 1.5 s redraw keeps the camera, the canvas and the cards', { skip: SKIP || false }, async () => {
  const { page, base, sb } = await world()
  await page.goto(base + '/?lang=en#/office/engineering')
  await page.waitFor(READY, 15000)
  await page.eval("window.__office3d.zoomBy(1.7); window.__office3d.panBy(90, -40); document.querySelector('#stage canvas').dataset.mark = 'same'; document.querySelector('.w3card').dataset.mark = 'same'; 1")
  await sleep(600)
  const before = await page.eval('window.__office3d.view()')
  assert.equal(before.auto, false, 'a moved camera is no longer the automatic fit')
  const id = await page.eval("DATA.active.find((a) => a.officeId === 'engineering').id")
  const r = sb.cli('--progress', JSON.stringify({ id, doing: 'camera check step' }))
  assert.equal(r.code, 0, r.err)
  await page.waitFor("[...document.querySelectorAll('.w3ov .bub')].some((b) => b.textContent.includes('camera check step'))", 10000)
  await sleep(1700)
  const after = await page.eval("({ view: window.__office3d.view(), canvas: document.querySelector('#stage canvas').dataset.mark, card: document.querySelector('.w3card').dataset.mark })")
  for (const k of ['tx', 'ty', 'tz', 'azim', 'elev', 'zoom']) assert.ok(Math.abs(after.view[k] - before[k]) < 1e-6, k + ' kept: ' + before[k] + ' -> ' + after.view[k])
  assert.equal(after.canvas, 'same', 'the canvas is the same element')
  assert.equal(after.card, 'same', 'the cards are kept, not drawn anew')
  await page.goto(base + '/?lang=en#/office/engineering')
  await page.waitFor(READY, 15000)
  const back = await page.eval('window.__office3d.view()')
  for (const k of ['tx', 'tz', 'zoom']) assert.ok(Math.abs(back[k] - before[k]) < 1e-3, k + ' restored after a reload')
})

test('office 3D: with no WebGL the flat office is drawn, and works', { skip: SKIP || false }, async (t) => {
  const { s, base } = await world()
  const page = await browser.launch()
  t.after(() => page.close())
  await page.onNewDocument(`(() => {
    const get = HTMLCanvasElement.prototype.getContext
    HTMLCanvasElement.prototype.getContext = function (kind, o) { return /webgl/i.test(kind) ? null : get.call(this, kind, o) }
  })()`)
  await page.goto(s.url.replace('localhost', '127.0.0.1'))
  await page.goto(base + '/?lang=en#/office/engineering')
  await sleep(800)
  const got = await page.eval(`({
    w3: !!window.__office3d,
    on: document.getElementById('stage').classList.contains('w3on'),
    svg: document.querySelectorAll('#stage-in svg.iso').length,
    canvas: document.querySelectorAll('#stage canvas').length,
  })`)
  assert.equal(got.w3, false, 'no 3D office without WebGL')
  assert.equal(got.on, false)
  assert.equal(got.svg, 1, 'the flat office is drawn')
  assert.equal(got.canvas, 0, 'and no canvas left behind')
})

test('office 3D: the built file keeps the flat office and carries no three.js; the live page carries r184 and the character', () => {
  const sb = makeSandbox()
  try {
    const { renderOffice } = sb.mod('agent-office-page.cjs')
    const state = { runs: [], active: [], agents: [], gates: [], decisions: [], prices: {}, answers: [] }
    const built = renderOffice(state, { live: false, lang: 'en' })
    assert.ok(!built.includes("const REVISION = '184'"), 'no three.js in the built file')
    const live = renderOffice(state, { live: true, token: 'x', lang: 'en' })
    assert.ok(live.includes("const REVISION = '184'"), 'the live page carries the pinned three.js r184')
    assert.ok(/const OFFICE_CHARACTERS = \{"default":"Z2xURg/.test(live), 'and the default character (a glTF binary)')
    assert.equal((live.match(/<\/script>/g) || []).length, (live.match(/<script>/g) || []).length, 'every script block closes where it should')
  } finally { sb.cleanup() }
})

test('the default character: CC0, made by our own script, with the four clip names', () => {
  const dir = path.join(__dirname, '..', 'characters')
  const b = fs.readFileSync(path.join(dir, 'default.glb'))
  assert.equal(b.readUInt32LE(0), 0x46546C67, 'a glTF binary')
  const json = JSON.parse(b.subarray(20, 20 + b.readUInt32LE(12)).toString('utf8'))
  assert.deepEqual(json.animations.map((a) => a.name), ['Idle', 'Typing', 'Thinking', 'Celebrate'])
  assert.equal(json.scenes[0].extras.arsenale.seated, true)
  assert.ok(!json.images && !json.textures, 'no textures in it')
  assert.match(fs.readFileSync(path.join(dir, 'LICENSE.txt'), 'utf8'), /CC0 1\.0/)
  // the script makes the same file again, byte for byte
  const out = path.join(require('os').tmpdir(), 'arsenale-default-' + process.pid + '.glb')
  const r = require('child_process').spawnSync(process.execPath, [path.join(dir, 'make-default-character.cjs'), out], { encoding: 'utf8' })
  assert.equal(r.status, 0, r.stderr)
  try { assert.ok(fs.readFileSync(out).equals(b), 'make-default-character.cjs rebuilds default.glb exactly') } finally { fs.rmSync(out, { force: true }) }
})

test('three.js is pinned to r184', () => {
  const three = fs.readFileSync(path.join(__dirname, '..', 'vendor', 'three', 'three.cjs'))
  assert.equal(require('crypto').createHash('sha256').update(three).digest('hex'), '0fe243aabd03faa48e4156b51bf5b4c943fea15748aa623047aab539ab3b9624', 'three.cjs is three@0.184.0 build/three.cjs')
})
