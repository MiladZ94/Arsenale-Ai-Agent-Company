/* The test queue (spec 1.1, 4.3): one full test suite at a time on this
 * machine, whatever the repo, so two suites never run side by side and both
 * time out. Targeted tests do not queue.
 *
 *   <data>/test-queue/lock.json            who holds the suite: { schemaVersion,
 *                                          run, agent, repo, pid, startedAt }
 *   <data>/test-queue/waiting/<run>.json   one waiter: { schemaVersion, run,
 *                                          agent, repo, pid, requestedAt }
 *
 * Turns are first come, first served by requestedAt. Every read-change-write
 * of the queue sits under one store.cjs lock, so two waiters never both take
 * the suite. The lock is bound to the pid of the `arsenale testq run` process:
 * when it ends, however it ends (the command finished, Ctrl-C, killed), the
 * next waiter finds the pid gone and takes over. A waiter whose process is
 * gone loses its turn at once and its entry goes after GONE_MS.
 *
 * `arsenale testq run` is the one place Arsenale itself starts a process: the
 * command the caller gave, with the caller's own console, in the caller's
 * process. The dashboard server only reads the queue (status) and never runs
 * anything; a holder that hangs is shown, never killed.
 */
const fs = require('fs')
const path = require('path')
const P = require('./paths.cjs')
const { writeAtomic, withLock, alive } = require('./store.cjs')

const SCHEMA = 1
const DIR = path.join(P.HOME, 'test-queue')
const LOCK = path.join(DIR, 'lock.json')
const WAITING = path.join(DIR, 'waiting')
const GONE_MS = 2 * 60000
const HUNG_MS = 60 * 60000
const LONG_WAIT_MS = 30 * 60000
const POLL_MS = 1000

const cleanId = (s) => String(s || '').replace(/[^\w.:-]/g, '').slice(0, 120)
const fileOf = (run) => path.join(WAITING, cleanId(run).replace(/:/g, '_') + '.json')
const readJson = (f) => { try { return JSON.parse(fs.readFileSync(f, 'utf8')) } catch { return null } }

function waiters() {
  let names = []
  try { names = fs.readdirSync(WAITING) } catch { return [] }
  return names.filter((n) => n.endsWith('.json')).map((n) => Object.assign(readJson(path.join(WAITING, n)) || {}, { file: path.join(WAITING, n) }))
    .filter((w) => w.run).sort((a, b) => String(a.requestedAt).localeCompare(String(b.requestedAt)) || String(a.run).localeCompare(String(b.run)))
}

/** The holder, or null; a holder whose process is gone is no holder. */
function holder() {
  const h = readJson(LOCK)
  return h && h.run && alive(Number(h.pid)) ? h : null
}

/** Joins the queue. A run already waiting keeps its place. */
function enqueue(entry) {
  fs.mkdirSync(WAITING, { recursive: true })
  return withLock(path.join(DIR, 'queue'), () => {
    const f = fileOf(entry.run)
    const cur = readJson(f)
    const rec = cur && cur.run ? Object.assign(cur, { pid: entry.pid }) : { schemaVersion: SCHEMA, run: cleanId(entry.run), agent: String(entry.agent || '').slice(0, 60), repo: String(entry.repo || '').slice(0, 500), pid: entry.pid, requestedAt: new Date().toISOString() }
    writeAtomic(f, JSON.stringify(rec, null, 2))
    return rec
  })
}

/** One try at the suite for `run`: true when it is now ours. Also tidies the
 *  queue: a dead holder's lock goes, gone waiters go after GONE_MS. */
function tryTake(run, pid) {
  fs.mkdirSync(WAITING, { recursive: true })
  return withLock(path.join(DIR, 'queue'), () => {
    const now = Date.now()
    const h = readJson(LOCK)
    if (h && h.run && alive(Number(h.pid))) return false
    if (h) { try { fs.unlinkSync(LOCK) } catch { /* gone */ } }
    let first = null
    for (const w of waiters()) {
      if (alive(Number(w.pid))) { if (!first) first = w; continue }
      const goneAt = Date.parse(w.goneAt)
      if (!Number.isFinite(goneAt)) { w.goneAt = new Date(now).toISOString(); const f = w.file; delete w.file; writeAtomic(f, JSON.stringify(w, null, 2)) }
      else if (now - goneAt >= GONE_MS) { try { fs.unlinkSync(w.file) } catch { /* gone */ } }
    }
    if (!first || first.run !== cleanId(run) || Number(first.pid) !== pid) return false
    writeAtomic(LOCK, JSON.stringify({ schemaVersion: SCHEMA, run: first.run, agent: first.agent, repo: first.repo, pid, startedAt: new Date(now).toISOString() }, null, 2))
    try { fs.unlinkSync(first.file) } catch { /* gone */ }
    return true
  })
}

/** Gives the suite back, only while it is still ours. */
function release(run, pid) {
  try {
    withLock(path.join(DIR, 'queue'), () => {
      const h = readJson(LOCK)
      if (h && h.run === cleanId(run) && Number(h.pid) === pid) fs.unlinkSync(LOCK)
    })
  } catch { /* a dead pid's lock is taken over anyway */ }
}

