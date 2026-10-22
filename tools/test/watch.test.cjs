/* Stalled and dead runs (spec 1.1, 4.2; acceptance tests 8, 10, 11, 12, 13):
 * the detector, the cleaner, the alert state, the limits, and the dashboard
 * server closing a dead run when it starts. Phone and desktop sends are P3:
 * here the one alert is the one event written for them. Invented data. */
const test = require('node:test')
const assert = require('node:assert/strict')
const fs = require('fs')
const http = require('http')
const path = require('path')
const { spawnSync } = require('child_process')
const { makeSandbox, SEED, startServer } = require('./helpers.cjs')

const MIN = 60000
const box = (t, opts) => { const sb = makeSandbox(Object.assign({ flat: true }, opts)); t.after(() => sb.cleanup()); return sb }
const iso = (ms) => new Date(ms).toISOString()
const deadPid = () => spawnSync(process.execPath, ['-e', ''], { windowsHide: true }).pid

/** An active record as an agent left it: last step `quietMin` before `now`. */
function active(sb, id, now, quietMin, extra) {
  const rec = Object.assign({ id, agent: 'tester', task: 'invented suite', doing: 'step', steps: [{ at: iso(now - quietMin * MIN), text: 'step' }], startedAt: iso(now - (quietMin + 5) * MIN) }, extra || {})
  fs.writeFileSync(path.join(sb.runs, 'active', id + '.json'), JSON.stringify(rec, null, 2))
  return rec
}
// one fresh set of modules bound to the sandbox, sharing one require cache
const mods = (sb) => { const W = sb.mod('watch.cjs'); const req = (n) => require(path.join(sb.tools, n)); return { W, L: req('runlog.cjs'), N: req('notify.cjs') } }
const stalls = (r) => r.events.filter((e) => e.kind === 'stalled')
const finishedRecords = (sb) => fs.readdirSync(sb.runs).filter((n) => n.endsWith('.json')).map((n) => JSON.parse(fs.readFileSync(path.join(sb.runs, n), 'utf8')))

test('AT8 stall: 19 min no alert, 20 min exactly one, 21 min no second', (t) => {
  const sb = box(t)
  const t0 = Date.parse('2026-05-04T08:00:00Z')
  active(sb, 'run-a', t0 + 19 * MIN, 19)
  const W = sb.mod('watch.cjs')
  assert.equal(stalls(W.tick({ now: t0 + 19 * MIN })).length, 0)
  const at20 = W.tick({ now: t0 + 20 * MIN })
  assert.equal(stalls(at20).length, 1)
  assert.equal(at20.events[0].run, 'run-a')
  assert.equal(at20.events[0].quietMin, 20)
  assert.equal(stalls(W.tick({ now: t0 + 21 * MIN })).length, 0)
  const st = W.readState()
  assert.ok(st.runs['run-a'])
  assert.equal(st.events.filter((e) => e.kind === 'stalled').length, 1, 'one event for the senders')
  const row = W.live({ now: t0 + 21 * MIN }).runs.find((r) => r.id === 'run-a')
  assert.equal(row.state, 'stalled')
  assert.ok(row.alert && !row.alert.dismissed)
  // the soft hint at 10 min is a state, never an alert
  active(sb, 'run-q', t0 + 21 * MIN, 12)
  const r = W.tick({ now: t0 + 21 * MIN })
  assert.equal(stalls(r).length, 0)
  assert.equal(W.live({ now: t0 + 21 * MIN }).runs.find((x) => x.id === 'run-q').state, 'quiet')
})

test('AT10 recover: a step clears the alert and a later stall alerts again; repeat and dismiss', (t) => {
  const sb = box(t)
  const now = Date.now()
  active(sb, 'run-b', now, 25)
  const { W: W2, L: L2 } = mods(sb)
  assert.equal(stalls(W2.tick({ now })).length, 1)
  L2.progress({ id: 'run-b', doing: 'back at work' })
  W2.tick({ now: Date.now() })
  assert.ok(!W2.readState().runs['run-b'], 'recovered: the alert is gone')
  assert.equal(W2.live().alerts.length, 0)
  const later = Date.now() + 20 * MIN
  // the server ticks every 30 s; a jump past the stall limit would be a sleep (one grace tick)
  W2.tick({ now: later - 10 * MIN })
  assert.equal(stalls(W2.tick({ now: later })).length, 1, 'stalled again: alerted again')
  // repeated after repeatMinutes (60) while nobody dismissed it
  assert.equal(stalls(W2.tick({ now: later + 59 * MIN })).length, 0)
  const rep = stalls(W2.tick({ now: later + 60 * MIN }))
  assert.equal(rep.length, 1)
  assert.equal(rep[0].repeat, 2)
  // dismiss is the owner's only, and stops the repeats; the run itself stays
  assert.throws(() => W2.dismiss('run-b', L2.actorFor('mcp', 'agent', { name: 'tester' })), (e) => e.code === 403)
  assert.throws(() => W2.dismiss('run-b', L2.actorFor('cli', 'supervisor')), (e) => e.code === 403)
  W2.dismiss('run-b', L2.actorFor('dashboard', 'board'))
  assert.equal(stalls(W2.tick({ now: later + 200 * MIN })).length, 0)
  assert.equal(W2.live().alerts.length, 0)
  assert.ok(fs.existsSync(path.join(sb.runs, 'active', 'run-b.json')))
})

