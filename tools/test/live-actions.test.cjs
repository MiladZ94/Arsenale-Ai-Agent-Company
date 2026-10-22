/* What the owner can do from the Live and Decisions pages (spec 1.1, 14.2 and
 * 14.7): Nudge, Stop and Clean on a run, and Undo on an approval that ran by
 * itself. All of it is board-only at the write path. Invented data. */
const test = require('node:test')
const assert = require('node:assert/strict')
const fs = require('fs')
const path = require('path')
const { makeSandbox, SEED } = require('./helpers.cjs')

const MIN = 60000
const box = (t) => { const sb = makeSandbox({ flat: true }); t.after(() => sb.cleanup()); return sb }
const iso = (ms) => new Date(ms).toISOString()
const active = (sb, id, extra) => fs.writeFileSync(path.join(sb.runs, 'active', id + '.json'), JSON.stringify(Object.assign({ id, agent: 'implementer', task: 'invented widget', doing: '', steps: [], startedAt: iso(Date.now() - 30 * MIN) }, extra)))
/** A finished record as Arsenale writes it for a dead run it closed. */
const closed = (sb, id, ago) => fs.writeFileSync(path.join(sb.runs, id + '.json'), JSON.stringify({ id, agent: 'implementer', task: 'old widget', status: 'stopped', closedBy: 'arsenale', summary: 'The process ended; closed by Arsenale', steps: [{ at: iso(Date.now() - (ago + 120) * MIN), text: 'editing' }], startedAt: iso(Date.now() - (ago + 130) * MIN), finishedAt: iso(Date.now() - ago * MIN) }))

test('Nudge and Stop: board only, an inbox line for the supervisor, nothing started or stopped here', (t) => {
  const sb = box(t)
  assert.equal(sb.cli('--company-init', '--seed', sb.seed(SEED)).code, 0)
  active(sb, 'run-a', { branch: 'auto/1.0/P1/R1' })
  const L = sb.mod('runlog.cjs')
  const A = sb.mod('liveactions.cjs')
  for (const who of [L.actorFor('mcp', 'agent', { name: 'implementer' }), L.actorFor('cli', 'supervisor')]) {
    assert.throws(() => A.act({ op: 'nudge', run: 'run-a' }, who, { runs: [] }), (e) => e.code === 403 && e.message === L.OWNER_ONLY)
    assert.throws(() => A.act({ op: 'stop', run: 'run-a' }, who, { runs: [] }), (e) => e.code === 403)
  }
  assert.equal(sb.lines('company/inbox.jsonl').filter((l) => l.type === 'nudge' || l.type === 'stop').length, 0)
  const board = L.actorFor('dashboard', 'board')
  A.act({ op: 'nudge', run: 'run-a' }, board, { runs: [] })
  A.act({ op: 'stop', run: 'run-a' }, board, { runs: [] })
  const items = sb.lines('company/inbox.jsonl').filter((l) => l.type === 'nudge' || l.type === 'stop')
  assert.deepEqual(items.map((i) => [i.type, i.run, i.branch]), [['nudge', 'run-a', 'auto/1.0/P1/R1'], ['stop', 'run-a', 'auto/1.0/P1/R1']])
  assert.ok(fs.existsSync(path.join(sb.runs, 'active', 'run-a.json')), 'the run itself is untouched')
  assert.throws(() => A.act({ op: 'nudge', run: 'run-zzz' }, board, { runs: [] }), (e) => e.code === 404)
  assert.throws(() => A.act({ op: 'explode', run: 'run-a' }, board, { runs: [] }), (e) => e.code === 400)
})

test('Clean: board only, hides a closed dead run from the list and keeps its record; Clean all hides every one shown', (t) => {
  const sb = box(t)
  closed(sb, 'dead-1', 60)
  closed(sb, 'dead-2', 90)
  const L = sb.mod('runlog.cjs')
  const A = sb.mod('liveactions.cjs')
  const B = sb.mod('build-agent-dashboard.cjs')
  const state = () => { B.invalidate(); return B.collect() }
  assert.deepEqual(A.view(state()).dead.map((d) => [d.id, d.quietMin]).sort(), [['dead-1', 120], ['dead-2', 120]])
  assert.throws(() => A.clean('dead-1', L.actorFor('cli', 'supervisor'), state()), (e) => e.code === 403)
  const board = L.actorFor('dashboard', 'board')
  A.clean('dead-1', board, state())
  assert.deepEqual(A.view(state()).dead.map((d) => d.id), ['dead-2'])
  assert.ok(fs.existsSync(path.join(sb.runs, 'dead-1.json')), 'its record stays')
  assert.throws(() => A.clean('nope', board, state()), (e) => e.code === 404)
  A.clean('all', board, state())
  assert.deepEqual(A.view(state()).dead, [])
  // a file from a newer Arsenale is read-only
  fs.writeFileSync(A.FILE, JSON.stringify({ schemaVersion: 2, cleaned: {} }))
  assert.throws(() => A.clean('dead-2', board, state()), (e) => e.code === 409)
  assert.equal(A.view(state()).readOnly, true)
})

