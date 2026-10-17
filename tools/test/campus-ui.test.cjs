/* The campus board (design C2) in a real page: the buildings on their lots,
 * build mode with its hotbar of 12 types, the ghost, the "Lot taken" refusal,
 * placing, moving, turning and archiving through the one write path, and Done
 * building. The scene is drawn by script with WebGL, so these tests open it in
 * a headless Chrome or Edge (test/browser.cjs). With none installed they skip. */
const test = require('node:test')
const assert = require('node:assert/strict')
const fs = require('fs')
const path = require('path')
const { startServer } = require('./helpers.cjs')
const browser = require('./browser.cjs')
const { scenario } = require('./office-scenario.cjs')

const SKIP = browser.unavailable()

let shared = null
async function world() {
  if (shared) return shared
  const sb = scenario()
  const s = await startServer(sb, { portBase: 44500 })
  const page = await browser.launch()
  await page.goto(s.url)
  await page.goto('http://127.0.0.1:' + s.port + '/?v=' + Date.now() + '#/campus')
  await page.screenshot(path.join(require('os').tmpdir(), 'campus-ui.png'), 1366, 768)
  await page.waitFor('window.__campus && window.__campus.info().on && window.__campus.info().buildings.length === 3', 20000)
  shared = { sb, s, page }
  return shared
}
test.after(async () => {
  if (!shared) return
  await shared.page.close()
  shared.s.child.kill()
  shared.sb.cleanup()
})

const file = (sb) => { try { return JSON.parse(fs.readFileSync(path.join(sb.company, 'campus.json'), 'utf8')) } catch { return null } }
// a pointer event on the canvas, at the middle of a lot
const pointer = (type, x, y, extra) => `(() => { const [px, py] = window.__campus.info().lotXY(${x}, ${y}); window.__campus.engine().canvas.dispatchEvent(new PointerEvent('${type}', Object.assign({ clientX: px, clientY: py, pointerId: 7, button: 0, bubbles: true }, ${JSON.stringify(extra || {})}))); return 1 })()`
const click = async (page, x, y) => { await page.eval(pointer('pointerdown', x, y)); await page.eval(pointer('pointerup', x, y)); await page.sleep(500) }
const msg = (page) => page.eval(`(document.getElementById('c3msg') || {}).textContent || ''`)

test('the campus shows one building per office, drawn in 3D, with a name label each', { skip: SKIP || false }, async () => {
  const { page } = await world()
  const got = await page.eval(`(() => { const i = window.__campus.info(); return { b: i.buildings.map((b) => [b.officeId, b.type]), labels: [...document.querySelectorAll('.c3lab')].map((l) => l.textContent), cnt: document.getElementById('c3cnt').textContent, flat: document.querySelectorAll('.c3flat').length } })()`)
  assert.deepEqual(got.b.map((b) => b[0]).sort(), ['docs', 'engineering', 'hq'])
  assert.equal(got.b.find((b) => b[0] === 'engineering')[1], 'engineering')
  assert.equal(got.b.find((b) => b[0] === 'docs')[1], 'docs', 'the profile picks the type')
  assert.ok(got.labels.some((t) => /Engineering/.test(t)))
  assert.match(got.cnt, /3 of 24 lots/)
  assert.equal(got.flat, 0)
})

test('one continuous ground: no slab, no trees, lot outlines only in build mode', { skip: SKIP || false }, async () => {
  const { page } = await world()
  await page.eval("if (window.__campus.info().build) document.querySelector('[data-c3=build]').click(); 1")
  await page.sleep(600)
  const off = await page.eval('window.__campus.info()')
  assert.equal(off.floorMeshes, 1, 'the ground is one checkerboard plane, not a slab with a tile per lot')
  assert.equal(off.loose, 0, 'nothing but the buildings stands on it: no trees')
  assert.equal(off.outlines, false, 'no lot outlines in normal mode')
  await page.eval("document.querySelector('[data-c3=build]').click(); 1")
  await page.waitFor("window.__campus.info().build", 5000)
  await page.sleep(400)
  assert.equal(await page.eval('window.__campus.info().outlines'), true, 'lot outlines show in build mode')
  await page.eval("document.querySelector('[data-c3=build]').click(); 1")
  await page.sleep(400)
})

