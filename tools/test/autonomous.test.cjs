/* Autonomous mode, portable setup (spec tests 17, 24-26) and the phase-1
 * review fixes in runlog.cjs. Temporary HOME and repos only; invented data. */
const test = require('node:test')
const assert = require('node:assert/strict')
const fs = require('fs')
const os = require('os')
const path = require('path')
const { spawnSync } = require('child_process')
const { makeSandbox } = require('./helpers.cjs')

const BIN = path.join(__dirname, '..', '..', 'bin', 'arsenale.cjs')
const ROOT = path.join(__dirname, '..', '..')

function machine(t) {
  const base = fs.mkdtempSync(path.join(os.tmpdir(), 'ars-auto-'))
  t.after(() => fs.rmSync(base, { recursive: true, force: true }))
  const homeDir = path.join(base, 'home'), repo = path.join(base, 'repo')
  fs.mkdirSync(homeDir); fs.mkdirSync(repo)
  const env = Object.assign({}, process.env, { HOME: homeDir, USERPROFILE: homeDir, ARSENALE_HOME: path.join(homeDir, '.arsenale') })
  delete env.CLAUDE_CONFIG_DIR
  const run = (...a) => { const r = spawnSync(process.execPath, [BIN, ...a], { cwd: repo, env, encoding: 'utf8', input: '' }); return { code: r.status, out: r.stdout + r.stderr } }
  const git = (...a) => spawnSync('git', ['-C', repo, ...a], { encoding: 'utf8' })
  git('init')
  return { base, homeDir, repo, run, git, data: env.ARSENALE_HOME }
}

test('test 24: fresh home + empty repo: init and autonomous start make the files; a re-run is a no-op', (t) => {
  const m = machine(t)
  const a = m.run('init', '--yes')
  assert.equal(a.code, 0, a.out)
  for (const f of ['PROJECT.md', 'REVIEW.md', 'docs/specs']) assert.ok(fs.existsSync(path.join(m.repo, f)), f)
  const ag = path.join(m.homeDir, '.claude')
  for (const f of ['agents/finding-verifier.md', 'agents/AGENT-RULES.md', 'skills/version-run/SKILL.md', 'skills/version-resume/SKILL.md']) assert.ok(fs.existsSync(path.join(ag, f)), f)
  assert.ok(fs.existsSync(path.join(m.data, 'autonomous', 'budget-defaults.json')))
  assert.equal(m.git('rev-parse', '--verify', 'HEAD').status, 0, 'worktrees need a first commit')
  const s = m.run('autonomous', 'start', '1.0')
  assert.equal(s.code, 0, s.out)
  assert.match(s.out, /planning checklist/)
  const file = path.join(m.repo, 'docs', 'specs', '1.0-list.md')
  const text = fs.readFileSync(file, 'utf8')
  assert.match(text, /Status: planning/)
  assert.match(text, /Integration branch: auto\/1\.0\/integration/)
  assert.match(text, /Budget: 2000000 tokens/)
  const mirror = JSON.parse(fs.readFileSync(path.join(m.data, 'version-runs', fs.readdirSync(path.join(m.data, 'version-runs'))[0]), 'utf8'))
  assert.equal(mirror.status, 'planning')
  assert.equal(mirror.budget, 2000000)
  // a re-run changes nothing
  const snap = () => ({ f: fs.readFileSync(file, 'utf8'), p: fs.readFileSync(path.join(m.repo, 'PROJECT.md'), 'utf8'), r: fs.readFileSync(path.join(ag, 'agents', 'tester.md'), 'utf8'), rec: fs.readFileSync(path.join(m.data, 'init-installed.json'), 'utf8') })
  const before = snap()
  assert.equal(m.run('init', '--yes').code, 0)
  assert.equal(m.run('autonomous', 'start', '1.0').code, 0)
  assert.deepEqual(snap(), before)
  assert.match(m.run('autonomous', 'status', '1.0').out, /status: planning/)
  assert.match(m.run('autonomous', 'resume', '1.0').out, /arsenale answers/)
})

test('init never overwrites an edited agent file without --force (then it backs it up)', (t) => {
  const m = machine(t)
  m.run('init', '--yes')
  const f = path.join(m.homeDir, '.claude', 'agents', 'tester.md')
  fs.writeFileSync(f, 'my own tester\n')
  assert.match(m.run('init', '--yes').out, /kept/)
  assert.equal(fs.readFileSync(f, 'utf8'), 'my own tester\n')
  m.run('init', '--yes', '--force')
  assert.match(fs.readFileSync(f, 'utf8'), /^---\nname: tester/)
  assert.ok(fs.existsSync(path.join(m.data, 'backups')))
})

