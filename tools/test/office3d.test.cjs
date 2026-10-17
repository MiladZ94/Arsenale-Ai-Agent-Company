/* The 3D pages (office floor and campus, office-world.cjs): the camera and
 * the figures survive the page's redraw, the flat office and the flat campus
 * when there is no WebGL, a built file that stays flat and carries no
 * three.js, no shadows anywhere, and the pinned three.js.
 *
 * The scenes are drawn by script with WebGL, so these tests open them in a
 * headless Chrome or Edge (test/browser.cjs). With none installed they skip.
 * The figures, the list and the layout are in office-layout.test.cjs; the
 * campus board in campus-ui.test.cjs. */
const test = require('node:test')
const assert = require('node:assert/strict')
const fs = require('fs')
const path = require('path')
const { makeSandbox, startServer } = require('./helpers.cjs')
const browser = require('./browser.cjs')
const { scenario } = require('./office-scenario.cjs')

const SKIP = browser.unavailable()
const sleep = (ms) => new Promise((r) => setTimeout(r, ms))

let shared = null
async function world() {
  if (shared) return shared
  const sb = scenario()
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

const READY = 'window.__office3d && window.__office3d.info().figures.length === 8'
const pageErrors = (log) => log.filter((m) => m.method === 'Runtime.exceptionThrown' || (m.method === 'Log.entryAdded' && m.params.entry.level === 'error')).map((m) => JSON.stringify(m.params).slice(0, 300))

test('office 3D: the 1.5 s redraw keeps the camera, the canvas and the figures; a reload restores the view', { skip: SKIP || false }, async () => {
  const { page, base, sb, log } = await world()
  await page.goto(base + '/?v=' + Date.now() + '#/office/engineering')
  await page.waitFor(READY, 20000)
  await page.eval("window.__office3d.zoomBy(1.4); window.__office3d.panBy(60, -30); document.querySelector('#stage canvas').dataset.mark = 'same'; document.querySelector('.o3a').dataset.mark = 'same'; 1")
  await sleep(600)
  const before = await page.eval('window.__office3d.view()')
  const id = await page.eval("DATA.active.find((a) => a.officeId === 'engineering').id")
  const r = sb.cli('--progress', JSON.stringify({ id, doing: 'camera check step' }))
  assert.equal(r.code, 0, r.err)
  await page.waitFor("[...document.querySelectorAll('.o3row small')].some((b) => b.textContent.includes('camera check step'))", 10000)
  await sleep(1700)
  const after = await page.eval("({ view: window.__office3d.view(), canvas: document.querySelector('#stage canvas').dataset.mark, fig: document.querySelector('.o3a').dataset.mark })")
  for (const k of ['tx', 'tz', 'zoom']) assert.ok(Math.abs(after.view[k] - before[k]) < 1e-6, k + ' kept: ' + before[k] + ' -> ' + after.view[k])
  assert.equal(after.canvas, 'same', 'the canvas is the same element')
  assert.equal(after.fig, 'same', 'the figures are kept, not drawn anew')
  await page.goto(base + '/?v=' + Date.now() + '#/office/engineering')
  await page.waitFor(READY, 20000)
  const back = await page.eval('window.__office3d.view()')
  for (const k of ['tx', 'tz', 'zoom']) assert.ok(Math.abs(back[k] - before[k]) < 1e-3, k + ' restored after a reload')
  assert.deepEqual(pageErrors(log), [], 'no page errors')
})

test('no WebGL: the flat office and a flat campus are drawn, and work', { skip: SKIP || false }, async (t) => {
  const { s, base } = await world()
  const page = await browser.launch()
  t.after(() => page.close())
  await page.onNewDocument(`(() => {
    const get = HTMLCanvasElement.prototype.getContext
    HTMLCanvasElement.prototype.getContext = function (kind, o) { return /webgl/i.test(kind) ? null : get.call(this, kind, o) }
  })()`)
  await page.goto(s.url.replace('localhost', '127.0.0.1'))
  await page.goto(base + '/?v=' + Date.now() + '#/office/engineering')
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
  await page.goto(base + '/?v=' + Date.now() + '#/campus')
  await page.waitFor("document.querySelector('.c3flat .tile')", 10000)
  const c = await page.eval(`({ tiles: [...document.querySelectorAll('.c3flat .tile')].map((t) => t.querySelector('b').textContent), canvas: document.querySelectorAll('#cmap canvas').length, build: document.querySelectorAll('[data-c3=build]').length, count: document.getElementById('c3cnt').textContent })`)
  assert.deepEqual(c.tiles.sort(), ['Docs', 'Engineering', 'Headquarters'])
  assert.equal(c.canvas, 0)
  assert.equal(c.build, 0, 'building needs the 3D board')
  assert.match(c.count, /3 of 24 lots/)
  await page.eval("document.querySelector('.c3flat .tile').click(); 1")
  await page.waitFor("location.hash.startsWith('#/office/')", 5000)
})

test('the built file keeps the flat office and carries no three.js; the live page carries r184 and the asset list', () => {
  const sb = makeSandbox()
  try {
    const { renderOffice } = sb.mod('agent-office-page.cjs')
    const state = { runs: [], active: [], agents: [], gates: [], decisions: [], prices: {}, answers: [] }
    const built = renderOffice(state, { live: false, lang: 'en' })
    assert.ok(!built.includes("const REVISION = '184'"), 'no three.js in the built file')
    const live = renderOffice(state, { live: true, token: 'x', lang: 'en' })
    assert.ok(live.includes("const REVISION = '184'"), 'the live page carries the pinned three.js r184')
    assert.ok(/const ASSET_MODELS = \{("(building|furniture|character|portrait):[a-z]+":"[A-Za-z0-9+\/=]+",?)*\};/.test(live), 'and the list of real models, by building type, furniture piece and character style (one with none is drawn from shapes)')
    assert.ok(!/OFFICE_CHARACTERS/.test(live), 'there is one avatar style: one character style in the manifest, no per-role character files')
    assert.equal((live.match(/<\/script>/g) || []).length, (live.match(/<script>/g) || []).length, 'every script block closes where it should')
  } finally { sb.cleanup() }
})

test('no shadows anywhere: nothing in the 3D code asks for one', () => {
  for (const f of ['kit.cjs', 'campus.cjs', 'office3d.cjs']) {
    const src = fs.readFileSync(path.join(__dirname, '..', 'pages', 'world', f), 'utf8')
    assert.ok(!/castShadow\s*=\s*true|receiveShadow\s*=\s*true|shadowMap\.enabled\s*=\s*true/.test(src), f + ' draws no shadows')
  }
})

test('three.js is pinned to r184', () => {
  const three = fs.readFileSync(path.join(__dirname, '..', 'vendor', 'three', 'three.cjs'))
  assert.equal(require('crypto').createHash('sha256').update(three).digest('hex'), '0fe243aabd03faa48e4156b51bf5b4c943fea15748aa623047aab539ab3b9624', 'three.cjs is three@0.184.0 build/three.cjs')
})
