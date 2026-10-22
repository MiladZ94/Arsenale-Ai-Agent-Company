/* Packs: format limits (24 members, known zones), the core team as a pack,
 * the nine development packs, and that nothing shipped in packs/ carries
 * non-ASCII text or private data. Run: npm test */
const test = require('node:test')
const assert = require('node:assert/strict')
const fs = require('fs')
const path = require('path')
const { makeSandbox } = require('./helpers.cjs')

const REPO = path.join(__dirname, '..', '..')
const PACKS = path.join(REPO, 'packs')
const NEW = ['autonomous-dev', 'verification', 'security', 'release', 'docs', 'data-integrity', 'devops', 'domain-engineering', 'legal-compliance']
const MODELS = ['haiku', 'sonnet', 'opus']
// strong models only where a wrong answer costs most: stored data and security
const STRONG_OK = new Set(['security', 'data-integrity'])

const frontmatter = (text) => Object.fromEntries(/^---\r?\n([\s\S]*?)\r?\n---/.exec(text)[1].split(/\r?\n/).map((l) => [l.slice(0, l.indexOf(':')), l.slice(l.indexOf(':') + 1).trim()]))
const readJson = (...p) => JSON.parse(fs.readFileSync(path.join(...p), 'utf8'))

test('every pack folder: schema, at most 24 members, known zones, model field', (t) => {
  const sb = makeSandbox({ packs: true })
  t.after(() => sb.cleanup())
  const Pk = sb.mod('packs.cjs')
  for (const id of fs.readdirSync(PACKS).filter((n) => fs.statSync(path.join(PACKS, n)).isDirectory())) {
    const p = Pk.readPack(path.join(PACKS, id)) // throws with the reason
    assert.equal(p.id, id)
    assert.ok(p.members.length >= 1 && p.members.length <= 24, id)
    for (const m of p.members) {
      assert.ok(Pk.ZONES.includes(m.zone), id + '/' + m.id + ' zone ' + m.zone)
      const fm = frontmatter(fs.readFileSync(m.file, 'utf8'))
      assert.equal(fm.name, m.id)
      assert.ok(MODELS.includes(fm.model), id + '/' + m.id + ' model ' + fm.model)
      assert.ok(fm.description.length > 10, m.id)
    }
  }
  assert.ok(Pk.bundled().length >= 17)
})

test('a pack with 25 members or an unknown zone is refused', (t) => {
  const sb = makeSandbox({ packs: true })
  t.after(() => sb.cleanup())
  const Pk = sb.mod('packs.cjs')
  const bad = path.join(sb.root, 'packs', 'too-big')
  fs.cpSync(path.join(PACKS, 'core-team'), bad, { recursive: true })
  const j = readJson(bad, 'pack.json')
  j.id = 'too-big'
  j.members.push({ id: 'seo-specialist', core: true, zone: 'design', title: 'SEO', tier: 'standard' })
  fs.writeFileSync(path.join(bad, 'pack.json'), JSON.stringify(j))
  assert.throws(() => Pk.readPack(bad), /1 to 24 members/)
  j.members.pop()
  j.members[0].zone = 'basement'
  fs.writeFileSync(path.join(bad, 'pack.json'), JSON.stringify(j))
  assert.throws(() => Pk.readPack(bad), /bad zone/)
})

test('the nine new packs: short English members, strong models only for data or security', () => {
  for (const id of NEW) {
    const j = readJson(PACKS, id, 'pack.json')
    assert.ok(j.members.some((m) => m.id === j.office.lead && !m.ref), id + ' lead is its own member')
    assert.ok(j.sampleTasks.length >= 2 && j.sampleTasks.length <= 5, id + ' sample tasks')
    for (const m of j.members.filter((x) => !x.ref)) {
      const text = fs.readFileSync(path.join(PACKS, id, 'agents', m.id + '.md'), 'utf8')
      const fm = frontmatter(text)
      assert.ok(text.split('\n').length <= 45, m.id + ' is short')
      if (fm.model === 'opus') assert.ok(STRONG_OK.has(id), m.id + ' uses a strong model outside data/security')
      assert.ok(['light', 'standard', 'heavy'].includes(m.tier))
    }
  }
  // the gates of an autonomous run are each provided by some pack
  const names = (id) => readJson(PACKS, id, 'pack.json').members.map((m) => m.id)
  assert.ok(names('verification').includes('finding-verifier') && names('verification').includes('visual-qa'))
  assert.ok(names('security').includes('security-reviewer') && names('data-integrity').includes('data-migration'))
  assert.ok(names('release').includes('release-manager'))
})

