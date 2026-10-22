/* Unfinished work after a restart (spec 1.1, 4.4).
 *
 *   scan()     `arsenale resume-scan`: finds the runs that ended without
 *              finishing and left work behind, and writes the list to
 *              <data>/resume/candidates.json (schemaVersion 1). A run counts
 *              when its process is gone (or, with no pid, it is past the dead
 *              limit), its worktree still exists, and the worktree has
 *              uncommitted changes or commits no other branch has. Both kinds
 *              are looked at: an active record left behind, and a record
 *              Arsenale already closed as dead (closedBy "arsenale").
 *              Read-only git, run in the CLI process only: the dashboard
 *              server never runs git (decision 13.2).
 *   view()     what the Live page shows: the candidates, less the dismissed
 *              ones, each with "Resume sent" when it was.
 *   resume()   board only: an item of type "resume" in the supervisor's inbox
 *              (`arsenale inbox`) with the run, the branch and the brief. It
 *              starts nothing; the supervisor sends the brief again.
 *   dismiss()  board only: hides a candidate; it stays in the history.
 *
 *   <data>/resume/state.json   { schemaVersion: 1, sent: {run: at}, dismissed: {run: at} }
 *
 * A candidate goes when a later run in the same worktree finished, when the
 * worktree has nothing left to resume, or when the owner dismissed it.
 * Nothing in a worktree is ever changed or deleted.
 */
const fs = require('fs')
const path = require('path')
const P = require('./paths.cjs')
const { writeAtomic, withLock } = require('./store.cjs')
const { fail, requireBoard, actorLabel, pidAlive } = require('./runlog.cjs')

const SCHEMA = 1
const DIR = path.join(P.HOME, 'resume')
const CANDIDATES = path.join(DIR, 'candidates.json')
const STATE = path.join(DIR, 'state.json')

// maps keyed by run id have no prototype, and these names are never run ids:
// a "constructor" run must not read or write Object.prototype
const idMap = (o) => Object.assign(Object.create(null), o && typeof o === 'object' && !Array.isArray(o) ? o : {})
const BAD_IDS = ['__proto__', 'constructor', 'prototype']

const readJson = (f, d) => { try { return JSON.parse(fs.readFileSync(f, 'utf8')) } catch { return d } }
function readDir(dir) {
  let names = []
  try { names = fs.readdirSync(dir) } catch { return [] }
  return names.filter((n) => n.endsWith('.json')).map((n) => readJson(path.join(dir, n), null)).filter((r) => r && typeof r === 'object')
}

// An empty folder for core.hooksPath: no hook of the worktree runs
const NO_HOOKS = path.join(DIR, 'no-hooks')

/** Read-only git in `dir`: changed files and commits only this branch has.
 *  The worktree's own config could still run a program (core.fsmonitor, a
 *  hook) or `status` could refresh the index under a lock another git holds:
 *  both are switched off on the command line, which wins over the repo's config. */
