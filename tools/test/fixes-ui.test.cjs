/* H5 (spec autonomous-mode 16, rule 5): on the demo data, the Team page
 * shows no existing office as "not set up"; the archive's token total is the
 * board's; "Unassigned work" shows "n/a", not "$0"; org chart names keep a
 * readable width at 1366 px and end in an ellipsis; Tasks says "Loading…"
 * until its data is there. Read in a headless Chrome or Edge
 * (test/browser.cjs; skipped when there is none). One demo for the file; it
 * is invented data in a temporary folder. */
const test = require('node:test')
const assert = require('node:assert/strict')
const fs = require('fs')
const path = require('path')
const { spawn } = require('child_process')
const { track } = require('./helpers.cjs')
const browser = require('./browser.cjs')

const SKIP = browser.unavailable()
const BIN = path.join(__dirname, '..', '..', 'bin', 'arsenale.cjs')
let demo = null

test.before(async () => {
  if (SKIP) return
  const port = 44000 + Math.floor(Math.random() * 2000)
  const child = track(spawn(process.execPath, [BIN, 'demo', '--port', String(port), '--no-open'], { stdio: ['ignore', 'pipe', 'pipe'] }))
  let out = ''
  await new Promise((resolve, reject) => {
    const to = setTimeout(() => reject(new Error('demo did not start: ' + out)), 30000)
    child.stdout.on('data', (d) => { out += d; if (/Data folder: .+\n/.test(out)) { clearTimeout(to); resolve() } })
    child.stderr.on('data', (d) => { out += d })
    child.on('exit', (c) => { clearTimeout(to); reject(new Error('demo exited ' + c + ': ' + out)) })
  })
  demo = { child, port, keyUrl: /: (http:\S+)/.exec(out)[1].replace('localhost', '127.0.0.1'), folder: /Data folder: (.+)/.exec(out)[1].trim(), base: 'http://127.0.0.1:' + port + '/' }
})
test.after(() => {
  if (!demo) return
  demo.child.kill()
  try { fs.rmSync(demo.folder, { recursive: true, force: true }) } catch { /* the OS cleans its temp folder later */ }
})

async function open(t, where, opts) {
  const page = await browser.launch()
  t.after(() => page.close())
  if (opts && opts.before) await page.onNewDocument(opts.before)
  await page.goto(demo.keyUrl)
  if (opts && opts.width) await page.screenshot(path.join(require('os').tmpdir(), 'arsenale-fixes-' + process.pid + '.png'), opts.width, opts.height)
  await page.goto(demo.base + where)
  return page
}

test('the Team page lists no existing office as "not set up"', { skip: SKIP || false }, async (t) => {
  const page = await open(t, '?v=' + Date.now() + '#/team')
  await page.waitFor("document.querySelector('.float.camp') && /not set up/.test(document.querySelector('.float.camp').textContent)")
  const offices = await page.eval("[...document.querySelectorAll('.float.camp button[data-ev=team-office] .sp')].map((e) => e.textContent)")
  const line = await page.eval("[...document.querySelectorAll('.float.camp p')].map((e) => e.textContent).join(' ')")
  assert.ok(offices.includes('Research'), 'Research is an office here: ' + offices)
  for (const o of offices) assert.ok(!new RegExp('\\b' + o + '\\b').test(line), o + ' exists and is listed as not set up: ' + line)
})

test('the archive counts the same tokens as the board', { skip: SKIP || false }, async (t) => {
  const page = await open(t, 'archive')
  await page.waitFor("typeof DATA === 'object' && document.querySelector('.tile b')")
  const r = await page.eval("({ tile: [...document.querySelectorAll('.tile')].find((e) => /all time/.test(e.textContent)).querySelector('b').textContent, board: fmt(DATA.runs.reduce((a, r) => a + (r.tokTotal || 0), 0)) })")
  assert.notEqual(r.board, '0')
  assert.equal(r.tile, r.board)
})

test('"Unassigned work" on the campus shows USD n/a, never "$0"', { skip: SKIP || false }, async (t) => {
  const page = await open(t, '?v=' + Date.now() + '#/campus')
  await page.waitFor("[...document.querySelectorAll('.orow')].some((e) => /Unassigned work/.test(e.textContent))")
  const row = await page.eval("[...document.querySelectorAll('.orow')].filter((e) => /Unassigned work/.test(e.textContent)).map((e) => e.textContent).join(' | ')")
  assert.match(row, /n\/a/)
  assert.doesNotMatch(row, /\$0(?![.\d])/)
})

test('org chart names and office headers keep a fixed width at 1366 px and end in an ellipsis', { skip: SKIP || false }, async (t) => {
  const page = await open(t, '?v=' + Date.now() + '#/org', { width: 1366, height: 768 })
  await page.waitFor("document.querySelectorAll('.otx b').length > 10")
  const cut = await page.eval("[...document.querySelectorAll('.otx b, .ocolh b')].map((e) => ({ t: e.textContent, w: e.clientWidth, full: e.scrollWidth, ell: getComputedStyle(e).textOverflow })).filter((x) => x.w < Math.min(x.full, 90) || (x.full > x.w && x.ell !== 'ellipsis'))")
  assert.deepEqual(cut, [], 'names cut short at 1366 px')
})

test('Tasks shows a loading state, not "No tasks yet", until the tasks arrive', { skip: SKIP || false }, async (t) => {
  // the tasks answer is held back for two seconds
  const slow = "(() => { const f = window.fetch; window.fetch = (u, o) => /api\\/tasks/.test(String(u)) ? new Promise((r) => setTimeout(r, 2000)).then(() => f(u, o)) : f(u, o) })()"
  const page = await open(t, '?v=' + Date.now() + '#/tasks', { before: slow })
  await page.waitFor("/New task/.test(document.body.innerText)")
  const early = await page.eval('document.body.innerText')
  assert.doesNotMatch(early, /No tasks yet/)
  assert.match(early, /Loading/)
  await page.waitFor("/Write the launch post/.test(document.body.innerText)", 15000)
})