test('AT12 a live pid is never closed by time when its start time is recorded; without one the time rule applies', (t) => {
  const sb = box(t)
  const now = Date.now()
  const { W, L } = mods(sb)
  const real = L.pidStartMs(process.pid)
  // where the system can tell (Linux) the real start time; elsewhere it cannot be checked and is trusted
  active(sb, 'run-live', now, 300, { pid: process.pid, pidStartedAt: iso(Number.isFinite(real) ? real : now - 400 * MIN) })
  active(sb, 'run-live-old', now, 300, { pid: process.pid })
  const r = W.tick({ now })
  assert.ok(fs.existsSync(path.join(sb.runs, 'active', 'run-live.json')), 'kept')
  assert.ok(stalls(r).some((e) => e.run === 'run-live'), 'stalled and alerted')
  assert.ok(!fs.existsSync(path.join(sb.runs, 'active', 'run-live-old.json')), 'no recorded start time: closed after the dead limit')
  assert.equal(r.closed[0].reason, 'pid-unverified-quiet')
})

test('AT13 no pid: 100 min quiet is stalled and kept; 241 min is closed', (t) => {
  const sb = box(t)
  const now = Date.now()
  active(sb, 'run-old', now, 100)
  const W = sb.mod('watch.cjs')
  W.tick({ now })
  assert.ok(fs.existsSync(path.join(sb.runs, 'active', 'run-old.json')))
  assert.equal(W.live({ now }).runs[0].state, 'stalled')
  const r = W.tick({ now: now + 141 * MIN })
  assert.deepEqual(r.closed.map((c) => [c.run, c.reason]), [['run-old', 'no-pid-quiet']])
  assert.ok(!fs.existsSync(path.join(sb.runs, 'active', 'run-old.json')))
  const rec = finishedRecords(sb).find((x) => x.id === 'run-old')
  assert.equal(rec.status, 'stopped')
  assert.equal(rec.closedBy, 'arsenale')
  assert.equal(rec.steps.length, 1, 'the steps are kept')
  assert.ok(!W.readState().runs['run-old'])
})

test('a run waiting for the test suite is not quiet; a clock moved back reads as 0 min', (t) => {
  const sb = box(t)
  const now = Date.now()
  active(sb, 'run-w', now, 45)
  active(sb, 'run-f', now, -30)
  fs.mkdirSync(path.join(sb.root, 'test-queue', 'waiting'), { recursive: true })
  fs.writeFileSync(path.join(sb.root, 'test-queue', 'waiting', 'run-w.json'), JSON.stringify({ schemaVersion: 1, run: 'run-w', agent: 'tester', repo: sb.base, pid: process.pid, requestedAt: iso(now - 40 * MIN) }))
  const W = sb.mod('watch.cjs')
  assert.equal(stalls(W.tick({ now })).length, 0)
  const rows = W.live({ now }).runs
  assert.equal(rows.find((r) => r.id === 'run-w').state, 'working')
  assert.equal(rows.find((r) => r.id === 'run-w').inQueue, true)
  assert.equal(rows.find((r) => r.id === 'run-f').quietMin, 0)
})

test('after a sleep longer than the stall limit, the alert waits one tick', (t) => {
  const sb = box(t)
  const now = Date.now()
  const W = sb.mod('watch.cjs')
  W.tick({ now: now - 90 * MIN })
  active(sb, 'run-s', now, 30)
  assert.equal(stalls(W.tick({ now })).length, 0, 'the grace tick')
  assert.equal(stalls(W.tick({ now: now + 30000 })).length, 1)
})

