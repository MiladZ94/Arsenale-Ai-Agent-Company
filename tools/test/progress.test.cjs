/* Live progress (spec 1.1, 4.1; acceptance tests 1, 2, 4, 5, 6, 7): the pure
 * percent, estimate, ETA and overall functions, the progress short form and
 * the new optional fields, and records read across old and new code.
 * All data is invented. */
const test = require('node:test')
const assert = require('node:assert/strict')
const fs = require('fs')
const os = require('os')
const path = require('path')
const { spawnSync } = require('child_process')
const { makeSandbox } = require('./helpers.cjs')
const Pg = require('../progress.cjs')

const box = (t) => { const sb = makeSandbox({ flat: true }); t.after(() => sb.cleanup()); return sb }
const MIN = 60000

test('AT1 plan percent: plan [read 1, edit 2, test 1], step 2 at 50 % reports 50 %', () => {
  const run = { plan: Pg.cleanPlan([{ name: 'read', weight: 1 }, { name: 'edit', weight: 2 }, { name: 'test', weight: 1 }]), stepIndex: 2, stepPct: 50 }
  assert.equal(Pg.reportedPercent(run), 50)
  assert.equal(Pg.stepIndexOf(run.plan, 'edit'), 2)
  assert.equal(Pg.stepIndexOf(run.plan, '3'), 3)
  assert.equal(Pg.stepIndexOf(run.plan, 9), 0)
  // a bare pct is the reported percent itself; a running run never shows 100
  assert.equal(Pg.reportedPercent({ pct: 60 }), 60)
  assert.equal(Pg.reportedPercent({ pct: 100 }), 99)
  assert.equal(Pg.reportedPercent({ pct: 100, finishedAt: '2026-01-02T10:00:00Z' }), 100)
  assert.equal(Pg.reportedPercent({}), null)
})

test('AT2 estimate: 60 % files and 40 % tests, one alone, the time fallback, else nothing', () => {
  const h = Pg.headline({ plannedFiles: 10, files: 4, plannedTests: 5, testsRun: 5, startedAt: new Date().toISOString() }, [], Date.now())
  assert.equal(h.estimate, 64)
  assert.equal(h.estimated, true, 'labelled est. when nothing was reported')
  assert.equal(h.percent, 64)
  assert.equal(Pg.estimatePercent({ plannedFiles: 10, files: 4 }).pct, 40)
  assert.equal(Pg.estimatePercent({}), null)
  assert.equal(Pg.headline({}, [], Date.now()).percent, null, 'missing is null ("—"), never 0')
  // plannedFiles 0 means not known
  assert.equal(Pg.estimatePercent({ plannedFiles: 0, files: 4 }), null)
  // steps of a plan: finished steps over planned steps
  assert.equal(Pg.estimatePercent({ plan: [{ name: 'a', weight: 1 }, { name: 'b', weight: 1 }, { name: 'c', weight: 1 }, { name: 'd', weight: 1 }], stepIndex: 3 }).pct, 50)
  // time against the median of the agent's last runs: needs 3, never above 95
  const now = Date.parse('2026-03-01T12:00:00Z')
  const past = (n, mins) => Array.from({ length: n }, (_, i) => ({ agent: 'tester', status: 'ok', durMs: mins * MIN, finishedAt: '2026-02-0' + (i + 1) + 'T10:00:00Z' }))
  const r = { agent: 'tester', startedAt: new Date(now - 10 * MIN).toISOString() }
  assert.equal(Pg.estimatePercent(r, past(2, 20), now), null)
  assert.deepEqual(Pg.estimatePercent(r, past(3, 20), now), { pct: 50, basis: 'time' })
  assert.equal(Pg.estimatePercent(Object.assign({}, r, { startedAt: new Date(now - 300 * MIN).toISOString() }), past(3, 20), now).pct, 95)
})

test('AT3 data: reported 90 and estimate 50 are both kept and marked as differing', () => {
  const h = Pg.headline({ pct: 90, plannedFiles: 10, files: 5, startedAt: new Date().toISOString() }, [], Date.now())
  assert.equal(h.percent, 90)
  assert.equal(h.estimate, 50)
  assert.equal(h.differ, true)
  assert.equal(h.estimated, false)
})

