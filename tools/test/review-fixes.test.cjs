/* The security review of spec 1.1 P2 (2026-10-20), findings 1 to 8: each test
 * fails on the code before the fix. Invented data, temporary folders only. */
const test = require('node:test')
const assert = require('node:assert/strict')
const fs = require('fs')
const path = require('path')
const { spawnSync } = require('child_process')
const { makeSandbox } = require('./helpers.cjs')

const MIN = 60000
const box = (t) => { const sb = makeSandbox({ flat: true }); t.after(() => sb.cleanup()); return sb }
const iso = (ms) => new Date(ms).toISOString()
const deadPid = () => spawnSync(process.execPath, ['-e', ''], { windowsHide: true }).pid
const alive = (pid) => { try { process.kill(pid, 0); return true } catch (e) { return e.code === 'EPERM' } }
const gitOk = spawnSync('git', ['--version'], { windowsHide: true }).status === 0
const mods = (sb) => { const L = sb.mod('runlog.cjs'); const req = (n) => require(path.join(sb.tools, n)); return { L, B: req('build-agent-dashboard.cjs'), N: req('notify.cjs'), W: req('watch.cjs'), R: req('resume.cjs'), S: req('store.cjs'), Pg: req('progress.cjs') } }

/** A waiting approval for a merge, asked by the supervisor. */
function mergeGate(B, extra) {
  return B.saveGate(Object.assign({ project: 'demo-calc', question: 'Merge the invented phase?', kind: 'approval', approvalType: 'gate', versionRun: 'app-x-1.2', action: { type: 'merge', ref: 'auto/1.2/P1', versionRun: 'app-x-1.2', gatesPassed: true } }, extra || {}), 'log')
}
function active(sb, id, now, quietMin, extra) {
  const rec = Object.assign({ id, agent: 'tester', task: 'invented suite', doing: 'step', steps: [{ at: iso(now - quietMin * MIN), text: 'step' }], startedAt: iso(now - (quietMin + 5) * MIN) }, extra || {})
  fs.writeFileSync(path.join(sb.runs, 'active', id + '.json'), JSON.stringify(rec, null, 2))
  return rec
}

test('finding 1: the question hash covers the action and the last write', (t) => {
  const sb = box(t)
  const { B, N } = mods(sb)
  const g = mergeGate(B)
  const h = N.questionHash(g)
  for (const k of ['type', 'ref', 'versionRun']) assert.notEqual(N.questionHash(Object.assign({}, g, { action: Object.assign({}, g.action, { [k]: 'other-' + k }) })), h, k)
  assert.notEqual(N.questionHash(Object.assign({}, g, { action: Object.assign({}, g.action, { gatesPassed: false }) })), h, 'gatesPassed')
  assert.notEqual(N.questionHash(Object.assign({}, g, { updatedAt: '2030-01-01T00:00:00.000Z' })), h, 'updatedAt')
  // the state the pages read carries it, so a page can send back what it showed
  assert.equal(B.collect().gates.find((x) => x.id === g.id).qhash, h)
})

test('finding 1: the action of a waiting gate cannot be changed', (t) => {
  const sb = box(t)
  const { B } = mods(sb)
  const g = mergeGate(B)
  assert.throws(() => B.saveGate({ id: g.id, action: { type: 'merge', ref: 'auto/1.2/P9', versionRun: 'app-x-1.2', gatesPassed: true } }, 'log'), (e) => e.code === 409)
  assert.throws(() => B.saveGate({ id: g.id, action: { type: 'next-phase', ref: 'auto/1.2/P1', versionRun: 'app-x-1.2', gatesPassed: true } }, 'log'), (e) => e.code === 409)
  assert.equal(sb.read('agent-runs/gates/' + g.id + '.json').action.ref, 'auto/1.2/P1')
  // the same action again, or another field, is still an update
  B.saveGate({ id: g.id, label: 'Merge P1', action: g.action }, 'log')
  assert.equal(sb.read('agent-runs/gates/' + g.id + '.json').label, 'Merge P1')
  // a waiting question with no action cannot be given one either
  const plain = B.saveGate({ project: 'demo-calc', question: 'Old style approval?', kind: 'approval' }, 'log')
  assert.throws(() => B.saveGate({ id: plain.id, action: { type: 'merge', ref: 'main' } }, 'log'), (e) => e.code === 409)
})