for (const [w, h] of [[1366, 768], [1920, 1080]]) {
  test('titles name the building and its working count, and never cover a building or each other, at ' + w + 'x' + h, { skip: SKIP || false }, async () => {
    const { page } = await world()
    await page.eval("if (window.__campus.info().build) document.querySelector('[data-c3=build]').click(); 1")
    await page.screenshot(path.join(require('os').tmpdir(), 'campus-titles-' + w + '.png'), w, h)
    await page.eval('document.querySelector("[data-c3=fit]").click(); 1')
    await page.sleep(900)
    const info = await page.eval('window.__campus.info()')
    const labelled = info.buildings.filter((b) => b.box)
    assert.equal(labelled.length, info.buildings.length, 'every building has a visible title')
    for (const b of info.buildings) {
      assert.match(b.label, /· ?\d+/, b.officeId + ' shows its working count: ' + b.label)
    }
    // no title box over any drawn part of a building (a ray through a grid of points in the box), nor over another title
    const hitsB = []
    for (const b of labelled) {
      for (let i = 0; i <= 8; i++) for (let j = 0; j <= 3; j++) {
        const x = b.box.l + (b.box.r - b.box.l) * i / 8, y = b.box.t + (b.box.b - b.box.t) * j / 3
        const id = await page.eval(`window.__campus.info().buildingAt(${x}, ${y})`)
        if (id) { hitsB.push(b.officeId + ' over ' + id); break }
      }
    }
    assert.deepEqual(hitsB, [], 'titles over buildings')
    const clash = []
    for (let i = 0; i < labelled.length; i++) for (let j = i + 1; j < labelled.length; j++) { const a = labelled[i].box, c = labelled[j].box; if (a.l < c.r && a.r > c.l && a.t < c.b && a.b > c.t) clash.push(labelled[i].officeId + ' / ' + labelled[j].officeId) }
    assert.deepEqual(clash, [], 'titles over each other')
  })
}

test('a building label enters its office, with the keyboard too', { skip: SKIP || false }, async () => {
  const { page } = await world()
  await page.eval("document.querySelector('.c3lab[data-b=b-docs]').click(); 1")
  await page.waitFor("location.hash === '#/office/docs'", 5000)
  await page.eval("location.hash = '#/campus'; 1")
  await page.waitFor("document.querySelector('.c3lab[data-b=b-docs]')", 5000)
  await page.eval("document.querySelector('.c3lab[data-b=b-hq]').dispatchEvent(new KeyboardEvent('keydown', { key: 'Enter', bubbles: true })); 1")
  await page.waitFor("location.hash === '#/office/hq'", 5000)
  await page.eval("location.hash = '#/campus'; 1")
  await page.waitFor("document.querySelector('.c3lab[data-b=b-docs]')", 5000)
})

test('build mode: 12 types in a hotbar, keys 1 to 9, a ghost, and "Lot taken" on a used lot', { skip: SKIP || false }, async () => {
  const { page, sb } = await world()
  await page.eval(`document.querySelector('[data-c3=build]').click(); 1`)
  await page.waitFor("document.querySelectorAll('.c3h').length === 12", 5000)
  assert.equal(await page.eval(`document.querySelectorAll('.c3t').length`), 4, 'select, move, rotate, archive')
  assert.equal(await page.eval(`document.querySelector('[data-c3=build]').textContent`), 'Done building')
  await page.eval(`document.dispatchEvent(new KeyboardEvent('keydown', { key: '3', bubbles: true })); 1`)
  await page.waitFor("window.__campus.info().type === 'security'", 3000)
  assert.equal(await page.eval(`document.querySelectorAll('.c3h.on').length`), 1)
  const taken = await page.eval(`window.__campus.info().buildings.find((b) => b.officeId === 'hq')`)
  await page.eval(pointer('pointermove', taken.x, taken.y))
  assert.match(await page.eval(`(document.getElementById('c3ghost') || {}).textContent || ''`), /^Lot taken: Headquarters$/)
  const before = JSON.stringify(await page.eval(`fetch('api/company').then((r) => r.json()).then((c) => c.offices.map((o) => o.id))`))
  await click(page, taken.x, taken.y)
  assert.match(await msg(page), /Lot taken: Headquarters/)
  assert.equal(JSON.stringify(await page.eval(`fetch('api/company').then((r) => r.json()).then((c) => c.offices.map((o) => o.id))`)), before, 'no office was made')
  assert.equal(file(sb), null, 'nothing was written')
  await page.eval(pointer('pointermove', 5, 3))
  assert.match(await page.eval(`(document.getElementById('c3ghost') || {}).textContent || ''`), /^Security · click to place$/)
  // the key 1 to 9 switch types, and pressing the same key again puts the type down
  await page.eval(`document.dispatchEvent(new KeyboardEvent('keydown', { key: '3', bubbles: true })); 1`)
  await page.waitFor("window.__campus.info().type === ''", 3000)
})

