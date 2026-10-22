/* Safe writes for the data folder: every record and company file goes through
 * here.
 *
 *   writeAtomic(file, text)   a temporary file next to it, flushed, then a
 *                             rename: a reader (the dashboard polls every
 *                             1.5 s) sees the old file or the new one, never
 *                             half of one
 *   withLock(file, fn)        fn() while holding <file>.lock: two writers that
 *                             read, change and write the same file in parallel
 *                             (agents in an autonomous run) lose no update
 *   withLockAsync(files, fn)  the same for the dashboard server: it waits with
 *                             timers, so one held lock never stops the server
 *                             answering everyone else
 *   cleanStray(dirs)          temp and lock files a crashed writer left behind
 *
 * A lock whose owner process is alive on this machine is never taken: fn() is
 * synchronous, so nothing can refresh a lock while it runs, and a time limit
 * alone broke into a slow writer that was still writing. Only a lock older
 * than LOCK_OLD_MS is taken from a live PID (one reused by an unrelated
 * process must not block forever), and that is logged. A lock whose PID is
 * gone is taken at once. Nothing here starts a process; process.kill(pid, 0)
 * only asks whether a PID lives.
 */
const fs = require('fs')
const os = require('os')
const path = require('path')
const crypto = require('crypto')

// a waiter gives up a little after a dead writer's lock would be taken, never before
const LOCK_WAIT_MS = 35000
const LOCK_OLD_MS = 10 * 60000
// a lock folder with no owner inside: left by a crash halfway through
// breakLock, or by an older Arsenale that made its lock in two steps
const LOCK_EMPTY_MS = 2000
// cleanStray leaves anything younger alone, whatever its PID says
const STRAY_MIN_MS = 60000
const RENAME_WAIT_MS = 5000

// how long a caller is kept waiting; the dashboard server shortens both (configure)
const waits = { sync: LOCK_WAIT_MS, async: LOCK_WAIT_MS }
function configure(o) {
  if (o && Number.isFinite(o.syncWaitMs)) waits.sync = o.syncWaitMs
  if (o && Number.isFinite(o.asyncWaitMs)) waits.async = o.asyncWaitMs
}

const pause = new Int32Array(new SharedArrayBuffer(4))
const sleep = (ms) => Atomics.wait(pause, 0, 0, ms)
const later = (ms) => new Promise((r) => setTimeout(r, ms))
const backoff = (n) => 1 + Math.min(20, n) + Math.floor(Math.random() * 3)

function alive(pid) {
  if (!Number.isInteger(pid) || pid <= 0) return false
  try { process.kill(pid, 0); return true } catch (e) { return e.code === 'EPERM' }
}

/** Windows refuses a rename onto a file another process has open for a
 *  moment (a reader, a virus scanner): EPERM, EACCES or EBUSY. That passes. */
function renameRetry(from, to) {
  const until = Date.now() + RENAME_WAIT_MS
  for (let n = 0; ; n++) {
    try { return fs.renameSync(from, to) } catch (e) {
      if (Date.now() > until || !['EPERM', 'EACCES', 'EBUSY'].includes(e.code)) throw e
      sleep(Math.min(50, 2 + n * 2) + Math.floor(Math.random() * 5))
    }
  }
}

/** opts.mode: the mode of the new file (POSIX); the temp file is made with
 *  it, so a secret is never readable by others even for the moment before
 *  the rename. */
function writeAtomic(file, text, opts) {
  const tmp = file + '.' + process.pid + '-' + crypto.randomBytes(3).toString('hex') + '.tmp'
  try {
    const fd = fs.openSync(tmp, 'w', opts && opts.mode)
    try {
      fs.writeFileSync(fd, text)
      // without it a power cut soon after the rename can leave an empty file
      // where the old one was; some Windows volumes refuse it
      try { fs.fsyncSync(fd) } catch { /* best effort */ }
    } finally { fs.closeSync(fd) }
    renameRetry(tmp, file)
  } catch (e) {
    try { fs.unlinkSync(tmp) } catch { /* never made, or already renamed */ }
    throw e
  }
}

