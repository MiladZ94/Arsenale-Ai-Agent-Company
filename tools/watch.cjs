/* Stalled and dead runs, and the Live data (spec 1.1, 4.1 and 4.2).
 *
 * tick() is run by the dashboard server once when it starts and every 30
 * seconds (startLoop); `arsenale alerts` prints the same view read-only. On
 * each tick every active run is classified (progress.classify):
 *   quiet     10 min without activity: a soft hint only, no alert
 *   stalled   at the stall limit (setting stallMinutes, default 20): one alert
 *             per stall, repeated after repeatMinutes (default 60, 0 = never)
 *             while it lasts and nobody dismissed it; a run that recovers and
 *             stalls again alerts again
 *   dead      its process is gone (pid recorded and not alive on 2 ticks in
 *             a row, and quiet for the stall limit or its start time came
 *             from the system), or quiet past deadMinutes (default 240), pid
 *             or not (a live pid only without a recorded start time): closed through
 *             runlog.closeDead, a finished record "stopped" with its steps,
 *             and an activity line. Nothing is deleted and nothing is killed.
 * A run waiting for the test suite, or running it, is never quiet: its timer
 * stops (decision 14.7). A tick that comes long after the last one (the
 * machine slept) raises no stall alert: it waits one tick for fresh activity.
 *
 *   <data>/alerts/state.json   { schemaVersion: 1, lastTickAt, runs: {id:
 *                              {since, alertedAt, alerts, dismissedAt}},
 *                              queue: {key: notedAt}, events: [...] }
 * Kept in the data folder, under a lock, so two servers on one folder do not
 * alert twice (best effort). `events` (newest last, at most 100) is what
 * the notifications (desktop, phone) are sent from; this file sends nothing.
 *
 * The limits are read from <data>/notify/config.json (stallMinutes,
 * deadMinutes, repeatMinutes); a missing or bad value reads as the default.
 */
const fs = require('fs')
const path = require('path')
const crypto = require('crypto')
const P = require('./paths.cjs')
const { writeAtomic, withLock } = require('./store.cjs')
const Pg = require('./progress.cjs')
const L = require('./runlog.cjs')

const SCHEMA = 1
const DIR = path.join(P.HOME, 'alerts')
const STATE = path.join(DIR, 'state.json')
const NOTIFY_CONFIG = path.join(P.HOME, 'notify', 'config.json')
const TICK_MS = 30000
const MAX_EVENTS = 100

const LIMITS = {
  stallMinutes: [5, 240, Pg.K.STALL_MIN],
  deadMinutes: [30, 10080, Pg.K.DEAD_MIN],
  repeatMinutes: [0, 1440, Pg.K.REPEAT_MIN],
}
const inRange = (k, v) => Number.isInteger(v) && v >= LIMITS[k][0] && v <= LIMITS[k][1]

/** The limits in force, from notify/config.json; bad or missing: the default. */
function limits() {
  let c = {}
  try { c = JSON.parse(P.stripBom(fs.readFileSync(NOTIFY_CONFIG, 'utf8'))) || {} } catch { /* defaults */ }
  const out = {}
  for (const k of Object.keys(LIMITS)) out[k] = inRange(k, c[k]) ? c[k] : LIMITS[k][2]
  return out
}

/** Checks limits given by the owner: whole minutes in range, or a 400 naming the field. */
function cleanLimits(input) {
  const out = {}
  for (const k of Object.keys(LIMITS)) {
    if (input[k] === undefined) continue
    const v = typeof input[k] === 'string' && /^\d+$/.test(input[k].trim()) ? Number(input[k]) : input[k]
    if (!inRange(k, v)) throw L.fail(400, k + ' must be a whole number of minutes from ' + LIMITS[k][0] + ' to ' + LIMITS[k][1])
    out[k] = v
  }
  return out
}

/** Board only: saves the limits into notify/config.json, keeping every other
 *  key, also the ones this version does not know. A file written by a newer
 *  Arsenale is not changed (409). */
function setLimits(input, actor) {
  L.requireBoard(actor)
  const clean = cleanLimits(input || {})
  const N = require('./notify.cjs')
  fs.mkdirSync(path.dirname(NOTIFY_CONFIG), { recursive: true })
  return withLock(NOTIFY_CONFIG, () => {
    let raw = null
    try { raw = JSON.parse(P.stripBom(fs.readFileSync(NOTIFY_CONFIG, 'utf8'))) } catch { /* none yet, or unreadable: the defaults */ }
    if (!raw || typeof raw !== 'object' || Array.isArray(raw)) raw = {}
    if (Number(raw.schemaVersion) > N.readConfig().schemaVersion) throw L.fail(409, 'The notification settings were written by a newer Arsenale; they cannot be changed here.')
    // readConfig keeps only the keys it knows: the others are laid under it
    const c = Object.assign(raw, N.readConfig(), clean)
    N.saveConfig(c)
    try { require('./agent-company.cjs').activity({ actor: L.actorLabel(actor), action: 'limits.set', entityType: 'setting', entityId: 'stall', summary: 'Run limits: ' + Object.entries(clean).map(([k, v]) => k + ' ' + v).join(', '), via: actor.door }) } catch { /* no company */ }
    return limits()
  })
}

