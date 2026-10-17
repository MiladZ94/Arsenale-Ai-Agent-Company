/* The campus: where each office's building stands (spec 16.2, rules 7 to 11).
 *
 * company/campus.json is optional. `schemaVersion 1`, `grid {cols, rows}`,
 * `buildings [{id, officeId, type, x, y, rot, floors, createdBy, createdAt}]`,
 * `roads`, `props`. An older Arsenale never reads it; a file with a newer
 * schemaVersion is shown and never written.
 *
 * Without the file the layout is derived from offices.json, one lot per office
 * in list order (what the campus has always been), and nothing is written:
 * reads never write. The first placement, move, turn or removal saves the
 * whole layout, derived part included, so a lot never changes under the owner.
 *
 * One write path (place, move, rotate, remove), used by the board through
 * POST /api/campus and by the supervisor through `arsenale campus`. The
 * supervisor may use it in an autonomous run only, and every such call also
 * writes a decision (A4); an agent cannot use it at all. Removing a building
 * archives its office: the office's history stays.
 *
 * The file is written whole into a temporary file and renamed (store.cjs), under a lock, so a reader never sees half a file and two
 * writers lose no update.
 */
const fs = require('fs')
const path = require('path')
const P = require('./paths.cjs')

const { withLock, writeAtomic } = require('./store.cjs')

const SCHEMA = 1
const DEFAULT_GRID = { cols: 6, rows: 4 }
const MAX_GRID = 24
const FILE = () => path.join(P.COMPANY, 'campus.json')
const company = () => require('./agent-company.cjs')

/** The 12 office types (rule 10): the shipped model, the default zones and the
 *  default pack of each. `theme` is a key of THEMES. `words` are what an
 *  office's free-text profile may say; the profile selects the type, the
 *  position in the list never does. */
const TYPES = [
  { id: 'engineering', name: 'Engineering', theme: 'blue', zones: ['build', 'review', 'lead'], pack: 'autonomous-dev', words: ['engineer', 'software', 'develop', 'code', 'build'] },
  { id: 'verification', name: 'Verification', theme: 'green', zones: ['review'], pack: 'verification', words: ['verif', 'qa', 'quality', 'test'] },
  { id: 'security', name: 'Security', theme: 'violet', zones: ['review'], pack: 'security', words: ['secur'] },
  { id: 'release', name: 'Release', theme: 'coral', zones: ['build', 'lead'], pack: 'release', words: ['release', 'ship', 'devops', 'deploy'] },
  { id: 'docs', name: 'Docs', theme: 'amber', zones: ['docs'], pack: 'docs', words: ['doc', 'writ', 'content'] },
  { id: 'design', name: 'Design', theme: 'pink', zones: ['design'], pack: 'design', words: ['design', 'ux', 'ui'] },
  { id: 'data', name: 'Data', theme: 'cyan', zones: ['build', 'review'], pack: 'data-integrity', words: ['data', 'analytic'] },
  { id: 'planning', name: 'Planning', theme: 'teal', zones: ['lead', 'docs'], pack: 'product-discovery', words: ['plan', 'product', 'strateg'] },
  { id: 'legal', name: 'Legal', theme: 'slate', zones: ['docs', 'review'], pack: 'legal-compliance', words: ['legal', 'complian', 'law'] },
  { id: 'business', name: 'Business', theme: 'blue', zones: ['docs', 'lead'], pack: 'finance', words: ['business', 'financ', 'hr', 'support', 'market', 'sales', 'operation'] },
  { id: 'archive', name: 'Archive hall', theme: 'amber', zones: ['docs'], pack: '', words: ['archiv', 'record'] },
  { id: 'domain', name: 'Domain lab', theme: 'green', zones: ['build', 'review'], pack: 'domain-engineering', words: ['domain', 'lab', 'research', 'science'] },
]
const TYPE_IDS = new Set(TYPES.map((t) => t.id))
const typeById = (id) => TYPES.find((t) => t.id === id) || null