function gitState(dir) {
  const { spawnSync } = require('child_process')
  fs.mkdirSync(NO_HOOKS, { recursive: true })
  const git = (...a) => spawnSync('git', ['--no-optional-locks', '-c', 'core.fsmonitor=', '-c', 'core.hooksPath=' + NO_HOOKS, '-C', dir, ...a], { encoding: 'utf8', windowsHide: true, timeout: 20000 })
  const st = git('status', '--porcelain', '--untracked-files=all')
  if (st.error || st.status !== 0) return null
  const changed = st.stdout.split('\n').filter((l) => l.trim()).length
  const head = git('symbolic-ref', '-q', 'HEAD').stdout.trim()
  const rl = git('rev-list', '--count', 'HEAD', '--not', ...(head ? ['--exclude=' + head] : []), '--branches', '--remotes')
  const unmerged = rl.status === 0 ? Number(rl.stdout.trim()) || 0 : 0
  return { changed, unmerged, branch: head.replace(/^refs\/heads\//, '') }
}

/** Finds the candidates and writes candidates.json. opts.dir: only runs whose
 *  worktree is inside it. opts.limits: { deadMinutes } (watch.limits()). */
function scan(opts) {
  const o = opts || {}
  const Pg = require('./progress.cjs')
  const dead = (o.limits && o.limits.deadMinutes) || Pg.K.DEAD_MIN
  const now = Date.now()
  const newer = () => { const d = readJson(CANDIDATES, null); if (d && Number(d.schemaVersion) > SCHEMA) throw fail(409, 'The resume list was written by a newer Arsenale; it cannot be changed here.') }
  // before any git runs; asked again under the lock
  newer()
  const finished = readDir(P.RUNS)
  const inside = (wt) => !o.dir || (() => { const rel = path.relative(path.resolve(o.dir), path.resolve(wt)); return !rel.startsWith('..') && !path.isAbsolute(rel) })()
  const gone = (r) => {
    const pid = Number(r.pid)
    if (Number.isSafeInteger(pid) && pid > 0) return !pidAlive(pid)
    return Pg.quietMinutes(r, now) >= dead
  }
  const ok = (r) => r.id && !BAD_IDS.includes(String(r.id)) && r.worktree
  const pool = readDir(P.ACTIVE).filter((r) => ok(r) && gone(r)).map((r) => [r, 'active'])
    .concat(finished.filter((r) => ok(r) && r.closedBy === 'arsenale').map((r) => [r, 'closed']))
  const seen = new Set()
  const out = []
  for (const [r, source] of pool) {
    if (seen.has(r.id) || !inside(r.worktree)) continue
    seen.add(r.id)
    const wt = path.resolve(r.worktree)
    if (!fs.existsSync(wt)) continue
    const last = Pg.lastActivity(r)
    // a later run in the same worktree that finished on its own settles it
    if (finished.some((f) => f.id !== r.id && f.worktree && path.resolve(f.worktree) === wt && f.closedBy !== 'arsenale' && Date.parse(f.startedAt) > last)) continue
    const g = gitState(wt)
    if (!g || (!g.changed && !g.unmerged)) continue
    out.push({
      run: r.id, agent: r.agent || '', task: r.task || '', branch: r.branch || g.branch, worktree: wt,
      changed: g.changed, unmerged: g.unmerged,
      lastActivityAt: Number.isFinite(last) ? new Date(last).toISOString() : '',
      brief: r.brief || '', limited: !r.brief, source,
      versionRun: r.versionRun || '', phase: r.phase || '',
    })
  }
  out.sort((a, b) => String(b.lastActivityAt).localeCompare(String(a.lastActivityAt)))
  fs.mkdirSync(DIR, { recursive: true })
  return withLock(CANDIDATES, () => {
    // a list written by a newer Arsenale is left as it is; the keys this
    // version does not know are kept
    newer()
    const cur = readJson(CANDIDATES, null)
    const prev = cur && typeof cur === 'object' && !Array.isArray(cur) ? cur : {}
    const doc = Object.assign(prev, { schemaVersion: SCHEMA, scannedAt: new Date(now).toISOString(), dir: o.dir ? path.resolve(o.dir) : '', candidates: out })
    writeAtomic(CANDIDATES, JSON.stringify(doc, null, 2))
    return doc
  })
}

function readState() {
  const s = readJson(STATE, null)
  const ok = s && typeof s === 'object' && !Array.isArray(s) && !(Number(s.schemaVersion) > SCHEMA)
  // keys this version does not know are carried along, so a save keeps them
  return Object.assign(ok ? Object.assign({}, s) : {}, { schemaVersion: SCHEMA, sent: idMap(ok && s.sent), dismissed: idMap(ok && s.dismissed), readOnly: !!s && Number(s.schemaVersion) > SCHEMA })
}

/** The list the Live page shows. The brief stays on the server: the page gets
 *  whether there is one and its length. */
function view() {
  const doc = readJson(CANDIDATES, null)
  const st = readState()
  const list = doc && Array.isArray(doc.candidates) && !(Number(doc.schemaVersion) > SCHEMA) ? doc.candidates : []
  return {
    scannedAt: doc ? String(doc.scannedAt || '') : '',
    candidates: list.filter((c) => c && c.run && !BAD_IDS.includes(String(c.run)) && !st.dismissed[c.run]).map((c) => ({
      run: c.run, agent: c.agent, task: c.task, branch: c.branch, worktree: c.worktree, changed: c.changed, unmerged: c.unmerged,
      lastActivityAt: c.lastActivityAt, hasBrief: !!c.brief, briefChars: String(c.brief || '').length, limited: !c.brief,
      versionRun: c.versionRun || '', phase: c.phase || '', sentAt: st.sent[c.run] || '',
    })),
  }
}

function candidate(run) {
  if (BAD_IDS.includes(String(run))) throw fail(400, 'not a run id')
  const doc = readJson(CANDIDATES, null)
  const c = doc && Array.isArray(doc.candidates) ? doc.candidates.find((x) => x && x.run === String(run || '')) : null
  if (!c) throw fail(404, 'no unfinished run with that id; run "arsenale resume-scan" first')
  return c
}

function mark(kind, run) {
  fs.mkdirSync(DIR, { recursive: true })
  return withLock(STATE, () => {
    const st = readState()
    if (st.readOnly) throw fail(409, 'The resume list was written by a newer Arsenale; it cannot be changed here.')
    st[kind][run] = new Date().toISOString()
    delete st.readOnly
    writeAtomic(STATE, JSON.stringify(st, null, 2))
    return st[kind][run]
  })
}

/** Board only. An inbox item of type "resume" for the supervisor. A run
 *  without a brief is resumed by its task text, marked "limited". */
function resume(run, actor) {
  requireBoard(actor)
  const c = candidate(run)
  const C = require('./agent-company.cjs')
  if (!C.readCompany().configured) throw fail(409, 'The supervisor inbox needs a company: create one with arsenale log --company-init')
  const brief = c.brief || ''
  C.inboxLine({
    type: 'resume', run: c.run, agent: c.agent, branch: c.branch, worktree: c.worktree, limited: !brief,
    brief: brief || c.task,
    summary: 'Resume ' + (c.agent || 'the run') + ' on ' + (c.branch || c.worktree) + (brief ? '' : ' (limited: no brief stored, use the task text)') + ': ' + (brief || c.task),
  }, actor.door)
  try { C.activity({ actor: actorLabel(actor), action: 'run.resume', entityType: 'run', entityId: c.run, summary: 'asked the supervisor to resume ' + (c.agent || c.run), via: actor.door }) } catch { /* the inbox line is the record */ }
  return { run: c.run, sentAt: mark('sent', c.run), limited: !brief }
}

/** Board only. Hides a candidate; candidates.json keeps it. */
function dismiss(run, actor) {
  requireBoard(actor)
  const c = candidate(run)
  return { run: c.run, dismissedAt: mark('dismissed', c.run) }
}

module.exports = { DIR, CANDIDATES, STATE, scan, view, resume, dismiss, gitState }
