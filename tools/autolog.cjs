/* "Done without you": the approvals that went ahead by themselves, and Undo
 * (spec 1.1, 14.2).
 *
 * The record is answers.jsonl, where the owner's Approve already writes a line
 * with `autoRun: true` for a merge or next phase (build-agent-dashboard.answerGate,
 * automation.grant). Nothing new is stored for the list.
 *
 *   log()        the autoRun lines of the last hour, newest first, each with
 *                its Undo window (10 minutes) and whether it was undone.
 *   undo(gate)   board only. Appends a line of type "undo" to answers.jsonl,
 *                which `arsenale answers` shows the supervisor, and tells the
 *                inbox when a company exists. Allowed once, inside the window,
 *                for an autoRun line only. It cannot reverse a merge itself:
 *                the dashboard never runs git or a process (decision 13.2);
 *                the supervisor takes the action back.
 */
const fs = require('fs')
const P = require('./paths.cjs')
const { withLock } = require('./store.cjs')
const { fail, requireBoard, actorLabel } = require('./runlog.cjs')

const WINDOW_MS = 10 * 60000
const LOG_MS = 60 * 60000

function lines() {
  let text = ''
  try { text = fs.readFileSync(P.ANSWERS, 'utf8') } catch { return [] }
  return text.split('\n').filter((l) => l.trim()).map((l) => { try { return JSON.parse(l) } catch { return null } }).filter((l) => l && typeof l === 'object')
}

function log(now) {
  const t = now || Date.now()
  const all = lines()
  const undone = new Map(all.filter((l) => l.type === 'undo' && l.gate).map((l) => [l.gate, l.at]))
  const items = all.filter((l) => l.autoRun === true && l.gate && t - Date.parse(l.at) <= LOG_MS)
    .map((l) => {
      const at = Date.parse(l.at)
      const a = l.action && typeof l.action === 'object' ? l.action : {}
      return {
        gate: l.gate, at: l.at, question: String(l.question || ''), run: l.run || '', project: l.project || '',
        type: String(a.type || ''), ref: String(a.ref || ''), versionRun: String(a.versionRun || l.versionRun || ''),
        undoUntil: new Date(at + WINDOW_MS).toISOString(), undoneAt: undone.get(l.gate) || '',
        canUndo: !undone.has(l.gate) && t - at <= WINDOW_MS,
      }
    }).sort((a, b) => String(b.at).localeCompare(String(a.at)))
  return { windowMin: WINDOW_MS / 60000, items }
}

function undo(gate, actor) {
  requireBoard(actor)
  const id = String(gate || '')
  if (!/^[\w.-]{1,120}$/.test(id) || ['__proto__', 'constructor', 'prototype'].includes(id)) throw fail(400, 'not a gate id')
  // the check and the line under one lock: two clicks at once undo once
  const { item, at } = withLock(P.ANSWERS, () => {
    const it = log().items.find((x) => x.gate === id)
    if (!it) throw fail(404, 'nothing ran by itself for that item in the last hour')
    if (it.undoneAt) throw fail(409, 'This was already undone')
    if (!it.canUndo) throw fail(409, 'The 10 minutes to undo this have passed')
    const now = new Date().toISOString()
    fs.appendFileSync(P.ANSWERS, JSON.stringify({ at: now, type: 'undo', gate: id, question: it.question, answer: '', by: 'user', via: actor.door || 'dashboard', action: { type: it.type, ref: it.ref, versionRun: it.versionRun } }) + '\n')
    return { item: it, at: now }
  })
  try {
    const C = require('./agent-company.cjs')
    if (C.readCompany().configured) C.inboxLine({ type: 'undo', gate: id, run: item.run, summary: 'Undo: the owner takes back "' + item.question + '". Stop it, or reverse it if it already ran.' }, actor.door)
    C.activity({ actor: actorLabel(actor), action: 'automation.undo', entityType: 'gate', entityId: id, summary: 'undid an action that ran by itself: ' + item.question, via: actor.door })
  } catch { /* the answers line is the record */ }
  return { gate: id, undoneAt: at }
}

module.exports = { WINDOW_MS, log, undo }