/** An approval of a given action type, asked through the CLI. */
function approval(sb, type) {
  const r = sb.cli('--gate', JSON.stringify({ project: 'demo-calc', question: 'Approve ' + type + ' of the invented phase?', kind: 'approval', approvalType: 'gate', versionRun: 'app-x-1.2', action: { type, ref: 'feature/x', versionRun: 'app-x-1.2', gatesPassed: true } }))
  assert.equal(r.code, 0, r.err)
  return r.out
}

test('Undo: only for what ran by itself, once, inside 10 minutes, board only; the supervisor sees it', (t) => {
  const sb = box(t)
  assert.equal(sb.cli('--company-init', '--seed', sb.seed(SEED)).code, 0)
  sb.cli('--version-run', JSON.stringify({ id: 'app-x-1.2', budget: 1000000 }))
  const L = sb.mod('runlog.cjs')
  const board = L.actorFor('dashboard', 'board')
  const Au = sb.mod('automation.cjs')
  const U = sb.mod('autolog.cjs')
  Au.set({ autoRun: true }, board)
  const merged = approval(sb, 'merge')
  const built = approval(sb, 'build')
  // as the page does: with the hash of the question it showed (a merge Approve needs it)
  const N = sb.mod('notify.cjs')
  const shown = (id) => ({ hash: N.questionHash(sb.read('agent-runs/gates/' + id + '.json')) })
  L.answer(merged, 'approve', board, shown(merged))
  L.answer(built, 'approve', board, shown(built))
  const log = U.log()
  assert.deepEqual(log.items.map((i) => [i.gate, i.type, i.canUndo]), [[merged, 'merge', true]], 'a build never ran by itself, so it is not in the list')
  assert.throws(() => U.undo(built, board), (e) => e.code === 404)
  for (const who of [L.actorFor('mcp', 'agent', { name: 'tester' }), L.actorFor('cli', 'supervisor')]) assert.throws(() => U.undo(merged, who), (e) => e.code === 403 && e.message === L.OWNER_ONLY)
  U.undo(merged, board)
  const last = sb.lines('agent-runs/answers.jsonl').slice(-1)[0]
  assert.deepEqual([last.type, last.gate, last.action.type], ['undo', merged, 'merge'])
  assert.ok(sb.lines('company/inbox.jsonl').some((l) => l.type === 'undo' && l.gate === merged))
  assert.ok(sb.lines('company/activity.jsonl').some((l) => l.action === 'automation.undo'))
  assert.ok(U.log().items[0].undoneAt && !U.log().items[0].canUndo)
  assert.throws(() => U.undo(merged, board), (e) => e.code === 409)
  // the supervisor's `arsenale answers` shows it in words
  assert.match(sb.cli('--answers', '--all').out, /UNDO/)
  // after 10 minutes it cannot be undone
  const g2 = approval(sb, 'merge')
  L.answer(g2, 'approve', board, shown(g2))
  const f = path.join(sb.runs, 'answers.jsonl')
  const lines = fs.readFileSync(f, 'utf8').trim().split('\n').map((l) => JSON.parse(l))
  lines[lines.length - 1].at = iso(Date.now() - 11 * MIN)
  fs.writeFileSync(f, lines.map((l) => JSON.stringify(l)).join('\n') + '\n')
  assert.equal(U.log().items.find((i) => i.gate === g2).canUndo, false)
  assert.throws(() => U.undo(g2, board), (e) => e.code === 409)
})

test('the routes: reads answer, writes need the owner\'s key and refuse what does not exist', async (t) => {
  const http = require('http')
  const { startServer } = require('./helpers.cjs')
  const sb = box(t)
  assert.equal(sb.cli('--company-init', '--seed', sb.seed(SEED)).code, 0)
  closed(sb, 'dead-1', 60)
  const { port, child, cookie, token } = await startServer(sb)
  t.after(() => child.kill())
  const req = (method, url, body) => new Promise((resolve, reject) => {
    const r = http.request({ host: '127.0.0.1', port, method, path: url, agent: false, headers: Object.assign({ Host: '127.0.0.1:' + port, Cookie: cookie }, method === 'POST' ? { Origin: 'http://127.0.0.1:' + port, 'Content-Type': 'application/json', 'X-Dashboard-Token': token } : {}) }, (res) => {
      let b = ''
      res.on('data', (d) => { b += d })
      res.on('end', () => resolve({ status: res.statusCode, json: JSON.parse(b || 'null') }))
    })
    r.on('error', reject)
    if (body) r.write(JSON.stringify(body))
    r.end()
  })
  assert.deepEqual((await req('GET', '/api/run-actions')).json.dead.map((d) => d.id), ['dead-1'])
  assert.deepEqual((await req('GET', '/api/auto-log')).json.items, [])
  assert.equal((await req('POST', '/api/run-action', { op: 'nudge', run: 'nope' })).status, 404)
  assert.equal((await req('POST', '/api/undo', { gate: 'nope' })).status, 404)
  assert.equal((await req('POST', '/api/run-action', { op: 'clean', run: 'dead-1' })).status, 200)
  assert.deepEqual((await req('GET', '/api/run-actions')).json.dead, [])
})

