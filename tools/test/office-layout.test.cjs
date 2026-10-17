/* The office floor (design C2): figures, the side list, "N idle", N runs of
 * one agent as N figures, one avatar style, state by shape and colour, role
 * colours with enough contrast, and no label, badge or box over an avatar or
 * another label at 1366 and 1920 wide (bounding boxes measured in the page).
 *
 * The scene is drawn by script with WebGL, so these tests open it in a
 * headless Chrome or Edge (test/browser.cjs). With none installed they skip. */
const test = require('node:test')
const assert = require('node:assert/strict')
const { startServer } = require('./helpers.cjs')
const browser = require('./browser.cjs')
const { scenario } = require('./office-scenario.cjs')
const { ROLE, STATE, contrast } = require('../pages/world/palette.cjs')

const SKIP = browser.unavailable()

test('role and state colours keep 4.5:1 with the white text on them (the orange one too)', () => {
  for (const [zone, hex] of Object.entries(ROLE)) assert.ok(contrast(hex, '#FFFFFF') >= 4.5, zone + ' ' + hex + ' is ' + contrast(hex, '#FFFFFF').toFixed(2))
  for (const [state, s] of Object.entries(STATE)) assert.ok(contrast(s.fill, '#FFFFFF') >= 4.5, state + ' ' + s.fill + ' is ' + contrast(s.fill, '#FFFFFF').toFixed(2))
  assert.equal(ROLE.build, '#B45309', 'the build zone is the orange one')
})

test('every state has a shape of its own, so colour is never the only sign', () => {
  const shapes = new Map()
  for (const k of ['working', 'quiet', 'waiting', 'failed', 'done']) shapes.set(STATE[k].shape, k)
  assert.equal(shapes.size, 5)
})

let shared = null
async function world() {
  if (shared) return shared
  const sb = scenario()
  const s = await startServer(sb, { portBase: 43500 })
  const page = await browser.launch()
  await page.goto(s.url)
  shared = { sb, s, page, base: 'http://127.0.0.1:' + s.port }
  return shared
}
test.after(async () => {
  if (!shared) return
  await shared.page.close()
  shared.s.child.kill()
  shared.sb.cleanup()
})

const READY = 'window.__office3d && window.__office3d.info().figures.length === 8'
async function open(w, h) {
  const { page, base } = await world()
  await page.goto(base + '/?v=' + Date.now() + '#/office/engineering')
  await page.screenshot(require('path').join(require('os').tmpdir(), 'office-layout-' + w + '.png'), w, h)
  await page.waitFor(READY, 20000)
  await page.eval('window.__office3d.fit(); 1')
  await page.sleep(500)
  return page
}
const hit = (a, b) => a.l < b.r && a.r > b.l && a.t < b.b && a.b > b.t

test('8 runs are 8 figures (the implementer twice), each with a number; 6 idle sit in the free area, not at desks', { skip: SKIP || false }, async () => {
  const page = await open(1366, 768)
  const got = await page.eval(`(() => {
    const i = window.__office3d.info()
    return {
      figures: i.figures.map((f) => ({ n: f.n, agent: f.agent, runCount: f.runCount, state: f.state })),
      rows: [...document.querySelectorAll('.o3row')].map((r) => ({ name: r.querySelector('.nm b').textContent, step: r.querySelector('.nm small').textContent, st: r.querySelector('.st').textContent, key: r.dataset.key })),
      idleRow: (document.querySelector('.o3idle') || {}).textContent || '',
      lounge: (document.querySelector('.o3c.lounge') || {}).textContent || '',
      info: { rooms: i.rooms, seated: i.seated, desks: i.desks.length },
      cards: document.querySelectorAll('.w3card,.w3who').length,
      avatars: document.querySelectorAll('.o3a').length,
      badges: [...document.querySelectorAll('.o3a .n')].map((n) => n.textContent),
    }
  })()`)
  assert.equal(got.figures.length, 8)
  assert.equal(new Set(got.figures.map((f) => f.n)).size, 8, 'every figure has its own number')
  assert.equal(got.avatars, 8, 'one avatar per run, and no card as well')
  assert.equal(got.cards, 0, 'no person is drawn twice: there are no portrait cards')
  assert.deepEqual(got.rows.map((r) => r.name).filter((n) => /^Implementer/.test(n)).sort(), ['Implementer · run 1', 'Implementer · run 2'])
  assert.equal(got.rows.length, 8)
  assert.ok(got.rows.every((r) => r.st === 'Working' && r.step && r.key), 'each row has a state, a step and a run to open')
  assert.match(got.idleRow, /6 idle/)
  assert.match(got.lounge, /^Free area · 6 idle$/)
  assert.deepEqual(got.info.rooms, ['desks', 'free'], 'one open floor: a block of desks and the free area, no rooms')
  assert.equal(got.info.seated, 5, 'idle agents sit in the free area (the sofa and chairs seat five; the label counts all six)')
  const nums = got.badges.map((b) => b.trim()).sort()
  assert.deepEqual(nums, ['1', '2', '3', '4', '5', '6', '7', '8'])
})