test('finding 1: an Approve of a merge or next phase needs the hash; under the gate lock', (t) => {
  const sb = box(t)
  const { L, B, N, S } = mods(sb)
  const board = L.actorFor('dashboard', 'board')
  const g = mergeGate(B)
  assert.throws(() => L.answer(g.id, 'approve', board), (e) => e.code === 409)
  const np = mergeGate(B, { action: { type: 'next-phase', ref: 'P2', versionRun: 'app-x-1.2', gatesPassed: true } })
  assert.throws(() => L.answer(np.id, 'yes', board), (e) => e.code === 409)
  assert.equal(sb.read('agent-runs/gates/' + g.id + '.json').status, 'waiting')
  // a decline, or a build approval, needs none (a build never runs by itself)
  assert.equal(L.answer(np.id, 'decline', board).status, 'answered')
  const build = mergeGate(B, { action: { type: 'build', ref: 'v1.2.0' } })
  assert.equal(L.answer(build.id, 'approve', board).status, 'answered')
  // with the hash of what was shown it goes through
  assert.equal(L.answer(g.id, 'approve', board, { hash: N.questionHash(sb.read('agent-runs/gates/' + g.id + '.json')) }).status, 'answered')
  // a gate whose lock another live process holds is not answered meanwhile
  const held = mergeGate(B)
  const lock = path.join(sb.runs, 'gates', held.id + '.json.lock')
  fs.mkdirSync(path.join(lock, process.pid + '-0123456789ab'), { recursive: true })
  // these modules are this test's own (sb.mod), so the short wait ends with it
  S.configure({ syncWaitMs: 200 })
  try {
    assert.throws(() => L.answer(held.id, 'approve', board, { hash: N.questionHash(held) }), (e) => e.code === 503)
    assert.equal(sb.read('agent-runs/gates/' + held.id + '.json').status, 'waiting')
  } finally { fs.rmSync(lock, { recursive: true, force: true }) }
})

test('finding 2: an agent cannot ask a typed approval or say its gates passed', (t) => {
  const sb = box(t)
  const { L } = mods(sb)
  const agent = L.actorFor('mcp', 'agent', { name: 'tester' })
  const ask = (action) => ({ project: 'demo-calc', question: 'Merge my own work?', kind: 'approval', action })
  assert.throws(() => L.gate(ask({ type: 'merge', ref: 'auto/1.2/P1', gatesPassed: true }), agent), (e) => e.code === 403)
  assert.throws(() => L.gate(ask({ gatesPassed: true }), L.actorFor('cli', 'agent')), (e) => e.code === 403)
  const cli = sb.cli('--gate', JSON.stringify(Object.assign(ask({ type: 'merge', ref: 'auto/1.2/P1', gatesPassed: true }), { by: 'agent:tester' })))
  assert.notEqual(cli.code, 0, 'refused from an agent at the command line')
  assert.equal(fs.readdirSync(path.join(sb.runs, 'gates')).filter((n) => n.endsWith('.json')).length, 0)
  // the supervisor still asks them
  assert.ok(L.gate(ask({ type: 'merge', ref: 'auto/1.2/P1', gatesPassed: true }), L.actorFor('cli', 'supervisor')).id)
  // an agent's plain action approval (check_action) is unchanged
  assert.ok(L.gate(ask({ category: 'email', summary: 'send a note' }), agent).id)
})

test('finding 3: the brief never leaves the server', (t) => {
  const sb = box(t)
  const { L, B } = mods(sb)
  const SECRET = 'invented brief text 7Q2X'
  const sup = L.actorFor('cli', 'supervisor')
  const { id } = L.startRun({ agent: 'implementer', task: 'invented job', brief: SECRET, worktree: path.join(sb.base, 'wt') }, sup)
  const ended = L.startRun({ agent: 'implementer', task: 'ended job', brief: SECRET }, sup)
  L.finishRun({ id: ended.id, agent: 'implementer', task: 'ended job' }, sup)
  active(sb, 'run-closed', Date.now(), 300, { brief: SECRET })
  L.closeDead('run-closed')
  assert.equal(L.readActive(id).brief, SECRET, 'kept in the run file for a resume')
  const state = B.collect()
  assert.ok(!JSON.stringify(state).includes(SECRET), 'not in /api/state')
  assert.ok(state.active.every((r) => !('brief' in r)) && state.runs.every((r) => !('brief' in r)))
  B.build()
  for (const f of [B.OUT, B.OUT_ARCHIVE]) assert.ok(!fs.readFileSync(f, 'utf8').includes(SECRET), path.basename(f))
  // a finished record keeps a brief only where a resume reads it: a closed run with a worktree
  const recs = fs.readdirSync(sb.runs).filter((n) => n.endsWith('.json')).map((n) => JSON.parse(fs.readFileSync(path.join(sb.runs, n), 'utf8')))
  assert.ok(recs.every((r) => !('brief' in r)), 'no worktree, nothing to resume: no brief copied')
})