const readJson = (f, d) => { try { return JSON.parse(fs.readFileSync(f, 'utf8')) } catch { return d } }
// maps keyed by run id have no prototype: a run called "constructor" or
// "__proto__" must never read or write Object.prototype
const idMap = (o) => Object.assign(Object.create(null), o && typeof o === 'object' && !Array.isArray(o) ? o : {})
const BAD_IDS = ['__proto__', 'constructor', 'prototype']
const badId = (id) => BAD_IDS.includes(String(id))
function readState() {
  const s = readJson(STATE, null)
  if (!s || typeof s !== 'object' || Number(s.schemaVersion) > SCHEMA) return { schemaVersion: SCHEMA, lastTickAt: '', runs: idMap(), queue: idMap(), events: [], readOnly: !!s && Number(s.schemaVersion) > SCHEMA }
  return { schemaVersion: SCHEMA, lastTickAt: String(s.lastTickAt || ''), runs: idMap(s.runs), queue: idMap(s.queue), events: Array.isArray(s.events) ? s.events : [] }
}
function readActive() {
  let names = []
  try { names = fs.readdirSync(P.ACTIVE) } catch { return [] }
  const done = new Set()
  const out = []
  for (const n of names) {
    if (!n.endsWith('.json')) continue
    const r = readJson(path.join(P.ACTIVE, n), null)
    if (r && r.id && !badId(r.id) && !done.has(r.id)) { done.add(r.id); out.push(r) }
  }
  return out
}

// How many ticks in a row saw each run's pid gone (progress.classify closes
// on the second). Kept in this process only: a restarted server counts from
// 0 again, so it waits longer, never shorter.
const goneSeen = new Map()
function countGone(runs) {
  const gone = new Set()
  for (const r of runs) {
    const pid = Number(r.pid)
    if (Number.isSafeInteger(pid) && pid > 0 && !L.pidAlive(pid)) { gone.add(r.id); goneSeen.set(r.id, (goneSeen.get(r.id) || 0) + 1) }
  }
  for (const id of [...goneSeen.keys()]) if (!gone.has(id)) goneSeen.delete(id)
}

const classifyOpts = (lim, queue) => (r) => ({ limits: lim, pidAlive: L.pidAlive, pidStart: L.pidStartMs, paused: require('./testq.cjs').inQueue(r.id, queue), goneTicks: goneSeen.get(r.id) || 0 })

/** One pass: closes dead runs, raises and clears stall alerts, notes long
 *  queue waits and hung holders. Returns { events (new ones), closed }. */
