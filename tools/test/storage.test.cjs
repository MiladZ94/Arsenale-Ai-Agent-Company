/* Writes that parallel agents cannot break (spec autonomous-mode 16, H1, H2):
 * two processes changing the same company file or the same active run lose
 * no update, a reader never sees half a file, and a writer killed between its
 * temp file and the rename leaves the old file whole, a temp file that the
 * next start removes, and a lock the next writer takes over. Every test has
 * its own data folder. All data is invented. */
const test = require('node:test')
const assert = require('node:assert/strict')
const fs = require('fs')
const path = require('path')
const { spawn } = require('child_process')
const { makeSandbox, SEED, track } = require('./helpers.cjs')

function setup(t) {
  const sb = makeSandbox()
  assert.equal(sb.cli('--company-init', '--seed', sb.seed(SEED)).code, 0)
  t.after(() => sb.cleanup())
  return sb
}
/** A node process in the sandbox running `body` (tools = the sandbox's tools folder). */
function child(sb, name, body) {
  const file = path.join(sb.base, name + '.cjs')
  fs.writeFileSync(file, 'const tools = ' + JSON.stringify(sb.tools) + '\n' + body)
  return track(spawn(process.execPath, [file], { env: sb.env, stdio: ['ignore', 'pipe', 'pipe'] }))
}
const ended = (c) => new Promise((res) => { let err = ''; c.stderr.on('data', (d) => { err += d }); c.on('exit', (code) => res({ code, err })) })
const sleep = (ms) => new Promise((r) => setTimeout(r, ms))

test('H1: two processes write employees.json 200 times each; the file always parses and no update is lost', async (t) => {
  const sb = setup(t)
  const file = path.join(sb.company, 'employees.json')
  const before = Object.keys(JSON.parse(fs.readFileSync(file, 'utf8')))
  const body = (p) => "const C = require(tools + '/agent-company.cjs')\nfor (let i = 0; i < 200; i++) C.writeOverlay('" + p + "-' + i, { n: i }, 'board')\n"
  const runs = [ended(child(sb, 'a', body('wa'))), ended(child(sb, 'b', body('wb')))]
  let done = false, reads = 0
  Promise.all(runs).then(() => { done = true })
  // a reader all the while, much more often than the dashboard's 1.5 s
  while (!done) {
    let text = ''
    try { text = fs.readFileSync(file, 'utf8') } catch (e) { if (e.code !== 'EBUSY' && e.code !== 'EPERM') throw e }
    if (text) { assert.doesNotThrow(() => JSON.parse(text), 'a reader saw a half-written employees.json'); reads++ }
    await sleep(20)
  }
  for (const r of await Promise.all(runs)) assert.equal(r.code, 0, r.err)
  const all = JSON.parse(fs.readFileSync(file, 'utf8'))
  const lost = []
  for (const p of ['wa', 'wb']) for (let i = 0; i < 200; i++) if (!all[p + '-' + i] || all[p + '-' + i].n !== i) lost.push(p + '-' + i)
  assert.deepEqual(lost, [], 'updates lost')
  for (const k of before) assert.ok(all[k], 'the seed employee ' + k + ' is kept')
  assert.ok(reads > 0)
  assert.deepEqual(fs.readdirSync(sb.company).filter((n) => /\.(tmp|lock)$/.test(n)), [], 'no temp or lock file is left')
})

test('two processes log 90 steps each on the same job; all 180 are kept', async (t) => {
  const sb = setup(t)
  const L = sb.mod('runlog.cjs')
  const { id } = L.startRun({ agent: 'implementer', task: 'invented parallel steps' }, L.actorFor('cli', 'supervisor'))
  const body = (p) => "const L = require(tools + '/runlog.cjs')\nfor (let i = 0; i < 90; i++) L.progress({ id: " + JSON.stringify(id) + ", doing: '" + p + " ' + i })\n"
  for (const r of await Promise.all([ended(child(sb, 'a', body('a'))), ended(child(sb, 'b', body('b')))])) assert.equal(r.code, 0, r.err)
  const run = sb.read('agent-runs/active/' + id + '.json')
  assert.equal(run.steps.length, 180)
})