test('test 26: init --dry-run and a declined init change nothing; an existing PROJECT.md only gets missing sections', (t) => {
  const m = machine(t)
  fs.writeFileSync(path.join(m.repo, 'PROJECT.md'), '# PROJECT.md: mine\n\n## Stack\n- node\n')
  const dry = m.run('init', '--yes', '--dry-run')
  assert.equal(dry.code, 0, dry.out)
  assert.deepEqual(fs.readdirSync(m.repo).filter((n) => n !== '.git').sort(), ['PROJECT.md'])
  assert.ok(!fs.existsSync(path.join(m.homeDir, '.claude')) && !fs.existsSync(m.data))
  assert.match(dry.out, /missing: Test suites, Owner gates/)
  // no --yes and no terminal = the owner declines
  assert.equal(m.run('init').code, 0)
  assert.equal(fs.readFileSync(path.join(m.repo, 'PROJECT.md'), 'utf8'), '# PROJECT.md: mine\n\n## Stack\n- node\n')
  m.run('init', '--yes')
  const once = fs.readFileSync(path.join(m.repo, 'PROJECT.md'), 'utf8')
  assert.match(once, /^# PROJECT.md: mine/)
  assert.match(once, /## Owner gates \(autonomous mode\)/)
  m.run('init', '--yes')
  assert.equal(fs.readFileSync(path.join(m.repo, 'PROJECT.md'), 'utf8'), once)
})

test('test 25: the shipped autonomous files and skills name no machine path or person', () => {
  const files = ['autonomous', 'adapters/claude-code/skills/version-run', 'adapters/claude-code/skills/version-resume'].flatMap((d) => fs.readdirSync(path.join(ROOT, d)).map((n) => path.join(ROOT, d, n)))
  assert.ok(files.length >= 7)
  for (const f of files) assert.doesNotMatch(fs.readFileSync(f, 'utf8'), /[A-Za-z]:[\/]|\/home\/|\/Users\/|OneDrive|\.claude\//, f)
  JSON.parse(fs.readFileSync(path.join(ROOT, 'autonomous', 'budget-defaults.json'), 'utf8'))
})

test('test 17: awake holds only through the OS tool, records its PID, releases on stop; Windows is honest', (t) => {
  const sb = makeSandbox({ flat: true }); t.after(() => sb.cleanup())
  const prevHome = process.env.ARSENALE_HOME
  t.after(() => { if (prevHome === undefined) delete process.env.ARSENALE_HOME; else process.env.ARSENALE_HOME = prevHome })
  process.env.ARSENALE_HOME = sb.root
  const A = require(path.join(ROOT, 'tools', 'autonomous.cjs'))
  const lines = []
  const out = (s) => lines.push(s)
  assert.deepEqual(A.awakePlan('darwin', 42), { cmd: 'caffeinate', args: ['-i', '-w', '42'] })
  assert.equal(A.awakePlan('linux', 42).cmd, 'systemd-inhibit')
  assert.equal(A.awakePlan('win32', 42), null)
  assert.equal(A.awake(['start', '--pid', '42'], out, { platform: 'win32' }), 1)
  assert.match(lines.pop(), /cannot hold Windows awake/)
  const calls = []
  const spawn = (cmd, args) => { calls.push([cmd, args]); return { pid: 99999, unref() {}, on() {} } }
  assert.equal(A.awake(['start', '--pid', '42'], out, { platform: 'darwin', spawn, alive: () => false }), 0)
  assert.deepEqual(calls[0], ['caffeinate', ['-i', '-w', '42']])
  const rec = JSON.parse(fs.readFileSync(path.join(sb.root, 'awake.json'), 'utf8'))
  assert.equal(rec.holder, 99999); assert.equal(rec.watching, 42)
  assert.equal(A.awake(['start', '--pid', '42'], out, { platform: 'darwin', spawn, alive: () => true }), 0)
  assert.equal(calls.length, 1, 'already holding: no second helper')
  assert.equal(A.awake(['start', '--pid', 'x'], out, { platform: 'darwin', spawn }), 1)
  // a reused PID (a different command line) is not killed
  const realKill = process.kill, killed = []
  process.kill = (pid, sig) => { killed.push(pid) }
  try {
    assert.equal(A.awake(['stop'], out, { alive: () => true, inspect: () => 'node unrelated.js' }), 0)
    assert.deepEqual(killed, [])
    assert.ok(!fs.existsSync(path.join(sb.root, 'awake.json')))
    A.awake(['start', '--pid', '42'], out, { platform: 'darwin', spawn, alive: () => false })
    assert.equal(A.awake(['stop'], out, { alive: () => true, inspect: () => 'caffeinate -i -w 42' }), 0)
    assert.deepEqual(killed, [99999])
  } finally { process.kill = realKill }
  assert.ok(!fs.existsSync(path.join(sb.root, 'awake.json')))
})

test('runlog fixes: temp file removed on a failed rename; empty phase id skipped; ledger de-duplicates; id accepted', (t) => {
  const sb = makeSandbox({ flat: true }); t.after(() => sb.cleanup())
  const L = sb.mod('runlog.cjs')
  fs.mkdirSync(path.join(sb.root, 'version-runs', 'blocked.json'), { recursive: true })
  assert.throws(() => L.versionRun({ id: 'blocked' }, null))
  assert.deepEqual(fs.readdirSync(path.join(sb.root, 'version-runs')), ['blocked.json'])
  const rec = L.versionRun({ id: 'app-x-1.2', phases: [{ id: '', name: 'no id' }, { id: '!!', name: 'only symbols' }, { id: 'P1', name: 'ok' }] }, null)
  assert.deepEqual(rec.phases.map((p) => p.id), ['P1'])
  const r = { id: 'same-run', agent: 'implementer', versionRun: 'app-x-1.2', phase: 'P1', tokens: 100, status: 'ok' }
  fs.writeFileSync(path.join(sb.runs, 'a.json'), JSON.stringify(r))
  fs.writeFileSync(path.join(sb.runs, 'active', 'same-run.json'), JSON.stringify(r))
  const led = L.versionLedger('app-x-1.2')
  assert.deepEqual(led.phases.map((p) => [p.runs, p.tokens]), [[1, 100]])
  assert.equal(JSON.parse(sb.cli('--version-ledger', '{"id":"app-x-1.2"}').out).tokens, 100)
})

test('review nits: version names, literal template text, unique backup folder, honest first-commit result', (t) => {
  const m = machine(t)
  for (const v of ['..', '.', '-x', '.hidden']) { const r = m.run('autonomous', 'start', v); assert.equal(r.code, 1, v) }
  assert.ok(!fs.existsSync(path.join(m.repo, 'docs')))
  fs.writeFileSync(path.join(m.repo, 'package.json'), JSON.stringify({ name: 'a$&b$1' }))
  m.run('autonomous', 'start', '2.0')
  assert.ok(fs.readFileSync(path.join(m.repo, 'docs', 'specs', '2.0-list.md'), 'utf8').startsWith('# Version 2.0: a$&b$1'))
  // a commit that cannot succeed is reported as failed
  m.git('config', 'commit.gpgsign', 'true'); m.git('config', 'gpg.program', 'arsenale-no-such-signer')
  const r = m.run('init', '--yes')
  assert.match(r.out, /first commit failed/)
  assert.doesNotMatch(r.out, /  empty first commit/)
})

test('dry run S2: --dry-run lists every step without asking; a declined init creates nothing, not even docs/specs', (t) => {
  const m = machine(t)
  fs.writeFileSync(path.join(m.repo, 'package.json'), '{"name":"sample-app","scripts":{"test":"node t.js"}}')
  const dry = m.run('init', '--dry-run')
  assert.equal(dry.code, 0, dry.out)
  assert.doesNotMatch(dry.out, /skipped/, 'a dry run shows the plan, it does not skip steps')
  for (const w of ['agents', 'PROJECT.md', 'REVIEW.md', 'docs']) assert.match(dry.out, new RegExp('create.*' + w + '|add.*' + w), 'the plan names ' + w)
  assert.deepEqual(fs.readdirSync(m.repo).filter((n) => n !== '.git'), ['package.json'], 'a dry run writes nothing')
  assert.equal(m.run('init').code, 0) // no terminal, no --yes: declined
  assert.deepEqual(fs.readdirSync(m.repo).filter((n) => n !== '.git'), ['package.json'], 'declined: nothing written, docs/specs included')
  const real = m.run('init', '--yes')
  assert.match(fs.readFileSync(path.join(m.repo, 'PROJECT.md'), 'utf8'), /Last checked against the code: \d{4}-\d\d-\d\d/, real.out)
})
