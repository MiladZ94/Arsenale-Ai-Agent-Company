/* 1.1 keeps working with a company that has 1.2 local packs (spec 1.2,
 * section 6). The 1.1.0 code is taken from git (commit ee79a1b) into a
 * folder next to a 1.2 data folder: it lists, installs and removes bundled
 * packs, reads the company and builds the page, and leaves the local pack's
 * record, files and office as 1.2 wrote them; 1.2 can then still remove the
 * local pack. Skips when the 1.1.0 commit is not in this checkout (an npm
 * copy has no git history). Invented data. Run: npm test */
const test = require('node:test')
const assert = require('node:assert/strict')
const fs = require('fs')
const path = require('path')
const crypto = require('crypto')
const { spawnSync } = require('child_process')
const { makeSandbox, SEED } = require('./helpers.cjs')
const { bakeryPack, folderBody } = require('./pack-fixture.cjs')

const REPO = path.join(__dirname, '..', '..')
const OLD = 'ee79a1b'
const git = (...a) => spawnSync('git', ['-C', REPO, ...a], { encoding: 'buffer', maxBuffer: 64 * 1024 * 1024 })
const SKIP = git('cat-file', '-e', OLD + '^{commit}').status === 0 ? false : 'the 1.1.0 commit is not in this checkout'
const sha = (f) => crypto.createHash('sha256').update(fs.readFileSync(f)).digest('hex')

/** The 1.1.0 code (tools/*.cjs, tools/pages, package.json) in `dir`, with today's bundled packs. */
function oldTree(dir) {
  const names = git('ls-tree', '-r', '--name-only', OLD, '--', 'tools', 'package.json').stdout.toString('utf8').split('\n').filter(Boolean)
  const want = names.filter((n) => n === 'package.json' || /^tools\/[^/]+\.cjs$/.test(n) || n.startsWith('tools/pages/'))
  for (const n of want) {
    const r = git('show', OLD + ':' + n)
    assert.equal(r.status, 0, 'git show ' + n)
    fs.mkdirSync(path.dirname(path.join(dir, n)), { recursive: true })
    fs.writeFileSync(path.join(dir, n), r.stdout)
  }
  fs.cpSync(path.join(REPO, 'packs'), path.join(dir, 'packs'), { recursive: true })
}

/** Runs `code` with the 1.1.0 modules on the sandbox's data folder; returns its JSON. */
function asOld(sb, dir, code) {
  const r = spawnSync(process.execPath, ['-e', code], { cwd: path.join(dir, 'tools'), env: sb.env, encoding: 'utf8', maxBuffer: 1 << 26 })
  assert.equal(r.status, 0, r.stderr)
  return JSON.parse(r.stdout)
}