/** Leaves the queue (a waiter that no longer wants its turn). */
function leave(run) {
  const f = fileOf(run)
  if (!fs.existsSync(f)) return false
  withLock(path.join(DIR, 'queue'), () => { try { fs.unlinkSync(f) } catch { /* gone */ } })
  return true
}

/** Who holds the suite and who waits, for the CLI and the Live page. Read-only. */
function status(now) {
  const t = now || Date.now()
  const h = holder()
  let pos = 1
  const list = waiters().map((w) => {
    const live = alive(Number(w.pid))
    const waitMs = Math.max(0, t - Date.parse(w.requestedAt)) || 0
    return { run: w.run, agent: w.agent || '', repo: w.repo || '', requestedAt: w.requestedAt, position: live ? ++pos : 0, waitMs, gone: !live, long: live && waitMs >= LONG_WAIT_MS }
  })
  return {
    holder: h ? { run: h.run, agent: h.agent || '', repo: h.repo || '', startedAt: h.startedAt, heldMs: Math.max(0, t - Date.parse(h.startedAt)) || 0, hung: t - Date.parse(h.startedAt) >= HUNG_MS } : null,
    waiting: list,
  }
}

/** Whether a run is in the queue now (waiting or holding): its quiet timer stops. */
function inQueue(runId, st) {
  const s = st || status()
  return !!((s.holder && s.holder.run === runId) || s.waiting.some((w) => w.run === runId && !w.gone))
}

/** Spaces and quotes survive cmd.exe only inside double quotes. */
const winQuote = (a) => (/^[\w.:\\/=@+-]+$/.test(a) ? a : '"' + String(a).replace(/"/g, '""') + '"')

/** `arsenale testq run`: waits its turn, runs the command with the caller's
 *  console, gives the suite back, resolves to the command's exit code. */
function run(opts) {
  const { spawn } = require('child_process')
  const L = require('./runlog.cjs')
  const id = cleanId(opts.run)
  const me = process.pid
  const active = L.readActive(id)
  enqueue({ run: id, agent: opts.agent || (active && active.agent) || '', repo: opts.repo ? path.resolve(opts.repo) : process.cwd(), pid: me })
  const say = opts.say || ((s) => process.stderr.write(s + '\n'))
  return new Promise((resolve) => {
    let child = null, done = false, stopped = false
    const finish = (code) => {
      if (done) return
      done = true
      release(id, me)
      try { L.touch(id) } catch { /* not an active run */ }
      resolve(code)
    }
    // Ctrl-C reaches the command too (same console). The suite is given back
    // only when the command has really ended (its 'exit'): on Windows the
    // command is cmd.exe, and killing it alone left the suite running with
    // the lock already free. So the whole tree goes, by its pid only.
    const onSignal = () => {
      if (!child) { leave(id); return finish(130) }
      if (stopped) return
      stopped = true
      if (process.platform === 'win32') {
        try { require('child_process').spawnSync('taskkill', ['/PID', String(child.pid), '/T', '/F'], { windowsHide: true, stdio: 'ignore', timeout: 20000 }) } catch { /* gone */ }
      } else { try { child.kill() } catch { /* gone */ } }
    }
    process.once('SIGINT', onSignal)
    process.once('SIGTERM', onSignal)
    let told = false, ticks = 0
    const step = () => {
      if (done) return
      let mine = false
      try { mine = tryTake(id, me) } catch (e) { if (e.code !== 503) { say('arsenale testq: ' + e.message); return finish(1) } }
      if (!mine) {
        // `testq leave` from another shell: this waiter gives up its turn
        if (!fs.existsSync(fileOf(id))) { say('arsenale testq: left the queue, the command was not run'); return finish(1) }
        // the wait does not count as quiet (spec 1.1, 14.7); refreshed once a minute
        if (ticks++ % 60 === 0) { try { L.touch(id) } catch { /* not an active run */ } }
        if (!told) { const s = status(); const w = s.waiting.find((x) => x.run === id); say('arsenale testq: waiting for the test suite' + (s.holder ? ' (held by ' + (s.holder.agent || s.holder.run) + ')' : '') + (w && w.position ? ', position ' + w.position : '')); told = true }
        return setTimeout(step, POLL_MS)
      }
      try { L.touch(id) } catch { /* not an active run */ }
      const [cmd, ...args] = opts.command
      const win = process.platform === 'win32'
      // npm, npx and other .cmd files run only through cmd.exe on Windows
      try {
        child = win ? spawn([cmd, ...args].map(winQuote).join(' '), { stdio: 'inherit', shell: true, windowsHide: true }) : spawn(cmd, args, { stdio: 'inherit', windowsHide: true })
      } catch (e) { say('arsenale testq: could not start ' + cmd + ': ' + e.message); return finish(1) }
      child.on('error', (e) => { say('arsenale testq: could not start ' + cmd + ': ' + e.message); finish(1) })
      child.on('exit', (code, signal) => finish(stopped ? 130 : code === null ? (signal ? 1 : 0) : code))
    }
    step()
  })
}

module.exports = { DIR, LOCK, WAITING, GONE_MS, HUNG_MS, LONG_WAIT_MS, status, inQueue, enqueue, tryTake, release, leave, run, holder }