test('AT4 ETA: 10 min at 40 % is about 15 min; under 10 % or under 2 min there is none', () => {
  assert.equal(Pg.etaMinutes(10 * MIN, 40), 15)
  assert.equal(Pg.etaText(Pg.etaMinutes(10 * MIN, 40)), 'about 15 min')
  assert.equal(Pg.etaMinutes(10 * MIN, 5), null)
  assert.equal(Pg.etaMinutes(1 * MIN, 40), null)
  assert.equal(Pg.etaText(null), '—')
})

test('AT5 overall version percent: (2x100 + 4x37.5 + 2x0) / 8 = 44 %', () => {
  const vr = { id: 'app-x-1.2', phases: [
    { id: 'P1', requests: ['R1', 'R2'], merged: ['R1', 'R2'], percent: 0 },
    { id: 'P2', requests: ['R3', 'R4', 'R5', 'R6'], merged: ['R3'], percent: 0 },
    { id: 'P3', requests: ['R7', 'R8'], percent: 0 },
  ] }
  const o = Pg.overallPercent(vr, [{ versionRun: 'app-x-1.2', phase: 'P2', percent: 50 }, { versionRun: 'other', phase: 'P3', percent: 90 }])
  assert.deepEqual(o.phases.map((p) => p.percent), [100, 37.5, 0])
  assert.equal(o.percent, 44)
  // a percent the supervisor set wins
  vr.phases[2].percent = 50; vr.phases[2].percentSet = true
  assert.equal(Pg.overallPercent(vr, []).phases[2].percent, 50)
  // a phase whose status says merged counts every request
  assert.equal(Pg.overallPercent({ id: 'v', phases: [{ id: 'A', requests: ['a', 'b'], status: 'merged' }] }, []).percent, 100)
})

test('AT6 command compat: the short form and the old JSON both work and print ok', (t) => {
  const sb = box(t)
  const id = sb.cli('--start', '{"agent":"tester","task":"invented suite"}').out
  const short = sb.cli('--progress', id, 'running tests', '60')
  assert.equal(short.code, 0, short.err)
  assert.equal(short.out, 'ok')
  let rec = sb.read('agent-runs/active/' + id + '.json')
  assert.equal(rec.doing, 'running tests')
  assert.equal(rec.pct, 60)
  const old = sb.cli('--progress', JSON.stringify({ id, doing: 'reading src' }))
  assert.equal(old.code, 0, old.err)
  assert.equal(old.out, 'ok')
  rec = sb.read('agent-runs/active/' + id + '.json')
  assert.equal(rec.doing, 'reading src')
  assert.equal(rec.pct, 60, 'a line without pct keeps the last one')
  assert.ok(rec.lastActivityAt)
  // a plan, then a step: pct is the step's own share; the record's pct is the whole run's
  sb.stdin = JSON.stringify({ id, doing: 'plan', plan: [{ name: 'read', weight: 1 }, { name: 'edit', weight: 2 }, { name: 'test', weight: 1 }] })
  assert.equal(sb.cli('--progress', '--stdin').code, 0)
  sb.stdin = JSON.stringify({ id, doing: 'editing', step: 'edit', pct: 50, files: 3, plannedFiles: 6, tests: { run: 2, of: 8 }, futureField: { x: 1 } })
  const r = sb.cli('--progress', '--stdin')
  assert.equal(r.code, 0, r.err)
  rec = sb.read('agent-runs/active/' + id + '.json')
  assert.equal(rec.stepIndex, 2)
  assert.equal(rec.stepPct, 50)
  assert.equal(rec.pct, 50)
  assert.equal(rec.files, 3)
  assert.equal(rec.plannedFiles, 6)
  assert.equal(rec.testsRun, 2)
  assert.equal(rec.plannedTests, 8)
  assert.ok(!('futureField' in rec), 'unknown fields are ignored')
  // a second plan is not taken
  sb.stdin = JSON.stringify({ id, doing: 'x', plan: ['only'] })
  sb.cli('--progress', '--stdin')
  assert.equal(sb.read('agent-runs/active/' + id + '.json').plan.length, 3)
  delete sb.stdin
})