function tick(opts) {
  const o = opts || {}
  const now = o.now || Date.now()
  const lim = limits()
  const Q = require('./testq.cjs')
  const queue = Q.status(now)
  const cOpts = classifyOpts(lim, queue)
  const closed = []
  const runs = readActive()
  countGone(runs)
  // dead runs first, each under its own run lock (runlog.closeDead)
  for (const r of runs) {
    const c = Pg.classify(r, now, cOpts(r))
    if (c.state !== 'dead') continue
    const rec = L.closeDead(r.id, (cur) => Pg.classify(cur, now, cOpts(cur)).state === 'dead')
    if (!rec) continue
    closed.push({ run: r.id, agent: r.agent, reason: c.reason })
    try { require('./agent-company.cjs').activity({ actor: 'arsenale', action: 'run.closed', entityType: 'run', entityId: r.id, summary: String(r.agent || 'a run') + ': closed a dead run (' + c.reason + ')', via: 'arsenale' }) } catch { /* no company: the stopped record is the trace */ }
  }
  fs.mkdirSync(DIR, { recursive: true })
  return withLock(STATE, () => {
    const st = readState()
    if (st.readOnly) return { events: [], closed, readOnly: true }
    const fresh = []
    const add = (e) => { const ev = Object.assign({ id: 'a-' + now.toString(36) + '-' + crypto.randomBytes(3).toString('hex'), at: new Date(now).toISOString() }, e); st.events.push(ev); fresh.push(ev) }
    for (const c of closed) add({ kind: 'closed', run: c.run, agent: c.agent || '', reason: c.reason })
    const last = Date.parse(st.lastTickAt)
    // the machine slept (or the server was off): wait one tick for fresh activity
    const grace = Number.isFinite(last) && now - last > lim.stallMinutes * 60000
    const live = new Set()
    for (const r of readActive()) {
      live.add(r.id)
      const c = Pg.classify(r, now, cOpts(r))
      const cur = st.runs[r.id]
      if (c.state !== 'stalled') { delete st.runs[r.id]; continue }
      if (grace && !cur) continue
      if (!cur) {
        st.runs[r.id] = { since: new Date(now - c.quietMin * 60000).toISOString(), alertedAt: new Date(now).toISOString(), alerts: 1, dismissedAt: '' }
        add({ kind: 'stalled', run: r.id, agent: r.agent || '', quietMin: c.quietMin })
      } else if (!cur.dismissedAt && lim.repeatMinutes > 0 && now - Date.parse(cur.alertedAt) >= lim.repeatMinutes * 60000) {
        cur.alertedAt = new Date(now).toISOString()
        cur.alerts = (Number(cur.alerts) || 0) + 1
        add({ kind: 'stalled', run: r.id, agent: r.agent || '', quietMin: c.quietMin, repeat: cur.alerts })
      }
    }
    // a finished run has no alert left
    for (const id of Object.keys(st.runs)) if (!live.has(id)) delete st.runs[id]
    // the test queue: one dashboard note per long wait and per hung holder
    const keys = new Set()
    for (const w of queue.waiting) {
      if (!w.long) continue
      const k = 'wait:' + w.run + ':' + w.requestedAt
      keys.add(k)
      if (!st.queue[k]) { st.queue[k] = new Date(now).toISOString(); add({ kind: 'queue-wait', run: w.run, agent: w.agent, waitMin: Math.floor(w.waitMs / 60000), dashboardOnly: true }) }
    }
    if (queue.holder && queue.holder.hung) {
      const k = 'hung:' + queue.holder.run + ':' + queue.holder.startedAt
      keys.add(k)
      if (!st.queue[k]) { st.queue[k] = new Date(now).toISOString(); add({ kind: 'queue-hung', run: queue.holder.run, agent: queue.holder.agent, heldMin: Math.floor(queue.holder.heldMs / 60000), dashboardOnly: true }) }
    }
    for (const k of Object.keys(st.queue)) if (!keys.has(k)) delete st.queue[k]
    if (st.events.length > MAX_EVENTS) st.events = st.events.slice(-MAX_EVENTS)
    st.lastTickAt = new Date(now).toISOString()
    delete st.readOnly
    writeAtomic(STATE, JSON.stringify(st, null, 2))
    return { events: fresh, closed }
  })
}

/** Board only: hides a stalled run's alert (the banner) until it recovers
 *  and stalls again. Nothing else changes; the run and its log stay. */
function dismiss(runId, actor) {
  L.requireBoard(actor)
  const id = String(runId || '')
  if (badId(id)) throw L.fail(400, 'not a run id')
  fs.mkdirSync(DIR, { recursive: true })
  return withLock(STATE, () => {
    const st = readState()
    if (st.readOnly) throw L.fail(409, 'The alert list was written by a newer Arsenale; it cannot be changed here.')
    const cur = st.runs[id]
    if (!cur) throw L.fail(404, 'no alert is open for that run')
    cur.dismissedAt = new Date().toISOString()
    delete st.readOnly
    writeAtomic(STATE, JSON.stringify(st, null, 2))
    return { run: id, dismissedAt: cur.dismissedAt }
  })
}

/** The monitor's verdict on one active run, for the office and Team pages
 *  (api/state): the same classify() options as live(), so a run is "dead" or
 *  "stalled" on every page at the same moment. Returns r -> { state, reason,
 *  quietMin, inQueue }; a run in the test queue has its quiet timer paused. */
function health(now) {
  const t = now || Date.now()
  const Q = require('./testq.cjs')
  const queue = Q.status(t)
  const cOpts = classifyOpts(limits(), queue)
  return (r) => {
    const c = Pg.classify(r, t, cOpts(r))
    return { state: c.state, reason: c.reason, quietMin: c.quietMin, inQueue: Q.inQueue(r.id, queue) }
  }
}

/** Files changed: the count the agent reported, else the files its
 *  transcript shows edited or written. null when neither is known. */
