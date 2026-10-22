/* Office packs from a folder or a .zip (spec 1.2, the Marketplace, rules
 * 28-34, Q4 b and Q5 a).
 *
 * A local pack is a stranger's instructions that a model will follow, so it
 * goes through four steps and the owner sees every word before it counts:
 *   1. Stage: the page uploads the files themselves ({ path, data } in base64,
 *      or the bytes of one .zip). The server never reads a path the page
 *      names. The entries are checked in memory, then written into
 *      <home>/packs/staging/<random>/pack/, and only that copy is checked
 *      again, so the source cannot change under the check.
 *   2. Check: every rule below; any failure refuses the whole pack, lists
 *      every reason, and removes the staging folder.
 *   3. Review: what the page shows (members, their declared tools, what
 *      read-only would drop, the full text, flags, files and sizes), with a
 *      hash of the staged files.
 *   4. Install: the owner's click, with that hash, on the board-only write
 *      path. The staged copy is checked a third time, installed through the
 *      same steps as a bundled pack (packs.cjs installFrom), and moved to
 *      <home>/packs/local/<id>/<version>/.
 *
 * What a local pack may hold (rule 29):
 *   - only pack.json, labels.json, README.md and agents/<member>.md: text,
 *     UTF-8, no NUL byte; nothing else (no script, no binary, no hidden file,
 *     no folder of its own); a .zip may wrap them in one top folder;
 *   - no "..", no absolute path, no drive letter, no backslash; in a .zip no
 *     link and no special file (zip-read.cjs);
 *   - each file at most 64 KB, the pack at most 1 MB, at most 200 entries,
 *     at most 24 members (readPack), a member file for each member and no
 *     other;
 *   - pack.json passes readPack, has no __proto__ / constructor / prototype
 *     key at any depth, is not the id of a bundled pack, and names no core or
 *     reference member (a stranger's pack must not claim to be the core
 *     team); its office is not an office the company already has;
 *   - each member file starts with a frontmatter of single "key: value" lines,
 *     only the keys packs/README.md names, each at most once, name = the id.
 *
 * Tools (Q5 a). A member file's `tools:` line is honoured by Claude Code, and
 * a file WITHOUT one gets every tool there. So every local member is written
 * with `tools: Read, Grep, Glob` (as the first frontmatter line, every other
 * tools line removed) unless the owner ticked "keep" for that member on the
 * review screen.
 *
 * No code from a pack ever runs: its files are read as text, shown as text,
 * and written as text into the agent folder. Nothing here starts a process.
 *
 * The flags on the review screen are hints, not a guarantee (rule 30): the
 * phrase lists live here, in one place.
 */
const fs = require('fs')
const path = require('path')
const crypto = require('crypto')
const P = require('./paths.cjs')
const Pk = require('./packs.cjs')
const { readZip } = require('./zip-read.cjs')
const { fail, requireBoard, clipCp } = require('./runlog.cjs')

const LIMITS = { entries: 200, file: 64 * 1024, total: 1024 * 1024 }
const STAGING = path.join(P.HOME, 'packs', 'staging')
const STALE_MS = 60 * 60 * 1000
const STAGE_ID = /^[a-f0-9]{32}$/
const PATH_RX = /^(pack\.json|labels\.json|README\.md|agents\/[a-z][a-z0-9-]{1,59}\.md)$/
const RESERVED = /^(con|prn|aux|nul|com[1-9]|lpt[1-9])$/
const READ_ONLY = ['Read', 'Grep', 'Glob']
const READ_ONLY_LINE = 'tools: ' + READ_ONLY.join(', ')
const FRONT_KEYS = ['name', 'description', 'model', 'effort', 'tools', 'color', 'zone']
const BAD_KEYS = new Set(['__proto__', 'constructor', 'prototype'])

