/* A data folder that points at a run log an earlier setup already keeps
 * elsewhere (config.json runsDir, companyDir, pagesDir), and the settings
 * that keep such a log reading the way it always did: project and model
 * aliases, pinned desks. Also the optional "pct" on --progress, and the org
 * chart's usage per person. Every test has its own sandbox; all data is
 * invented. */
const test = require('node:test')
const assert = require('node:assert/strict')
const fs = require('fs')
const path = require('path')
const { makeSandbox, SEED, thisMonth, startServer } = require('./helpers.cjs')
const browser = require('./browser.cjs')

const SKIP = browser.unavailable()

/** A sandbox whose config.json sends the run log, the company and the built
 *  pages to <base>/legacy, with one record there in the oldest shape. */
function legacySandbox(extra) {
  const sb = makeSandbox()
  const legacy = path.join(sb.base, 'legacy')
  fs.mkdirSync(path.join(legacy, 'agent-runs', 'active'), { recursive: true })
  // a record as the first CLI wrote it: no usage, no transcript, no company fields
  fs.writeFileSync(path.join(legacy, 'agent-runs', '2026-01-02T10-00-00-000Z-tester-ab12.json'), JSON.stringify({ agent: 'tester', model: 'sonnet', project: 'Demo Calc (branch)', task: 'old invented task', status: 'ok', summary: 'done', findings: [], files: [], command: '', durationMs: 60000, tokens: 1200, startedAt: '2026-01-02T09:59:00.000Z', finishedAt: '2026-01-02T10:00:00.000Z' }, null, 2))
  fs.writeFileSync(path.join(sb.root, 'config.json'), JSON.stringify(Object.assign({ runsDir: legacy + '/agent-runs', companyDir: legacy + '/company', pagesDir: legacy }, extra || {}), null, 2))
  return Object.assign(sb, { legacy, legacyRuns: path.join(legacy, 'agent-runs') })
}

test('runsDir, companyDir and pagesDir: the CLI writes, and the page reads, the log where it already is', () => {
  const sb = legacySandbox()
  try {
    const P = sb.mod('paths.cjs')
    assert.equal(P.RUNS, sb.legacyRuns)
    assert.equal(P.COMPANY, path.join(sb.legacy, 'company'))
    assert.equal(P.OUT, path.join(sb.legacy, 'agent-dashboard.html'))
    assert.equal(P.HOME, sb.root, 'the data folder itself stays where it was')
    const id = sb.cli('--start', JSON.stringify({ agent: 'implementer', model: 'sonnet', task: 'new invented task' })).out
    assert.match(id, /^\d{4}-\d\d-\d\dT[\w-]+$/)
    assert.ok(fs.existsSync(path.join(sb.legacyRuns, 'active', id + '.json')))
    assert.equal(sb.cli('--progress', JSON.stringify({ id, doing: 'a step', pct: 40 })).out, 'ok')
    const fin = sb.cli(JSON.stringify({ id, agent: 'implementer', task: 'new invented task', status: 'ok' }))
    assert.equal(fin.code, 0, fin.err)
    assert.equal(path.resolve(sb.base, fin.out).startsWith(sb.legacyRuns + path.sep), true, fin.out)
    // nothing was made in the data folder's own agent-runs
    assert.deepEqual(fs.readdirSync(sb.runs).filter((n) => n.endsWith('.json')), [])
    assert.ok(fs.existsSync(path.join(sb.legacy, 'agent-dashboard.html')), 'the built page goes to pagesDir')
    assert.equal(sb.cli('--company-init', '--seed', sb.seed(SEED)).code, 0)
    assert.ok(fs.existsSync(path.join(sb.legacy, 'company', 'company.json')))
    assert.ok(!fs.existsSync(sb.company))
    const state = sb.mod('build-agent-dashboard.cjs').collect()
    const old = state.runs.find((r) => r.task === 'old invented task')
    assert.ok(old, 'the oldest record is read as it is')
    assert.equal(old.tokTotal, 1200)
    const neu = state.runs.find((r) => r.task === 'new invented task')
    assert.equal(neu.steps[0].text, 'a step')
    // the old record was not rewritten
    assert.doesNotMatch(fs.readFileSync(path.join(sb.legacyRuns, '2026-01-02T10-00-00-000Z-tester-ab12.json'), 'utf8'), /projectKey|modelKey/)
  } finally { sb.cleanup() }
})

