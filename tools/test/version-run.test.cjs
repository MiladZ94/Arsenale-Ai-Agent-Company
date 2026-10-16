/* Autonomous mode, phase 1 (spec autonomous-mode, tests 15 and 20): the
 * versionRun / phase tags on the run log, the version-run mirror in the data
 * folder, and the owner-only gate answer. All data is invented. */
const test = require('node:test')
const assert = require('node:assert/strict')
const fs = require('fs')
const path = require('path')
const { makeSandbox } = require('./helpers.cjs')

const box = (t) => { const sb = makeSandbox({ flat: true }); t.after(() => sb.cleanup()); return sb }

test('--start and finish carry versionRun and phase; runs without them have neither', (t) => {
  const sb = box(t)
  const id = sb.cli('--start', '{"agent":"implementer","task":"feature A","versionRun":"app-x-1.2","phase":"P2"}').out
  const active = sb.read('agent-runs/active/' + id + '.json')
  assert.equal(active.versionRun, 'app-x-1.2')
  assert.equal(active.phase, 'P2')
  // the finish repeats them even when the finish JSON does not name them
  const fin = sb.cli('--finish', JSON.stringify({ id, agent: 'implementer', task: 'feature A', usage: { tokens: 900 } }))
  assert.equal(fin.code, 0, fin.err)
  const rec = JSON.parse(fs.readFileSync(path.resolve(sb.base, fin.out), 'utf8'))
  assert.equal(rec.versionRun, 'app-x-1.2')
  assert.equal(rec.phase, 'P2')
  const plain = sb.cli('--start', '{"agent":"tester","task":"plain"}').out
  const p = sb.read('agent-runs/active/' + plain + '.json')
  assert.ok(!('versionRun' in p) && !('phase' in p))
})

test('the tags are cleaned: no path or markup survives', (t) => {
  const sb = box(t)
  const id = sb.cli('--start', '{"agent":"implementer","task":"x","versionRun":"../../evil<b>","phase":"P 1/2"}').out
  const a = sb.read('agent-runs/active/' + id + '.json')
  assert.equal(a.versionRun, '....evilb')
  assert.equal(a.phase, 'P12')
})

test('an older reader: a run record with the new fields is read unchanged', (t) => {
  const sb = box(t)
  const base = { agent: 'implementer', task: 'invented task', summary: 'done', tokens: 500 }
  sb.run(Object.assign({}, base, { finishedAt: '2026-01-02T10:00:00.000Z', startedAt: '2026-01-02T09:00:00.000Z' }))
  sb.run(Object.assign({}, base, { finishedAt: '2026-01-03T10:00:00.000Z', startedAt: '2026-01-03T09:00:00.000Z', versionRun: 'app-x-1.2', phase: 'P1', someFutureField: { a: 1 } }))
  const runs = sb.mod('build-agent-dashboard.cjs').collect().runs
  assert.equal(runs.length, 2)
  const pick = (r) => ({ agent: r.agent, task: r.task, status: r.status, summary: r.summary, tokens: r.tokens })
  assert.deepEqual(pick(runs[0]), pick(runs[1]))
})

test('--version-run writes a mirror, keeps unnamed fields, refuses a bad budget or status', (t) => {
  const sb = box(t)
  const r = sb.cli('--version-run', JSON.stringify({ id: 'app-x-1.2', app: 'app X', version: '1.2', budget: 1000000, stateFile: 'docs/specs/1.2-list.md', integrationBranch: 'auto/1.2/integration', phases: [{ id: 'P1', name: 'data', tier: 'high', requests: ['R1'], percent: 40 }, { id: 'P2', name: 'ui', tier: 'bogus', dependsOn: ['P1'], percent: 250 }] }))
  assert.equal(r.code, 0, r.err)
  assert.equal(r.out, 'app-x-1.2')
  let rec = sb.read('version-runs/app-x-1.2.json')
  assert.equal(rec.status, 'planning')
  assert.equal(rec.phases[0].tier, 'high')
  assert.equal(rec.phases[1].tier, 'medium')
  assert.equal(rec.phases[1].percent, 100)
  assert.equal(sb.cli('--version-run', '{"id":"app-x-1.2","status":"running"}').code, 0)
  rec = sb.read('version-runs/app-x-1.2.json')
  assert.equal(rec.status, 'running')
  assert.equal(rec.budget, 1000000)
  assert.equal(rec.phases.length, 2)
  for (const bad of ['0', '-5', '"abc"', '1.5']) {
    const x = sb.cli('--version-run', '{"id":"app-x-1.2","budget":' + bad + '}')
    assert.equal(x.code, 1, bad)
    assert.match(x.err, /positive whole number/)
  }
  assert.equal(sb.cli('--version-run', '{"id":"app-x-1.2","status":"flying"}').code, 1)
  assert.equal(sb.read('version-runs/app-x-1.2.json').budget, 1000000)
  assert.deepEqual(fs.readdirSync(path.join(sb.root, 'version-runs')), ['app-x-1.2.json'], 'no temp file is left behind')
  assert.equal(sb.cli('--version-run', '{"app":"no id"}').code, 1)
})

