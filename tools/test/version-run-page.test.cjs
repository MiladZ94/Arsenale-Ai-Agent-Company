/* The Version run page (spec autonomous-mode section 7, decision A11):
 * the data it is served, the view drawn from fixture records, the empty
 * state, the token gauge at 80 % and 100 %, two runs, and one real-browser
 * check (UI tier, skipped without a Chrome or Edge). All data is invented. */
const test = require('node:test')
const assert = require('node:assert/strict')
const fs = require('fs')
const path = require('path')
const { makeSandbox, startServer } = require('./helpers.cjs')
const { seed } = require('./version-run-fixture.cjs')
const browser = require('./browser.cjs')

const box = (t, opts) => { const sb = makeSandbox(Object.assign({ flat: true }, opts)); t.after(() => sb.cleanup()); return sb }

// The view's source is written into the dashboard page; here it is run in
// Node with the few browser things it touches, as the page would.
function view(data, extra) {
  const { versionRunView } = require('../version-run-page.cjs')
  const esc = (x) => String(x == null ? '' : x).replace(/&/g, '&amp;').replace(/</g, '&lt;').replace(/>/g, '&gt;').replace(/"/g, '&quot;')
  const g = globalThis
  g.document = { addEventListener() {} }
  g.DATA = Object.assign({ gates: [], decisions: [] }, (extra && extra.DATA) || {})
  const realFetch = g.fetch // the view may call fetch; the later server tests need the real one
  g.fetch = () => new Promise(() => {})
  const v = new Function('return ' + versionRunView.toString())()({
    esc, T: (s) => s, ms: (s) => Date.parse(s), live: () => !!(extra && extra.live), shown: () => true, redraw() {},
    answerBox: (gate) => '<div class="ansbox" data-for="' + esc(gate.id) + '"></div>',
  })
  v.st.data = data
  if (extra && extra.sel) v.st.sel = extra.sel
  const html = v.render({ active: (extra && extra.active) || [] })
  g.fetch = realFetch
  return html
}

const run = (o) => Object.assign({ id: 'app-x-1.2', app: 'app X', version: '1.2', status: 'running', budget: 1000000, phases: [], integrationBranch: 'b', startedAt: new Date().toISOString(), updatedAt: new Date().toISOString(), ledger: { phases: [], tokens: null } }, o)
const dirJson = (sb, rel) => fs.readdirSync(path.join(sb.root, rel)).map((n) => sb.read(rel + '/' + n))

test('load: the mirror records with the per-phase token ledger', (t) => {
  const sb = box(t)
  seed(sb)
  const { runs } = sb.mod('version-run-page.cjs').load()
  assert.deepEqual(runs.map((r) => r.id).sort(), ['app-x-1.2', 'app-y-0.9'])
  const x = runs.find((r) => r.id === 'app-x-1.2')
  assert.equal(x.ledger.tokens, 1660000)
  assert.deepEqual(x.ledger.phases.map((p) => [p.phase, p.tokens]), [['P1', 412000], ['P2', 800000], ['P3', 448000]])
  assert.ok(x.startedAt)
})

test('load: no version run is an empty list, a damaged record is skipped', (t) => {
  const sb = box(t)
  assert.deepEqual(sb.mod('version-run-page.cjs').load(), { runs: [] })
  fs.mkdirSync(path.join(sb.root, 'version-runs'))
  fs.writeFileSync(path.join(sb.root, 'version-runs', 'bad.json'), '{ half')
  assert.deepEqual(sb.mod('version-run-page.cjs').load(), { runs: [] })
})

test('empty state: no run yet, with the command to start one', () => {
  const html = view({ runs: [] })
  assert.match(html, /No version run yet/)
  assert.match(html, /arsenale autonomous start/)
  assert.doesNotMatch(view(null, { live: true }), /No version run yet/) // not loaded yet is not "empty"
})

test('a run with no tokens recorded says so, and a run with no budget says so', () => {
  assert.match(view({ runs: [run({})] }), /Tokens not recorded/)
  assert.match(view({ runs: [run({ budget: null })] }), /No budget set/)
})

test('gauge: 83 % warns, one segment per phase, the 80 % and 100 % marks', () => {
  const html = view({ runs: [run({ budget: 2000000, ledger: { tokens: 1660000, phases: [{ phase: 'P1', tokens: 412000 }, { phase: 'P2', tokens: 1248000 }] } })] })
  assert.match(html, /83 %/)
  assert.match(html, /warning at 80 %/)
  assert.equal((html.match(/<i title="P\d: /g) || []).length, 2)
  assert.match(html, /left:80%/)
  assert.match(html, /width:20\.60%/) // P1: 412k of 2M
})

test('gauge: below 80 % is within budget; at 100 % the bar is full and new agents stop', () => {
  assert.match(view({ runs: [run({ ledger: { tokens: 410000, phases: [{ phase: 'P1', tokens: 410000 }] } })] }), /within budget/)
  const html = view({ runs: [run({ ledger: { tokens: 1250000, phases: [{ phase: 'P1', tokens: 1250000 }] } })] })
  assert.match(html, /125 %/)
  assert.match(html, /budget reached, no new agents/)
  assert.match(html, /width:100\.00%/) // clipped to the bar
})

test('page from fixture records: owner gates first, phases, one row per running agent, decisions', (t) => {
  const sb = box(t)
  seed(sb)
  const active = dirJson(sb, 'agent-runs/active').map((a) => Object.assign(a, { start: Date.parse(a.startedAt), steps: [] }))
  const html = view(sb.mod('version-run-page.cjs').load(), { DATA: { gates: dirJson(sb, 'agent-runs/gates'), decisions: dirJson(sb, 'agent-runs/decisions') }, active })
  assert.ok(html.indexOf('Waiting for you') < html.indexOf('app X 1.2'), 'gates come first')
  assert.match(html, /Continue to 100 %\?/)
  assert.match(html, /data-for="g2"/)
  assert.match(html, /Sync engine/)
  assert.match(html, /gating round 2 of 3/)
  // one agent twice in one version: two rows, not one
  assert.equal((html.match(/<b>implementer<\/b>/g) || []).length, 2)
  assert.match(html, /D3/)
  assert.match(html, /Retry capped at 5 min/)
  assert.match(html, /dir="auto"/)
  assert.doesNotMatch(html, /[؀-ۿ]/)
})

test('two runs: two header cards, one compare table with both runs, nothing merged', () => {
  const p = (id, name) => ({ id, name, tier: 'low', percent: 50, status: 'building' })
  const html = view({ runs: [run({ id: 'a-1', app: 'A', version: '1', phases: [p('P1', 'One'), p('P2', 'Two')] }), run({ id: 'b-2', app: 'B', version: '2', phases: [p('P1', 'Uno')] })] })
  assert.equal((html.match(/<h1 /g) || []).length, 2)
  assert.match(html, /colspan="4"[^>]*>A 1<\/th>/)
  assert.match(html, /colspan="4"[^>]*>B 2<\/th>/)
  assert.match(html, /Uno/)
  assert.match(html, /<td class="dim bl" colspan="4">—<\/td>/) // B has no second phase
})

test('A24: with three runs active a selector shows one run at a time; with two (or one active and others done) all sit side by side', () => {
  const r = (id, app, status) => run({ id, app, version: '1', status })
  const three = { runs: [r('a-1', 'Alpha', 'running'), r('b-2', 'Beta', 'running'), r('c-3', 'Gamma', 'planning')] }
  const html = view(three)
  assert.match(html, /data-vrsel="1"/)
  assert.equal((html.match(/<option /g) || []).length, 3)
  assert.equal((html.match(/<h1 /g) || []).length, 1, 'one run drawn')
  assert.match(html, /<h1[^>]*>Gamma 1<\/h1>/, 'the newest is the default')
  // the owner's choice is kept, and a run with a waiting gate is the default
  assert.match(view(three, { sel: 'a-1' }), /<h1[^>]*>Alpha 1<\/h1>/)
  const gated = view(three, { DATA: { gates: [{ id: 'g', status: 'waiting', versionRun: 'b-2', question: 'q', askedAt: new Date().toISOString() }] } })
  assert.match(gated, /<h1[^>]*>Beta 1<\/h1>/)
  // two active and one finished: side by side, no selector
  const two = view({ runs: [r('a-1', 'Alpha', 'running'), r('b-2', 'Beta', 'waiting for owner'), r('c-3', 'Gamma', 'done')] })
  assert.doesNotMatch(two, /data-vrsel/)
  assert.equal((two.match(/<h1 /g) || []).length, 3)
})

test('user text is escaped', () => {
  assert.doesNotMatch(view({ runs: [run({ app: '<img src=x onerror=alert(1)>' })] }), /<img/)
})

test('GET api/version-runs serves the records to the owner only', async (t) => {
  const sb = box(t, { flat: false })
  seed(sb, { only: 'x' })
  const s = await startServer(sb)
  t.after(() => s.child.kill())
  assert.equal((await fetch(s.base + 'api/version-runs')).status, 401)
  const ok = await fetch(s.base + 'api/version-runs', { headers: { cookie: s.cookie } })
  assert.equal(ok.status, 200)
  assert.equal((await ok.json()).runs.length, 1)
})

// UI tier: needs a Chrome or Edge, skipped without one. The only browser test of this page.
test('UI tier: the Version run tab draws the page from the live server', { skip: browser.unavailable() || false }, async (t) => {
  const sb = box(t, { flat: false, packs: true })
  seed(sb)
  const s = await startServer(sb)
  const page = await browser.launch()
  t.after(async () => { await page.close(); s.child.kill() })
  await page.goto(s.url)
  await page.goto('about:blank')
  await page.goto(s.base + '#/versionrun')
  await page.waitFor('document.querySelectorAll("#v-vr .vr h1").length === 2', 15000)
  const text = await page.eval('document.getElementById("v-vr").innerText')
  assert.match(text, /waiting for you/i)
  assert.match(text, /83 %/)
})