function filesOf(r) {
  if (Number.isSafeInteger(r.files) && r.files >= 0) return { files: r.files, filesFrom: 'reported' }
  const t = r.transcript
  if (t && t.found && Array.isArray(t.files)) return { files: t.files.filter((f) => f && (f.edit || 0) + (f.write || 0) > 0).length, filesFrom: 'transcript' }
  return { files: null, filesFrom: '' }
}

/** Everything the Live page needs, read-only. opts.state: the dashboard's
 *  collected state (build-agent-dashboard.collect), to avoid a second read. */
function live(opts) {
  const o = opts || {}
  const now = o.now || Date.now()
  const state = o.state || require('./build-agent-dashboard.cjs').collect()
  const lim = limits()
  const Q = require('./testq.cjs')
  const queue = Q.status(now)
  const cOpts = classifyOpts(lim, queue)
  const st = readState()
  const history = state.runs || []
  const rows = (state.active || []).map((r) => {
    const f = filesOf(r)
    const h = Pg.headline(Object.assign({}, r, { files: f.files === null ? undefined : f.files }), history, now)
    const c = Pg.classify(r, now, cOpts(r))
    const plan = Pg.cleanPlan(r.plan)
    const last = Pg.lastActivity(r)
    const alert = st.runs[r.id] || null
    return Object.assign({
      id: r.id, agent: r.agent || '', task: r.task || '', doing: r.doing || '', project: r.project || '',
      versionRun: r.versionRun || '', phase: r.phase || '', officeId: r.officeId || '',
      step: plan && r.stepIndex ? { index: r.stepIndex, of: plan.length, name: (plan[r.stepIndex - 1] || {}).name || '' } : null,
      testsRun: Number.isSafeInteger(r.testsRun) ? r.testsRun : null, plannedTests: r.plannedTests || null, plannedFiles: r.plannedFiles || null,
      startedAt: r.startedAt || '', lastActivityAt: Number.isFinite(last) ? new Date(last).toISOString() : '',
      state: c.state, deadReason: c.reason, quietMin: c.quietMin, inQueue: Q.inQueue(r.id, queue),
      alert: alert ? { since: alert.since, alertedAt: alert.alertedAt, dismissed: !!alert.dismissedAt } : null,
      hasWorktree: !!r.worktree, branch: r.branch || '',
    }, f, h)
  })
  const vrs = []
  let names = []
  try { names = fs.readdirSync(P.VERSION_RUNS) } catch { /* none */ }
  for (const n of names) {
    if (!/^[\w.-]+\.json$/.test(n)) continue
    const vr = readJson(path.join(P.VERSION_RUNS, n), null)
    if (!vr || !vr.id) continue
    const ov = Pg.overallPercent(vr, rows)
    vrs.push({ id: vr.id, app: vr.app || '', version: vr.version || '', status: vr.status || '', percent: ov.percent, phases: ov.phases })
  }
  let resume = { scannedAt: '', candidates: [] }
  try { resume = require('./resume.cjs').view() } catch { /* unreadable: nothing to resume */ }
  let automation = null
  try { const a = require('./automation.cjs').read(); automation = { autoRun: a.autoRun, kinds: a.kinds, readOnly: a.readOnly } } catch { /* off */ }
  return {
    at: new Date(now).toISOString(), limits: lim, runs: rows, versionRuns: vrs, queue, resume, automation,
    alerts: rows.filter((r) => r.alert && !r.alert.dismissed).map((r) => ({ run: r.id, agent: r.agent, quietMin: r.quietMin, since: r.alert.since })),
    events: st.events.slice(-20),
  }
}

/** Started by the dashboard server: a tick now and every 30 s. `after` runs
 *  after a tick that changed something (the server drops its cached state);
 *  `onEvents` gets the new events (the notifications, spec P3). A folder
 *  that cannot be written is reported once, never thrown. */
function startLoop(hooks) {
  const h = hooks || {}
  let told = ''
  const run = () => {
    try {
      const r = tick()
      told = ''
      if ((r.closed.length || r.events.length) && h.after) h.after(r)
      if (r.events.length && h.onEvents) { try { h.onEvents(r.events) } catch { /* a sender never stops the loop */ } }
    } catch (e) {
      const msg = /EACCES|EPERM|EROFS/.test(String(e.code)) ? 'Cannot write the data folder: stalled and dead runs are not checked' : 'run check failed: ' + e.message
      if (msg !== told) { process.stderr.write('arsenale: ' + msg + '\n'); told = msg }
    }
  }
  run()
  const t = setInterval(run, TICK_MS)
  t.unref()
  return () => clearInterval(t)
}

module.exports = { STATE, TICK_MS, LIMITS, limits, cleanLimits, setLimits, tick, dismiss, live, health, startLoop, readState }
