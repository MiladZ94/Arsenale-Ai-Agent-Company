/* "Let approved actions run by themselves" (spec 1.1, rule 31 and 14.3).
 *
 *   <data>/settings/automation.json   { schemaVersion: 1, autoRun: false,
 *                                       kinds: { merge: true, "next-phase": true },
 *                                       updatedAt }
 *
 * When the master switch is on, the answer line the owner's Approve writes for
 * a `merge` or `next-phase` approval carries `autoRun: true`; the supervisor
 * reads it (`arsenale answers --json`) and goes on without asking again.
 * Decided here, where the answer is written (grant below, called by
 * build-agent-dashboard.answerGate), never by a button:
 *   - only `merge` and `next-phase`; a build, a publish, any other or unknown
 *     type never, whatever the file says: releases have no switch at all;
 *   - only when the asker said the item's gates passed (action.gatesPassed);
 *   - a next phase never when its version run is at the budget warning (80 %,
 *     autonomous/RULES.md rule 19) or past it, or its budget cannot be read.
 * Changing the setting is board-only and leaves an activity line. A file
 * written by a newer Arsenale is read-only here, and reads as off.
 */
const fs = require('fs')
const path = require('path')
const P = require('./paths.cjs')
const { writeAtomic, withLock } = require('./store.cjs')
const { fail, requireBoard, actorLabel } = require('./runlog.cjs')

const SCHEMA = 1
const FILE = path.join(P.HOME, 'settings', 'automation.json')
const KINDS = ['merge', 'next-phase']
const BUDGET_WARN = 0.8

function read() {
  let j = null
  try { j = JSON.parse(P.stripBom(fs.readFileSync(FILE, 'utf8'))) } catch { /* no file: the defaults */ }
  const out = { schemaVersion: SCHEMA, autoRun: false, kinds: { merge: true, 'next-phase': true }, readOnly: false, updatedAt: '' }
  if (!j || typeof j !== 'object' || Array.isArray(j)) return out
  if (Number(j.schemaVersion) > SCHEMA) return Object.assign(out, { readOnly: true })
  out.autoRun = j.autoRun === true
  if (j.kinds && typeof j.kinds === 'object') for (const k of KINDS) if (typeof j.kinds[k] === 'boolean') out.kinds[k] = j.kinds[k]
  out.updatedAt = String(j.updatedAt || '')
  return out
}

/** Board only. input: { autoRun?: boolean, kinds?: { merge?, "next-phase"? } }.
 *  Any other key, or a kind that is not on the list (build, publish), is refused. */
function set(input, actor) {
  requireBoard(actor)
  const b = input && typeof input === 'object' ? input : {}
  if (b.autoRun !== undefined && typeof b.autoRun !== 'boolean') throw fail(400, '"autoRun" must be true or false')
  if (b.kinds !== undefined) {
    if (!b.kinds || typeof b.kinds !== 'object' || Array.isArray(b.kinds)) throw fail(400, '"kinds" must be an object')
    for (const [k, v] of Object.entries(b.kinds)) {
      if (!KINDS.includes(k)) throw fail(400, 'only ' + KINDS.join(' and ') + ' can run by themselves; releases always wait for the owner')
      if (typeof v !== 'boolean') throw fail(400, '"kinds.' + k + '" must be true or false')
    }
  }
  fs.mkdirSync(path.dirname(FILE), { recursive: true })
  return withLock(FILE, () => {
    const cur = read()
    if (cur.readOnly) throw fail(409, 'This setting was written by a newer Arsenale; it cannot be changed here.')
    const next = { schemaVersion: SCHEMA, autoRun: b.autoRun !== undefined ? b.autoRun : cur.autoRun, kinds: Object.assign({}, cur.kinds, b.kinds || {}), updatedAt: new Date().toISOString() }
    writeAtomic(FILE, JSON.stringify(next, null, 2))
    const summary = 'Approved actions run by themselves: ' + (next.autoRun ? 'on' : 'off') + ' (merge ' + (next.kinds.merge ? 'on' : 'off') + ', next phase ' + (next.kinds['next-phase'] ? 'on' : 'off') + ')'
    try { require('./agent-company.cjs').activity({ actor: actorLabel(actor), action: 'automation.set', entityType: 'setting', entityId: 'autoRun', summary, via: actor.door }) } catch { /* no company: the file is the record */ }
    return Object.assign(read(), { summary })
  })
}

/** Whether a version run is at its budget warning or past it. Unknown counts as at it. */
function nearBudget(versionRun) {
  const id = String(versionRun || '').replace(/[^\w.-]/g, '')
  if (!id) return true
  let rec
  try { rec = JSON.parse(fs.readFileSync(path.join(P.VERSION_RUNS, id + '.json'), 'utf8')) } catch { return true }
  if (!rec || !Number.isSafeInteger(rec.budget) || rec.budget <= 0) return true
  let used = null
  try { used = require('./runlog.cjs').versionLedger(id).tokens } catch { return true }
  return (used || 0) >= BUDGET_WARN * rec.budget
}

const APPROVED = /^(approve|approved|yes)$/i

/** Whether an answer earns autoRun: true. `g` is the gate as stored, `answer`
 *  the owner's text. Anything the caller sends besides is never looked at. */
function grant(g, answer) {
  if (!g || g.kind !== 'approval' || !APPROVED.test(String(answer || '').trim())) return false
  const a = g.action && typeof g.action === 'object' ? g.action : null
  const type = a && String(a.type || '')
  if (!KINDS.includes(type) || a.gatesPassed !== true) return false
  const s = read()
  if (!s.autoRun || s.readOnly || !s.kinds[type]) return false
  if (type === 'next-phase' && nearBudget(a.versionRun || g.versionRun)) return false
  return true
}

/** Why an answers.jsonl line's `autoRun: true` must not be acted on, or ''
 *  when the stored gate backs it. The file is plain text that anything on the
 *  machine can append to, so `arsenale answers` checks every such line
 *  against the gate before it passes the flag on: answered, last written by
 *  the dashboard or a phone tap, a merge or next phase whose checks passed,
 *  and approved. */
function verify(line, g) {
  if (!g || typeof g !== 'object') return 'no such gate'
  if (g.status !== 'answered') return 'the gate is ' + (g.status || 'not answered')
  const last = Array.isArray(g.history) && g.history.length ? g.history[g.history.length - 1] : null
  const via = last && typeof last === 'object' ? String(last.via || '') : ''
  if (!(via === 'dashboard' || /^phone:\w+$/.test(via))) return 'the gate was last written ' + (via ? 'by ' + via : 'with no source') + ', not the dashboard or a phone'
  const a = g.action && typeof g.action === 'object' ? g.action : {}
  if (!KINDS.includes(String(a.type || ''))) return 'the gate is not a merge or next phase'
  if (a.gatesPassed !== true) return 'the gate\'s checks did not pass'
  if (!APPROVED.test(String(g.answer || '').trim()) || String(g.answer || '').trim() !== String((line && line.answer) || '').trim()) return 'the stored answer is not this approval'
  return ''
}

module.exports = { FILE, KINDS, read, set, grant, nearBudget, verify }