test('an agent cannot write a version run', (t) => {
  const sb = box(t)
  const L = sb.mod('runlog.cjs')
  assert.throws(() => L.versionRun({ id: 'app-x-1.2' }, L.actorFor('mcp', 'agent', { name: 'implementer' })), (e) => e.code === 403)
  assert.ok(!fs.existsSync(path.join(sb.root, 'version-runs')))
})

test('test 15: tokens per phase from tagged runs; "not recorded" is null, never 0', (t) => {
  const sb = box(t)
  sb.run({ agent: 'implementer', versionRun: 'app-x-1.2', phase: 'P1', tokens: 1000 })
  sb.run({ agent: 'tester', versionRun: 'app-x-1.2', phase: 'P1', usage: { tokens: 500 } })
  sb.run({ agent: 'implementer', versionRun: 'app-x-1.2', phase: 'P2' })               // no token count
  sb.run({ agent: 'implementer', versionRun: 'arsenale-1.1', phase: 'P1', tokens: 7777 }) // the other run
  sb.run({ agent: 'implementer', tokens: 4242 })                                          // untagged
  sb.cli('--start', '{"agent":"implementer","task":"going","versionRun":"app-x-1.2","phase":"P3"}')
  const out = JSON.parse(sb.cli('--version-ledger', '{"versionRun":"app-x-1.2"}').out)
  assert.deepEqual(out.phases.map((p) => [p.phase, p.runs, p.running, p.tokens]), [['P1', 2, 0, 1500], ['P2', 1, 0, null], ['P3', 1, 1, null]])
  assert.equal(out.tokens, 1500)
  const none = JSON.parse(sb.cli('--version-ledger', '{"versionRun":"nothing-yet"}').out)
  assert.deepEqual(none.phases, [])
  assert.equal(none.tokens, null)
})

test('test 20: a gate of a version run lands in answers.jsonl with its run id; only the owner answers', (t) => {
  const sb = box(t)
  const gid = sb.cli('--gate', '{"project":"app X","kind":"approval","question":"Build the 1.2 installer?","choices":["yes","no"],"versionRun":"app-x-1.2"}').out
  assert.equal(sb.read('agent-runs/gates/' + gid + '.json').versionRun, 'app-x-1.2')
  const L = sb.mod('runlog.cjs')
  // an agent (and the supervisor) is refused, and the question stays waiting
  for (const a of [L.actorFor('mcp', 'agent', { name: 'implementer' }), L.actorFor('mcp', 'supervisor'), L.actorFor('cli', 'supervisor')]) {
    assert.throws(() => L.answer(gid, 'yes', a), (e) => e.code === 403 && e.message === L.OWNER_ONLY)
  }
  assert.equal(sb.read('agent-runs/gates/' + gid + '.json').status, 'waiting')
  assert.deepEqual(sb.lines('agent-runs/answers.jsonl'), [])
  L.answer(gid, 'yes', L.actorFor('dashboard', 'board'))
  const lines = sb.lines('agent-runs/answers.jsonl')
  assert.equal(lines.length, 1)
  assert.equal(lines[0].gate, gid)
  assert.equal(lines[0].answer, 'yes')
  assert.equal(lines[0].versionRun, 'app-x-1.2')
  // the supervisor reads it through the CLI
  assert.match(sb.cli('--answers').out, /yes/)
})