// ---------- the review flags (rule 30): hints only, the page says so
const OVERRIDE = [
  'ignore previous', 'ignore all previous', 'ignore the above', 'ignore your instructions', 'ignore the house rules',
  'disregard previous', 'disregard the house rules', 'disregard your instructions', 'forget your instructions',
  'do not tell the owner', "don't tell the owner", 'do not tell the user', "don't tell the user", 'without telling',
  'skip the safety', 'skip check_action', 'do not call check_action', 'you are now', 'new instructions', 'system prompt',
]
const ACTION = /\b(send|post|pay|delete|upload|publish|transfer|wire|e-?mail)\b/i
const NEGATED = /\b(never|not|no|without)\b|n't\b/i
const URL_RX = /\bhttps?:\/\/[^\s)<>"']+|\bwww\.[^\s)<>"']+/gi
const EMAIL_RX = /[\w.+-]+@[\w-]+(\.[\w-]+)+/g

// every reason is listed (rule 28.2), up to a page of them: a picked folder with .git inside has hundreds
const bad = (reasons) => {
  const shown = reasons.length > 30 ? reasons.slice(0, 30).concat(['and ' + (reasons.length - 30) + ' more']) : reasons
  const e = fail(400, 'This pack was refused:\n- ' + shown.join('\n- '))
  e.reasons = reasons
  return e
}

/** The stricter path check, the same for a folder and a .zip. '' when fine. */
function pathProblem(name) {
  const s = String(name)
  if (!s) return 'an entry with no name'
  if (s.length > 200) return 'a path longer than 200 characters'
  if (/[\x00-\x1f\x7f]/.test(s)) return 'a path with a control character'
  if (s.includes('\\')) return s + ': a backslash in a path'
  if (s.startsWith('/') || /^[a-zA-Z]:/.test(s)) return s + ': an absolute path'
  const parts = s.replace(/\/$/, '').split('/')
  if (parts.some((x) => x === '..')) return s + ': a ".." in a path'
  if (parts.some((x) => x === '' || x === '.')) return s + ': an empty or "." part in a path'
  return ''
}

/** A JSON value with a key that could reach an object's prototype. */
function protoKey(v, depth) {
  if ((depth || 0) > 20) return 'too deeply nested'
  if (Array.isArray(v)) { for (const x of v) { const r = protoKey(x, (depth || 0) + 1); if (r) return r } return '' }
  if (v && typeof v === 'object') {
    for (const k of Object.keys(v)) {
      if (BAD_KEYS.has(k)) return 'the key "' + k + '"'
      const r = protoKey(v[k], (depth || 0) + 1)
      if (r) return r
    }
  }
  return ''
}

// ignoreBOM keeps a byte-order mark in the text, so a member file that starts
// with one is seen (and refused) rather than silently decoded away
const UTF8 = new TextDecoder('utf-8', { fatal: true, ignoreBOM: true })
function textOf(buf) { try { return UTF8.decode(buf) } catch { return null } }

/** The uploaded entries, from a body the page sent: [{ name, dir, data }]. */
function entriesOf(body) {
  const b64 = (s) => {
    const t = String(s == null ? '' : s)
    // strict: Buffer.from would skip characters it does not know
    if (t.length % 4 || !/^[A-Za-z0-9+/]*={0,2}$/.test(t)) throw bad(['the upload is damaged (not base64)'])
    return Buffer.from(t, 'base64')
  }
  if (body && typeof body.zip === 'string') return readZip(b64(body.zip), LIMITS)
  if (!body || !Array.isArray(body.files)) throw bad(['nothing was uploaded'])
  if (body.files.length > LIMITS.entries) throw bad(['more than ' + LIMITS.entries + ' files'])
  return body.files.map((f) => ({ name: String((f && f.path) || ''), dir: false, data: b64(f && f.data) }))
}

/** Checks entries in memory: names, sizes, text. Returns { files, reasons }
 *  with the files at their pack paths (one wrapping top folder removed). */