test('1.1.0 works on a company with a 1.2 local pack, and keeps every 1.2 field', { skip: SKIP }, (t) => {
  const sb = makeSandbox({ packs: true })
  t.after(() => sb.cleanup())
  assert.equal(sb.cli('--company-init', '--seed', sb.seed(Object.assign({}, SEED, { company: { name: 'Bluefin Bakery', issuePrefix: 'BLU' } }))).code, 0)
  const L = sb.mod('runlog.cjs')
  const board = L.actorFor('dashboard', 'board')
  const Pl = sb.mod('pack-local.cjs')
  const r = Pl.stage(folderBody(bakeryPack()), board)
  Pl.install({ stage: r.stage, hash: r.hash, keep: { 'bakery-lead': true } }, board)
  require(path.join(sb.tools, 'packs.cjs')).installPack('research', board)
  const state = () => JSON.parse(fs.readFileSync(path.join(sb.root, 'packs', 'installed.json'), 'utf8'))
  const local = state().packs['demo-bakery-pack']
  assert.equal(local.source, 'local')
  const files = Object.fromEntries(local.files.map((f) => [f.path, sha(path.join(sb.agents, f.path))]))

  const dir = path.join(sb.base, 'old-1.1')
  oldTree(dir)
  assert.equal(JSON.parse(fs.readFileSync(path.join(dir, 'package.json'), 'utf8')).version, '1.1.0')
  const out = asOld(sb, dir, `
    const Pk = require('./packs.cjs'), L = require('./runlog.cjs'), C = require('./agent-company.cjs'), B = require('./build-agent-dashboard.cjs')
    const board = L.actorFor('dashboard', 'board')
    const listed = Pk.listPacks().filter((p) => p.installed).map((p) => p.id)
    const installed = Pk.installPack('finance', board).id
    Pk.uninstallPack('research', board)
    const s = B.collect()
    const co = C.companyState(s)
    const html = B.renderPage(s, { live: true, token: 't', company: B.companyOf(s) })
    process.stdout.write(JSON.stringify({ listed, installed, offices: co.offices.map((o) => o.id + ':' + !!o.archived), lead: (co.employees.find((e) => e.id === 'bakery-lead') || {}).homeOfficeId || '', page: html.length }))
  `)
  // 1.1 lists bundled packs only: the local one is invisible there, and nothing breaks
  assert.deepEqual(out.listed.sort(), ['research'])
  assert.equal(out.installed, 'finance')
  assert.ok(out.offices.includes('bakery-desk:false'), 'the local pack\'s office is there in 1.1')
  assert.equal(out.lead, 'bakery-desk', 'its members work in 1.1')
  assert.ok(out.page > 1000)
  // 1.1's writes to installed.json kept the 1.2 entry exactly
  const after = state()
  assert.deepEqual(after.packs['demo-bakery-pack'], local)
  assert.ok(Object.hasOwn(after.packs, 'finance') && !Object.hasOwn(after.packs, 'research'))
  for (const [f, h] of Object.entries(files)) assert.equal(sha(path.join(sb.agents, f)), h, f + ' untouched by 1.1')
  assert.ok(fs.existsSync(path.join(sb.root, 'packs', 'local', 'demo-bakery-pack', '1.0.0', 'pack.json')))

  // back on 1.2: the local pack still removes exactly
  const Pk = sb.mod('packs.cjs')
  const rm = Pk.uninstallPack('demo-bakery-pack', sb.mod('runlog.cjs').actorFor('dashboard', 'board'))
  assert.deepEqual(rm.removed.sort(), ['bakery-lead', 'bread-writer'])
  assert.ok(!fs.existsSync(path.join(sb.root, 'packs', 'local', 'demo-bakery-pack')))
  assert.ok(Object.hasOwn(state().packs, 'finance'))
})

test('1.1.0 can still remove a 1.2 local pack by its record; only its own copy is left behind', { skip: SKIP }, (t) => {
  const sb = makeSandbox({ packs: true })
  t.after(() => sb.cleanup())
  assert.equal(sb.cli('--company-init', '--seed', sb.seed()).code, 0)
  const board = sb.mod('runlog.cjs').actorFor('dashboard', 'board')
  const Pl = sb.mod('pack-local.cjs')
  const r = Pl.stage(folderBody(bakeryPack()), board)
  Pl.install({ stage: r.stage, hash: r.hash }, board)
  const dir = path.join(sb.base, 'old-1.1')
  oldTree(dir)
  const out = asOld(sb, dir, `
    const Pk = require('./packs.cjs'), L = require('./runlog.cjs')
    process.stdout.write(JSON.stringify(Pk.uninstallPack('demo-bakery-pack', L.actorFor('dashboard', 'board'))))
  `)
  assert.deepEqual(out.removed.sort(), ['bakery-lead', 'bread-writer'])
  assert.ok(!fs.existsSync(path.join(sb.agents, 'bakery-lead.md')))
  // 1.1 does not know packs/local/: the copy stays, inert (no agent folder reads it)
  assert.ok(fs.existsSync(path.join(sb.root, 'packs', 'local', 'demo-bakery-pack', '1.0.0')))
})