test('core-team: the 24 core agents, read from agents/, not copied into the pack', () => {
  const j = readJson(PACKS, 'core-team', 'pack.json')
  assert.equal(j.members.length, 24)
  assert.ok(!fs.existsSync(path.join(PACKS, 'core-team', 'agents')))
  for (const m of j.members) {
    assert.equal(m.core, true)
    const text = fs.readFileSync(path.join(REPO, 'agents', m.id + '.md'), 'utf8')
    assert.equal(frontmatter(text).zone, m.zone, m.id + ' zone matches its definition')
  }
  const inCore = new Set(j.members.map((m) => m.id))
  for (const f of fs.readdirSync(path.join(REPO, 'agents'))) {
    if (!f.endsWith('.md') || /^(AGENT-RULES|PROJECT|REVIEW|WORKFLOW)/.test(f)) continue
    if (f === 'seo-specialist.md') continue // ships in content-marketing; a pack holds 24 at most
    assert.ok(inCore.has(f.slice(0, -3)), f + ' is missing from core-team')
  }
})

test('install: core-team copies the missing core agents, a pack with references copies only its own', (t) => {
  const sb = makeSandbox({ packs: true })
  t.after(() => sb.cleanup())
  const Pk = sb.mod('packs.cjs')
  const before = new Set(fs.readdirSync(sb.agents))
  const copied = Pk.copyFiles(Pk.bundledPack('core-team'), 'keep')
  const ids = copied.files.map((f) => f.id)
  assert.ok(ids.includes('office-lead') && ids.includes('spec-writer'))
  assert.ok(!ids.some((x) => before.has(x + '.md')), 'an agent that existed was not copied again')
  assert.ok(fs.existsSync(path.join(sb.agents, 'spec-writer.md')))
  Pk.undoCopy(copied)
  assert.ok(!fs.existsSync(path.join(sb.agents, 'spec-writer.md')))
  const v = Pk.copyFiles(Pk.bundledPack('verification'), 'keep')
  assert.deepEqual(v.files.map((f) => f.id).sort(), ['evidence-collector', 'flaky-test-triager', 'regression-guard', 'verification-lead'])
  assert.ok(!fs.existsSync(path.join(sb.agents, 'visual-qa.md')), 'visual-qa is used by reference')
})

test('nothing shipped in packs/<id>/ has non-ASCII text, an address or private data', () => {
  for (const f of fs.readdirSync(PACKS, { recursive: true })) {
    const full = path.join(PACKS, f)
    if (!f.includes(path.sep) || fs.statSync(full).isDirectory()) continue // packs/README.md is documentation
    const text = fs.readFileSync(full, 'utf8')
    assert.doesNotMatch(text, /[^\x00-\x7F]/, f + ' has non-ASCII text')
    assert.doesNotMatch(text, /micoperi|padeye|emad|barandan|C:\\Users/i, f + ' names private data')
    for (const email of text.match(/[\w.+-]+@[\w-]+(\.[\w-]+)+/g) || []) assert.match(email, /@example\./, f)
  }
})

test('packs are shipped: package files list packs/ and agents/', () => {
  const files = readJson(REPO, 'package.json').files
  assert.ok(files.includes('packs/') && files.includes('agents/'))
})

test('pack members get the zone their definition names, the company file knows every zone', (t) => {
  const sb = makeSandbox({ packs: true })
  t.after(() => sb.cleanup())
  const Pk = sb.mod('packs.cjs')
  const p = Pk.bundledPack('verification')
  const emps = Pk.employeesOf(p, { rename: {}, kept: [] })
  const zones = Object.values(emps).map((e) => e.zone)
  assert.ok(zones.includes('verify'), 'a verify zone is kept, not blanked')
  assert.ok(zones.every((z) => z !== ''), 'every member has a zone')
  const C = sb.mod('agent-company.cjs')
  for (const z of Pk.ZONES) assert.ok(C.ZONES.includes(z), 'the company file knows zone ' + z)
})
