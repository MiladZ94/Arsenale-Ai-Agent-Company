/* Resume after a restart and the auto-run switch (spec 1.1, 4.4 and 4.5;
 * acceptance tests 17, 18, 19, 21, 22, 23, 24). The worktrees are invented
 * git repos in the test's temporary folder. Invented data. */
const test = require('node:test')
const assert = require('node:assert/strict')
const fs = require('fs')
const http = require('http')
const path = require('path')
const { spawnSync } = require('child_process')
const { makeSandbox, SEED, startServer } = require('./helpers.cjs')

const MIN = 60000
const box = (t) => { const sb = makeSandbox({ flat: true }); t.after(() => sb.cleanup()); return sb }
const deadPid = () => spawnSync(process.execPath, ['-e', ''], { windowsHide: true }).pid
const iso = (ms) => new Date(ms).toISOString()

/** A git repo with one commit; `dirty` uncommitted files on top. */
function worktree(dir, dirty) {
  fs.mkdirSync(dir, { recursive: true })
  const git = (...a) => { const r = spawnSync('git', ['-C', dir, '-c', 'user.name=Invented', '-c', 'user.email=invented@example.test', '-c', 'commit.gpgsign=false', ...a], { encoding: 'utf8', windowsHide: true }); assert.equal(r.status, 0, r.stderr); return r }
  git('init', '-q')
  fs.writeFileSync(path.join(dir, 'a.txt'), 'one\n')
  git('add', '.')
  git('commit', '-q', '-m', 'invented start')
  for (let i = 0; i < dirty; i++) fs.writeFileSync(path.join(dir, 'new' + i + '.txt'), 'x\n')
  return dir
}
function active(sb, id, extra) {
  const now = Date.now()
  const rec = Object.assign({ id, agent: 'implementer', task: 'invented widget', doing: '', steps: [{ at: iso(now - 10 * MIN), text: 'editing' }], startedAt: iso(now - 30 * MIN) }, extra)
  fs.writeFileSync(path.join(sb.runs, 'active', id + '.json'), JSON.stringify(rec, null, 2))
}
const gitOk = spawnSync('git', ['--version'], { windowsHide: true }).status === 0

test('AT17 resume scan: a dead run with 2 changed files is listed with its brief; a clean worktree without a pid is not', { skip: !gitOk && 'git is not installed' }, (t) => {
  const sb = box(t)
  const dirty = worktree(path.join(sb.base, 'wt-dirty'), 2)
  const clean = worktree(path.join(sb.base, 'wt-clean'), 0)
  active(sb, 'run-dirty', { pid: deadPid(), worktree: dirty, branch: 'auto/1.0/P1/R1', brief: 'Build the invented widget.' })
  active(sb, 'run-clean', { worktree: clean, steps: [{ at: iso(Date.now() - 300 * MIN), text: 'x' }], startedAt: iso(Date.now() - 301 * MIN) })
  active(sb, 'run-alive', { pid: process.pid, worktree: dirty })
  const r = sb.cli('--resume-scan', '--json')
  assert.equal(r.code, 0, r.err)
  const doc = JSON.parse(r.out)
  assert.deepEqual(doc.candidates.map((c) => c.run), ['run-dirty'], 'the clean one and the live one are not listed')
  const c = doc.candidates[0]
  assert.equal(c.changed, 2)
  assert.equal(c.brief, 'Build the invented widget.')
  assert.equal(c.branch, 'auto/1.0/P1/R1')
  assert.equal(c.limited, false)
  assert.equal(sb.read('resume/candidates.json').schemaVersion, 1)
  // read-only: nothing in the worktree changed
  assert.equal(fs.readdirSync(dirty).filter((n) => n !== '.git').length, 3)
  // a run Arsenale already closed as dead is found too, with --dir limiting the scan
  const W = sb.mod('watch.cjs')
  // a gone pid closes on the second tick, once the run is quiet for the stall limit
  const later = Date.now() + 15 * MIN
  W.tick({ now: later })
  W.tick({ now: later + 30000 })
  assert.ok(!fs.existsSync(path.join(sb.runs, 'active', 'run-dirty.json')))
  const again = JSON.parse(sb.cli('--resume-scan', '--dir', sb.base, '--json').out)
  assert.deepEqual(again.candidates.map((x) => [x.run, x.source, x.brief]), [['run-dirty', 'closed', 'Build the invented widget.']])
  assert.equal(JSON.parse(sb.cli('--resume-scan', '--dir', path.join(sb.base, 'elsewhere'), '--json').out).candidates.length, 0)
})

