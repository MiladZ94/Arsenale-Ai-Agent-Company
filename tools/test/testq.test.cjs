/* The test queue (spec 1.1, 4.3; acceptance tests 14, 15, 16): one full
 * suite at a time, first come first served, the lock released when its
 * holder dies, the command's exit code passed on. The "suites" are small
 * invented node scripts. */
const test = require('node:test')
const assert = require('node:assert/strict')
const fs = require('fs')
const path = require('path')
const { spawn } = require('child_process')
const { makeSandbox, track, exitOf } = require('./helpers.cjs')

const box = (t) => { const sb = makeSandbox({ flat: true }); t.after(() => sb.cleanup()); return sb }
const sleep = (ms) => new Promise((r) => setTimeout(r, ms))

// a fake suite: logs its start and end, waits, exits with the given code
const SUITE = `const fs = require('fs')
const [log, name, ms, code] = process.argv.slice(2)
fs.appendFileSync(log, 'start ' + name + ' ' + process.pid + '\\n')
setTimeout(() => { fs.appendFileSync(log, 'end ' + name + '\\n'); process.exit(Number(code)) }, Number(ms))
`

function queued(sb, run, ms, code) {
  const script = path.join(sb.base, 'suite.js')
  if (!fs.existsSync(script)) fs.writeFileSync(script, SUITE)
  const log = path.join(sb.base, 'suite.log')
  const child = track(spawn(process.execPath, [path.join(sb.tools, 'log-agent-run.cjs'), '--testq', 'run', '--run', run, '--repo', sb.base, '--', process.execPath, script, log, run, String(ms), String(code || 0)], { env: sb.env, cwd: sb.base, stdio: ['ignore', 'ignore', 'pipe'], windowsHide: true }))
  child.done = exitOf(child)
  return child
}
const status = (sb) => JSON.parse(sb.cli('--testq', 'status', '--json').out)
async function until(fn, ms, what) {
  const end = Date.now() + (ms || 20000)
  for (;;) {
    const v = fn()
    if (v) return v
    if (Date.now() > end) throw new Error('timed out waiting for ' + what)
    await sleep(200)
  }
}
const lines = (sb) => { try { return fs.readFileSync(path.join(sb.base, 'suite.log'), 'utf8').split('\n').filter(Boolean) } catch { return [] } }

test('AT14 queue order: A runs, B and C wait at positions 2 and 3, then B, then C; never two at once', async (t) => {
  const sb = box(t)
  const a = queued(sb, 'run-A', 7000)
  await until(() => { const s = status(sb); return s.holder && s.holder.run === 'run-A' }, 20000, 'A to hold')
  const b = queued(sb, 'run-B', 800)
  await until(() => status(sb).waiting.some((w) => w.run === 'run-B'), 20000, 'B to wait')
  const c = queued(sb, 'run-C', 800)
  await until(() => status(sb).waiting.some((w) => w.run === 'run-C'), 20000, 'C to wait')
  const s = status(sb)
  assert.equal(s.holder.run, 'run-A')
  assert.equal(s.holder.repo, sb.base)
  assert.deepEqual(s.waiting.map((w) => [w.run, w.position]), [['run-B', 2], ['run-C', 3]])
  assert.deepEqual(await Promise.all([a.done, b.done, c.done]), [0, 0, 0])
  const log = lines(sb).map((l) => l.split(' ').slice(0, 2).join(' '))
  assert.deepEqual(log, ['start run-A', 'end run-A', 'start run-B', 'end run-B', 'start run-C', 'end run-C'])
  const after = status(sb)
  assert.equal(after.holder, null)
  assert.equal(after.waiting.length, 0)
  assert.equal(sb.cli('--testq', 'status').out, 'Nobody is testing.')
})

test('AT15 queue crash: the holder is killed, the next waiter runs within 30 s', async (t) => {
  const sb = box(t)
  const a = queued(sb, 'run-K', 60000)
  await until(() => lines(sb).some((l) => l.startsWith('start run-K')), 20000, 'K to start')
  // the suite K started keeps running on its own when its queue process dies: stop it at the end
  const orphan = Number(lines(sb).find((l) => l.startsWith('start run-K')).split(' ')[2])
  const stopOrphan = async () => { try { process.kill(orphan) } catch { /* gone */ } await sleep(300) }
  try {
    const b = queued(sb, 'run-N', 300)
    await until(() => status(sb).waiting.some((w) => w.run === 'run-N'), 20000, 'N to wait')
    a.kill()
    const killedAt = Date.now()
    assert.equal(await b.done, 0)
    assert.ok(lines(sb).some((l) => l.startsWith('end run-N')))
    assert.ok(Date.now() - killedAt < 30000)
  } finally { await stopOrphan() }
})

test('AT16 exit code: a command that exits 3 makes testq run exit 3; leave removes a waiter', async (t) => {
  const sb = box(t)
  assert.equal(await queued(sb, 'run-E', 100, 3).done, 3)
  assert.equal(status(sb).holder, null, 'the lock is given back after a failing suite too')
  const a = queued(sb, 'run-H', 4000)
  await until(() => status(sb).holder, 20000, 'H to hold')
  const w = queued(sb, 'run-W', 100)
  await until(() => status(sb).waiting.some((x) => x.run === 'run-W'), 20000, 'W to wait')
  assert.equal(sb.cli('--testq', 'leave', '--run', 'run-W').out, 'left the queue')
  assert.equal(status(sb).waiting.length, 0)
  assert.equal(await w.done, 1, 'the waiter gives up without running its command')
  assert.ok(!lines(sb).some((l) => l.startsWith('start run-W')))
  assert.equal(await a.done, 0)
  assert.equal(sb.cli('--testq', 'run', '--run', 'x').code, 1, 'no command: usage')
})