/** The type of an office from its profile: the id itself, or a word it contains. */
function typeOfProfile(profile) {
  const p = String(profile || '').toLowerCase().trim()
  if (TYPE_IDS.has(p)) return p
  for (const t of TYPES) if (t.words.some((w) => p.includes(w))) return t.id
  return 'business'
}

function fail(code, message) { const e = new Error(message); e.code = code; return e }
const clip = (s, n) => String(s == null ? '' : s).slice(0, n)
const readJson = (f, d) => { try { return JSON.parse(fs.readFileSync(f, 'utf8')) } catch { return d } }
const int = (v) => (typeof v === 'number' || (typeof v === 'string' && /^-?\d+$/.test(v))) && Number.isInteger(Number(v)) ? Number(v) : NaN

/** Offices that can have a building: the stored ones, not archived. */
const placeable = (co) => co.offices.filter((o) => !o.builtIn && !o.archived)

/** The first free lot for an office that has none: every other lot first (a
 *  checkerboard, so the campus does not start as one crowded row), row by row,
 *  then the lots between; null when the grid is full. */
function freeLot(grid, taken) {
  for (const parity of [0, 1]) for (let y = 0; y < grid.rows; y++) for (let x = 0; x < grid.cols; x++) if ((x + y) % 2 === parity && !taken.has(x + ',' + y)) return [x, y]
  return null
}

/** The campus as it stands: the file checked against the offices, plus a lot
 *  for every office the file does not know (a pack installed since, or the
 *  whole company when there is no file). Never writes. */
function readCampus(co) {
  co = co || company().readCompany()
  const raw = readJson(FILE(), null)
  const problems = []
  const readOnly = !!(raw && Number(raw.schemaVersion) > SCHEMA)
  const stored = raw && typeof raw === 'object' && !Array.isArray(raw)
  const gc = stored && raw.grid ? int(raw.grid.cols) : NaN, gr = stored && raw.grid ? int(raw.grid.rows) : NaN
  const grid = { cols: gc >= 1 && gc <= MAX_GRID ? gc : DEFAULT_GRID.cols, rows: gr >= 1 && gr <= MAX_GRID ? gr : DEFAULT_GRID.rows }
  const offices = new Map(placeable(co).map((o) => [o.id, o]))
  const taken = new Set()
  const buildings = []
  for (const b of stored && Array.isArray(raw.buildings) ? raw.buildings : []) {
    if (!b || !offices.has(b.officeId)) continue // an archived or missing office has no building
    const x = int(b.x), y = int(b.y)
    if (!(x >= 0 && x < grid.cols && y >= 0 && y < grid.rows) || taken.has(x + ',' + y) || buildings.some((o) => o.officeId === b.officeId)) { problems.push('campus.json: a building of "' + clip(b.officeId, 40) + '" was left out (outside the grid or on a taken lot)'); continue }
    taken.add(x + ',' + y)
    const fl = int(b.floors)
    buildings.push({
      id: clip(b.id, 60) || 'b-' + b.officeId, officeId: b.officeId, type: TYPE_IDS.has(b.type) ? b.type : typeOfProfile(offices.get(b.officeId).profile),
      x, y, rot: ((int(b.rot) || 0) % 4 + 4) % 4, floors: fl >= 1 && fl <= 6 ? fl : 1, createdBy: clip(b.createdBy, 60), createdAt: clip(b.createdAt, 40),
    })
  }
  // offices with no lot yet, in list order, on the first free lot
  let derived = !stored
  const known = new Set(buildings.map((b) => b.officeId))
  for (const o of offices.values()) {
    if (known.has(o.id)) continue
    let lot = freeLot(grid, taken)
    if (!lot && !readOnly && grid.rows < MAX_GRID) { grid.rows++; lot = freeLot(grid, taken) } // the grid grows by a row, never past the cap
    if (!lot) { problems.push('campus: no free lot for "' + o.id + '"'); continue }
    taken.add(lot[0] + ',' + lot[1])
    buildings.push({ id: 'b-' + o.id, officeId: o.id, type: typeOfProfile(o.profile), x: lot[0], y: lot[1], rot: 0, floors: 1, createdBy: 'derived', createdAt: '' })
    derived = true
  }
  return {
    schemaVersion: SCHEMA, readOnly, derived, grid, buildings,
    roads: stored && Array.isArray(raw.roads) ? raw.roads : [], props: stored && Array.isArray(raw.props) ? raw.props : [], problems,
  }
}