test('finding 4: a gone pid closes a run only on 2 ticks and when quiet or verified', (t) => {
  const sb = box(t)
  const { W, Pg } = mods(sb)
  const now = Date.now()
  const r = { id: 'x', pid: 999999, steps: [{ at: iso(now - 5 * MIN) }], startedAt: iso(now - 6 * MIN) }
  const opts = (n) => ({ pidAlive: () => false, goneTicks: n })
  assert.notEqual(Pg.classify(r, now, opts(1)).state, 'dead', 'seen gone once')
  assert.notEqual(Pg.classify(r, now, opts(2)).state, 'dead', 'twice, but working 5 min ago and no system start time')
  assert.equal(Pg.classify(Object.assign({}, r, { pidStartedAt: iso(now - 6 * MIN) }), now, opts(2)).state, 'dead')
  const quiet = Object.assign({}, r, { steps: [{ at: iso(now - 25 * MIN) }], startedAt: iso(now - 26 * MIN) })
  assert.notEqual(Pg.classify(quiet, now, opts(1)).state, 'dead')
  assert.equal(Pg.classify(quiet, now, opts(2)).reason, 'pid-gone')
  // the loop: a working run whose recorded pid is gone stays; a quiet one goes on the 2nd tick
  active(sb, 'run-working', now, 2, { pid: deadPid() })
  active(sb, 'run-quiet', now, 25, { pid: deadPid() })
  const file = (id) => path.join(sb.runs, 'active', id + '.json')
  W.tick({ now })
  assert.ok(fs.existsSync(file('run-quiet')), 'one tick is not enough')
  W.tick({ now: now + 30000 })
  assert.ok(!fs.existsSync(file('run-quiet')), 'closed on the second tick')
  assert.ok(fs.existsSync(file('run-working')), 'a working run is never closed for a pid alone')
})

test('finding 4: pidStartedAt comes from the system, never from the input', (t) => {
  const sb = box(t)
  const { L } = mods(sb)
  const given = '2026-01-02T10:00:00.000Z'
  const { id } = L.startRun({ agent: 'implementer', task: 'invented', pid: process.pid, pidStartedAt: given }, L.actorFor('cli', 'supervisor'))
  const rec = L.readActive(id)
  assert.notEqual(rec.pidStartedAt, given)
  const real = L.pidStartMs(process.pid)
  assert.equal(rec.pidStartedAt, Number.isFinite(real) ? iso(real) : undefined)
})

test('finding 5: testq keeps the suite until the command ended, and stops its whole tree', (t) => {
  const sb = box(t)
  const suite = path.join(sb.base, 'suite.js')
  const pidFile = path.join(sb.base, 'suite.pid')
  fs.writeFileSync(suite, "require('fs').writeFileSync(process.argv[2], String(process.pid)); setInterval(() => {}, 1000)\n")
  // the Ctrl-C handler is the testq process's own: a small driver runs it in its own process
  const driver = path.join(sb.base, 'driver.js')
  fs.writeFileSync(driver, `const fs = require('fs')
const Q = require(${JSON.stringify(path.join(sb.tools, 'testq.cjs'))})
const done = Q.run({ run: 'run-T', command: [process.execPath, ${JSON.stringify(suite)}, ${JSON.stringify(pidFile)}], say: () => {} })
const wait = setInterval(() => {
  if (!fs.existsSync(${JSON.stringify(pidFile)})) return
  clearInterval(wait)
  process.emit('SIGINT')
  const held = fs.existsSync(Q.LOCK)
  done.then((code) => { console.log(JSON.stringify({ held, code, after: fs.existsSync(Q.LOCK) })); process.exit(0) })
}, 50)
`)
  let suitePid = 0
  try {
    const r = spawnSync(process.execPath, [driver], { env: sb.env, cwd: sb.base, encoding: 'utf8', windowsHide: true, timeout: 60000 })
    suitePid = Number(fs.readFileSync(pidFile, 'utf8'))
    const out = JSON.parse(r.stdout.trim().split('\n').pop())
    assert.equal(out.held, true, 'the lock is still held right after Ctrl-C')
    assert.equal(out.code, 130)
    assert.equal(out.after, false, 'given back once the command ended')
    assert.equal(alive(suitePid), false, 'the suite itself was stopped')
  } finally { if (suitePid && alive(suitePid)) { try { process.kill(suitePid) } catch { /* gone */ } } }
})