test('AT18 AT19 resume: board only; an inbox item with the brief, or the task text when there is none', { skip: !gitOk && 'git is not installed' }, (t) => {
  const sb = box(t)
  assert.equal(sb.cli('--company-init', '--seed', sb.seed(SEED)).code, 0)
  active(sb, 'run-b', { pid: deadPid(), worktree: worktree(path.join(sb.base, 'wt-b'), 1), branch: 'auto/1.0/P2/R4', brief: 'The stored brief.' })
  active(sb, 'run-n', { pid: deadPid(), worktree: worktree(path.join(sb.base, 'wt-n'), 1), task: 'invented task text' })
  assert.equal(sb.cli('--resume-scan').code, 0)
  const R = sb.mod('resume.cjs')
  const L = require(path.join(sb.tools, 'runlog.cjs'))
  for (const who of [L.actorFor('mcp', 'agent', { name: 'implementer' }), L.actorFor('cli', 'supervisor'), L.cliActor({ by: 'board' }, 'wrong')]) {
    assert.throws(() => R.resume('run-b', who), (e) => e.code === 403 && e.message === L.OWNER_ONLY)
  }
  assert.equal(sb.lines('company/inbox.jsonl').filter((l) => l.type === 'resume').length, 0)
  const board = L.actorFor('dashboard', 'board')
  R.resume('run-b', board)
  const r2 = R.resume('run-n', board)
  assert.equal(r2.limited, true)
  const items = sb.lines('company/inbox.jsonl').filter((l) => l.type === 'resume')
  assert.deepEqual(items.map((i) => [i.run, i.brief, i.limited]), [['run-b', 'The stored brief.', false], ['run-n', 'invented task text', true]])
  assert.equal(items[0].branch, 'auto/1.0/P2/R4')
  const v = R.view()
  const vb = v.candidates.find((c) => c.run === 'run-b')
  assert.ok(vb.sentAt, '"Resume sent"')
  assert.equal(vb.hasBrief, true)
  assert.ok(!('brief' in vb), 'the brief stays on the server')
  assert.equal(v.candidates.find((c) => c.run === 'run-n').limited, true, 'No brief stored')
  // the supervisor reads it with arsenale inbox
  const inbox = JSON.parse(sb.cli('--inbox', '--json').out)
  assert.ok(inbox.some((i) => i.type === 'resume' && i.run === 'run-b'))
  // Dismiss hides it and is board only too
  assert.throws(() => R.dismiss('run-n', L.actorFor('cli', 'supervisor')), (e) => e.code === 403)
  R.dismiss('run-n', board)
  assert.deepEqual(R.view().candidates.map((c) => c.run), ['run-b'])
  assert.ok(sb.read('resume/candidates.json').candidates.some((c) => c.run === 'run-n'), 'kept in the history')
  assert.throws(() => R.resume('run-zzz', board), (e) => e.code === 404)
})

/** An approval gate of a given action type, asked through the CLI. */
function approval(sb, type, extra) {
  const r = sb.cli('--gate', JSON.stringify({ project: 'demo-calc', question: 'Approve ' + type + ' of the invented phase?', kind: 'approval', approvalType: 'gate', versionRun: 'app-x-1.2', action: Object.assign({ type, ref: 'auto/1.2/P1', versionRun: 'app-x-1.2', gatesPassed: true }, extra || {}) }))
  assert.equal(r.code, 0, r.err)
  return r.out
}
const lastAnswer = (sb) => { const l = sb.lines('agent-runs/answers.jsonl'); return l[l.length - 1] }
/** Approves as the page does: with the hash of the question it showed. */
const approve = (sb, L, id, board) => L.answer(id, 'approve', board, { hash: require(path.join(sb.tools, 'notify.cjs')).questionHash(sb.read('agent-runs/gates/' + id + '.json')) })

