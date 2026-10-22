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
const http = require('http')
const { makeSandbox, SEED, track, exitOf, startServer } = require('./helpers.cjs')

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
const ended = (c) => { let err = ''; c.stderr.on('data', (d) => { err += d }); return exitOf(c).then((code) => ({ code, err })) }
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
  // and a later start removes what the dead writer left, once it is a minute
  // old: a temp made a moment ago may belong to a writer just starting
  const S = sb.mod('store.cjs')
  const dir = path.join(sb.runs, 'active')
  assert.deepEqual(S.cleanStray([dir]), [], 'a temp a moment old is left alone')
  // a temp of a live process is kept however old it is
  const live = path.join(dir, id + '.json.' + process.pid + '-abcdef.tmp')
  fs.writeFileSync(live, 'x')
  const past = new Date(Date.now() - 5 * 60000)
  for (const n of fs.readdirSync(dir)) fs.utimesSync(path.join(dir, n), past, past)
  const removed = S.cleanStray([dir])
  assert.ok(removed.some((n) => n.endsWith('.tmp')))
  assert.deepEqual(fs.readdirSync(dir).sort(), [id + '.json', path.basename(live)].sort())
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

/** A child that holds the lock of `file` and, under it, adds `key` to the
 *  JSON in it after `ms`: a read-change-write that loses an update when
 *  another writer is let in meanwhile. Prints "held" once it holds. */
const holder = (sb, name, file, key, ms) => child(sb, name, [
  "const fs = require('fs')",
  "const S = require(tools + '/store.cjs')",
  'const f = ' + JSON.stringify(file),
  'S.withLock(f, () => {',
  "  const j = JSON.parse(fs.readFileSync(f, 'utf8'))",
  "  process.stdout.write('held\\n')",
  '  Atomics.wait(new Int32Array(new SharedArrayBuffer(4)), 0, 0, ' + ms + ')',
  '  j[' + JSON.stringify(key) + '] = { n: 1 }',
  '  S.writeAtomic(f, JSON.stringify(j))',
  '})',
].join('\n'))
const heldBy = (c) => new Promise((res) => { let out = ''; c.stdout.on('data', (d) => { out += d; if (/held/.test(out)) res() }) })

test('a live writer that holds its lock longer than 30 s keeps it: the next writer waits, and neither update is lost', async (t) => {
  const sb = setup(t)
  const file = path.join(sb.company, 'employees.json')
  const c = holder(sb, 'slow', file, 'slow-writer', 1500)
  const exit = ended(c)
  await heldBy(c)
  // as if it had held the lock for 40 s: its PID is alive, so it is still its lock
  const lock = file + '.lock'
  const past = new Date(Date.now() - 40000)
  for (const n of fs.readdirSync(lock)) fs.utimesSync(path.join(lock, n), past, past)
  sb.mod('agent-company.cjs').writeOverlay('waiter', { n: 1 }, 'board')
  assert.equal((await exit).code, 0)
  const all = sb.read('company/employees.json')
  assert.ok(all['slow-writer'], 'the update of the slow writer is kept')
  assert.ok(all.waiter, 'the update of the waiter is kept')
})

/** A child whose lock attempt stops for 3 s right before it makes its owner
 *  folder (the moment an older store left a lock with no owner), then writes
 *  under the lock with a marker that tells whether anyone else is inside. */
function slowMaker(sb, file, marker, inside) {
  return child(sb, 'maker', [
    "const fs = require('fs'), path = require('path')",
    'const real = fs.mkdirSync',
    'let paused = false',
    'fs.mkdirSync = (p, o) => { if (!paused && /^\\d+-[0-9a-f]+$/.test(path.basename(String(p)))) { paused = true; fs.writeFileSync(' + JSON.stringify(marker) + ", 'x'); Atomics.wait(new Int32Array(new SharedArrayBuffer(4)), 0, 0, 3000) } return real(p, o) }",
    "require(tools + '/store.cjs').withLock(" + JSON.stringify(file) + ', () => {',
    '  try { fs.writeFileSync(' + JSON.stringify(inside) + ", 'maker', { flag: 'wx' }) } catch { process.stderr.write('two owners\\n'); process.exit(3) }",
    '  fs.unlinkSync(' + JSON.stringify(inside) + ')',
    '})',
  ].join('\n'))
}
async function makerPaused(marker) {
  for (let i = 0; i < 300 && !fs.existsSync(marker); i++) await sleep(20)
  assert.ok(fs.existsSync(marker), 'the maker did not reach its owner folder')
}

test('two processes taking one lock never both hold it, even when one stops halfway through making it', async (t) => {
  const sb = setup(t)
  const file = path.join(sb.company, 'employees.json')
  const marker = path.join(sb.base, 'paused'), inside = path.join(sb.base, 'inside')
  const exit = ended(slowMaker(sb, file, marker, inside))
  await makerPaused(marker)
  // this one takes the lock while the other is stopped, and stays in for 2 s
  sb.mod('store.cjs').withLock(file, () => {
    fs.writeFileSync(inside, 'test', { flag: 'wx' })
    Atomics.wait(new Int32Array(new SharedArrayBuffer(4)), 0, 0, 2000)
    fs.unlinkSync(inside)
  })
  const r = await exit
  assert.equal(r.code, 0, 'both held the lock at once: ' + r.err)
})

