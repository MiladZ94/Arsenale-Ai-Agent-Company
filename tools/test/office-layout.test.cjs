/* The office floor: one figure per run (N runs of one agent are N people at N
 * desks, each keeping its desk while the page redraws), and the top bar at
 * 1366 wide.
 *
 * The floor is drawn by script with WebGL, so these tests open it in a
 * headless Chrome or Edge (test/browser.cjs). With none installed they skip. */
const test = require('node:test')
const assert = require('node:assert/strict')
const { startServer } = require('./helpers.cjs')
const browser = require('./browser.cjs')
const { scenario } = require('./office-scenario.cjs')

const SKIP = browser.unavailable()

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

const READY = "window.__office3d && window.__office3d.info().podiums.filter((p) => p.character).length >= 9"
const cells = (page) => page.eval("window.__office3d.info().podiums.filter((p) => p.kind === 'desk').map((p) => p.id + ':' + p.cell.join(',')).sort()")

test('8 runs are 8 people at work (the implementer twice), each at a desk of its own with its own card', { skip: SKIP || false }, async () => {
  const { page, base } = await world()
  await page.goto(base + '/?v=' + Date.now() + '#/office/engineering')
  await page.waitFor(READY, 20000)
  const got = await page.eval(`(() => {
    const i = window.__office3d.info()
    return {
      working: i.podiums.filter((p) => ['working', 'quiet'].includes(p.state)).map((p) => p.id).sort(),
      cells: i.podiums.filter((p) => p.cell).map((p) => p.cell.join(',')),
      cards: [...document.querySelectorAll('.w3card')].map((c) => c.dataset.anchor).sort(),
      ids: i.podiums.map((p) => p.id).sort(),
      bubbles: [...document.querySelectorAll('.w3ov .bub')].map((b) => b.dataset.anchor).sort(),
    }
  })()`)
  assert.deepEqual(got.working, ['architect', 'implementer', 'implementer#2', 'planner', 'refactorer', 'releaser', 'reviewer', 'tester'], 'the implementer works twice: two people')
  assert.equal(new Set(got.cells).size, got.cells.length, 'no two people share a desk')
  assert.deepEqual(got.cards, got.ids, 'one card per person, the second implementer included')
  assert.deepEqual(got.bubbles, got.working, 'one bubble per run, pinned to its own person')
})

test('a person keeps their desk while the page redraws; a third run of the same agent adds a person, nobody else moves', { skip: SKIP || false }, async () => {
  const { sb, page, base } = await world()
  await page.goto(base + '/?v=' + Date.now() + '#/office/engineering')
  await page.waitFor(READY, 20000)
  const before = await cells(page)
  await page.sleep(3500) // two polls
  assert.deepEqual(await cells(page), before, 'nothing moved')
  const r = sb.cli('--start', JSON.stringify({ agent: 'implementer', task: 'a third run', project: 'ledger', model: 'sonnet', doing: 'reading A' }))
  assert.equal(r.code, 0, r.err)
  await page.waitFor("window.__office3d.info().podiums.some((p) => p.id === 'implementer#3')", 15000)
  const after = await cells(page)
  assert.deepEqual(after.filter((c) => before.includes(c)), before, 'every desk kept its person')
  assert.equal(after.length, before.length + 1, 'and one person came')
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