/** What the page and api/company get. */
function view(co) {
  const c = readCampus(co)
  return {
    schemaVersion: c.schemaVersion, readOnly: c.readOnly, derived: c.derived, grid: c.grid,
    buildings: c.buildings.map((b) => ({ id: b.id, officeId: b.officeId, type: b.type, x: b.x, y: b.y, rot: b.rot, floors: b.floors })),
    types: TYPES.map((t) => ({ id: t.id, name: t.name, theme: t.theme, zones: t.zones, pack: t.pack })),
  }
}

const slug = (s) => String(s || '').toLowerCase().normalize('NFKD').replace(/[^a-z0-9]+/g, '-').replace(/^[^a-z]+|-+$/g, '').slice(0, 28)
function freshOfficeId(name, co) {
  const base = slug(name) || 'office'
  const ids = new Set(co.offices.map((o) => o.id))
  if (base.length >= 2 && !ids.has(base)) return base
  for (let n = 2; n < 1000; n++) { const id = (base.length >= 2 ? base : 'office') + '-' + n; if (!ids.has(id)) return id }
  throw fail(409, 'no free office id')
}

/** A record left in an active status by a crashed run must not keep campus
 *  edits open: its process is alive, or it was updated in the last 30 minutes. */
const LIVE_MS = 30 * 60 * 1000
function isLive(r) {
  const pid = Number(r.pid)
  if (Number.isInteger(pid) && pid > 0) { try { process.kill(pid, 0); return true } catch (e) { if (e.code === 'EPERM') return true } }
  const t = Date.parse(r.updatedAt || '')
  return !isNaN(t) && Date.now() - t < LIVE_MS
}

/** Who may do this. The board: always. The supervisor: only while an
 *  autonomous version run is going. An agent: never. */
function allowed(actor) {
  const role = actor && actor.role
  if (role === 'board') return ''
  if (role === 'agent') throw fail(403, 'an agent cannot change the campus')
  const dir = P.VERSION_RUNS
  let live = ''
  try {
    for (const f of fs.readdirSync(dir)) {
      const r = readJson(path.join(dir, f), null)
      if (r && ['planning', 'running', 'waiting for owner', 'blocked'].includes(r.status) && isLive(r)) { live = r.id || f.replace(/\.json$/, ''); break }
    }
  } catch { /* no version runs */ }
  if (!live) throw fail(403, 'the supervisor changes the campus in an autonomous run only; ask the owner or use the dashboard')
  return live
}

const label = (b, o) => (o ? o.name : b.officeId)

/** The one write path. input: {op: place|move|rotate|remove, ...}. `via` is
 *  the door ('dashboard', 'cli'). Returns {summary, building?, office?}. */
