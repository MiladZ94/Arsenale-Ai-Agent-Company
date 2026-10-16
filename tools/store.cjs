/* Safe writes for the data folder: every record and company file goes through
 * here.
 *
 *   writeAtomic(file, text)   a temporary file next to it, then a rename: a
 *                             reader (the dashboard polls every 1.5 s) sees
 *                             the old file or the new one, never half of one
 *   withLock(file, fn)        fn() while holding <file>.lock: two writers that
 *                             read, change and write the same file in parallel
 *                             (agents in an autonomous run) lose no update
 *   cleanStray(dirs)          temp and lock files a crashed writer left behind
 *
 * A lock is stale, and taken over, when its owner process is gone, or when
 * it is older than LOCK_STALE_MS (a reused PID must not block forever: a lock
 * is held for milliseconds). Nothing here starts a process; process.kill(pid, 0) only asks
 * whether a PID lives.
 */
const fs = require('fs')
const path = require('path')
const crypto = require('crypto')

const LOCK_WAIT_MS = 30000
const LOCK_STALE_MS = 30000
// a lock with no owner folder yet was made a moment ago
const LOCK_EMPTY_MS = 2000
const STRAY_MS = 10 * 60000
const RENAME_WAIT_MS = 5000

const pause = new Int32Array(new SharedArrayBuffer(4))
const sleep = (ms) => Atomics.wait(pause, 0, 0, ms)

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

function writeAtomic(file, text) {
  const tmp = file + '.' + process.pid + '-' + crypto.randomBytes(3).toString('hex') + '.tmp'
  try {
    fs.writeFileSync(tmp, text)
    renameRetry(tmp, file)
  } catch (e) {
    try { fs.unlinkSync(tmp) } catch { /* never made, or already renamed */ }
    throw e
  }
}

// The lock is a folder, made with mkdir (atomic, and on Windows about 1 ms,
// where a lock file with content costs 15 to 40 ms of virus scanning), holding
// one empty folder named <pid>-<token>: who owns it.
function readLock(lock) {
  let names
  try { names = fs.readdirSync(lock) } catch { return null }
  const m = names.length === 1 && /^(\d+)-([0-9a-f]+)$/.exec(names[0])
  try {
    const st = fs.statSync(m ? path.join(lock, names[0]) : lock)
    return { owner: m ? names[0] : '', pid: m ? Number(m[1]) : 0, age: Date.now() - st.mtimeMs }
  } catch { return null }
}

/** Stale: its owner process is gone, or it is older than LOCK_STALE_MS; a
 *  lock with no owner yet is being made, and stale only after LOCK_EMPTY_MS. */
function stale(info) {
  if (!info) return false
  if (!info.owner) return info.age > LOCK_EMPTY_MS
  return !alive(info.pid) || info.age > LOCK_STALE_MS
}

/** Takes a stale lock away. Two processes may try at once: only the one that
 *  removes the owner folder goes on to remove the lock. */
function breakLock(lock, info) {
  try {
    if (info.owner) fs.rmdirSync(path.join(lock, info.owner))
    fs.rmdirSync(lock)
  } catch { /* someone else took it over first */ }
}

/** Runs fn() holding the lock of `file`. Not re-entrant: fn must not lock the
 *  same file again. Throws (code 503) when the lock stays held too long. */
function withLock(file, fn) {
  const lock = file + '.lock'
  const me = process.pid + '-' + crypto.randomBytes(6).toString('hex')
  const until = Date.now() + LOCK_WAIT_MS
  for (let n = 0; ; n++) {
    try {
      fs.mkdirSync(lock)
      fs.mkdirSync(path.join(lock, me))
      break
    } catch (e) {
      // EPERM: on Windows a lock folder being removed cannot be made again for a moment
      if (e.code !== 'EEXIST' && e.code !== 'EPERM') throw e
      const info = readLock(lock)
      if (stale(info)) { breakLock(lock, info); continue }
      if (Date.now() > until) { const err = new Error('busy: ' + path.basename(file) + ' is being changed by another process, try again'); err.code = 503; throw err }
      sleep(1 + Math.min(20, n) + Math.floor(Math.random() * 3))
    }
  }
  try { return fn() } finally {
    // only while it is still ours: a lock held past LOCK_STALE_MS may have been taken over
    try { fs.rmdirSync(path.join(lock, me)); fs.rmdirSync(lock) } catch { /* taken over */ }
  }
}

/** Removes temp files (name.<pid>-xxxxxx.tmp, name.<pid>.tmp) whose writer is
 *  gone or that are older than ten minutes, and stale locks. What a writer
 *  still running holds is left alone. Returns the names removed. */
function cleanStray(dirs) {
  const out = []
  for (const dir of dirs) {
    let names = []
    try { names = fs.readdirSync(dir) } catch { continue }
    for (const n of names) {
      const f = path.join(dir, n)
      const t = /\.(\d+)(?:-[0-9a-z]+)?\.tmp$/.exec(n)
      if (t) {
        let age = 0
        try { age = Date.now() - fs.statSync(f).mtimeMs } catch { continue }
        if (alive(Number(t[1])) && age <= STRAY_MS) continue
        try { fs.unlinkSync(f); out.push(n) } catch { /* in use */ }
      } else if (n.endsWith('.lock')) {
        const info = readLock(f)
        if (!stale(info)) continue
        breakLock(f, info)
        if (!fs.existsSync(f)) out.push(n)
      }
    }
  }
  return out
}

module.exports = { writeAtomic, withLock, cleanStray, alive }