test('limits: whole minutes in range, board only, kept when the channels are saved', (t) => {
  const sb = box(t)
  const { W, L, N } = mods(sb)
  assert.deepEqual(W.limits(), { stallMinutes: 20, deadMinutes: 240, repeatMinutes: 60 })
  const board = L.actorFor('dashboard', 'board')
  for (const bad of [{ stallMinutes: 4 }, { stallMinutes: 241 }, { stallMinutes: 7.5 }, { deadMinutes: 29 }, { repeatMinutes: -1 }]) {
    assert.throws(() => W.setLimits(bad, board), (e) => e.code === 400 && e.message.startsWith(Object.keys(bad)[0]), JSON.stringify(bad))
  }
  assert.throws(() => W.setLimits({ stallMinutes: 30 }, L.actorFor('cli', 'supervisor')), (e) => e.code === 403)
  assert.equal(W.setLimits({ stallMinutes: 30, deadMinutes: '600' }, board).stallMinutes, 30)
  // an old config.json without the keys reads with defaults; a channel save keeps the new keys
  N.saveConfig(N.readConfig())
  const raw = sb.read('notify/config.json')
  assert.equal(raw.stallMinutes, 30)
  assert.equal(raw.deadMinutes, 600)
  assert.equal(W.limits().stallMinutes, 30)
  fs.writeFileSync(path.join(sb.root, 'notify', 'config.json'), JSON.stringify({ schemaVersion: 1, stallMinutes: 'x', expiryMin: 30 }))
  assert.equal(W.limits().stallMinutes, 20)
})

test('AT11 dead run closed when the server starts: stopped, closed by Arsenale, in Activity, not in Live', async (t) => {
  const sb = box(t)
  assert.equal(sb.cli('--company-init', '--seed', sb.seed(SEED)).code, 0)
  const now = Date.now()
  active(sb, 'run-dead', now, 4919, { pid: deadPid(), worktree: path.join(sb.base, 'wt'), brief: 'invented brief' })
  const { port, child, cookie } = await startServer(sb)
  t.after(() => child.kill())
  const get = (url) => new Promise((resolve, reject) => {
    http.get({ host: '127.0.0.1', port, path: url, agent: false, headers: { Host: '127.0.0.1:' + port, Cookie: cookie } }, (res) => {
      let b = ''
      res.on('data', (d) => { b += d })
      res.on('end', () => resolve({ status: res.statusCode, json: JSON.parse(b) }))
    }).on('error', reject)
  })
  assert.ok(!fs.existsSync(path.join(sb.runs, 'active', 'run-dead.json')), 'closed once, at start')
  const rec = finishedRecords(sb).find((x) => x.id === 'run-dead')
  assert.equal(rec.status, 'stopped')
  assert.equal(rec.summary, 'The process ended; closed by Arsenale')
  assert.equal(rec.closedBy, 'arsenale')
  assert.equal(rec.brief, 'invented brief', 'kept for a resume')
  assert.equal(rec.steps.length, 1)
  assert.ok(sb.lines('company/activity.jsonl').some((l) => l.action === 'run.closed' && l.entityId === 'run-dead' && /closed a dead run/.test(l.summary)))
  const live = await get('/api/live')
  assert.equal(live.status, 200)
  assert.ok(!live.json.runs.some((r) => r.id === 'run-dead'))
  const st = await get('/api/state')
  assert.ok(st.json.runs.some((r) => r.id === 'run-dead' && r.status === 'stopped'), 'listed with the finished runs')
  assert.ok(!st.json.active.some((r) => r.id === 'run-dead'))
})

test('the office and Team pages get the monitor verdict api/live shows: same state per run, the queue pauses the timer, no own guess', (t) => {
  const sb = box(t)
  const now = Date.now()
  active(sb, 'run-ok', now, 2)
  active(sb, 'run-q', now, 12)
  active(sb, 'run-s', now, 25)
  active(sb, 'run-d', now, 300)
  active(sb, 'run-w', now, 45)
  fs.mkdirSync(path.join(sb.root, 'test-queue', 'waiting'), { recursive: true })
  fs.writeFileSync(path.join(sb.root, 'test-queue', 'waiting', 'run-w.json'), JSON.stringify({ schemaVersion: 1, run: 'run-w', agent: 'tester', repo: sb.base, pid: process.pid, requestedAt: iso(now - 40 * MIN) }))
  const W = sb.mod('watch.cjs')
  const B = require(path.join(sb.tools, 'build-agent-dashboard.cjs'))
  const state = B.collect()
  const byId = Object.fromEntries(state.active.map((a) => [a.id, a.monitor]))
  const live = Object.fromEntries(W.live({ state }).runs.map((r) => [r.id, r]))
  assert.deepEqual(Object.fromEntries(Object.entries(byId).map(([id, m]) => [id, m.state])), { 'run-ok': 'working', 'run-q': 'quiet', 'run-s': 'stalled', 'run-d': 'dead', 'run-w': 'working' })
  for (const [id, m] of Object.entries(byId)) assert.deepEqual([m.state, m.inQueue], [live[id].state, live[id].inQueue], id)
  assert.equal(byId['run-w'].inQueue, true)
  assert.equal(byId['run-w'].quietMin, 0, 'the timer of a run in the test queue is paused')
  // the stand-ins are gone: no pid test on the page side
  assert.ok(state.active.every((a) => !('pidGone' in a)))
  const page = fs.readFileSync(path.join(sb.tools, 'pages', 'office', 'client', 'part1.js'), 'utf8')
  assert.doesNotMatch(page, /pidGone|DEAD_MIN|STALL_MIN/)
})