function apply(input, actor, via) {
  const op = String(input && input.op || '')
  if (!['place', 'move', 'rotate', 'remove'].includes(op)) throw fail(400, 'op must be place, move, rotate or remove')
  const liveRun = allowed(actor)
  if (actor.role !== 'board' && !clip(input.reason, 400).trim()) throw fail(400, 'a supervisor campus change needs a "reason": it is logged as a decision')
  const C = company()
  const out = withLock(FILE(), () => {
    const co = C.readCompany()
    if (!co.configured) throw fail(409, 'no company configured: run arsenale log --company-init first')
    if (co.readOnly) throw fail(409, 'Company data was written by a newer dashboard. Editing is disabled.')
    const cur = readCampus(co)
    if (cur.readOnly) throw fail(409, 'campus.json was written by a newer Arsenale. Editing is disabled.')
    const taken = new Map(cur.buildings.map((b) => [b.x + ',' + b.y, b]))
    const nameOf = (b) => label(b, co.offices.find((o) => o.id === b.officeId))
    const by = actor.role === 'board' ? 'board' : 'supervisor'
    let summary, building, office
    const lot = () => {
      const x = int(input.x), y = int(input.y)
      if (!(x >= 0 && x < cur.grid.cols && y >= 0 && y < cur.grid.rows)) throw fail(409, 'Outside the grid')
      return [x, y]
    }
    const find = () => {
      const b = cur.buildings.find((q) => q.id === String(input.id || '') || q.officeId === String(input.officeId || '\u0000'))
      if (!b) throw fail(404, 'no such building: ' + clip(input.id || input.officeId, 60))
      return b
    }
    if (op === 'place') {
      const type = String(input.type || '')
      if (!TYPE_IDS.has(type)) throw fail(400, 'unknown building type: ' + clip(type, 30))
      const [x, y] = lot()
      const there = taken.get(x + ',' + y)
      if (there) throw fail(409, 'Lot taken: ' + nameOf(there))
      const t = typeById(type)
      let id = String(input.officeId || '')
      if (id) {
        if (!co.offices.some((o) => o.id === id && !o.builtIn && !o.archived)) throw fail(404, 'no such office: ' + clip(id, 40))
        if (cur.buildings.some((b) => b.officeId === id)) throw fail(409, 'That office already has a building')
      } else {
        const name = clip(input.name, 40).trim() || t.name
        id = freshOfficeId(name, co)
        C.addOffice({ id, name, profile: type, theme: Object.hasOwn(C.THEMES, input.theme) ? input.theme : t.theme }, 'board', via)
      }
      const rot = ((int(input.rot) || 0) % 4 + 4) % 4
      building = { id: 'b-' + id, officeId: id, type, x, y, rot, floors: 1, createdBy: by, createdAt: new Date().toISOString() }
      cur.buildings.push(building)
      office = id
      summary = 'placed ' + t.name + ' "' + id + '" on lot ' + x + ',' + y
    } else if (op === 'move') {
      const b = find()
      const [x, y] = lot()
      const there = taken.get(x + ',' + y)
      if (there && there.id !== b.id) throw fail(409, 'Lot taken: ' + nameOf(there))
      summary = 'moved ' + nameOf(b) + ' from ' + b.x + ',' + b.y + ' to ' + x + ',' + y
      b.x = x; b.y = y; building = b; office = b.officeId
    } else if (op === 'rotate') {
      const b = find()
      b.rot = (b.rot + 1) % 4
      summary = 'turned ' + nameOf(b) + ' to ' + b.rot * 90 + ' degrees'
      building = b; office = b.officeId
    } else {
      const b = find()
      cur.buildings.splice(cur.buildings.indexOf(b), 1)
      summary = 'removed the building of ' + nameOf(b) + ' (the office is archived, its history stays)'
      building = b; office = b.officeId
    }
    const file = {
      schemaVersion: SCHEMA, grid: cur.grid, roads: cur.roads, props: cur.props,
      buildings: cur.buildings.map((b) => ({ id: b.id, officeId: b.officeId, type: b.type, x: b.x, y: b.y, rot: b.rot, floors: b.floors, createdBy: b.createdBy, createdAt: b.createdAt })),
    }
    fs.mkdirSync(P.COMPANY, { recursive: true })
    writeAtomic(FILE(), JSON.stringify(file, null, 2))
    return { summary, building, office, op }
  })
  // the office is archived after the lot is free: a crash in between leaves an
  // office with no building, which the next read puts on a free lot
  if (out.op === 'remove') C.archiveOffice(out.office, 'board', via)
  C.activity({ actor: actor.role === 'board' ? 'board' : 'supervisor', action: 'campus.' + out.op, entityType: 'office', entityId: out.office, officeId: out.office, summary: out.summary, via: via || 'cli' })
  if (actor.role !== 'board') {
    // every supervisor change is a decision the owner can read and overrule (A4)
    require('./build-agent-dashboard.cjs').saveDecision({ project: 'campus', by: 'supervisor', text: out.summary, reason: clip(input.reason, 400), run: liveRun })
  }
  return { summary: out.summary, building: out.building, office: out.office }
}

module.exports = { TYPES, TYPE_IDS, typeById, typeOfProfile, readCampus, view, apply, SCHEMA, DEFAULT_GRID, MAX_GRID, FILE }