test('a lock taken over while its maker stopped halfway: the maker waits and gets it, no raw ENOENT', async (t) => {
  const sb = setup(t)
  const file = path.join(sb.company, 'employees.json')
  const marker = path.join(sb.base, 'paused'), inside = path.join(sb.base, 'inside')
  const exit = ended(slowMaker(sb, file, marker, inside))
  await makerPaused(marker)
  // in and out at once: the lock is free again by the time the maker goes on
  sb.mod('store.cjs').withLock(file, () => {})
  const r = await exit
  assert.equal(r.code, 0, r.err)
  assert.ok(!fs.existsSync(file + '.lock'), 'no lock is left')
})

test('the dashboard server keeps answering while a write it was sent waits for a lock', async (t) => {
  const sb = setup(t)
  const { port, child: server, cookie, token } = await startServer(sb)
  t.after(() => server.kill())
  const ask = (method, url, body) => new Promise((res, rej) => {
    const t0 = Date.now()
    const headers = Object.assign({ Host: '127.0.0.1:' + port, Cookie: cookie }, body ? { Origin: 'http://127.0.0.1:' + port, 'Content-Type': 'application/json', 'X-Dashboard-Token': token } : {})
    const r = http.request({ host: '127.0.0.1', port, method, path: url, agent: false, headers }, (x) => {
      let d = ''
      x.on('data', (c) => { d += c })
      x.on('end', () => res({ status: x.statusCode, ms: Date.now() - t0, text: d }))
    })
    r.on('error', rej)
    if (body) r.write(JSON.stringify(body))
    r.end()
  })
  const file = path.join(sb.company, 'company.json')
  const c = holder(sb, 'holder', file, 'heldKey', 2500)
  const exit = ended(c)
  await heldBy(c)
  const write = ask('POST', '/api/budget', { scope: 'company', budget: { monthlyTokens: 777 } })
  await sleep(300)
  const read = await ask('GET', '/api/company')
  assert.equal(read.status, 200)
  assert.ok(read.ms < 1000, 'a read waited ' + read.ms + ' ms behind the locked write')
  const w = await write
  assert.equal(w.status, 200, w.text)
  assert.equal((await exit).code, 0)
  const co = sb.read('company/company.json')
  assert.ok(co.heldKey, 'the update of the holder is kept')
  assert.equal(co.budget.monthlyTokens, 777, 'the waiting write is saved after it')
})

test('a writer killed in the middle of finishing a job loses nothing: before its final record the job is still active, after it the job is finished', async (t) => {
  for (const at of ['record', 'unlink']) {
    const sb = setup(t)
    const L = sb.mod('runlog.cjs')
    const { id } = L.startRun({ agent: 'implementer', task: 'invented finish', doing: 'step one' }, L.actorFor('cli', 'supervisor'))
    const active = path.join(sb.runs, 'active', id + '.json')
    const marker = path.join(sb.base, 'stopped')
    const stop = '{ fs.writeFileSync(' + JSON.stringify(marker) + ", 'x'); Atomics.wait(new Int32Array(new SharedArrayBuffer(4)), 0, 0) }"
    const c = child(sb, 'finisher', [
      "const fs = require('fs'), path = require('path')",
      'const runs = ' + JSON.stringify(sb.runs),
      at === 'record'
        ? 'const real = fs.renameSync; fs.renameSync = (a, b) => { if (path.dirname(String(b)) === runs) ' + stop + ' return real(a, b) }'
        : 'const real = fs.unlinkSync; fs.unlinkSync = (p) => { if (String(p) === ' + JSON.stringify(active) + ') ' + stop + ' return real(p) }',
      "const L = require(tools + '/runlog.cjs')",
      'L.finishRun({ id: ' + JSON.stringify(id) + ", agent: 'implementer', task: 'invented finish', summary: 'done' }, L.actorFor('cli', 'supervisor'))",
    ].join('\n'))
    const exit = ended(c)
    for (let i = 0; i < 300 && !fs.existsSync(marker); i++) await sleep(20)
    assert.ok(fs.existsSync(marker), at + ': the finisher did not reach the stop')
    c.kill()
    await exit
    const B = sb.mod('build-agent-dashboard.cjs').collect()
    const finished = B.runs.find((r) => r.id === id), running = B.active.find((r) => r.id === id)
    assert.equal(B.runs.filter((r) => r.id === id).length + B.active.filter((r) => r.id === id).length, 1, at + ': the job is shown once')
    if (at === 'record') assert.equal(running && running.doing, 'step one', 'killed before its record: still active, with its step')
    else assert.deepEqual(finished && finished.steps.map((s) => s.text), ['step one'], 'killed after its record: finished, with its steps')
  }
})