for (const [w, h] of [[1366, 768], [1920, 1080]]) {
  test('no badge, avatar, tag or chip covers another, at ' + w + 'x' + h, { skip: SKIP || false }, async () => {
    const { sb } = await world()
    const page = await open(w, h)
    const info = await page.eval('window.__office3d.info()')
    const boxes = []
    for (const f of info.figures) {
      boxes.push(['avatar ' + f.id + ' ' + f.n, { l: f.box.l, r: f.box.r, t: f.box.t, b: f.box.b }])
      if (f.tag) boxes.push(['tag ' + f.id + ' ' + f.n, { l: f.tag.l, r: f.tag.r, t: f.tag.t, b: f.tag.b }])
    }
    for (const c of info.labels) boxes.push(['chip ' + c.text, { l: c.box.l, r: c.box.r, t: c.box.t, b: c.box.b }])
    const clash = []
    for (let i = 0; i < boxes.length; i++) for (let j = i + 1; j < boxes.length; j++) if (hit(boxes[i][1], boxes[j][1])) clash.push(boxes[i][0] + ' / ' + boxes[j][0])
    assert.deepEqual(clash, [], 'overlapping boxes')
    // a label may not sit on a desk either (the "×2" chip and the "Guest" name used to)
    assert.ok(info.desks.length >= 8, 'the desks are reported')
    const onDesk = []
    for (const [name, b] of boxes) if (!/^avatar/.test(name)) for (const d of info.desks) if (hit(b, d)) { onDesk.push(name); break }
    assert.deepEqual(onDesk, [], 'labels touching a desk')
    // everything of the scene lies inside the scene, left of the list
    for (const [name, b] of boxes) { assert.ok(b.l >= info.scene.l - 1 && b.r <= info.scene.r + 1 && b.t >= info.scene.t - 1 && b.b <= info.scene.b + 1, name + ' is inside the scene') }
    assert.ok(info.scene.r <= info.side.l + 1, 'the list does not cover the scene')
    // every run's desk has its label ("name · step", or the name alone): it is obvious who does what
    assert.deepEqual(info.figures.filter((f) => !f.tag).map((f) => f.id), [], 'a figure with no label at its desk')
    // the free area's label is there
    assert.ok(info.labels.some((c) => /Free area · \d+ idle/.test(c.text)))
    void sb
  })
}

