/* The test tiers (spec autonomous-mode 16, rule 3):
 *   npm test          fast: every *.test.cjs that does not drive a browser
 *   npm run test:ui   ui: the files that use ./browser.cjs (a headless Chrome
 *                     each), at most two files at once, so at most two Chromes
 *   npm run test:all  both, fast first; fails when either fails
 * Files are listed by name: Node 20 cannot take a glob after --test, and given
 * the folder it would also run the helpers here as test files. */
const fs = require('fs')
const path = require('path')
const { spawnSync } = require('child_process')

const tier = process.argv[2] || 'fast'
if (!['fast', 'ui', 'all'].includes(tier)) { console.error('usage: node tools/test/run.cjs [fast|ui|all]'); process.exit(1) }
const all = fs.readdirSync(__dirname).filter((f) => f.endsWith('.test.cjs')).sort()
// a file is in the ui tier when it loads the browser helper
const usesBrowser = (f) => /require\(['"]\.\/browser\.cjs['"]\)/.test(fs.readFileSync(path.join(__dirname, f), 'utf8'))
const UI = all.filter(usesBrowser)
// the longest files start first, so the run does not wait on one at the end
const LONGEST = ['install.test.cjs', 'mcp.test.cjs', 'autonomous.test.cjs', 'company-data.test.cjs']
const rank = (f) => (LONGEST.includes(f) ? LONGEST.indexOf(f) : LONGEST.length)
const FAST = all.filter((f) => !UI.includes(f)).sort((a, b) => rank(a) - rank(b))

// A test that hangs fails after five minutes instead of holding the whole run.
// Fast files run side by side, one per two cores; TEST_CONCURRENCY overrides.
function run(files, concurrency) {
  if (!files.length) return 0
  // on GitHub Actions the failures are annotations too (annotate.cjs)
  const report = process.env.GITHUB_ACTIONS ? ['--test-reporter=spec', '--test-reporter-destination=stdout', '--test-reporter=' + require('url').pathToFileURL(path.join(__dirname, 'annotate.cjs')).href, '--test-reporter-destination=stdout'] : []
  const r = spawnSync(process.execPath, ['--test', '--test-timeout=300000', '--test-concurrency=' + concurrency, ...report, ...files.map((f) => path.join(__dirname, f))], { stdio: 'inherit' })
  return r.status === null ? 1 : r.status
}
const fastN = process.env.TEST_CONCURRENCY || String(Math.max(2, Math.min(7, Math.floor(require('os').availableParallelism() / 2))))
let status = 0
if (tier !== 'ui') status = run(FAST, fastN) || status
if (tier !== 'fast') status = run(UI, '2') || status
process.exit(status)