test('AT6 start: the new optional fields, the brief file and its 8000-character limit', (t) => {
  const sb = box(t)
  const bf = path.join(sb.base, 'brief.txt')
  // a byte-order mark, as Windows PowerShell 5.1 writes one; built from its code
  fs.writeFileSync(bf, String.fromCharCode(0xfeff) + 'Build the invented widget.\nKeep it small.')
  sb.stdin = JSON.stringify({ agent: 'implementer', task: 'widget', worktree: path.join(sb.base, 'wt'), branch: 'auto/1.0/P1/R1', briefFile: bf, pid: process.pid, pidStartedAt: '2026-01-02T10:00:00Z', plannedFiles: 4, plannedTests: 'x' })
  const r = sb.cli('--start', '--stdin')
  assert.equal(r.code, 0, r.err)
  assert.match(r.err, /plannedTests/, 'a bad planned count is a note, never a refused start')
  const rec = sb.read('agent-runs/active/' + r.out + '.json')
  assert.equal(rec.brief, 'Build the invented widget.\nKeep it small.')
  assert.equal(rec.branch, 'auto/1.0/P1/R1')
  assert.equal(rec.worktree, path.join(sb.base, 'wt'))
  // the system's start time, never the input's (security review of P2, finding 4)
  assert.notEqual(rec.pidStartedAt, '2026-01-02T10:00:00.000Z')
  assert.equal(rec.plannedFiles, 4)
  assert.ok(!('plannedTests' in rec) && !('briefFile' in rec))
  sb.stdin = JSON.stringify({ agent: 'implementer', task: 'long', brief: 'x'.repeat(9000) })
  const long = sb.cli('--start', '--stdin')
  assert.equal(long.code, 0)
  assert.equal(sb.read('agent-runs/active/' + long.out + '.json').brief.length, 8000)
  delete sb.stdin
})

test('AT7 isolation: an agent cannot write to another agent\'s run; bad counts are refused and nothing is written', (t) => {
  const sb = box(t)
  const id = sb.cli('--start', '{"agent":"tester","task":"invented"}').out
  const L = sb.mod('runlog.cjs')
  assert.throws(() => L.progress({ id, doing: 'x' }, L.actorFor('mcp', 'agent', { name: 'implementer' })), (e) => e.code === 403)
  const before = fs.readFileSync(path.join(sb.runs, 'active', id + '.json'), 'utf8')
  for (const bad of [{ files: -3 }, { files: 2.5 }, { files: 'many' }, { plannedFiles: -1 }, { tests: { run: 1.5, of: 4 } }]) {
    assert.throws(() => L.progress(Object.assign({ id, doing: 'y' }, bad), L.actorFor('mcp', 'agent', { name: 'tester' })), (e) => e.code === 400, JSON.stringify(bad))
  }
  const cli = sb.cli('--progress', JSON.stringify({ id, doing: 'z', files: -3 }))
  assert.equal(cli.code, 1)
  assert.match(cli.err, /files/)
  assert.equal(fs.readFileSync(path.join(sb.runs, 'active', id + '.json'), 'utf8'), before)
  // a percent outside 0-100 is clamped; a non-number is ignored
  L.progress({ id, doing: 'a', pct: 140 }, L.actorFor('mcp', 'agent', { name: 'tester' }))
  assert.equal(sb.read('agent-runs/active/' + id + '.json').pct, 100)
  L.progress({ id, doing: 'b', pct: 'soon' }, L.actorFor('mcp', 'agent', { name: 'tester' }))
  assert.equal(sb.read('agent-runs/active/' + id + '.json').pct, 100)
})

test('the version-run mirror keeps merged requests and marks a percent the supervisor gave', (t) => {
  const sb = box(t)
  assert.equal(sb.cli('--version-run', JSON.stringify({ id: 'app-y-2.0', phases: [{ id: 'P1', requests: ['R1', 'R2'], merged: ['R1'] }, { id: 'P2', requests: ['R3'], percent: 30 }] })).code, 0)
  const rec = sb.read('version-runs/app-y-2.0.json')
  assert.deepEqual(rec.phases[0].merged, ['R1'])
  assert.ok(!('percentSet' in rec.phases[0]))
  assert.equal(rec.phases[1].percentSet, true)
  assert.equal(Pg.overallPercent(rec, []).percent, Math.round((2 * 50 + 1 * 30) / 3))
})

// The code as committed (HEAD), extracted next to the sandbox: the "old app".
function oldTools(sb) {
  const repo = path.join(__dirname, '..', '..')
  const dir = path.join(sb.base, 'old')
  fs.mkdirSync(dir)
  // read-only git: file by file, so neither the index nor a tar program is needed
  const ls = spawnSync('git', ['-C', repo, 'ls-tree', '-r', '--name-only', 'HEAD', 'tools'], { encoding: 'utf8', windowsHide: true })
  if (ls.status !== 0) return null
  for (const f of ls.stdout.split('\n').filter((n) => /^tools\/(?!test\/)[^]*\.(cjs|js|json)$/.test(n))) {
    const s = spawnSync('git', ['-C', repo, 'show', 'HEAD:' + f], { windowsHide: true, maxBuffer: 64 * 1024 * 1024 })
    if (s.status !== 0) return null
    fs.mkdirSync(path.dirname(path.join(dir, f)), { recursive: true })
    fs.writeFileSync(path.join(dir, f), s.stdout)
  }
  return path.join(dir, 'tools')
}