test('H2: a writer killed between its temp file and the rename leaves the old file whole; the next start cleans up and the next writer takes the lock over', async (t) => {
  const sb = setup(t)
  const L = sb.mod('runlog.cjs')
  const sup = L.actorFor('cli', 'supervisor')
  const { id } = L.startRun({ agent: 'implementer', task: 'invented job', doing: 'reading the brief' }, sup)
  const active = path.join(sb.runs, 'active', id + '.json')
  const old = fs.readFileSync(active, 'utf8')
  const marker = path.join(sb.base, 'renaming')
  // the child stops for good right before the rename of its new step
  const c = child(sb, 'killed', [
    "const fs = require('fs')",
    "const real = fs.renameSync",
    "fs.renameSync = (a, b) => { if (String(b).endsWith(" + JSON.stringify(id + '.json') + ")) { fs.writeFileSync(" + JSON.stringify(marker) + ", 'x'); Atomics.wait(new Int32Array(new SharedArrayBuffer(4)), 0, 0) } return real(a, b) }",
    "require(tools + '/runlog.cjs').progress({ id: " + JSON.stringify(id) + ", doing: 'never written' })",
  ].join('\n'))
  const exit = ended(c)
  for (let i = 0; i < 300 && !fs.existsSync(marker); i++) await sleep(50)
  assert.ok(fs.existsSync(marker), 'the writer did not reach the rename')
  c.kill()
  await exit
  assert.equal(fs.readFileSync(active, 'utf8'), old, 'the old file is intact')
  const left = fs.readdirSync(path.join(sb.runs, 'active')).filter((n) => n !== id + '.json')
  assert.ok(left.some((n) => n.endsWith('.tmp')), 'the temp file of the killed writer is there: ' + left)
  assert.ok(left.some((n) => n.endsWith('.lock')), 'its lock is there')
  // the dashboard still shows the run, with its old step
  const B = sb.mod('build-agent-dashboard.cjs')
  const shown = B.collect().active.find((r) => r.id === id)
  assert.ok(shown, 'the dashboard shows the run')
  assert.equal(shown.doing, 'reading the brief')
  // the next writer takes the lock of the dead process over
  const L2 = sb.mod('runlog.cjs')
  L2.progress({ id, doing: 'after the crash' }, sup)
  assert.equal(sb.read('agent-runs/active/' + id + '.json').doing, 'after the crash')
  // and the next start removes what the dead writer left
  const removed = sb.mod('store.cjs').cleanStray([path.join(sb.runs, 'active')])
  assert.ok(removed.some((n) => n.endsWith('.tmp')))
  assert.deepEqual(fs.readdirSync(path.join(sb.runs, 'active')), [id + '.json'])
})

test('a lock held by a live process is waited for, not taken', async (t) => {
  const sb = setup(t)
  const file = path.join(sb.company, 'employees.json')
  // a live process that holds the lock for a second, then lets it go
  const c = child(sb, 'holder', "const S = require(tools + '/store.cjs')\nS.withLock(" + JSON.stringify(file) + ", () => { process.stdout.write('held\\n'); Atomics.wait(new Int32Array(new SharedArrayBuffer(4)), 0, 0, 1000) })\n")
  const exit = ended(c)
  await new Promise((res) => c.stdout.on('data', (d) => { if (/held/.test(String(d))) res() }))
  const t0 = Date.now()
  sb.mod('agent-company.cjs').writeOverlay('waiter', { n: 1 }, 'board')
  assert.ok(Date.now() - t0 >= 300, 'the writer waited for the lock')
  assert.equal((await exit).code, 0)
  assert.equal(sb.read('company/employees.json').waiter.n, 1)
})