function checkEntries(entries) {
  const reasons = []
  if (entries.length > LIMITS.entries) return { files: [], reasons: ['more than ' + LIMITS.entries + ' files'] }
  for (const e of entries) { const r = pathProblem(e.name); if (r) reasons.push(r) }
  if (reasons.length) return { files: [], reasons }
  // a zip of the folder, or a picked folder: everything under one top folder
  let list = entries
  const tops = new Set(list.map((e) => e.name.split('/')[0]))
  if (tops.size === 1 && !list.some((e) => e.name === 'pack.json')) {
    const top = [...tops][0] + '/'
    list = list.filter((e) => e.name !== top).map((e) => Object.assign({}, e, { name: e.name.startsWith(top) ? e.name.slice(top.length) : e.name }))
  }
  const files = []
  const seen = new Set()
  let total = 0
  for (const e of list) {
    if (e.dir) { if (e.name !== 'agents/') reasons.push(e.name + ': a folder a pack does not have'); continue }
    if (!PATH_RX.test(e.name)) { reasons.push(e.name + ': not a file a pack may hold (only pack.json, labels.json, README.md and agents/<member>.md)'); continue }
    const base = e.name.replace(/^agents\//, '').replace(/\.md$/, '')
    if (e.name.startsWith('agents/') && RESERVED.test(base)) { reasons.push(e.name + ': a name Windows reserves'); continue }
    if (seen.has(e.name.toLowerCase())) { reasons.push(e.name + ': in the pack twice'); continue }
    seen.add(e.name.toLowerCase())
    total += e.data.length
    if (e.data.length > LIMITS.file) { reasons.push(e.name + ': larger than 64 KB'); continue }
    const text = textOf(e.data)
    if (text === null) { reasons.push(e.name + ': not UTF-8 text'); continue }
    if (text.includes('\u0000')) { reasons.push(e.name + ': holds a NUL byte (not plain text)'); continue }
    files.push({ path: e.name, data: e.data, text })
  }
  if (total > LIMITS.total) reasons.push('the pack is larger than 1 MB')
  if (!seen.has('pack.json')) reasons.push('there is no pack.json')
  return { files, reasons }
}

/** The frontmatter of a member file, strictly: { keys, lines, eol } or a reason. */
function frontOf(text) {
  if (text.charCodeAt(0) === 0xfeff) return { reason: 'starts with a byte-order mark (save it as UTF-8 without one)' }
  const m = /^---(\r?\n)([\s\S]*?)\r?\n---(\r?\n|$)/.exec(text)
  if (!m) return { reason: 'has no frontmatter between --- lines at the top' }
  const keys = {}
  for (const line of m[2].split(/\r?\n/)) {
    const kv = /^([a-z]+):(.*)$/.exec(line)
    if (!kv) return { reason: 'has a frontmatter line that is not "key: value": ' + clipCp(line, 40) }
    if (!FRONT_KEYS.includes(kv[1])) return { reason: 'has the frontmatter key "' + kv[1] + '", which a pack member may not have' }
    if (Object.hasOwn(keys, kv[1])) return { reason: 'has the key "' + kv[1] + '" twice' }
    keys[kv[1]] = kv[2].trim()
  }
  // Claude Code reads this as YAML, where an open quote, a block scalar, a
  // flow list, an anchor or a tag can run on over the next lines and swallow
  // a "tools:" line we counted, so the member would get every tool. A quoted
  // value closed on its own line is the house style and stays.
  for (const [k, v] of Object.entries(keys)) {
    if (/^"[^"\\]*"$/.test(v) || /^'(?:[^']|'')*'$/.test(v)) continue
    if (/^["'[{|>&*!%@`]/.test(v)) return { reason: 'has a "' + k + '" value that starts with ' + v[0] + ' (write it on one line, plain or closed in quotes)' }
  }
  return { keys, eol: m[1], end: m[0].length }
}

/** The member text with the tools line set to read-only: the read-only line
 *  first after the opening ---, every other tools line removed. First, so no
 *  line above it can make YAML read it as part of another value. */
function readOnlyTools(text) {
  const fm = frontOf(text)
  if (fm.reason) throw fail(400, 'a member file ' + fm.reason)
  const open = 3 + fm.eol.length
  const head = text.slice(open, fm.end).replace(/^tools:.*(\r?\n|$)/gm, '')
  return text.slice(0, open) + READ_ONLY_LINE + fm.eol + head + text.slice(fm.end)
}

/** The tools a member declares, and what read-only would drop. */
function toolsOf(keys) {
  if (!Object.hasOwn(keys, 'tools')) return { declared: null, dropped: 'all' }
  const list = keys.tools.replace(/^\[|\]$/g, '').split(',').map((s) => s.trim().replace(/^["']|["']$/g, '')).filter(Boolean)
  return { declared: keys.tools, dropped: list.filter((t) => !READ_ONLY.includes(t)) }
}

/** The review flags of one text (rule 30). */
function flagsOf(file, text) {
  const out = []
  const add = (what, line) => { if (out.length < 40) out.push({ file, what, line: clipCp(String(line).trim(), 160) }) }
  const lines = text.split(/\r?\n/)
  for (const line of lines) {
    for (const u of line.match(URL_RX) || []) add('a web address', u)
    for (const m of line.match(EMAIL_RX) || []) if (!/@example\./i.test(m)) add('an e-mail address', m)
    const low = line.toLowerCase()
    for (const ph of OVERRIDE) if (low.includes(ph)) add('words that try to override the rules', line)
    if (ACTION.test(line) && !NEGATED.test(line) && !/^(name|description|model|effort|tools|color|zone):/.test(line)) add('an instruction to send, post, pay, delete or upload', line)
  }
  return out
}

/** Reads and checks a staged pack folder (our own copy). Returns the review,
 *  or throws with every reason. */
function checkStaged(dir) {
  const reasons = []
  // the copy is ours, but it lives on disk: walk it with lstat, links refused
  const entries = []
  const walk = (d, rel) => {
    for (const n of fs.readdirSync(d)) {
      const full = path.join(d, n), r = rel ? rel + '/' + n : n
      const s = fs.lstatSync(full)
      if (s.isSymbolicLink()) { reasons.push(r + ': a link'); continue }
      if (s.isDirectory()) { if (r !== 'agents') reasons.push(r + ': a folder a pack does not have'); else walk(full, r); continue }
      if (!s.isFile()) { reasons.push(r + ': not a plain file'); continue }
      if (s.size > LIMITS.file) { reasons.push(r + ': larger than 64 KB'); continue }
      entries.push({ name: r, dir: false, data: fs.readFileSync(full) })
    }
  }
  walk(dir, '')
  const c = checkEntries(entries)
  reasons.push(...c.reasons)
  if (reasons.length) throw bad(reasons)
  const byPath = Object.fromEntries(c.files.map((f) => [f.path, f]))

  let raw
  try { raw = JSON.parse(P.stripBom(byPath['pack.json'].text)) } catch { throw bad(['pack.json is not JSON']) }
  if (!raw || typeof raw !== 'object' || Array.isArray(raw)) throw bad(['pack.json is not an object'])
  const pk = protoKey(raw)
  if (pk) throw bad(['pack.json has ' + pk])
  if (byPath['labels.json']) {
    let lj
    try { lj = JSON.parse(P.stripBom(byPath['labels.json'].text)) } catch { reasons.push('labels.json is not JSON') }
    if (lj !== undefined) {
      if (!lj || typeof lj !== 'object' || Array.isArray(lj)) reasons.push('labels.json is not an object')
      else { const lk = protoKey(lj); if (lk) reasons.push('labels.json has ' + lk) }
    }
  }
  const rawMembers = Array.isArray(raw.members) ? raw.members : []
  for (const m of rawMembers) if (m && typeof m === 'object' && (Object.hasOwn(m, 'core') || Object.hasOwn(m, 'ref'))) reasons.push('the member ' + clipCp(m.id, 60) + ' claims to be a core team agent; a pack from a folder brings its own members')
  if (reasons.length) throw bad(reasons)

  let p
  try { p = Pk.readPack(dir) } catch (e) { throw bad([e.code >= 400 && e.code < 500 ? e.message : 'pack.json does not have the pack format']) }
  if (RESERVED.test(p.id)) reasons.push('the pack id is a name Windows reserves')
  if (bundledIds().has(p.id)) reasons.push('This id belongs to a pack that ships with Arsenale')
  if (Pk.cmpSemver(p.minArsenale, Pk.APP_VERSION) > 0) reasons.push('This pack needs Arsenale ' + p.minArsenale + ' or newer')
  if (Array.isArray(raw.sampleTasks) && raw.sampleTasks.some((t) => !t || typeof t !== 'object')) reasons.push('pack.json has a sample task that is not an object')
  // every member file is listed, and every listed member has its file
  const listed = new Set(p.members.map((m) => 'agents/' + m.id + '.md'))
  for (const f of c.files) if (f.path.startsWith('agents/') && !listed.has(f.path)) reasons.push(f.path + ': a member file that pack.json does not list')
  const taken = reservedIds()
  for (const m of p.members) if (taken.has(m.id.toLowerCase())) reasons.push('the member id "' + m.id + '" is a name Arsenale uses for its own people (the board, the supervisor or a core agent)')
  // labels only for this pack's own members: a stranger's labels.json must not retitle the owner's agents
  const own = new Set(p.members.map((m) => m.id))
  p.labels = Object.fromEntries(Object.entries(p.labels).filter(([k]) => own.has(k)))

  const members = []
  for (const m of p.members) {
    const f = byPath['agents/' + m.id + '.md']
    if (!f) { reasons.push('agents/' + m.id + '.md is missing'); continue }
    const fm = frontOf(f.text)
    if (fm.reason) { reasons.push(f.path + ' ' + fm.reason); continue }
    if (fm.keys.name !== m.id) reasons.push(f.path + ': its name line must be "name: ' + m.id + '"')
    if (!fm.keys.description) reasons.push(f.path + ': has no description line')
    const t = toolsOf(fm.keys)
    members.push({ id: m.id, title: m.title, zone: m.zone, tier: m.tier, lead: m.id === p.office.lead, model: fm.keys.model || '', tools: t.declared, dropped: t.dropped, size: f.data.length, text: f.text })
  }
  if (reasons.length) throw bad(reasons)

  const flags = []
  for (const m of members) {
    if (m.tools === null) flags.push({ file: 'agents/' + m.id + '.md', what: 'no tools line: in Claude Code this member would get every tool', line: '' })
    else if (m.dropped.length) flags.push({ file: 'agents/' + m.id + '.md', what: 'tools beyond reading', line: 'tools: ' + m.tools })
    if (m.model) flags.push({ file: 'agents/' + m.id + '.md', what: 'a model line', line: 'model: ' + m.model })
    if (!/## Safety: prepare, do not act/.test(m.text)) flags.push({ file: 'agents/' + m.id + '.md', what: 'no safety block', line: '' })
  }
  for (const f of c.files) flags.push(...flagsOf(f.path, f.text))

  return {
    id: p.id, version: p.version, name: p.name, description: p.description,
    office: p.office, members, policyRows: p.policyRows, sampleTasks: p.sampleTasks,
    readme: byPath['README.md'] ? byPath['README.md'].text : '', labels: p.labels,
    files: c.files.map((f) => ({ path: f.path, size: f.data.length })).sort((a, b) => (a.path < b.path ? -1 : 1)),
    total: c.files.reduce((n, f) => n + f.data.length, 0),
    flags, hash: hashOf(c.files), pack: p,
  }
}

const hashOf = (files) => Pk.sha256(Buffer.from(files.map((f) => f.path + '\0' + Pk.sha256(f.data)).sort().join('\n'), 'utf8'))
function reservedIds() {
  const out = new Set(['ceo', 'board', 'unassigned', 'supervisor'])
  try { for (const n of fs.readdirSync(Pk.coreDir())) out.add(path.parse(n).name.toLowerCase()) } catch { /* no core folder */ }
  return out
}
function bundledIds() { try { return new Set(fs.readdirSync(Pk.BUNDLED).filter((n) => Pk.PACK_ID.test(n))) } catch { return new Set() } }

/** Removes staging folders older than an hour (a closed review, a restart). */
function cleanStaging(now) {
  let names = []
  try { names = fs.readdirSync(STAGING) } catch { return 0 }
  let n = 0
  for (const x of names) {
    if (!STAGE_ID.test(x)) continue
    const full = path.join(STAGING, x)
    try { if ((now || Date.now()) - fs.statSync(full).mtimeMs > STALE_MS) { fs.rmSync(full, { recursive: true, force: true }); n++ } } catch { /* gone */ }
  }
  return n
}

const stageDir = (id) => {
  if (!STAGE_ID.test(String(id))) throw fail(400, 'bad review id')
  return path.join(STAGING, String(id))
}

/** What installing would meet in this company: members that exist, an
 *  office that exists, an installed copy of the pack. */
function situation(r) {
  const st = Pk.readState()
  const inst = Object.hasOwn(st.packs, r.id) ? st.packs[r.id] : null
  let office = null
  try { office = require('./agent-company.cjs').readCompany().offices.find((o) => o.id === r.office.id && !o.archived) || null } catch { /* no company */ }
  return { inst, office, conflicts: inst ? [] : Pk.conflictsOf(r.pack) }
}

function reviewOf(stage, r) {
  const s = situation(r)
  return {
    stage, hash: r.hash, id: r.id, version: r.version, name: r.name, description: r.description, office: r.office,
    members: r.members.map((m) => ({ id: m.id, title: m.title, zone: m.zone, tier: m.tier, lead: m.lead, model: m.model, tools: m.tools, dropped: m.dropped, readOnly: READ_ONLY_LINE, size: m.size, text: m.text })),
    policy: r.policyRows, sampleTasks: r.sampleTasks, readme: r.readme, labels: r.labels, files: r.files, total: r.total, flags: r.flags,
    update: s.inst ? String(s.inst.version || '') : '', conflicts: s.conflicts, notChecked: 'From a folder: not checked by Arsenale',
  }
}

/** Step 1-3: stage the upload, check it, return the review. Board only. */
function stage(body, actor) {
  requireBoard(actor)
  cleanStaging()
  const entries = entriesOf(body)
  const c = checkEntries(entries)
  if (c.reasons.length) throw bad(c.reasons)
  const id = crypto.randomBytes(16).toString('hex')
  const dir = path.join(stageDir(id), 'pack')
  try {
    fs.mkdirSync(path.join(dir, 'agents'), { recursive: true })
    for (const f of c.files) {
      const full = path.join(dir, ...f.path.split('/'))
      // the path passed PATH_RX; this is the belt to those braces
      const rel = path.relative(dir, full)
      if (!rel || rel.startsWith('..') || path.isAbsolute(rel)) throw bad([f.path + ': outside the pack'])
      fs.writeFileSync(full, f.data, { flag: 'wx' })
    }
    const r = checkStaged(dir)
    const s = situation(r)
    const more = []
    if (s.inst && s.inst.source !== 'local') more.push('A pack with this id is installed from Arsenale itself')
    else if (s.inst && !(Pk.cmpSemver(r.version, String(s.inst.version)) > 0)) more.push('This pack is installed already, at version ' + s.inst.version + '; an update needs a higher version')
    if (!s.inst && s.office) more.push('Your company has an office "' + s.office.id + '" already; a pack brings an office of its own')
    if (more.length) throw bad(more)
    return reviewOf(id, r)
  } catch (e) {
    fs.rmSync(stageDir(id), { recursive: true, force: true })
    throw e
  }
}

/** Closing the review: the staged copy goes. Board only. */
function cancel(stageId, actor) {
  requireBoard(actor)
  fs.rmSync(stageDir(stageId), { recursive: true, force: true })
  return { stage: String(stageId) }
}

/** Step 4: the owner's Install. `keep` is { <member>: true } for members whose
 *  own tools line stays. Board only. */
function install(body, actor) {
  requireBoard(actor)
  const b = body || {}
  const root = stageDir(b.stage)
  const dir = path.join(root, 'pack')
  if (!fs.existsSync(dir)) throw fail(404, 'This review has expired. Upload the pack again.')
  let r
  try { r = checkStaged(dir) } catch (e) { fs.rmSync(root, { recursive: true, force: true }); throw e }
  if (String(b.hash || '') !== r.hash) throw fail(409, 'The pack changed after the review. Upload it again.')
  const keepIn = b.keep && typeof b.keep === 'object' && !Array.isArray(b.keep) ? b.keep : {}
  const toolsKept = {}
  for (const m of r.members) toolsKept[m.id] = Object.hasOwn(keepIn, m.id) && keepIn[m.id] === true
  const textOf = (m, text) => (toolsKept[m.id] ? text : readOnlyTools(text))
  const localDir = path.posix.join('packs', 'local', r.id, r.version)
  const extra = { source: 'local', localDir, reviewedAt: new Date().toISOString(), toolsKept }
  const st = Pk.readState()
  const inst = Object.hasOwn(st.packs, r.id) ? st.packs[r.id] : null
  let out
  if (inst) {
    if (inst.source !== 'local') throw fail(409, 'A pack with this id is installed from Arsenale itself')
    const before = inst.localDir
    out = Pk.updateFrom(r.pack, actor, st, inst, { textOf, extra })
    moveIn(dir, localDir)
    if (before && before !== localDir) removeOld(before)
  } else {
    out = Pk.installFrom(r.pack, actor, { onConflict: b.onConflict, textOf, extra })
    moveIn(dir, localDir)
  }
  fs.rmSync(root, { recursive: true, force: true })
  return Object.assign({ toolsKept, source: 'local' }, out)
}

/** The staged copy becomes the installed version's own copy. */
function moveIn(dir, rel) {
  const dest = path.resolve(P.HOME, rel)
  fs.rmSync(dest, { recursive: true, force: true })
  fs.mkdirSync(path.dirname(dest), { recursive: true })
  fs.renameSync(dir, dest)
}
function removeOld(rel) {
  const full = path.resolve(P.HOME, String(rel))
  const inside = path.relative(Pk.LOCAL, full)
  if (inside && !inside.startsWith('..') && !path.isAbsolute(inside)) fs.rmSync(full, { recursive: true, force: true })
}

/** The one door for the page: { op: stage | install | cancel }. */
function handle(body, actor) {
  requireBoard(actor)
  const op = String((body && body.op) || '')
  if (op === 'stage') return stage(body, actor)
  if (op === 'install') return install(body, actor)
  if (op === 'cancel') return cancel(body.stage, actor)
  throw fail(400, 'unknown op')
}

module.exports = { LIMITS, STAGING, READ_ONLY, READ_ONLY_LINE, OVERRIDE, PATH_RX, pathProblem, protoKey, entriesOf, checkEntries, checkStaged, frontOf, readOnlyTools, toolsOf, flagsOf, cleanStaging, stage, cancel, install, handle }