test('finding 6: limits and the resume list refuse a newer file and keep keys they do not know', (t) => {
  const sb = box(t)
  const { L, W, R } = mods(sb)
  const board = L.actorFor('dashboard', 'board')
  const cfg = path.join(sb.root, 'notify', 'config.json')
  fs.mkdirSync(path.dirname(cfg), { recursive: true })
  fs.writeFileSync(cfg, JSON.stringify({ schemaVersion: 1, futureKey: { a: 1 }, ntfy: { enabled: false, futureChannelKey: 'k' } }))
  W.setLimits({ stallMinutes: 30 }, board)
  const saved = sb.read('notify/config.json')
  assert.deepEqual(saved.futureKey, { a: 1 })
  assert.equal(saved.ntfy.futureChannelKey, 'k')
  assert.equal(saved.stallMinutes, 30)
  const newer = JSON.stringify({ schemaVersion: 2, stallMinutes: 50 })
  fs.writeFileSync(cfg, newer)
  assert.throws(() => W.setLimits({ stallMinutes: 30 }, board), (e) => e.code === 409)
  assert.equal(fs.readFileSync(cfg, 'utf8'), newer)
  // the resume list
  const cand = path.join(sb.root, 'resume', 'candidates.json')
  fs.mkdirSync(path.dirname(cand), { recursive: true })
  fs.writeFileSync(cand, JSON.stringify({ schemaVersion: 1, futureKey: 'kept', candidates: [] }))
  R.scan({})
  assert.equal(sb.read('resume/candidates.json').futureKey, 'kept')
  const newerList = JSON.stringify({ schemaVersion: 2, candidates: [] })
  fs.writeFileSync(cand, newerList)
  assert.throws(() => R.scan({}), (e) => e.code === 409)
  assert.equal(fs.readFileSync(cand, 'utf8'), newerList)
  // the resume state keeps its unknown keys on a Dismiss
  fs.writeFileSync(cand, JSON.stringify({ schemaVersion: 1, candidates: [{ run: 'run-x', agent: 'tester', task: 'invented', worktree: sb.base }] }))
  fs.writeFileSync(path.join(sb.root, 'resume', 'state.json'), JSON.stringify({ schemaVersion: 1, sent: {}, dismissed: {}, futureKey: 7 }))
  R.dismiss('run-x', board)
  assert.equal(sb.read('resume/state.json').futureKey, 7)
  assert.ok(sb.read('resume/state.json').dismissed['run-x'])
})

test('finding 7: resume-scan runs git without the worktree\'s fsmonitor command', { skip: !gitOk && 'git is not installed' }, (t) => {
  const sb = box(t)
  const { R } = mods(sb)
  const wt = path.join(sb.base, 'wt')
  fs.mkdirSync(wt)
  const git = (...a) => spawnSync('git', ['-C', wt, '-c', 'user.name=Invented', '-c', 'user.email=invented@example.test', '-c', 'commit.gpgsign=false', ...a], { encoding: 'utf8', windowsHide: true })
  git('init', '-q')
  git('commit', '-q', '--allow-empty', '-m', 'invented start')
  const marker = path.join(sb.base, 'fsmonitor-ran.txt').replace(/\\/g, '/')
  // a repo's own config naming a program for git to run on status
  git('config', 'core.fsmonitor', 'echo ran >> "' + marker + '"')
  const st = R.gitState(wt)
  assert.ok(st, 'git answered')
  assert.equal(fs.existsSync(marker), false, 'the configured command did not run')
})

test('finding 8: run ids that name Object.prototype keys are refused', (t) => {
  const sb = box(t)
  const { L, W, R } = mods(sb)
  const board = L.actorFor('dashboard', 'board')
  for (const id of ['__proto__', 'constructor', 'prototype']) {
    assert.throws(() => W.dismiss(id, board), (e) => e.code === 400, 'alerts ' + id)
    assert.throws(() => R.dismiss(id, board), (e) => e.code === 400, 'resume ' + id)
  }
  // a stalled run with such an id never reaches the alert map
  const now = Date.now()
  active(sb, 'constructor', now, 25)
  W.tick({ now })
  W.tick({ now: now + 30000 })
  const st = sb.read('alerts/state.json')
  assert.ok(!Object.hasOwn(st.runs, 'constructor'))
  assert.equal(st.events.filter((e) => e.run === 'constructor').length, 0)
  assert.equal(Object.getPrototypeOf(W.readState().runs), null)
})
