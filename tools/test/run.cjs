/* `npm test`: every *.test.cjs in this folder, listed by name. Node 20 cannot
 * take a glob after --test, and given the folder it would also run the
 * helpers here as test files. */
const fs = require('fs')
const path = require('path')
const { spawnSync } = require('child_process')

const files = fs.readdirSync(__dirname).filter((f) => f.endsWith('.test.cjs')).sort().map((f) => path.join(__dirname, f))
// A test that hangs fails after five minutes instead of holding the whole run.
// Files run side by side; the browser files are heavy (a Chrome, a 3D page),
// so not one per core. TEST_CONCURRENCY overrides.
const concurrency = process.env.TEST_CONCURRENCY || String(Math.max(2, Math.min(7, Math.floor(require('os').availableParallelism() / 2))))
const r = spawnSync(process.execPath, ['--test', '--test-timeout=300000', '--test-concurrency=' + concurrency, ...files], { stdio: 'inherit' })
process.exit(r.status === null ? 1 : r.status)
