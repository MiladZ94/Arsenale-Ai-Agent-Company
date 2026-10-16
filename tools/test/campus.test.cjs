/* The campus model (campus.cjs): the derived layout of an older company, the
 * one write path with its refusals, who may use it, the atomic file, a newer
 * file being read-only, and the CLI. */
const test = require('node:test')
const assert = require('node:assert/strict')
const fs = require('fs')
const path = require('path')
const { makeSandbox, SEED } = require('./helpers.cjs')

function world(t, seed) {
  const sb = makeSandbox()
  t.after(() => sb.cleanup())
  const C = sb.mod('agent-company.cjs')
  C.companyInit(seed || SEED, ['implementer', 'tester'])
  const K = sb.mod('campus.cjs')
  return { sb, C, K }
}
const board = { door: 'dashboard', role: 'board', name: '' }
const sup = { door: 'cli', role: 'supervisor', name: '' }
const agent = { door: 'cli', role: 'agent', name: 'tester' }
const file = (sb) => path.join(sb.company, 'campus.json')

test('an old company with no campus.json gets a derived layout: one lot per office, none shared, nothing written', (t) => {
  const { sb, K } = world(t)
  const c = K.readCampus()
  assert.equal(c.derived, true)
  assert.deepEqual(c.buildings.map((b) => b.officeId), ['engineering', 'studio', 'hq'])
  assert.equal(new Set(c.buildings.map((b) => b.x + ',' + b.y)).size, 3)
  assert.ok(c.buildings.every((b) => b.x < c.grid.cols && b.y < c.grid.rows))
  assert.equal(fs.existsSync(file(sb)), false, 'a read never writes')
})

test('the type comes from the office profile, never from its place in the list', (t) => {
  const { K } = world(t)
  assert.equal(K.typeOfProfile('security'), 'security')
  assert.equal(K.typeOfProfile('Software engineering'), 'engineering')
  assert.equal(K.typeOfProfile('finance'), 'business')
  assert.equal(K.typeOfProfile(''), 'business')
  assert.equal(K.TYPES.length, 12)
  assert.equal(new Set(K.TYPES.map((x) => x.id)).size, 12)
})

test('place creates the office and the file; the file is the whole layout, derived part included', (t) => {
  const { sb, K, C } = world(t)
  const r = K.apply({ op: 'place', type: 'legal', name: 'Legal desk', x: 5, y: 3 }, board, 'dashboard')
  assert.match(r.summary, /placed Legal/)
  const f = sb.read('company/campus.json')
  assert.equal(f.schemaVersion, 1)
  assert.equal(f.buildings.length, 4, 'the three derived buildings are saved with the new one')
  const b = f.buildings.find((x) => x.officeId === 'legal-desk')
  assert.deepEqual([b.type, b.x, b.y, b.rot, b.createdBy], ['legal', 5, 3, 0, 'board'])
  const off = C.readCompany().offices.find((o) => o.id === 'legal-desk')
  assert.equal(off.profile, 'legal', 'the office profile selects the type')
  assert.ok(sb.lines('company/activity.jsonl').some((l) => l.action === 'campus.place'))
  assert.equal(fs.readdirSync(sb.company).filter((n) => n.endsWith('.tmp')).length, 0, 'no temporary file is left')
})

test('placing on a taken lot is refused with the reason, and nothing changes', (t) => {
  const { sb, K, C } = world(t)
  const first = K.readCampus().buildings[0]
  const offices = C.readCompany().offices.length
  assert.throws(() => K.apply({ op: 'place', type: 'docs', x: first.x, y: first.y }, board), (e) => e.code === 409 && /^Lot taken: /.test(e.message))
  assert.equal(C.readCompany().offices.length, offices, 'no office was made')
  assert.equal(fs.existsSync(file(sb)), false)
  assert.throws(() => K.apply({ op: 'place', type: 'docs', x: 99, y: 0 }, board), (e) => e.code === 409 && /Outside the grid/.test(e.message))
  assert.throws(() => K.apply({ op: 'place', type: 'castle', x: 5, y: 3 }, board), (e) => e.code === 400)
})

test('move, rotate and remove; remove archives the office and frees the lot', (t) => {
  const { sb, K, C } = world(t)
  const b = K.readCampus().buildings.find((x) => x.officeId === 'studio')
  K.apply({ op: 'move', id: b.id, x: 5, y: 3 }, board)
  K.apply({ op: 'rotate', id: b.id }, board)
  K.apply({ op: 'rotate', id: b.id }, board)
  let now = sb.read('company/campus.json').buildings.find((x) => x.id === b.id)
  assert.deepEqual([now.x, now.y, now.rot], [5, 3, 2])
  const other = K.readCampus().buildings.find((x) => x.officeId === 'hq')
  assert.throws(() => K.apply({ op: 'move', id: b.id, x: other.x, y: other.y }, board), (e) => /Lot taken: HQ/.test(e.message))
  K.apply({ op: 'remove', id: b.id }, board)
  assert.equal(sb.read('company/campus.json').buildings.some((x) => x.id === b.id), false)
  assert.equal(C.readCompany().offices.find((o) => o.id === 'studio').archived, true)
  assert.equal(K.readCampus().buildings.some((x) => x.officeId === 'studio'), false)
  K.apply({ op: 'place', type: 'docs', x: 5, y: 3 }, board)
})

