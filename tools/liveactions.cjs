/* What the owner can do about one run from the Live page (spec 1.1, 14.7).
 *
 *   nudge(run)   board only: an inbox line of type "nudge" for the supervisor
 *                ("ask this run where it is"). Starts and sends nothing.
 *   stop(run)    board only: an inbox line of type "stop". The dashboard
 *                server never ends a process (decision 13.2); the supervisor
 *                reads the line and stops the run itself.
 *   clean(run)   board only: hides a closed dead run from the Live page.
 *                "all" hides every one shown. The run's record and log stay.
 *   view(state)  the dead runs Arsenale closed and nobody cleaned yet.
 *
 *   <data>/alerts/actions.json   { schemaVersion: 1, cleaned: {run: at} }
 *
 * A file written by a newer Arsenale is read-only here: Clean is refused, the
 * list shows everything.
 */
const fs = require('fs')
const path = require('path')
const P = require('./paths.cjs')
const { writeAtomic, withLock } = require('./store.cjs')
const { fail, requireBoard, actorLabel, readActive } = require('./runlog.cjs')

const SCHEMA = 1
const FILE = path.join(P.HOME, 'alerts', 'actions.json')
const CLOSED_DAYS = 7
// a run id is a key of `cleaned`: these would reach Object.prototype instead
const BAD_IDS = ['__proto__', 'constructor', 'prototype']
const idMap = (o) => Object.assign(Object.create(null), o && typeof o === 'object' && !Array.isArray(o) ? o : {})

function readState() {
  let j = null
  try { j = JSON.parse(P.stripBom(fs.readFileSync(FILE, 'utf8'))) } catch { /* none yet */ }
  const ok = j && typeof j === 'object' && !Array.isArray(j) && !(Number(j.schemaVersion) > SCHEMA)
  return { schemaVersion: SCHEMA, cleaned: idMap(ok ? j.cleaned : null), readOnly: !!j && Number(j.schemaVersion) > SCHEMA }
}

const isClosedDead = (r) => r && r.closedBy === 'arsenale' && r.status === 'stopped'
const quietBefore = (r) => {
  const steps = Array.isArray(r.steps) ? r.steps : []
  const last = [steps.length ? steps[steps.length - 1].at : '', r.startedAt].map((s) => Date.parse(s)).find(Number.isFinite)
  const end = Date.parse(r.finishedAt)
  return Number.isFinite(last) && Number.isFinite(end) ? Math.max(0, Math.round((end - last) / 60000)) : null
}

/** The closed dead runs of the last days that nobody cleaned. state: the
 *  dashboard's collected state (its finished runs). */
function view(state) {
  const st = readState()
  const since = Date.now() - CLOSED_DAYS * 86400000
  const dead = ((state && state.runs) || []).filter((r) => isClosedDead(r) && !st.cleaned[r.id] && Date.parse(r.finishedAt) >= since)
    .map((r) => ({ id: r.id, agent: r.agent || '', model: r.model || '', task: r.task || '', startedAt: r.startedAt || '', closedAt: r.finishedAt || '', quietMin: quietBefore(r) }))
  return { dead, readOnly: st.readOnly }
}

function clean(run, actor, state) {
  requireBoard(actor)
  const id = String(run || '')
  fs.mkdirSync(path.dirname(FILE), { recursive: true })
  return withLock(FILE, () => {
    const st = readState()
    if (st.readOnly) throw fail(409, 'This list was written by a newer Arsenale; it cannot be changed here.')
    const known = new Set(((state && state.runs) || []).filter(isClosedDead).map((r) => r.id))
    const ids = id === 'all' ? view(state).dead.map((d) => d.id) : [id]
    if (id !== 'all' && !known.has(id)) throw fail(404, 'no closed dead run with that id')
    const at = new Date().toISOString()
    for (const x of ids) st.cleaned[x] = at
    delete st.readOnly
    writeAtomic(FILE, JSON.stringify(st, null, 2))
    try { require('./agent-company.cjs').activity({ actor: actorLabel(actor), action: 'run.cleaned', entityType: 'run', entityId: id, summary: 'hid ' + ids.length + ' closed run' + (ids.length === 1 ? '' : 's') + ' from the Live page', via: actor.door }) } catch { /* no company: the file is the record */ }
    return { cleaned: ids, at }
  })
}

/** The inbox line for the supervisor about one active run. */
function ask(kind, run, actor) {
  requireBoard(actor)
  const id = String(run || '')
  const r = readActive(id)
  if (!r) throw fail(404, 'no active run with that id')
  const C = require('./agent-company.cjs')
  if (!C.readCompany().configured) throw fail(409, 'The supervisor inbox needs a company: create one with arsenale log --company-init')
  const who = r.agent || 'the run'
  const summary = kind === 'nudge'
    ? 'Nudge ' + who + ': the owner asks where it is. Ask it for a step report.'
    : 'Stop ' + who + ': the owner asks to end this run. Arsenale does not stop processes itself.'
  C.inboxLine({ type: kind, run: r.id, agent: r.agent || '', branch: r.branch || '', summary }, actor.door)
  try { C.activity({ actor: actorLabel(actor), action: 'run.' + kind, entityType: 'run', entityId: r.id, summary: 'asked the supervisor to ' + kind + ' ' + who, via: actor.door }) } catch { /* the inbox line is the record */ }
  return { run: r.id, kind, sentAt: new Date().toISOString() }
}

/** One door for the Live buttons: { op: nudge | stop | clean, run }. */
function act(input, actor, state) {
  const op = String((input && input.op) || '')
  if (BAD_IDS.includes(String((input && input.run) || ''))) throw fail(400, 'not a run id')
  if (op === 'nudge' || op === 'stop') return ask(op, input.run, actor)
  if (op === 'clean') return clean(input.run, actor, state)
  throw fail(400, 'unknown action')
}

module.exports = { FILE, view, act, clean }