test('one run keeps its figure, number and desk while the page redraws; a second run of the same agent adds a figure', { skip: SKIP || false }, async () => {
  const { sb, page } = await world()
  await open(1366, 768)
  const before = await page.eval(`window.__office3d.info().figures.map((f) => [f.id, f.n, Math.round(f.box.l), Math.round(f.box.t)].join(':')).sort()`)
  await page.sleep(3500) // two polls
  const after = await page.eval(`window.__office3d.info().figures.map((f) => [f.id, f.n, Math.round(f.box.l), Math.round(f.box.t)].join(':')).sort()`)
  assert.deepEqual(after, before, 'nothing moved')
  const r = sb.cli('--start', JSON.stringify({ agent: 'implementer', task: 'a third run', project: 'ledger', model: 'sonnet', doing: 'reading A' }))
  assert.equal(r.code, 0, r.err)
  await page.waitFor("window.__office3d.info().figures.filter((f) => f.runCount === 3).length === 3", 15000)
  const rows = await page.eval(`[...document.querySelectorAll('.o3row .nm b')].map((b) => b.textContent).filter((t) => /^Implementer/.test(t)).sort()`)
  assert.deepEqual(rows, ['Implementer · run 1', 'Implementer · run 2', 'Implementer · run 3'])
  // the first two kept their numbers
  const nums = await page.eval(`window.__office3d.info().figures.map((f) => f.n).sort((a, b) => a - b)`)
  assert.deepEqual(nums, [1, 2, 3, 4, 5, 6, 7, 8, 9])
})


test('the top bar fits at 1366 with every count showing, "Live" whole and nothing clipped', { skip: SKIP || false }, async () => {
  const { sb, page, base } = await world()
  // a run with no step for 40 minutes is "quiet": the fourth count chip
  const r = sb.cli('--start', JSON.stringify({ agent: 'helper', task: 'long wait', project: 'ledger', model: 'sonnet', startedAt: new Date(Date.now() - 40 * 60000).toISOString() }))
  assert.equal(r.code, 0, r.err)
  await page.goto(base + '/?v=' + Date.now() + '#/office/engineering')
  await page.screenshot(require('path').join(require('os').tmpdir(), 'office-layout-top.png'), 1366, 768)
  await page.waitFor("document.querySelectorAll('#counts li').length >= 4", 15000)
  const got = await page.eval(`(() => {
    const top = document.querySelector('header.top'), t = top.getBoundingClientRect()
    const live = document.getElementById('mode')
    return {
      overflow: top.scrollWidth - top.clientWidth,
      kids: [...top.children].map((c) => { const b = c.getBoundingClientRect(); return { id: c.id || c.className || c.tagName, r: b.right, l: b.left, own: c.scrollWidth - c.clientWidth } }),
      topRight: t.right, live: live.textContent.trim(), liveRight: live.getBoundingClientRect().right, vw: window.innerWidth,
    }
  })()`)
  assert.ok(got.overflow <= 0, 'the header is not wider than the window: ' + JSON.stringify(got))
  for (const k of got.kids) assert.ok(k.r <= got.vw + 0.5 && k.own <= 1, 'header item ' + k.id + ' is whole inside the window: ' + JSON.stringify(k))
  assert.equal(got.live, 'Live')
})

test('"N idle" in the office strip is the number the lounge shows, in the headquarters too (the lead is on the floor)', { skip: SKIP || false }, async () => {
  const { page, base } = await world()
  for (const office of ['engineering', 'hq']) {
    await page.goto(base + '/?v=' + Date.now() + '#/office/' + office)
    await page.screenshot(require('path').join(require('os').tmpdir(), 'office-layout-idle.png'), 1366, 768)
    await page.waitFor("window.__office3d && window.__office3d.info().rooms.length > 0 && document.querySelector('.ostats')", 20000)
    await page.sleep(600)
    const got = await page.eval(`(() => {
      const strip = [...document.querySelectorAll('.ostats div')].find((d) => /idle/.test(d.textContent))
      const lounge = document.querySelector('.o3c.lounge')
      return { strip: strip ? strip.querySelector('b').textContent.trim() : null, lounge: lounge ? lounge.textContent.trim() : '', list: (document.querySelector('.o3idle') || {}).textContent || '' }
    })()`)
    const n = (/(\d+) idle/.exec(got.lounge) || [])[1] || '0'
    assert.equal(got.strip, n, office + ': strip ' + got.strip + ' vs lounge "' + got.lounge + '"')
    if (got.list) assert.match(got.list, new RegExp('^\D*' + n + ' idle'), office + ': list ' + got.list)
  }
})