// The lock is a folder (on Windows a folder costs about 1 ms, where a lock
// file with content costs 15 to 40 ms of virus scanning), holding one empty
// folder named <pid>-<token>: who owns it. The token starts with a tag of this
// machine, so a PID from another machine sharing the folder is never looked
// up here. Both folders are made under a temporary name and renamed into
// place in one step: the rename fails while <file>.lock exists, so a lock is
// never seen without its owner, and two owners never share one.
const HOST = crypto.createHash('sha1').update(os.hostname()).digest('hex').slice(0, 8)
const OWNER = /^(\d+)-([0-9a-f]+)$/
const newOwner = () => process.pid + '-' + HOST + crypto.randomBytes(6).toString('hex')
// an older Arsenale wrote a 12-character token without the tag: its PID is local
const localToken = (token) => token.length !== 20 || token.startsWith(HOST)

function readLock(lock) {
  let names
  try { names = fs.readdirSync(lock) } catch { return null }
  const m = names.length === 1 && OWNER.exec(names[0])
  try {
    const st = fs.statSync(m ? path.join(lock, names[0]) : lock)
    return { owner: m ? names[0] : '', pid: m ? Number(m[1]) : 0, local: m ? localToken(m[2]) : true, age: Date.now() - st.mtimeMs }
  } catch { return null }
}

/** Stale: its owner process is gone, or it is older than LOCK_OLD_MS; a lock
 *  with no owner is stale after LOCK_EMPTY_MS. */
function stale(info, lock) {
  if (!info) return false
  if (!info.owner) return info.age > LOCK_EMPTY_MS
  if (info.local && !alive(info.pid)) return true
  if (info.age <= LOCK_OLD_MS) return false
  process.stderr.write('arsenale: taking over ' + path.basename(lock) + ', held ' + Math.round(info.age / 60000) + ' min by ' + (info.local ? 'live process ' : 'a process on another machine, PID ') + info.pid + '\n')
  return true
}

/** Takes a stale lock away. Two processes may try at once: only the one that
 *  removes the owner folder goes on to remove the lock. */
function breakLock(lock, info) {
  try {
    if (info.owner) fs.rmdirSync(path.join(lock, info.owner))
    fs.rmdirSync(lock)
  } catch { /* someone else took it over first */ }
}

/** One try at the lock: true when it is ours. Throws only when the folder of
 *  the file is not there (the caller's mistake, never worth waiting for). */
function tryLock(lock, me) {
  const tmp = lock + '.' + me + '.tmp'
  try {
    fs.mkdirSync(tmp)
    fs.mkdirSync(path.join(tmp, me))
    fs.renameSync(tmp, lock)
  } catch (e) {
    try { fs.rmSync(tmp, { recursive: true, force: true }) } catch { /* never made */ }
    if (e.code === 'ENOENT' && !fs.existsSync(path.dirname(lock))) throw e
    // a read-only folder stays read-only: waiting would only turn that into
    // "busy" after LOCK_WAIT_MS. Not EACCES on Windows, which also reports a
    // lock folder being removed or scanned with it.
    if (e.code === 'EROFS' || (e.code === 'EACCES' && process.platform !== 'win32')) throw e
    // EEXIST, ENOTEMPTY (POSIX) or EPERM (Windows): the lock is there; EPERM,
    // EACCES, EBUSY: a lock folder being removed or scanned; ENOENT: our
    // temp folder was taken away. All pass, so the caller tries again.
    if (['EEXIST', 'ENOTEMPTY', 'EPERM', 'EACCES', 'EBUSY', 'ENOENT'].includes(e.code)) return false
    throw e
  }
  // POSIX lets a rename replace an EMPTY folder, such as an older Arsenale's
  // lock between its two mkdirs: ours only when we are the one owner inside.
  let names = []
  try { names = fs.readdirSync(lock) } catch { /* taken away already */ }
  if (names.length === 1 && names[0] === me) return true
  try { fs.rmdirSync(path.join(lock, me)) } catch { /* not there */ }
  return false
}

function release(lock, me) {
  // only while it is still ours: a lock held past LOCK_OLD_MS may have been taken over
  try { fs.rmdirSync(path.join(lock, me)); fs.rmdirSync(lock) } catch { /* taken over */ }
}

