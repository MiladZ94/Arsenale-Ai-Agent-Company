/* How far a run is, and whether it is still alive: pure functions, no file
 * is read or written here (watch.cjs and the pages call them with data).
 *
 * Two percentages are kept apart and both shown (spec 1.1, 4.1):
 *   reported   what the agent said: a plan of weighted steps and the step it
 *              is on, or a bare "pct"
 *   estimated  what Arsenale infers: finished steps of the plan; else files
 *              changed and tests run against the planned counts; else the
 *              time taken against the agent's own recent runs
 * The headline is the reported one when there is one. An estimate is never
 * shown above EST_CAP, and no running run ever shows 100: only a finished one
 * does. A value that cannot be worked out is null ("—" on the page), never 0.
 *
 * Every weight and limit sits in K, so a change is made in one place.
 */
const K = {
  FILES_WEIGHT: 0.6,       // estimate: share of files changed against the plan
  TESTS_WEIGHT: 0.4,       // estimate: share of tests run against the plan
  EST_CAP: 95,             // an estimate never claims more than this
  RUNNING_CAP: 99,         // a reported 100 on a run still going shows as 99
  HISTORY_RUNS: 10,        // the agent's last finished runs used for the time estimate
  HISTORY_MIN: 3,          // fewer than this: no time estimate
  ETA_MIN_PCT: 10,         // below this the ETA is noise
  ETA_MIN_ELAPSED_MS: 2 * 60000,
  DIFFER_POINTS: 25,       // reported and estimate further apart than this get a mark
  QUIET_MIN: 10,           // the soft amber hint of the office view
  STALL_MIN: 20,           // default stall limit (setting stallMinutes, 5-240)
  DEAD_MIN: 240,           // default limit for a run with no pid (setting deadMinutes, 30-10080)
  REPEAT_MIN: 60,          // default repeat of a stall alert (setting repeatMinutes, 0 = never)
  PID_START_SLACK_MS: 5000,
}

const num = (v) => (v === null || v === undefined || v === '' ? NaN : Number(v))
const whole = (v) => { const n = num(v); return Number.isSafeInteger(n) && n >= 0 ? n : null }
const clamp = (n, lo, hi) => Math.max(lo, Math.min(hi, n))
const finished = (r) => !!(r && r.finishedAt)

/** A plan as stored: [{name, weight}], weight a positive number (default 1).
 *  Accepts plain names too. Returns null when there is nothing usable. */
function cleanPlan(plan) {
  if (!Array.isArray(plan)) return null
  const out = plan.slice(0, 50).map((s) => {
    const o = s && typeof s === 'object' ? s : { name: s }
    const w = num(o.weight)
    return { name: Array.from(String(o.name == null ? '' : o.name)).slice(0, 120).join(''), weight: Number.isFinite(w) && w > 0 ? Math.min(w, 1000) : 1 }
  }).filter((s) => s.name)
  return out.length ? out : null
}

/** The 1-based index of a step given by name or number; 0 when unknown. */
function stepIndexOf(plan, step) {
  if (!plan || step === undefined || step === null || step === '') return 0
  const n = num(step)
  if (Number.isInteger(n)) return n >= 1 && n <= plan.length ? n : 0
  const i = plan.findIndex((s) => s.name === String(step))
  return i + 1
}

/** The reported percent, or null. From a plan: the weight of the steps before
 *  the current one, plus the current step's own pct share of its weight. */
function reportedPercent(r) {
  if (!r) return null
  const plan = cleanPlan(r.plan)
  let p = null
  if (plan && Number.isInteger(r.stepIndex) && r.stepIndex >= 1) {
    const total = plan.reduce((s, x) => s + x.weight, 0)
    const i = Math.min(r.stepIndex, plan.length)
    const before = plan.slice(0, i - 1).reduce((s, x) => s + x.weight, 0)
    const sp = num(r.stepPct)
    const cur = Number.isFinite(sp) ? plan[i - 1].weight * clamp(sp, 0, 100) / 100 : 0
    p = Math.round(100 * (before + cur) / total)
  } else if (Number.isFinite(num(r.pct))) p = Math.round(clamp(num(r.pct), 0, 100))
  if (p === null) return null
  return finished(r) ? p : Math.min(p, K.RUNNING_CAP)
}

/** Median of the durations (ms) of the agent's last finished runs, or null
 *  when there are fewer than HISTORY_MIN of them. `runs` is any list of
 *  finished records; only this agent's, newest first, are used. */
