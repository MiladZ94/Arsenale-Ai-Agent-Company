/* The 1.2 office fields across versions (spec 1.2, section 6 and AT19).
 *
 * Old app, new file: the 1.1.0 code itself, read out of git at its release
 * commit (git show), runs against company files this build wrote. Its writes
 * (archive, budget, add, bring back) must keep `kinds`, `createdBy` and
 * `createdAt` on every office, it must read the file without a problem, and
 * a run stamped by 1.2 must land in the same office there.
 *
 * New app, old file: a 1.1 company reads unchanged and routes exactly as 1.1.
 *
 * Without git or without that commit (an installed package) the first test
 * is skipped, with the reason. Invented data. */
const test = require('node:test')
const assert = require('node:assert/strict')
const fs = require('fs')
const path = require('path')
const { spawnSync } = require('child_process')
const { makeSandbox, SEED } = require('./helpers.cjs')

const REPO = path.join(__dirname, '..', '..')
const V11 = 'ee79a1b' // Arsenale 1.1.0
const board = { door: 'dashboard', role: 'board', name: '' }

const git = (...args) => spawnSync('git', ['-C', REPO, ...args], { encoding: 'buffer', maxBuffer: 1 << 26 })

/** tools/ of 1.1.0 into `dir`, file by file through git show; null when git cannot. */
function checkout11(dir) {
  const ls = git('ls-tree', '-r', '--name-only', V11, '--', 'tools')
  if (ls.status !== 0) return null
  const files = ls.stdout.toString('utf8').split('\n').filter((f) => f && !/^tools\/(test|vendor|characters)\//.test(f) && /\.(cjs|js|json|md)$/.test(f))
  for (const f of files) {
    const r = git('show', V11 + ':' + f)
    if (r.status !== 0) return null
    const to = path.join(dir, f)
    fs.mkdirSync(path.dirname(to), { recursive: true })
    fs.writeFileSync(to, r.stdout)
  }
  return path.join(dir, 'tools')
}

const can11 = git('cat-file', '-e', V11 + '^{commit}').status === 0

test('AT19: 1.1.0 writing offices.json keeps every 1.2 field, reads the file cleanly, and puts a stamped run where 1.2 did', { skip: can11 ? false : 'no git, or the 1.1.0 commit ' + V11 + ' is not in this checkout' }, (t) => {
  const sb = makeSandbox()
  t.after(() => sb.cleanup())
  const seed = JSON.parse(JSON.stringify(SEED)); seed.employees.tester.zone = 'verify'
  const C = sb.mod('agent-company.cjs')
  C.companyInit(seed, ['implementer', 'tester'])
  const K = sb.mod('campus.cjs')
  K.office({ op: 'create', name: 'Quality Bay', theme: 'green', type: 'verification', kinds: ['verify', 'review'] }, board, 'dashboard')
  K.office({ op: 'create', name: 'Night Lab', theme: 'violet', type: 'domain', kinds: ['research'] }, board, 'dashboard')
  K.office({ op: 'edit', id: 'engineering', kinds: ['build'] }, board, 'dashboard')
  const L = sb.mod('runlog.cjs')
  const stamped = L.startRun({ agent: 'tester', task: 'invented', project: 'democalc' }, L.actorFor('cli', 'supervisor')).record
  assert.deepEqual([stamped.officeId, stamped.officeBy], ['quality-bay', 'kind'])
  const new12 = JSON.parse(fs.readFileSync(path.join(sb.company, 'offices.json'), 'utf8'))
  const fields12 = Object.fromEntries(new12.filter((o) => o.kinds || o.createdBy).map((o) => [o.id, { kinds: o.kinds, createdBy: o.createdBy, createdAt: o.createdAt }]))
  assert.deepEqual(Object.keys(fields12).sort(), ['engineering', 'night-lab', 'quality-bay'])

  const tools11 = checkout11(path.join(sb.base, 'v11'))
  assert.ok(tools11, 'the 1.1.0 tools could be read from git')
  assert.equal(fs.readFileSync(path.join(tools11, 'agent-company.cjs'), 'utf8').includes('kinds.cjs'), false, 'this is the 1.1.0 code, which knows no kinds of work')
  // the 1.1.0 library, in its own process, on this data folder
  const script = `
    const C = require('./agent-company.cjs')
    C.setBudget({ scope: 'office', id: 'quality-bay', budget: { monthlyTokens: 5000 }, by: 'board' }, 'cli')
    C.archiveOffice('studio', 'board', 'cli')
    C.addOffice({ id: 'legacy-desk', name: 'Legacy desk', theme: 'amber', profile: 'docs' }, 'board', 'cli')
    C.archiveOffice('night-lab', 'board', 'cli')
    C.addOffice({ id: 'night-lab' }, 'board', 'cli')
    const co = C.readCompany()
    const B = require('./build-agent-dashboard.cjs')
    const st = B.collect()
    const R = C.resolver(co, new Map())
    const run = st.active.find((r) => r.id === ${JSON.stringify(stamped.id)})
    process.stdout.write(JSON.stringify({ problems: co.problems, readOnly: co.readOnly, offices: co.offices.map((o) => o.id), office: run && R.office(run), cost: C.costEvents(st, co).find((e) => e.id === ${JSON.stringify(stamped.id)}) }))
  `
  const env = Object.assign({}, sb.env)
  const r = spawnSync(process.execPath, ['-e', script], { cwd: tools11, env, encoding: 'utf8' })
  assert.equal(r.status, 0, r.stderr)
  const out = JSON.parse(r.stdout)
  assert.deepEqual(out.problems, [], '1.1.0 reads the 1.2 file with no problem')
  assert.equal(out.readOnly, false)
  assert.ok(out.offices.includes('quality-bay') && out.offices.includes('night-lab'))
  assert.equal(out.office, 'quality-bay', 'the stamped run is in the same office on 1.1.0')
  assert.equal(out.cost.officeId, 'quality-bay', 'and so is its cost')

  // every 1.2 field is still there after 1.1.0 wrote the file four times
  const after = JSON.parse(fs.readFileSync(path.join(sb.company, 'offices.json'), 'utf8'))
  for (const [id, f] of Object.entries(fields12)) {
    const o = after.find((x) => x.id === id)
    assert.deepEqual({ kinds: o.kinds, createdBy: o.createdBy, createdAt: o.createdAt }, f, id + ' keeps its 1.2 fields')
  }
  assert.equal(after.find((x) => x.id === 'quality-bay').budget.monthlyTokens, 5000, 'the 1.1 write itself went through')
  assert.equal(after.find((x) => x.id === 'studio').archived, true)
  // 1.1 archived and brought back Night Lab without touching its kinds: 1.2 reads it holding them
  const co = sb.mod('agent-company.cjs').readCompany()
  assert.equal(co.offices.find((o) => o.id === 'night-lab').archived, false)
  assert.equal(sb.mod('agent-company.cjs').kindHolders(co).get('research'), 'night-lab')
  // and a 1.1 office reads in 1.2 with no kinds
  assert.deepEqual(co.offices.find((o) => o.id === 'legacy-desk').kinds, [])
})

test('new app, old file: a 1.1 company reads unchanged and routes as 1.1; reading writes nothing', (t) => {
  const sb = makeSandbox()
  t.after(() => sb.cleanup())
  const C = sb.mod('agent-company.cjs')
  C.companyInit(SEED, ['implementer', 'tester'])
  // a 1.1 offices.json: no kinds, no createdBy, archived office with an old profile
  const old = JSON.parse(fs.readFileSync(path.join(sb.company, 'offices.json'), 'utf8'))
  old.push({ id: 'legal', name: 'Legal', leadEmployeeId: '', profile: 'Legal and compliance', layout: 'standard', theme: 'slate', order: 3, budget: null, archived: true })
  const text = JSON.stringify(old, null, 2)
  fs.writeFileSync(path.join(sb.company, 'offices.json'), text)
  const co = C.readCompany()
  assert.deepEqual(co.problems, [])
  assert.ok(co.offices.every((o) => Array.isArray(o.kinds) && !o.kinds.length && o.createdBy === ''))
  assert.equal(C.kindHolders(co).size, 0)
  // an old run record and a new start both go by the 1.1 rule
  sb.run({ agent: 'tester', project: 'democalc' })
  const B = sb.mod('build-agent-dashboard.cjs')
  const R = C.resolver(co, new Map())
  assert.equal(R.office(B.collect().runs[0]), 'engineering')
  const L = sb.mod('runlog.cjs')
  const rec = L.startRun({ agent: 'tester', task: 'invented', project: 'democalc' }, L.actorFor('cli', 'supervisor')).record
  assert.deepEqual([rec.officeId, rec.officeBy], ['engineering', 'project'])
  const home = L.startRun({ agent: 'implementer', task: 'invented' }, L.actorFor('cli', 'supervisor')).record
  assert.deepEqual([home.officeId, home.officeBy], ['studio', 'home'])
  assert.equal(fs.readFileSync(path.join(sb.company, 'offices.json'), 'utf8'), text, 'offices.json is untouched')
  // a pack's office (addOffice without the form) is still written in the 1.1 shape
  C.addOffice({ id: 'research', name: 'Research', theme: 'cyan', profile: 'research' }, 'board', 'cli')
  const o = JSON.parse(fs.readFileSync(path.join(sb.company, 'offices.json'), 'utf8')).find((x) => x.id === 'research')
  assert.deepEqual(Object.keys(o).sort(), ['archived', 'budget', 'id', 'layout', 'leadEmployeeId', 'name', 'order', 'profile', 'theme'])
})