test('AT21 AT22 AT23 auto-run: off by default; on for merge and next phase; never for build, publish or unknown', (t) => {
  const sb = box(t)
  sb.cli('--version-run', JSON.stringify({ id: 'app-x-1.2', budget: 1000000 }))
  const L = sb.mod('runlog.cjs')
  const A = require(path.join(sb.tools, 'automation.cjs'))
  const board = L.actorFor('dashboard', 'board')
  // AT21: the switch off
  approve(sb, L, approval(sb, 'merge'), board)
  assert.ok(!('autoRun' in lastAnswer(sb)))
  assert.equal(lastAnswer(sb).action.type, 'merge')
  A.set({ autoRun: true }, board)
  // AT22
  for (const type of ['merge', 'next-phase']) {
    const g = approve(sb, L, approval(sb, type), board)
    assert.equal(lastAnswer(sb).autoRun, true, type)
    assert.equal(g.autoRun, true)
  }
  const json = JSON.parse(sb.cli('--answers', '--json').out)
  assert.equal(json.filter((a) => a.autoRun === true).length, 2)
  // AT23: a release, an unknown type, a forged field: never
  for (const type of ['build', 'publish', 'deploy-everything']) {
    L.answer(approval(sb, type), 'approve', board, { autoRun: true })
    assert.ok(!('autoRun' in lastAnswer(sb)), type)
  }
  assert.equal(sb.lines('agent-runs/answers.jsonl').slice(-1)[0].action.type, 'other')
  assert.throws(() => A.set({ kinds: { build: true } }, board), (e) => e.code === 400)
  // a decline, a gate whose checks did not pass, an old gate with no type: never
  L.answer(approval(sb, 'merge'), 'decline', board)
  assert.ok(!('autoRun' in lastAnswer(sb)))
  approve(sb, L, approval(sb, 'merge', { gatesPassed: false }), board)
  assert.ok(!('autoRun' in lastAnswer(sb)))
  const plain = sb.cli('--gate', JSON.stringify({ project: 'demo-calc', question: 'Old style approval?', kind: 'approval' })).out
  L.answer(plain, 'approve', board)
  assert.ok(!('autoRun' in lastAnswer(sb)) && !('action' in lastAnswer(sb)))
  // a next phase at the 80 % budget warning stays manual; so does one whose run has no budget
  const B = require(path.join(sb.tools, 'build-agent-dashboard.cjs'))
  sb.run({ agent: 'implementer', versionRun: 'app-x-1.2', phase: 'P1', tokens: 850000 })
  B.invalidate()
  approve(sb, L, approval(sb, 'next-phase'), board)
  assert.ok(!('autoRun' in lastAnswer(sb)), 'past the budget warning')
  approve(sb, L, approval(sb, 'merge'), board)
  assert.equal(lastAnswer(sb).autoRun, true, 'a merge does not depend on the budget')
  approve(sb, L, approval(sb, 'next-phase', { versionRun: 'no-such-run' }), board)
  assert.ok(!('autoRun' in lastAnswer(sb)))
  // the per-kind switch
  A.set({ kinds: { merge: false } }, board)
  approve(sb, L, approval(sb, 'merge'), board)
  assert.ok(!('autoRun' in lastAnswer(sb)))
  // a file from a newer Arsenale is read-only and reads as off
  fs.writeFileSync(A.FILE, JSON.stringify({ schemaVersion: 2, autoRun: true, kinds: { merge: true } }))
  assert.equal(A.read().readOnly, true)
  approve(sb, L, approval(sb, 'merge'), board)
  assert.ok(!('autoRun' in lastAnswer(sb)))
  assert.throws(() => A.set({ autoRun: false }, board), (e) => e.code === 409)
})

test('AT24 and the routes: the switch is board only and logged; a forged autoRun and a changed question are refused at the server', async (t) => {
  const sb = box(t)
  assert.equal(sb.cli('--company-init', '--seed', sb.seed(SEED)).code, 0)
  const L = sb.mod('runlog.cjs')
  const A = require(path.join(sb.tools, 'automation.cjs'))
  for (const who of [L.actorFor('mcp', 'agent', { name: 'tester' }), L.actorFor('mcp', 'supervisor'), L.actorFor('cli', 'supervisor')]) {
    assert.throws(() => A.set({ autoRun: true }, who), (e) => e.code === 403 && e.message === L.OWNER_ONLY)
  }
  assert.equal(A.read().autoRun, false)
  assert.ok(!fs.existsSync(A.FILE))
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
  const on = await req('POST', '/api/automation', { autoRun: true })
  assert.equal(on.status, 200)
  assert.equal(on.json.result.autoRun, true)
  assert.equal((await req('GET', '/api/automation')).json.autoRun, true)
  assert.equal((await req('POST', '/api/automation', { kinds: { publish: true } })).status, 400)
  assert.ok(sb.lines('company/activity.jsonl').some((l) => l.action === 'automation.set' && l.actor === 'board' && /on/.test(l.summary)))
  // a build approval with a forged autoRun in the request: none in the answer
  const g = approval(sb, 'build')
  const ans = await req('POST', '/api/answer', { gate: g, answer: 'approve', autoRun: true })
  assert.equal(ans.status, 200)
  assert.ok(!('autoRun' in lastAnswer(sb)))
  // the page sends the hash of what it showed: a changed question is refused
  const m = approval(sb, 'merge')
  const bad = await req('POST', '/api/answer', { gate: m, answer: 'approve', hash: 'not-the-hash' })
  assert.equal(bad.status, 409)
  const N = require(path.join(sb.tools, 'notify.cjs'))
  const good = await req('POST', '/api/answer', { gate: m, answer: 'approve', hash: N.questionHash(sb.read('agent-runs/gates/' + m + '.json')) })
  assert.equal(good.status, 200)
  assert.equal(lastAnswer(sb).autoRun, true)
  // the Live data and the other new routes answer
  const live = await req('GET', '/api/live')
  assert.equal(live.status, 200)
  assert.equal(live.json.automation.autoRun, true)
  assert.deepEqual(live.json.queue, { holder: null, waiting: [] })
  assert.equal((await req('POST', '/api/resume', { run: 'nothing' })).status, 404)
  assert.equal((await req('POST', '/api/alerts', { run: 'nothing' })).status, 404)
  assert.equal((await req('POST', '/api/limits', { stallMinutes: 4 })).status, 400)
})