/** A stale lock is taken away; true when the caller may try again at once. */
function clearStale(lock) {
  const info = readLock(lock)
  if (!stale(info, lock)) return false
  breakLock(lock, info)
  return !fs.existsSync(lock)
}

const busy = (file) => { const err = new Error('busy: ' + path.basename(file) + ' is being changed by another process, try again'); err.code = 503; return err }

// The locks this process holds now, by full path. fn() is synchronous, so a
// lock asked for again inside it (withLockAsync around a function that locks
// the same file itself) can only come from the holder, and simply runs.
const held = new Map()

/** Runs fn() holding the lock of `file`. Throws (code 503) when the lock stays
 *  held too long. For the command line: the wait blocks the thread. */
function withLock(file, fn) {
  const key = path.resolve(file)
  if (held.has(key)) return fn()
  const lock = key + '.lock'
  const me = newOwner()
  const until = Date.now() + waits.sync
  for (let n = 0; !tryLock(lock, me); n++) {
    if (clearStale(lock)) continue
    if (Date.now() > until) throw busy(file)
    sleep(backoff(n))
  }
  held.set(key, me)
  try { return fn() } finally { held.delete(key); release(lock, me) }
}

/** Runs fn() (synchronous) holding the locks of all `files`, waiting with
 *  timers. All or none: a busy lock lets go of the ones already taken, so two
 *  callers that need the same files never wait on each other. Rejects (code
 *  503) after `waitMs`, by default the asyncWaitMs of configure(). */
async function withLockAsync(files, fn, waitMs) {
  const keys = [...new Set((Array.isArray(files) ? files : [files]).filter(Boolean).map((f) => path.resolve(f)))].filter((k) => !held.has(k)).sort()
  const until = Date.now() + (Number.isFinite(waitMs) ? waitMs : waits.async)
  for (let n = 0; ; n++) {
    const got = []
    let missed = ''
    for (const k of keys) {
      const me = newOwner()
      if (tryLock(k + '.lock', me)) got.push([k, me])
      else { missed = k; break }
    }
    if (!missed) {
      for (const [k, me] of got) held.set(k, me)
      try { return fn() } finally {
        for (const [k, me] of got.reverse()) { held.delete(k); release(k + '.lock', me) }
      }
    }
    for (const [k, me] of got.reverse()) release(k + '.lock', me)
    if (clearStale(missed + '.lock')) continue
    if (Date.now() > until) throw busy(missed)
    await later(backoff(n))
  }
}

/** Removes temp files (name.<pid>-xxxxxx.tmp, name.<pid>.tmp), half-made locks
 *  (name.lock.<pid>-<token>.tmp) and locks, only when their PID is gone and
 *  they are older than STRAY_MIN_MS: what a live writer holds, or what was
 *  made a moment ago, is left alone. Returns the names removed. */
function cleanStray(dirs) {
  const out = []
  const ageOf = (f) => { try { return Date.now() - fs.statSync(f).mtimeMs } catch { return -1 } }
  for (const dir of dirs) {
    let names = []
    try { names = fs.readdirSync(dir) } catch { continue }
    for (const n of names) {
      const f = path.join(dir, n)
      const half = /\.lock\.(\d+)-([0-9a-f]+)\.tmp$/.exec(n)
      const t = half || /\.(\d+)(?:-[0-9a-z]+)?\.tmp$/.exec(n)
      if (t) {
        if ((half && !localToken(half[2])) || alive(Number(t[1])) || ageOf(f) < STRAY_MIN_MS) continue
        try { if (half) fs.rmSync(f, { recursive: true }); else fs.unlinkSync(f); out.push(n) } catch { /* in use */ }
      } else if (n.endsWith('.lock')) {
        const info = readLock(f)
        if (!info || info.age < STRAY_MIN_MS || (info.owner && (!info.local || alive(info.pid)))) continue
        breakLock(f, info)
        if (!fs.existsSync(f)) out.push(n)
      }
    }
  }
  return out
}

module.exports = { writeAtomic, withLock, withLockAsync, configure, cleanStray, alive }