test('AT6 old and new: the committed code reads and updates a record with the new fields; the new code reads an old record', (t) => {
  const sb = box(t)
  const old = oldTools(sb)
  if (!old) return t.skip('git archive or tar is not available')
  sb.stdin = JSON.stringify({ agent: 'tester', task: 'invented', worktree: path.join(os.tmpdir(), 'nowhere'), brief: 'b', plannedFiles: 3 })
  const id = sb.cli('--start', '--stdin').out
  sb.stdin = JSON.stringify({ id, doing: 'p', plan: ['a', 'b'], step: 1, pct: 50, files: 1, tests: { run: 1, of: 2 } })
  assert.equal(sb.cli('--progress', '--stdin').code, 0)
  delete sb.stdin
  const oldCli = (...args) => spawnSync(process.execPath, [path.join(old, 'log-agent-run.cjs'), ...args], { encoding: 'utf8', cwd: sb.base, env: sb.env })
  const p = oldCli('--progress', JSON.stringify({ id, doing: 'old line', pct: 70 }))
  assert.equal(p.status, 0, p.stderr)
  assert.equal(p.stdout.trim(), 'ok')
  const rec = sb.read('agent-runs/active/' + id + '.json')
  assert.equal(rec.brief, 'b', 'the old writer keeps fields it does not know')
  assert.equal(rec.plan.length, 2)
  const c = spawnSync(process.execPath, ['-e', 'const s=require(' + JSON.stringify(path.join(old, 'build-agent-dashboard.cjs')) + ').collect();console.log(JSON.stringify(s.active.map(a=>[a.id,a.doing,a.pct])))'], { encoding: 'utf8', env: sb.env })
  assert.equal(c.status, 0, c.stderr)
  // since 1.1 the committed code knows plans too: 70 % of step 1 of the two-step plan is 35 % overall (AT1)
  assert.deepEqual(JSON.parse(c.stdout.trim().split('\n').pop()), [[id, 'old line', 35]])
  const fin = oldCli('--finish', JSON.stringify({ id, agent: 'tester', task: 'invented' }))
  assert.equal(fin.status, 0, fin.stderr)
  // an old record (no plan, pid, worktree or brief) in the new Live view: missing parts are null
  const oldId = '2026-01-02T10-00-00-000Z-abcd'
  fs.writeFileSync(path.join(sb.runs, 'active', oldId + '.json'), JSON.stringify({ id: oldId, agent: 'tester', task: 'old run', doing: '', steps: [], startedAt: new Date().toISOString() }))
  const W = sb.mod('watch.cjs')
  const row = W.live().runs.find((r) => r.id === oldId)
  assert.equal(row.percent, null)
  assert.equal(row.reported, null)
  assert.equal(row.files, null)
  assert.equal(row.etaMin, null)
  assert.equal(row.step, null)
  assert.equal(row.state, 'working')
})

test('MCP log_step takes the same optional fields, and refuses a bad count', async (t) => {
  const { mcpClient } = require('./helpers.cjs')
  const sb = box(t)
  const c = mcpClient(sb, 'Test Client')
  t.after(() => c.close())
  await c.init()
  const job = await c.call('start_job', { team_member: 'tester', task: 'invented suite' })
  assert.equal(job.error, false, job.text)
  const id = job.data.job_id
  const s = await c.call('log_step', { job_id: id, doing: 'editing', plan: [{ name: 'read', weight: 1 }, { name: 'edit', weight: 2 }, { name: 'test', weight: 1 }], step: 2, pct: 50, files: 2, tests: { run: 1, of: 4 } })
  assert.equal(s.error, false, s.text)
  const rec = sb.read('agent-runs/active/' + id + '.json')
  assert.equal(rec.pct, 50)
  assert.equal(rec.files, 2)
  assert.equal(rec.plannedTests, 4)
  const bad = await c.call('log_step', { job_id: id, doing: 'x', files: -3 })
  assert.equal(bad.error, true)
  assert.match(bad.text, /files/)
})