test('the write routes take the same Origin, Sec-Fetch and token checks as every POST, and write nothing when refused', async (t) => {
  const http = require('http')
  const { startServer } = require('./helpers.cjs')
  const sb = box(t)
  assert.equal(sb.cli('--company-init', '--seed', sb.seed(SEED)).code, 0)
  closed(sb, 'dead-1', 60)
  active(sb, 'run-a')
  const { port, child, cookie, token } = await startServer(sb)
  t.after(() => child.kill())
  const req = (url, body, headers) => new Promise((resolve, reject) => {
    const r = http.request({ host: '127.0.0.1', port, method: 'POST', path: url, agent: false, headers: Object.assign({ Host: '127.0.0.1:' + port, Cookie: cookie, Origin: 'http://127.0.0.1:' + port, 'Content-Type': 'application/json', 'X-Dashboard-Token': token }, headers) }, (res) => {
      let b = ''
      res.on('data', (d) => { b += d })
      res.on('end', () => resolve({ status: res.statusCode, json: JSON.parse(b || 'null') }))
    })
    r.on('error', reject)
    r.write(JSON.stringify(body))
    r.end()
  })
  const bodies = { '/api/run-action': { op: 'clean', run: 'dead-1' }, '/api/undo': { gate: 'g-none' } }
  const bad = [{ Origin: 'http://evil.example' }, { 'Sec-Fetch-Site': 'cross-site' }, { 'X-Dashboard-Token': 'wrong' }]
  for (const [url, body] of Object.entries(bodies)) {
    for (const h of bad) {
      const r = await req(url, body, h)
      assert.equal(r.status, 403, url + ' ' + JSON.stringify(h))
    }
    // a GET-only reader is not a write door
    assert.equal((await req(url.replace('run-action', 'run-actions').replace('/api/undo', '/api/auto-log'), {})).status, 405)
  }
  for (const op of ['nudge', 'stop']) for (const h of bad) assert.equal((await req('/api/run-action', { op, run: 'run-a' }, h)).status, 403)
  assert.equal(fs.existsSync(path.join(sb.root, 'alerts', 'actions.json')), false, 'no Clean was written')
  assert.equal(sb.lines('company/inbox.jsonl').filter((l) => l.type === 'nudge' || l.type === 'stop').length, 0, 'no inbox line was written')
})

test('Stop never ends a process: the run and its process are left as they were', async (t) => {
  const { spawn } = require('child_process')
  const sb = box(t)
  assert.equal(sb.cli('--company-init', '--seed', sb.seed(SEED)).code, 0)
  // a process of this test's own, standing in for an agent
  const kid = spawn(process.execPath, ['-e', 'setTimeout(() => {}, 60000)'], { stdio: 'ignore' })
  t.after(() => { try { process.kill(kid.pid) } catch { /* already gone */ } })
  active(sb, 'run-p', { pid: kid.pid })
  const L = sb.mod('runlog.cjs')
  const A = sb.mod('liveactions.cjs')
  A.act({ op: 'stop', run: 'run-p' }, L.actorFor('dashboard', 'board'), { runs: [] })
  await new Promise((r) => setTimeout(r, 300))
  assert.equal(L.pidAlive(kid.pid), true, 'the process still runs')
  assert.ok(fs.existsSync(path.join(sb.runs, 'active', 'run-p.json')), 'the run is still active')
})

test('keys that name Object.prototype are refused, and a cleaned list cannot hide a run through them', (t) => {
  const sb = box(t)
  closed(sb, 'dead-1', 60)
  const L = sb.mod('runlog.cjs')
  const A = sb.mod('liveactions.cjs')
  const U = sb.mod('autolog.cjs')
  const B = sb.mod('build-agent-dashboard.cjs')
  const board = L.actorFor('dashboard', 'board')
  for (const id of ['__proto__', 'constructor', 'prototype']) {
    for (const op of ['clean', 'nudge', 'stop']) assert.throws(() => A.act({ op, run: id }, board, B.collect()), (e) => e.code === 400, op + ' ' + id)
    assert.throws(() => U.undo(id, board), (e) => e.code === 400, 'undo ' + id)
  }
  // a hand-edited file whose cleaned map names a prototype key hides nothing else
  fs.mkdirSync(path.dirname(A.FILE), { recursive: true })
  fs.writeFileSync(A.FILE, '{"schemaVersion":1,"cleaned":{"__proto__":{"dead-1":"x"},"constructor":"x"}}')
  assert.deepEqual(A.view(B.collect()).dead.map((d) => d.id), ['dead-1'])
  assert.equal({}.polluted, undefined)
})
