/* The page builders' golden output: the dashboard pages rendered from a frozen
 * state, as SHA-256 hashes. A refactor of the builders (how the source is split
 * into modules) must leave every hash as it was; a deliberate change to a page
 * regenerates them:
 *   node tools/test/page-golden.cjs --state   (rebuild fixtures/page-state.json from the invented company; slow)
 *   node tools/test/page-golden.cjs --hash    (rebuild fixtures/page-golden.json from that state)
 *   node tools/test/page-golden.cjs --dump <dir>   (write the HTML itself, to diff two versions) */
const fs = require('fs')
const os = require('os')
const path = require('path')
const crypto = require('crypto')

const FIX = path.join(__dirname, 'fixtures')
const STATE = path.join(FIX, 'page-state.json')
const GOLDEN = path.join(FIX, 'page-golden.json')

/** The pages, as [name, html]. An empty home folder keeps the machine's own
 *  characters and settings out of the pages. */
function render() {
  process.env.ARSENALE_HOME = fs.mkdtempSync(path.join(os.tmpdir(), 'page-golden-'))
  delete process.env.ARSENALE_AGENT_DIRS
  delete process.env.ARSENALE_TRANSCRIPT_ROOTS
  const B = require('../build-agent-dashboard.cjs')
  const { state, company } = JSON.parse(fs.readFileSync(STATE, 'utf8'))
  const bare = Object.assign({}, state, { active: [], gates: [] })
  return [
    ['office-company', B.renderPage(state, { company })],
    ['office-company-live', B.renderPage(state, { live: true, token: 'test-token', company })],
    ['office-plain', B.renderPage(state, { company: { configured: false } })],
    ['office-plain-live', B.renderPage(bare, { live: true, token: '', company: { configured: false } })],
    ['archive', B.renderArchive(state)],
    ['archive-live', B.renderArchive(state, { live: true })],
  ]
}

const sha = (s) => crypto.createHash('sha256').update(s).digest('hex')

if (require.main === module) {
  const arg = process.argv[2]
  if (arg === '--state') {
    const { fixture } = require('./language-fixture.cjs')
    const sb = fixture()
    const code = "const B=require('./build-agent-dashboard.cjs');const s=B.collect();s.builtAt='2026-01-01T00:00:00.000Z';process.stdout.write(JSON.stringify({state:s,company:B.companyOf(s)}))"
    const r = require('child_process').spawnSync(process.execPath, ['-e', code], { cwd: sb.tools, env: sb.env, encoding: 'utf8', maxBuffer: 1 << 28 })
    if (r.status !== 0) throw new Error(r.stderr)
    const text = r.stdout.split(sb.root).join('<ROOT>').split(JSON.stringify(sb.root).slice(1, -1)).join('<ROOT>')
    fs.writeFileSync(STATE, JSON.stringify(JSON.parse(text), null, 1))
    sb.cleanup()
  } else if (arg === '--hash') {
    const g = {}
    for (const [n, html] of render()) g[n] = { sha256: sha(html), length: html.length }
    fs.writeFileSync(GOLDEN, JSON.stringify(g, null, 2) + '\n')
  } else if (arg === '--dump') {
    fs.mkdirSync(process.argv[3], { recursive: true })
    for (const [n, html] of render()) fs.writeFileSync(path.join(process.argv[3], n + '.html'), html)
  }
}

module.exports = { render, sha, GOLDEN }