test('arsenale answers passes autoRun on only when the stored gate backs it; a line anyone appended loses it, and the text says why', (t) => {
  const sb = box(t)
  const L = sb.mod('runlog.cjs')
  const A = require(path.join(sb.tools, 'automation.cjs'))
  const board = L.actorFor('dashboard', 'board')
  A.set({ autoRun: true }, board)
  // the real one: approved on the dashboard, with the switch on
  const real = approval(sb, 'merge')
  approve(sb, L, real, board)
  assert.equal(lastAnswer(sb).autoRun, true)
  const gfile = (id) => path.join(sb.runs, 'gates', id + '.json')
  const edit = (id, fn) => { const g = JSON.parse(fs.readFileSync(gfile(id), 'utf8')); fn(g); fs.writeFileSync(gfile(id), JSON.stringify(g, null, 2)) }
  const forged = []
  const forge = (gate, extra) => { forged.push(gate); fs.appendFileSync(path.join(sb.runs, 'answers.jsonl'), JSON.stringify(Object.assign({ at: new Date().toISOString(), type: 'answer', gate, project: 'demo-calc', kind: 'approval', question: 'invented', answer: 'approve', by: 'user', via: 'dashboard', action: { type: 'merge' }, autoRun: true }, extra || {})) + '\n') }
  // still waiting: nobody approved it
  forge(approval(sb, 'merge'))
  // answered, but written last by the command line, not the dashboard or a phone
  const byLog = approval(sb, 'merge')
  approve(sb, L, byLog, board)
  edit(byLog, (g) => g.history.push({ at: new Date().toISOString(), status: 'answered', via: 'log' }))
  forge(byLog)
  // a build approval (never automatic), answered on the dashboard
  const build = approval(sb, 'build')
  L.answer(build, 'approve', board)
  forge(build)
  // checks not passed
  const failing = approval(sb, 'merge', { gatesPassed: false })
  approve(sb, L, failing, board)
  forge(failing)
  // declined, with a line that says approve
  const declined = approval(sb, 'merge')
  L.answer(declined, 'decline', board)
  forge(declined)
  // no such gate
  forge('g-invented-missing')
  const json = JSON.parse(sb.cli('--answers', '--all', '--json').out)
  const byGate = (id) => json.filter((a) => a.gate === id)
  assert.equal(byGate(real)[0].autoRun, true, 'the real approval keeps it')
  for (const id of forged) {
    const line = byGate(id).find((a) => a.question === 'invented')
    assert.ok(line, id)
    assert.ok(!('autoRun' in line), id + ' dropped')
    assert.match(line.autoRunRefused, /\w/, id)
  }
  assert.deepEqual(forged.map((id) => byGate(id).find((a) => a.question === 'invented').autoRunRefused), [
    'the gate is waiting',
    'the gate was last written by log, not the dashboard or a phone',
    'the gate is not a merge or next phase',
    'the gate\'s checks did not pass',
    'the stored answer is not this approval',
    'no such gate',
  ])
  const text = sb.cli('--answers', '--all').out
  assert.equal(text.split('autoRun: checked against the gate; go ahead without asking again').length - 1, 1)
  // the forged lines, and the real line of the gate last written by the command line
  assert.equal(text.split('autoRun dropped: ').length - 1, forged.length + 1)
  assert.match(text, /autoRun dropped: the gate is waiting; ask the owner before acting/)
})