test('--progress "pct": kept 0-100 and rounded; a step without it, or with no number, keeps the last one', () => {
  const sb = makeSandbox()
  try {
    const id = sb.cli('--start', JSON.stringify({ agent: 'tester', task: 'invented' })).out
    const pct = () => JSON.parse(fs.readFileSync(path.join(sb.runs, 'active', id + '.json'), 'utf8')).pct
    const step = (o) => { const r = sb.cli('--progress', JSON.stringify(Object.assign({ id }, o))); assert.equal(r.code, 0, r.err); assert.equal(r.out, 'ok') }
    assert.equal(pct(), undefined)
    step({ doing: 'read the brief', pct: 10 })
    assert.equal(pct(), 10)
    step({ doing: 'no milestone' })
    assert.equal(pct(), 10)
    step({ doing: 'over', pct: 140 })
    assert.equal(pct(), 100)
    step({ doing: 'below', pct: -5 })
    assert.equal(pct(), 0)
    step({ doing: 'rounded', pct: 39.6 })
    assert.equal(pct(), 40)
    step({ doing: 'text', pct: 'abc' })
    assert.equal(pct(), 40)
    step({ doing: 'as text', pct: '70' })
    assert.equal(pct(), 70)
    const steps = JSON.parse(fs.readFileSync(path.join(sb.runs, 'active', id + '.json'), 'utf8')).steps.map((s) => s.text)
    assert.deepEqual(steps, ['read the brief', 'no milestone', 'over', 'below', 'rounded', 'text', 'as text'])
    // an unknown run still fails as before
    const bad = sb.cli('--progress', JSON.stringify({ id: 'nope', doing: 'x', pct: 10 }))
    assert.equal(bad.code, 1)
    assert.equal(bad.err, 'no run is active with that id')
    // and the finished record keeps it with the rest of the active run's log
    const fin = sb.cli(JSON.stringify({ id, agent: 'tester', task: 'invented', status: 'ok' }))
    assert.equal(fin.code, 0, fin.err)
  } finally { sb.cleanup() }
})

test('projectAliases and modelAliases: older spellings group as one project and one model; a bad pattern is skipped', () => {
  const sb = makeSandbox({ prices: { 'Opus 5.5': { input: 4, output: 20, cacheRead: 0.2, cacheWrite5m: 5, cacheWrite1h: 8 } } })
  try {
    fs.writeFileSync(path.join(sb.root, 'config.json'), JSON.stringify({
      projectAliases: [{ match: '(', project: 'broken' }, { match: 'board|tooling', project: 'internal-tools' }, { match: 'x' }],
      modelAliases: { Opus: 'Opus 5.5', Sonnet: 42 },
    }))
    sb.run({ project: 'Agent board (v2)', model: 'opus', task: 'a' })
    sb.run({ project: 'tooling', model: 'claude-opus-5-5', task: 'b' })
    sb.run({ project: 'Demo Calc (branch)', model: 'sonnet', task: 'c' })
    // a transcript counted by a build without the alias stored the bare family
    sb.measured('tester', 'board', 1000000, { model: 'Opus', task: 'd' })
    const B = sb.mod('build-agent-dashboard.cjs')
    const by = (t) => B.collect().runs.find((r) => r.task === t)
    assert.equal(by('a').projectKey, 'internal-tools')
    assert.equal(by('b').projectKey, 'internal-tools')
    assert.equal(by('c').projectKey, 'Demo Calc', 'no alias: as before')
    assert.equal(by('a').modelKey, 'Opus 5.5')
    assert.equal(by('b').modelKey, 'Opus 5.5')
    assert.equal(by('c').modelKey, 'Sonnet', 'an alias that is not text is ignored')
    assert.equal(B.modelKey('opus'), 'Opus 5.5')
    // the bare family now prices with the version it meant
    assert.equal(by('d').costUsd, 4)
  } finally { sb.cleanup() }
})