test('placing a building creates the office and the file; the new building is on its lot', { skip: SKIP || false }, async () => {
  const { page, sb } = await world()
  await page.eval(`document.querySelector('[data-c3type=legal]').click(); 1`)
  await page.waitFor("window.__campus.info().type === 'legal'", 3000)
  await page.eval(pointer('pointermove', 5, 3))
  await click(page, 5, 3)
  await page.waitFor("window.__campus.info().buildings.length === 4", 8000)
  const f = file(sb)
  const b = f.buildings.find((x) => x.type === 'legal')
  assert.deepEqual([b.x, b.y, b.createdBy], [5, 3, 'board'])
  assert.equal(f.buildings.length, 4, 'the three buildings of before are saved with it')
  const off = JSON.parse(fs.readFileSync(path.join(sb.company, 'offices.json'), 'utf8')).find((o) => o.id === b.officeId)
  assert.equal(off.profile, 'legal')
  assert.match(await msg(page), /Placed Legal/)
})

test('move, rotate and archive tools work on a building; archive asks twice; Done building closes the palette', { skip: SKIP || false }, async () => {
  const { page, sb } = await world()
  const legal = () => file(sb).buildings.find((x) => x.type === 'legal')
  const at = legal()
  // rotate: click the building
  await page.eval(`document.querySelector('[data-c3tool=rotate]').click(); 1`)
  await click(page, at.x, at.y)
  await page.waitFor(`window.__campus.info().buildings.find((b) => b.type === 'legal').rot === 1`, 5000)
  assert.equal(legal().rot, 1)
  // move: pick it up, put it down on a free lot (a click, then a click)
  await page.eval(`document.querySelector('[data-c3tool=move]').click(); 1`)
  await click(page, at.x, at.y)
  await click(page, 4, 2)
  await page.waitFor(`window.__campus.info().buildings.find((b) => b.type === 'legal').x === 4`, 5000)
  assert.deepEqual([legal().x, legal().y], [4, 2])
  // archive: the first click arms it, the second does it
  await page.eval(`document.querySelector('[data-c3tool=archive]').click(); 1`)
  await click(page, 4, 2)
  assert.match(await msg(page), /Click again to archive/)
  assert.ok(legal(), 'still there after one click')
  await click(page, 4, 2)
  await page.waitFor(`window.__campus.info().buildings.length === 3`, 8000)
  assert.equal(file(sb).buildings.some((x) => x.type === 'legal'), false)
  const offices = JSON.parse(fs.readFileSync(path.join(sb.company, 'offices.json'), 'utf8'))
  assert.equal(offices.find((o) => /legal/.test(o.id)).archived, true, 'the office is archived, not deleted')
  await page.eval(`document.querySelector('[data-c3=build]').click(); 1`)
  await page.waitFor("document.querySelectorAll('.c3h').length === 0", 5000)
})

test('the write path is the board\'s: a post with no key is refused', { skip: SKIP || false }, async () => {
  const { s } = await world()
  const body = JSON.stringify({ op: 'place', type: 'docs', x: 0, y: 3 })
  const bad = await fetch(s.base + 'api/campus', { method: 'POST', headers: { 'Content-Type': 'application/json', Origin: 'http://127.0.0.1:' + s.port, cookie: s.cookie }, body })
  assert.equal(bad.status, 403)
  const ok = await fetch(s.base + 'api/campus', { method: 'POST', headers: { 'Content-Type': 'application/json', Origin: 'http://127.0.0.1:' + s.port, cookie: s.cookie, 'X-Dashboard-Token': s.token }, body })
  assert.equal(ok.status, 200)
  const again = await fetch(s.base + 'api/campus', { method: 'POST', headers: { 'Content-Type': 'application/json', Origin: 'http://127.0.0.1:' + s.port, cookie: s.cookie, 'X-Dashboard-Token': s.token }, body })
  assert.equal(again.status, 409, 'the same lot twice is refused')
  assert.match((await again.json()).error, /Lot taken/)
})