function medianDuration(agent, runs) {
  const mine = (runs || []).filter((x) => x && x.agent === agent && x.finishedAt && (x.status === 'ok' || x.status === 'findings' || !x.status))
    .sort((a, b) => String(b.finishedAt).localeCompare(String(a.finishedAt)))
    .map((x) => Number(x.durMs) || Number(x.durationMs) || (Date.parse(x.finishedAt) - Date.parse(x.startedAt)))
    .filter((d) => Number.isFinite(d) && d > 0)
    .slice(0, K.HISTORY_RUNS)
    .sort((a, b) => a - b)
  if (mine.length < K.HISTORY_MIN) return null
  const m = mine.length >> 1
  return mine.length % 2 ? mine[m] : (mine[m - 1] + mine[m]) / 2
}

/** The estimate { pct, basis } or null. basis: steps | work | time. */
function estimatePercent(r, history, now) {
  if (!r) return null
  const cap = (p) => ({ pct: Math.round(clamp(p, 0, finished(r) ? 100 : K.EST_CAP)) })
  const plan = cleanPlan(r.plan)
  if (plan && Number.isInteger(r.stepIndex) && r.stepIndex >= 1) {
    return Object.assign(cap(100 * (Math.min(r.stepIndex, plan.length + 1) - 1) / plan.length), { basis: 'steps' })
  }
  const pf = whole(r.plannedFiles), pt = whole(r.plannedTests)
  const fc = whole(r.files), tr = whole(r.testsRun)
  // 0 planned means "not known"
  const fShare = pf ? Math.min(1, (fc || 0) / pf) : null
  const tShare = pt ? Math.min(1, (tr || 0) / pt) : null
  if (fShare !== null && tShare !== null) return Object.assign(cap(100 * (K.FILES_WEIGHT * fShare + K.TESTS_WEIGHT * tShare)), { basis: 'work' })
  if (fShare !== null) return Object.assign(cap(100 * fShare), { basis: 'work' })
  if (tShare !== null) return Object.assign(cap(100 * tShare), { basis: 'work' })
  const med = medianDuration(r.agent, history)
  const start = Date.parse(r.startedAt)
  if (med && Number.isFinite(start)) return Object.assign(cap(100 * Math.max(0, (now || Date.now()) - start) / med), { basis: 'time' })
  return null
}

/** Minutes left, or null. elapsed x (100 - p) / p, only from 10 % and 2 min. */
function etaMinutes(elapsedMs, p) {
  if (!Number.isFinite(p) || !Number.isFinite(elapsedMs) || p < K.ETA_MIN_PCT || elapsedMs < K.ETA_MIN_ELAPSED_MS || p >= 100) return null
  return Math.max(0, Math.round(elapsedMs * (100 - p) / p / 60000))
}
const etaText = (m) => (m === null || m === undefined ? '—' : 'about ' + m + ' min')

/** Both numbers and the headline of one run. */
function headline(r, history, now) {
  const t = now || Date.now()
  const reported = reportedPercent(r)
  const est = estimatePercent(r, history, t)
  const estimate = est ? est.pct : null
  const big = reported !== null ? reported : estimate
  const start = Date.parse(r && r.startedAt)
  const elapsedMs = Number.isFinite(start) ? Math.max(0, t - start) : null
  return {
    reported, estimate, estimateBasis: est ? est.basis : '',
    percent: big, estimated: reported === null && estimate !== null,
    differ: reported !== null && estimate !== null && Math.abs(reported - estimate) > K.DIFFER_POINTS,
    elapsedMs, etaMin: elapsedMs === null || big === null ? null : etaMinutes(elapsedMs, big),
  }
}

/** The newest of: last progress line, last hook or queue touch, start. ms or NaN. */
function lastActivity(r) {
  const steps = Array.isArray(r && r.steps) ? r.steps : []
  const times = [r && r.lastActivityAt, steps.length ? steps[steps.length - 1].at : '', r && r.startedAt].map((s) => Date.parse(s)).filter(Number.isFinite)
  return times.length ? Math.max(...times) : NaN
}

/** Minutes without activity; a clock moved back (activity in the future) is 0. */
function quietMinutes(r, now) {
  const a = lastActivity(r)
  if (!Number.isFinite(a)) return 0
  return Math.max(0, ((now || Date.now()) - a) / 60000)
}