test('config "unmappedRuns": a run no project claims goes to the home office of its member, or to Unassigned work', () => {
  const sb = makeSandbox()
  try {
    assert.equal(sb.cli('--company-init', '--seed', sb.seed(SEED)).code, 0)
    // today's runs: those are the ones the office floors show
    const now = new Date().toISOString()
    sb.run({ agent: 'tester', project: 'nobody claims this', task: 'u', startedAt: now, finishedAt: now })
    sb.run({ agent: 'tester', project: 'Demo Calc', task: 'm', startedAt: now, finishedAt: now })
    const office = (t) => sb.mod('build-agent-dashboard.cjs').collect().runs.find((r) => r.task === t).officeId
    assert.equal(office('u'), 'engineering', 'default: the home office')
    fs.writeFileSync(path.join(sb.root, 'config.json'), JSON.stringify({ unmappedRuns: 'unassigned' }))
    assert.equal(office('u'), 'unassigned')
    assert.equal(office('m'), 'engineering', 'a claimed project still decides')
  } finally { sb.cleanup() }
})

test('config "desks": a pinned agent keeps its desk, a bad or double pin is ignored, no desk is given twice', () => {
  const sb = makeSandbox()
  try {
    const { homeDesks } = sb.mod('agent-office-page.cjs')
    const agents = ['implementer', 'tester', 'code-reviewer', 'ui-designer', 'release-builder', 'docs-writer', 'spec-writer'].map((name) => ({ name }))
    const pins = { tester: ['build', 3], 'release-builder': ['build', 3], 'docs-writer': ['nowhere', 0], 'spec-writer': ['design', 9], 'code-reviewer': ['review', 5], ghost: ['build', 0] }
    const r = homeDesks(agents, pins)
    assert.deepEqual(r.seats['release-builder'], ['build', 3])
    assert.deepEqual(r.seats['code-reviewer'], ['review', 5])
    // tester's pin was taken by release-builder (pins are placed in name order): placed as usual
    assert.notDeepEqual(r.seats.tester, ['build', 3])
    assert.equal(r.seats.tester[0], 'build')
    assert.equal(r.zones['docs-writer'], 'docs')
    assert.equal(r.seats['spec-writer'][0], 'design')
    assert.equal(r.seats.ghost, undefined, 'a pin for an agent that does not exist places nobody')
    const used = Object.values(r.seats).map((s) => s.join(':'))
    assert.equal(new Set(used).size, used.length)
    // without pins, the same as before
    assert.deepEqual(homeDesks(agents).seats, homeDesks(agents, {}).seats)
    assert.deepEqual(homeDesks(agents).seats.implementer, ['build', 0])
    // the state carries the cleaned pins to the page
    fs.writeFileSync(path.join(sb.root, 'config.json'), JSON.stringify({ desks: { tester: ['build', 3], 'bad name/..': ['build', 1], implementer: ['build', 'x'] } }))
    assert.deepEqual(sb.mod('build-agent-dashboard.cjs').collect().desks, { tester: ['build', 3] })
  } finally { sb.cleanup() }
})

test('the org chart shows each person\'s model and this month\'s tokens, and the office\'s total', { skip: SKIP || false }, async (t) => {
  const sb = makeSandbox()
  assert.equal(sb.cli('--company-init', '--seed', sb.seed(SEED)).code, 0)
  sb.measured('tester', 'Demo Calc', 250000, { finishedAt: thisMonth(3) })
  const { port, child, url: keyUrl } = await startServer(sb)
  const page = await browser.launch()
  t.after(async () => { await page.close(); child.kill(); sb.cleanup() })
  await page.goto(keyUrl)
  await page.goto('http://127.0.0.1:' + port + '/?v=' + Date.now() + '#/org')
  await page.waitFor("!!document.querySelector('.org .ocol')")
  const row = await page.eval("(document.querySelector('.opr .opb[data-arg=tester]') || {}).parentElement.textContent")
  assert.match(row, /Sonnet/)
  assert.match(row, /250k tok|0\.25M tok|250K tok/i)
  const head = await page.eval("[...document.querySelectorAll('.org .ocol')].map((c) => c.querySelector('.ocolh').textContent).join('|')")
  assert.match(head, /Engineering.*tok/)
  assert.match(await page.eval("(document.querySelector('.org .oft') || {}).textContent || ''"), /Budgets are off: tokens this month only|Bar = this month/)
})