test('who may change the campus: the board, the supervisor in an autonomous run only (with a decision), never an agent', (t) => {
  const { sb, K } = world(t)
  assert.throws(() => K.apply({ op: 'place', type: 'docs', x: 5, y: 3 }, agent), (e) => e.code === 403)
  assert.throws(() => K.apply({ op: 'remove', id: 'b-hq' }, agent), (e) => e.code === 403)
  assert.throws(() => K.apply({ op: 'place', type: 'docs', x: 5, y: 3 }, sup), (e) => e.code === 403 && /autonomous/.test(e.message))
  fs.mkdirSync(path.join(sb.root, 'version-runs'), { recursive: true })
  fs.writeFileSync(path.join(sb.root, 'version-runs', 'x-1.json'), JSON.stringify({ id: 'x-1', status: 'running' }))
  K.apply({ op: 'place', type: 'docs', name: 'Docs', x: 5, y: 3, reason: 'the docs work needs a home' }, sup, 'cli')
  const dec = fs.readdirSync(path.join(sb.runs, 'decisions')).map((n) => JSON.parse(fs.readFileSync(path.join(sb.runs, 'decisions', n), 'utf8')))
  assert.ok(dec.some((d) => d.by === 'supervisor' && d.project === 'campus' && /placed Docs/.test(d.text) && /needs a home/.test(d.reason)), 'a decision names the placement and the reason')
  assert.equal(sb.read('company/campus.json').buildings.find((x) => x.officeId === 'docs').createdBy, 'supervisor')
  // the owner can still move or remove what the supervisor placed
  K.apply({ op: 'remove', officeId: 'docs' }, board)
})

test('an agent has no way in through the MCP server either', (t) => {
  const { sb } = world(t)
  const M = sb.mod('mcp-server.cjs')
  const src = fs.readFileSync(path.join(sb.tools, 'mcp-server.cjs'), 'utf8')
  assert.equal(/campus/i.test(src), false, 'mcp-server.cjs names no campus tool')
  assert.ok(M)
})

test('a campus.json from a newer Arsenale is shown and never written', (t) => {
  const { sb, K } = world(t)
  fs.writeFileSync(file(sb), JSON.stringify({ schemaVersion: 9, grid: { cols: 6, rows: 4 }, buildings: [{ id: 'b-hq', officeId: 'hq', type: 'security', x: 2, y: 2, rot: 1, floors: 1 }] }))
  const before = fs.readFileSync(file(sb), 'utf8')
  const c = K.readCampus()
  assert.equal(c.readOnly, true)
  assert.equal(c.buildings.find((b) => b.officeId === 'hq').type, 'security')
  assert.throws(() => K.apply({ op: 'rotate', id: 'b-hq' }, board), (e) => e.code === 409)
  assert.equal(fs.readFileSync(file(sb), 'utf8'), before)
})

test('a broken or overlapping file never crashes the read: bad buildings are left out and reported', (t) => {
  const { sb, K } = world(t)
  fs.writeFileSync(file(sb), JSON.stringify({ schemaVersion: 1, grid: { cols: 3, rows: 2 }, buildings: [
    { id: 'a', officeId: 'engineering', type: 'engineering', x: 0, y: 0 }, { id: 'b', officeId: 'studio', type: 'design', x: 0, y: 0 },
    { id: 'c', officeId: 'hq', type: 'nonsense', x: 9, y: 9 }, null, { officeId: 'ghost', x: 1, y: 1 }] }))
  const c = K.readCampus()
  const lots = c.buildings.map((b) => b.x + ',' + b.y)
  assert.equal(new Set(lots).size, lots.length, 'no two buildings share a lot')
  assert.ok(c.problems.length >= 1)
  assert.equal(c.buildings.length, 3, 'every office still has a building (left-out ones are placed on a free lot)')
  fs.writeFileSync(file(sb), '{not json')
  assert.equal(K.readCampus().buildings.length, 3)
})

test('two parallel placements both land (the file is changed under a lock) when the storage helpers are there', async (t) => {
  const { sb } = world(t)
  if (!fs.existsSync(path.join(sb.tools, 'store.cjs'))) return t.skip('store.cjs is not in this build')
  const { spawn } = require('child_process')
  const run = (x) => new Promise((res) => {
    const p = spawn(process.execPath, [path.join(sb.tools, 'log-agent-run.cjs'), '--campus', JSON.stringify({ by: 'board', op: 'place', type: 'docs', name: 'Docs ' + x, x, y: 3 })], { env: sb.env })
    p.on('exit', res)
  })
  await Promise.all([run(0), run(1), run(2)])
  assert.equal(sb.read('company/campus.json').buildings.filter((b) => /^b-docs/.test(b.id)).length, 3)
})

test('the CLI: arsenale campus list / place / remove, as the board', (t) => {
  const { sb } = world(t)
  const l = sb.cli('--campus', '{"op":"list"}')
  assert.equal(l.code, 0, l.err)
  assert.equal(JSON.parse(l.out).buildings.length, 3)
  const p = sb.cli('--campus', '{"by":"board","op":"place","type":"security","name":"Sec","x":4,"y":2}')
  assert.equal(p.code, 0, p.err)
  assert.match(p.out, /placed Security/)
  const bad = sb.cli('--campus', '{"by":"board","op":"place","type":"security","x":4,"y":2}')
  assert.equal(bad.code, 1)
  assert.match(bad.err, /Lot taken: Sec/)
  const nope = sb.cli('--campus', '{"by":"agent:tester","op":"remove","id":"b-hq"}')
  assert.equal(nope.code, 1)
  assert.match(nope.err, /agent cannot/)
})