/** The state of an active run: working | quiet | stalled | dead.
 *  opts: { limits: {stallMinutes, deadMinutes}, pidAlive(pid), pidStart(pid)
 *  -> ms or NaN when the system cannot tell, paused (waiting in the test
 *  queue, or holding it: the quiet timer does not run), goneTicks (how many
 *  ticks in a row have seen the pid gone, this one included) }.
 *  A pid that is gone makes the run dead only when it was seen gone on 2
 *  ticks in a row AND the run is quiet for the stall limit or its
 *  pidStartedAt came from the system (runlog.pidStartFields): an agent that
 *  recorded the wrong pid, say its short-lived shell's, keeps a working run
 *  open. Until then the time rules apply as for a run with no pid.
 *  dead.reason: pid-gone | pid-gone-quiet | pid-reused | no-pid-quiet |
 *  pid-unverified-quiet. */
function classify(r, now, opts) {
  const o = opts || {}
  const lim = Object.assign({ stallMinutes: K.STALL_MIN, deadMinutes: K.DEAD_MIN }, o.limits || {})
  const quiet = o.paused ? 0 : quietMinutes(r, now)
  const pid = Number(r && r.pid)
  const out = (state, reason) => ({ state, reason: reason || '', quietMin: Math.floor(quiet) })
  const gone = Number.isSafeInteger(pid) && pid > 0 && !!o.pidAlive && !o.pidAlive(pid)
  if (gone) {
    const verified = Number.isFinite(Date.parse(r.pidStartedAt))
    if ((o.goneTicks || 0) >= 2 && (verified || quiet >= lim.stallMinutes)) return out('dead', 'pid-gone')
    if (quiet >= lim.deadMinutes) return out('dead', 'pid-gone-quiet')
  } else if (Number.isSafeInteger(pid) && pid > 0) {
    const rec = Date.parse(r.pidStartedAt)
    const real = o.pidStart ? o.pidStart(pid) : NaN
    if (Number.isFinite(rec) && Number.isFinite(real) && Math.abs(real - rec) > K.PID_START_SLACK_MS) return out('dead', 'pid-reused')
    // a live pid with a start time the system confirmed (or cannot check) is
    // never closed by time; without a recorded start time the pid may have
    // been reused, so the no-pid time rule applies as well
    if (!Number.isFinite(rec) && quiet >= lim.deadMinutes) return out('dead', 'pid-unverified-quiet')
  } else if (quiet >= lim.deadMinutes) return out('dead', 'no-pid-quiet')
  if (quiet >= lim.stallMinutes) return out('stalled')
  if (quiet >= K.QUIET_MIN) return out('quiet')
  return out('working')
}

/** The headline percent of a version run (spec 4.1 rule 7).
 *  vr: the mirror ({phases: [{id, requests, merged?, status, percent, percentSet?}]}),
 *  runs: active runs, each with `versionRun`, `phase` and a `percent` (headline).
 *  A phase counts its merged requests (`merged`, a list or a count; a phase
 *  whose status says merged or done counts all), plus the average headline of
 *  its running runs as one more part-done request, over all its requests.
 *  A phase percent the supervisor set explicitly wins. Weight = requests (>= 1). */
function overallPercent(vr, runs) {
  const phases = Array.isArray(vr && vr.phases) ? vr.phases : []
  if (!phases.length) return { percent: null, phases: [] }
  const mine = (runs || []).filter((r) => r && r.versionRun === vr.id)
  let sum = 0, weights = 0
  const out = phases.map((ph) => {
    const n = Array.isArray(ph.requests) ? ph.requests.length : 0
    const w = Math.max(1, n)
    let pct
    const setPct = num(ph.percent)
    // older mirrors have no percentSet: a non-zero percent there was set on purpose
    const explicit = Number.isFinite(setPct) && (ph.percentSet === true || (ph.percentSet === undefined && setPct > 0))
    if (explicit) pct = clamp(setPct, 0, 100)
    else {
      let merged = Array.isArray(ph.merged) ? ph.merged.length : whole(ph.merged) || 0
      if (/merged|done/i.test(String(ph.status || ''))) merged = w
      const running = mine.filter((r) => r.phase === ph.id).map((r) => num(r.percent)).filter(Number.isFinite)
      const part = running.length ? running.reduce((s, p) => s + p, 0) / running.length / 100 : 0
      pct = clamp(100 * Math.min(w, merged + part) / w, 0, 100)
    }
    sum += pct * w
    weights += w
    return { id: ph.id, percent: pct, weight: w, explicit }
  })
  return { percent: Math.round(sum / weights), phases: out }
}

module.exports = { K, cleanPlan, stepIndexOf, reportedPercent, estimatePercent, medianDuration, etaMinutes, etaText, headline, lastActivity, quietMinutes, classify, overallPercent, whole }
