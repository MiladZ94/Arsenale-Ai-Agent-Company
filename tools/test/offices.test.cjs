/* Offices the owner makes, and routing by kind of work (spec 1.2, rules 15
 * to 25, acceptance tests 10 to 18): the 16 kinds, the routing order, the
 * office stamped at a run's start, an archived office, the form's checks and
 * the write path's refusals (library, HTTP, CLI and MCP). Invented data. */
const test = require('node:test')
const assert = require('node:assert/strict')
const fs = require('fs')
const http = require('http')
const path = require('path')
const { makeSandbox, hashTree, SEED, startServer, mcpClient } = require('./helpers.cjs')

const board = { door: 'dashboard', role: 'board', name: '' }
const sup = { door: 'cli', role: 'supervisor', name: '' }
const agent = { door: 'cli', role: 'agent', name: 'tester' }

// AT14's company: the project "atlas" belongs to Engineering, tester sits at
// the verify desks, implementer at the build desks
function world(t) {
  const sb = makeSandbox()
  t.after(() => sb.cleanup())
  const seed = JSON.parse(JSON.stringify(SEED))
  seed.projects.push({ id: 'atlas', name: 'Atlas', key: 'ATL', officeId: 'engineering', aliases: ['atlas'] })
  seed.employees.tester.zone = 'verify'
  seed.employees.implementer.zone = 'build'
  const C = sb.mod('agent-company.cjs')
  C.companyInit(seed, ['implementer', 'tester'])
  const K = sb.mod('campus.cjs')
  const L = sb.mod('runlog.cjs')
  const B = sb.mod('build-agent-dashboard.cjs')
  const bay = () => K.office({ op: 'create', name: 'Quality Bay', theme: 'green', type: 'verification', kinds: ['verify', 'review'] }, board, 'dashboard')
  const start = (input) => L.startRun(Object.assign({ task: 'invented task' }, input), L.actorFor('cli', 'supervisor')).record
  return { sb, C, K, L, B, bay, start }
}
const offices = (sb) => sb.read('company/offices.json')

test('the 16 kinds: one list, unique ids, the zone table of rule 21, nothing else reads as a kind', () => {
  const Kd = require('../kinds.cjs')
  assert.equal(Kd.KINDS.length, 16)
  assert.equal(new Set(Kd.KINDS.map((k) => k.id)).size, 16)
  assert.deepEqual(Kd.KINDS.map((k) => k.id), ['build', 'review', 'verify', 'security', 'docs', 'design', 'data', 'plan', 'ship', 'ops', 'legal', 'research', 'content', 'support', 'finance', 'people'])
  const zones = { build: 'build', review: 'review', verify: 'verify', docs: 'docs', design: 'design', data: 'data', plan: 'plan', ship: 'ship', ops: 'ops', legal: 'legal' }
  for (const [zone, kind] of Object.entries(zones)) assert.equal(Kd.kindOfZone(zone), kind, zone)
  for (const zone of ['lead', 'guest', '', 'constructor']) assert.equal(Kd.kindOfZone(zone), '', 'no kind from the zone "' + zone + '"')
  assert.equal(Kd.labelOf('verify'), 'Testing')
  for (const bad of ['__proto__', 'constructor', 'toString', 'Testing', 'juggling', '', null, 3]) assert.equal(Kd.isKind(bad), false, String(bad))
  assert.deepEqual(Kd.cleanKinds(['verify', 'juggling', 'verify', '__proto__', 'docs']), ['verify', 'docs'])
  assert.deepEqual(Kd.cleanKinds('verify'), [])
  // every desk zone a person can have maps to a kind or to none, never to an unknown id
  for (const z of require('../agent-company.cjs').ZONES) assert.ok(Kd.kindOfZone(z) === '' || Kd.isKind(Kd.kindOfZone(z)), z)
})

test('AT10: Create writes the office with its kinds and its building on the first free lot, and one activity line', (t) => {
  const { sb, K, C, bay } = world(t)
  const r = bay()
  assert.equal(r.id, 'quality-bay')
  const o = offices(sb).find((x) => x.id === 'quality-bay')
  assert.deepEqual([o.name, o.theme, o.profile, o.kinds, o.archived, o.createdBy], ['Quality Bay', 'green', 'verification', ['verify', 'review'], false, 'board'])
  assert.ok(o.createdAt)
  const b = sb.read('company/campus.json').buildings.find((x) => x.officeId === 'quality-bay')
  assert.equal(b.type, 'verification')
  // three seeded offices on lots 0,0 1,0 2,0: the first free lot is 0,1
  assert.deepEqual([b.x, b.y], [0, 1])
  const lines = sb.lines('company/activity.jsonl').filter((l) => l.entityId === 'quality-bay')
  assert.deepEqual(lines.map((l) => l.action), ['office.created'], 'exactly one line for the creation')
  assert.equal(C.readCompany().offices.find((x) => x.id === 'quality-bay').kinds.join(), 'verify,review')
  assert.ok(K.view(C.readCompany()).buildings.some((x) => x.officeId === 'quality-bay'), 'the campus shows it')
})

test('AT12, AT13: a held kind, a bad name, a raw colour and an unknown kind are refused naming the field, and nothing is written', (t) => {
  const { sb, K, bay } = world(t)
  bay()
  const before = hashTree(sb.company)
  const tryIt = (body) => { try { K.office(Object.assign({ op: 'create', name: 'Night Lab', theme: 'violet', type: 'domain' }, body), board, 'dashboard'); return null } catch (e) { return e } }
  const held = tryIt({ kinds: ['verify'] })
  assert.equal(held.code, 409)
  assert.equal(held.message, 'Testing is done by Quality Bay. Remove it there first.')
  assert.equal(held.field, 'kinds')
  for (const [body, field] of [[{ name: '' }, 'name'], [{ name: '   ' }, 'name'], [{ name: 'x'.repeat(41) }, 'name'], [{ theme: '#FF0000' }, 'theme'], [{ kinds: ['juggling'] }, 'kinds'], [{ kinds: 'verify' }, 'kinds'], [{ type: 'castle' }, 'type'], [{ type: undefined }, 'type'], [{ name: 'quality bay' }, 'name']]) {
    const e = tryIt(body)
    assert.ok(e, JSON.stringify(body) + ' is refused')
    assert.equal(e.field, field, JSON.stringify(body))
    assert.ok(e.code === 400 || e.code === 409)
  }
  assert.deepEqual(hashTree(sb.company), before, 'nothing changed on disk')
  // 40 characters are fine
  assert.ok(K.office({ op: 'create', name: 'y'.repeat(40), type: 'docs' }, board, 'dashboard').id)
})

test('AT14: routing order: an explicit office, then the kind, then the project, then the home office, then Unassigned', (t) => {
  const { C, bay, start, sb } = world(t)
  // before any office holds a kind, routing is the 1.1 rule
  let r = start({ agent: 'tester', project: 'atlas' })
  assert.deepEqual([r.officeId, r.officeBy, r.kind], ['engineering', 'project', 'verify'])
  bay()
  r = start({ agent: 'tester', project: 'atlas' })
  assert.deepEqual([r.officeId, r.officeBy, r.kind], ['quality-bay', 'kind', 'verify'])
  r = start({ agent: 'tester', project: 'atlas', officeId: 'engineering' })
  assert.deepEqual([r.officeId, r.officeBy], ['engineering', 'explicit'])
  r = start({ agent: 'implementer', project: 'atlas' })
  assert.deepEqual([r.officeId, r.officeBy, r.kind], ['engineering', 'project', 'build'])
  // no project: the home office (implementer lives in studio)
  r = start({ agent: 'implementer' })
  assert.deepEqual([r.officeId, r.officeBy], ['studio', 'home'])
  // a contractor with no home and no project: Unassigned work
  r = start({ agent: 'stranger' })
  assert.deepEqual([r.officeId, r.officeBy, r.kind || ''], ['unassigned', 'unassigned', ''])
  // a kind named at the start wins over the desk zone; an unknown one is ignored
  r = start({ agent: 'implementer', project: 'atlas', kind: 'review' })
  assert.deepEqual([r.officeId, r.officeBy, r.kind], ['quality-bay', 'kind', 'review'])
  r = start({ agent: 'implementer', project: 'atlas', kind: 'juggling' })
  assert.deepEqual([r.officeId, r.officeBy, r.kind], ['engineering', 'project', 'build'])
  r = start({ agent: 'implementer', project: 'atlas', kind: '__proto__' })
  assert.equal(r.officeBy, 'project')
  // an unknown explicit office counts as none
  r = start({ agent: 'tester', project: 'atlas', officeId: 'nowhere' })
  assert.deepEqual([r.officeId, r.officeBy], ['quality-bay', 'kind'])
  // the employee's own kind comes before its zone
  C.writeOverlay('implementer', { kind: 'verify' }, 'board')
  r = start({ agent: 'implementer', project: 'atlas' })
  assert.deepEqual([r.officeId, r.officeBy, r.kind], ['quality-bay', 'kind', 'verify'])
  // the task's kind comes before the employee's
  const Tk = sb.mod('tasks.cjs')
  const task = Tk.createTask({ title: 'Write the docs', kind: 'docs' }, board)
  r = start({ agent: 'implementer', project: 'atlas', issue: task.id })
  assert.deepEqual([r.officeId, r.officeBy, r.kind], ['engineering', 'project', 'docs'])
})

test('AT15: the office is fixed at the start: moving a kind moves no past run and no past budget; the next run follows the kind', (t) => {
  const { sb, K, L, B, C, bay, start } = world(t)
  bay()
  for (let i = 0; i < 5; i++) {
    const r = start({ agent: 'tester', project: 'atlas' })
    // the finish names another office: the stamp of the start stays
    L.finishRun({ id: r.id, agent: 'tester', task: 'invented task', status: 'ok', officeId: 'engineering', tokens: 100 }, L.actorFor('cli', 'supervisor'))
  }
  const finished = fs.readdirSync(sb.runs).filter((f) => f.endsWith('.json')).map((f) => JSON.parse(fs.readFileSync(path.join(sb.runs, f), 'utf8')))
  assert.equal(finished.length, 5)
  assert.ok(finished.every((r) => r.officeId === 'quality-bay' && r.officeBy === 'kind' && r.kind === 'verify'))
  const spendOf = (id) => C.standings(B.collect(), C.readCompany()).offices[id].spend.runs
  assert.equal(spendOf('quality-bay'), 5)
  const files = hashTree(sb.runs)
  // Testing moves to Night Lab
  K.office({ op: 'edit', id: 'quality-bay', kinds: ['review'] }, board, 'dashboard')
  K.office({ op: 'create', name: 'Night Lab', type: 'domain', kinds: ['verify'] }, board, 'dashboard')
  assert.deepEqual(hashTree(sb.runs), files, 'no run record is rewritten')
  assert.equal(spendOf('quality-bay'), 5, 'Quality Bay keeps its five runs')
  assert.equal(spendOf('night-lab'), 0)
  const next = start({ agent: 'tester', project: 'atlas' })
  assert.deepEqual([next.officeId, next.officeBy], ['night-lab', 'kind'])
})

test('AT16: a run record from before 1.2 has no stamp and keeps the 1.1 rule on read', (t) => {
  const { sb, C, B, bay } = world(t)
  bay()
  // a 1.1 record: tester on atlas, no officeId and no kind
  sb.run({ agent: 'tester', project: 'atlas', tokens: 5 })
  const st = B.collect()
  const R = C.resolver(C.readCompany(), new Map())
  const rec = st.runs.find((r) => r.agent === 'tester')
  assert.equal(R.office(rec), 'engineering', 'the project office, as 1.1 gives, not the kind holder')
  const ev = C.costEvents(st, C.readCompany()).find((e) => e.agent === 'tester')
  assert.equal(ev.officeId, 'engineering')
})

test('an archived office gives up its kinds, keeps its history, cannot be edited, and takes no held kind back', (t) => {
  const { sb, K, C, B, bay, start } = world(t)
  bay()
  const past = start({ agent: 'tester', project: 'atlas' })
  assert.equal(past.officeId, 'quality-bay')
  K.office({ op: 'archive', id: 'quality-bay' }, board, 'dashboard')
  const o = offices(sb).find((x) => x.id === 'quality-bay')
  assert.equal(o.archived, true)
  assert.equal(o.kinds, undefined, 'its kinds are given up')
  assert.equal(C.kindHolders(C.readCompany()).size, 0)
  assert.equal(sb.read('company/campus.json').buildings.some((b) => b.officeId === 'quality-bay'), false, 'its building is gone')
  // the run that started there stays there
  const st = B.collect()
  assert.equal(C.resolver(C.readCompany(), new Map()).office(st.active.find((r) => r.id === past.id)), 'quality-bay')
  // the next tester run goes by the project again
  assert.deepEqual([start({ agent: 'tester', project: 'atlas' }).officeBy], ['project'])
  // an archived office is not edited
  assert.throws(() => K.office({ op: 'edit', id: 'quality-bay', name: 'Bay' }, board, 'dashboard'), (e) => e.code === 409)
  // Testing is taken by a new office; a hand-written kinds list on the archived one comes back without it
  K.office({ op: 'create', name: 'Night Lab', type: 'domain', kinds: ['verify'] }, board, 'dashboard')
  const raw = offices(sb)
  raw.find((x) => x.id === 'quality-bay').kinds = ['verify', 'review']
  fs.writeFileSync(path.join(sb.company, 'offices.json'), JSON.stringify(raw, null, 2))
  C.addOffice({ id: 'quality-bay' }, 'board', 'cli')
  assert.deepEqual(offices(sb).find((x) => x.id === 'quality-bay').kinds, ['review'])
  // a name an archived office had is free again
  assert.ok(K.office({ op: 'create', name: 'Old Bay', type: 'docs' }, board, 'dashboard').id)
})

test('edit changes name, colour, building type and kinds; the building keeps its lot; unknown fields stay', (t) => {
  const { sb, K, bay } = world(t)
  bay()
  const raw = offices(sb)
  raw.find((x) => x.id === 'quality-bay').futureField = { keep: true }
  fs.writeFileSync(path.join(sb.company, 'offices.json'), JSON.stringify(raw, null, 2))
  const lot = sb.read('company/campus.json').buildings.find((b) => b.officeId === 'quality-bay')
  const r = K.office({ op: 'edit', id: 'quality-bay', name: 'QA Bay', theme: 'cyan', type: 'security', kinds: ['security'] }, board, 'dashboard')
  assert.deepEqual(r.changed.sort(), ['kinds', 'name', 'profile', 'theme'])
  const o = offices(sb).find((x) => x.id === 'quality-bay')
  assert.deepEqual([o.name, o.theme, o.profile, o.kinds, o.futureField], ['QA Bay', 'cyan', 'security', ['security'], { keep: true }])
  const b = sb.read('company/campus.json').buildings.find((x) => x.officeId === 'quality-bay')
  assert.deepEqual([b.type, b.x, b.y], ['security', lot.x, lot.y])
  // no kinds left: the field goes, so the entry is in the 1.1 shape again
  K.office({ op: 'edit', id: 'quality-bay', kinds: [] }, board, 'dashboard')
  assert.equal(Object.hasOwn(offices(sb).find((x) => x.id === 'quality-bay'), 'kinds'), false)
  assert.ok(sb.lines('company/activity.jsonl').some((l) => l.action === 'office.updated' && /name=QA Bay/.test(l.summary)))
  assert.ok(sb.lines('company/inbox.jsonl').some((l) => l.type === 'office.updated'), 'a dashboard edit reaches the supervisor')
})

test('AT17: a task with a kind and no office is sent to the office that holds the kind', (t) => {
  const { sb, bay } = world(t)
  bay()
  const Tk = sb.mod('tasks.cjs')
  const a = Tk.createTask({ title: 'Check the release', kind: 'verify' }, board)
  assert.deepEqual([a.kind, a.assigneeOfficeId], ['verify', 'quality-bay'])
  const b = Tk.createTask({ title: 'Check the release', kind: 'verify', assigneeOfficeId: 'studio' }, board)
  assert.equal(b.assigneeOfficeId, 'studio', 'an office the owner chose stays')
  const c = Tk.createTask({ title: 'Write docs for Atlas', kind: 'docs', projectId: 'atlas' }, board)
  assert.equal(c.assigneeOfficeId, 'engineering', 'no office holds Writing docs: the project office')
  const d = Tk.createTask({ title: 'No kind' }, board)
  assert.deepEqual([d.kind, d.assigneeOfficeId], [undefined, ''], 'a task without a kind is as in 1.1')
  assert.throws(() => Tk.createTask({ title: 'x', kind: 'juggling' }, board), (e) => e.code === 400)
  assert.equal(Tk.listTasks().find((x) => x.id === a.id).kind, 'verify')
})

test('AT18 library: create, edit and archive are refused for an agent and the supervisor, and nothing is written', (t) => {
  const { sb, K, bay } = world(t)
  bay()
  const before = hashTree(sb.company)
  for (const who of [agent, sup, { door: 'mcp', role: 'supervisor' }, undefined]) {
    for (const body of [{ op: 'create', name: 'Night Lab', type: 'domain' }, { op: 'edit', id: 'quality-bay', kinds: [] }, { op: 'archive', id: 'quality-bay' }]) {
      assert.throws(() => K.office(body, who, 'cli'), (e) => e.code === 403 && /Only the owner can do this/.test(e.message), JSON.stringify([who, body.op]))
    }
  }
  // the agent CLI, without the owner's key
  const r = sb.cliWithoutKey('--office', JSON.stringify({ op: 'create', name: 'Night Lab', type: 'domain', by: 'board' }))
  assert.equal(r.code, 1)
  assert.match(r.err, /Only the owner can do this/)
  assert.deepEqual(hashTree(sb.company), before)
  // the supervisor's 1.1 campus right stays, and it sets no kinds
  fs.mkdirSync(path.join(sb.root, 'version-runs'), { recursive: true })
  fs.writeFileSync(path.join(sb.root, 'version-runs', 'x-1.json'), JSON.stringify({ id: 'x-1', status: 'running', updatedAt: new Date().toISOString() }))
  const placed = K.apply({ op: 'place', type: 'docs', name: 'Docs corner', x: 5, y: 3, reason: 'invented', kinds: ['docs'] }, sup, 'cli')
  assert.equal(offices(sb).find((o) => o.id === placed.office).kinds, undefined)
  // the owner's CLI, with the key, may
  const ok = sb.cli('--office', JSON.stringify({ op: 'edit', id: 'quality-bay', name: 'QA Bay', by: 'board' }))
  assert.equal(ok.code, 0, ok.err)
  // anyone may read: an agent reads its office and where its next run goes
  const read = sb.cliWithoutKey('--office', '{"agent":"tester","project":"atlas"}')
  assert.equal(read.code, 0, read.err)
  assert.match(read.out, /next job: QA Bay \(quality-bay\); here because: Testing/)
  const json = JSON.parse(sb.cliWithoutKey('--office', '{"id":"quality-bay"}', '--json').out)
  assert.deepEqual(json.office.kinds.map((k) => k.id), ['verify', 'review'])
  // and an agent's own start may name a kind
  const st = sb.cliWithoutKey('--start', '{"agent":"implementer","task":"invented","project":"atlas","kind":"verify","by":"agent:implementer"}')
  assert.equal(st.code, 0, st.err)
  const rec = JSON.parse(fs.readFileSync(path.join(sb.runs, 'active', st.out + '.json'), 'utf8'))
  assert.deepEqual([rec.officeId, rec.officeBy, rec.kind], ['quality-bay', 'kind', 'verify'])
})

test('prototype keys are refused: in the body, as a kind, and as an office id', (t) => {
  const { sb, K, C, bay } = world(t)
  bay()
  const before = hashTree(sb.company)
  for (const body of [
    JSON.parse('{"op":"create","name":"P","type":"docs","__proto__":{"admin":true}}'),
    JSON.parse('{"op":"edit","id":"quality-bay","kinds":["review"],"constructor":{"prototype":{}}}'),
    { op: 'create', name: 'P', type: 'docs', kinds: ['__proto__'] },
    { op: 'create', name: 'P', type: 'docs', kinds: ['constructor'] },
    { op: 'edit', id: 'constructor', name: 'X' },
    { op: 'edit', id: '__proto__', name: 'X' },
    { op: 'create', name: 'P', type: '__proto__' },
    { op: 'create', name: 'P', type: 'docs', theme: 'constructor' },
  ]) assert.throws(() => K.office(body, board, 'dashboard'), (e) => e.code === 400 || e.code === 404, JSON.stringify(body))
  assert.deepEqual(hashTree(sb.company), before)
  // a name that slugs to "constructor" gets another id
  const r = K.office({ op: 'create', name: 'Constructor', type: 'docs' }, board, 'dashboard')
  assert.notEqual(r.id, 'constructor')
  assert.equal(({}).admin, undefined)
  assert.equal(C.readCompany().offices.find((o) => o.id === r.id).name, 'Constructor')
})

test('a newer company file makes the form read-only: create and edit get 409', (t) => {
  const { sb, K, bay } = world(t)
  bay()
  const c = sb.read('company/company.json')
  c.schemaVersion = 2
  fs.writeFileSync(path.join(sb.company, 'company.json'), JSON.stringify(c))
  const before = hashTree(sb.company)
  assert.throws(() => K.office({ op: 'create', name: 'Night Lab', type: 'domain' }, board, 'dashboard'), (e) => e.code === 409)
  assert.throws(() => K.office({ op: 'edit', id: 'quality-bay', name: 'X' }, board, 'dashboard'), (e) => e.code === 409)
  assert.deepEqual(hashTree(sb.company), before)
})

// ---------- the doors: HTTP and MCP
const cookies = {}
function req(port, { method = 'GET', url = '/', headers = {}, body } = {}) {
  return new Promise((resolve, reject) => {
    const r = http.request({ host: '127.0.0.1', port, method, path: url, agent: false, headers: Object.assign({ Host: '127.0.0.1:' + port }, cookies[port] ? { Cookie: cookies[port] } : {}, headers) }, (res) => {
      const chunks = []
      res.on('data', (c) => chunks.push(c))
      res.on('end', () => { const text = Buffer.concat(chunks).toString('utf8'); let json = null; try { json = JSON.parse(text) } catch { /* not json */ } resolve({ status: res.statusCode, json }) })
    })
    r.on('error', reject)
    if (body !== undefined) r.write(typeof body === 'string' ? body : JSON.stringify(body))
    r.end()
  })
}

test('AT18 HTTP: POST api/office needs the page Origin, token and same-site fetch, and refuses a prototype key', async (t) => {
  const sb = makeSandbox()
  assert.equal(sb.cli('--company-init', '--seed', sb.seed()).code, 0)
  const { port, child, cookie, token } = await startServer(sb)
  cookies[port] = cookie
  t.after(() => { child.kill(); sb.cleanup() })
  const head = { Origin: 'http://127.0.0.1:' + port, 'Content-Type': 'application/json', 'X-Dashboard-Token': token }
  const body = { op: 'create', name: 'Quality Bay', theme: 'green', type: 'verification', kinds: ['verify'] }
  const before = hashTree(sb.company)
  for (const [what, h] of [['no token', { 'X-Dashboard-Token': '' }], ['other origin', { Origin: 'https://evil.example' }], ['no origin', { Origin: '' }], ['cross-site', { 'Sec-Fetch-Site': 'cross-site' }]]) {
    const r = await req(port, { method: 'POST', url: '/api/office', body, headers: Object.assign({}, head, h) })
    assert.equal(r.status, 403, what)
  }
  const noKey = await req(port, { method: 'POST', url: '/api/office', body, headers: Object.assign({}, head, { Cookie: '' }) })
  assert.equal(noKey.status, 401)
  const proto = await req(port, { method: 'POST', url: '/api/office', body: '{"op":"create","name":"P","type":"docs","__proto__":{"x":1}}', headers: head })
  assert.equal(proto.status, 400)
  const raw = await req(port, { method: 'POST', url: '/api/office', body: Object.assign({}, body, { theme: '#FF0000' }), headers: head })
  assert.deepEqual([raw.status, raw.json.field], [400, 'theme'])
  assert.deepEqual(hashTree(sb.company), before, 'nothing was written')
  const ok = await req(port, { method: 'POST', url: '/api/office', body, headers: head })
  assert.equal(ok.status, 200, JSON.stringify(ok.json))
  assert.equal(ok.json.result.id, 'quality-bay')
  const dup = await req(port, { method: 'POST', url: '/api/office', body: Object.assign({}, body, { name: 'Night Lab' }), headers: head })
  assert.deepEqual([dup.status, dup.json.error, dup.json.field], [409, 'Testing is done by Quality Bay. Remove it there first.', 'kinds'])
  const co = await req(port, { url: '/api/company' })
  assert.deepEqual(co.json.offices.find((o) => o.id === 'quality-bay').kinds, ['verify'])
  assert.equal(co.json.kinds.length, 16)
})

test('AT18 MCP: no tool changes an office; get_office reads; start_job takes a kind', async (t) => {
  const sb = makeSandbox()
  t.after(() => sb.cleanup())
  const seed = JSON.parse(JSON.stringify(SEED)); seed.employees.tester.zone = 'verify'
  const C = sb.mod('agent-company.cjs')
  C.companyInit(seed, ['implementer', 'tester'])
  sb.mod('campus.cjs').office({ op: 'create', name: 'Quality Bay', type: 'verification', kinds: ['verify'] }, board, 'dashboard')
  const c = mcpClient(sb)
  t.after(() => c.close())
  await c.init()
  const names = (await c.rpc('tools/list', {})).result.tools.map((x) => x.name)
  assert.ok(names.includes('get_office'))
  assert.equal(names.filter((n) => /office/.test(n) && n !== 'get_office').length, 0, 'no create, edit or archive tool')
  const g = await c.call('get_office', { team_member: 'tester' })
  assert.equal(g.error, false, g.text)
  assert.equal(g.data.next_job.office.id, 'quality-bay')
  assert.equal(g.data.next_job.because, 'Testing')
  const job = await c.call('start_job', { team_member: 'implementer', task: 'invented', kind: 'verify' })
  assert.equal(job.error, false, job.text)
  const rec = JSON.parse(fs.readFileSync(path.join(sb.runs, 'active', job.data.job_id + '.json'), 'utf8'))
  assert.deepEqual([rec.officeId, rec.officeBy, rec.kind], ['quality-bay', 'kind', 'verify'])
  // asking a tool to act as the board is refused
  const forged = await c.call('get_office', { by: 'board' })
  assert.equal(forged.error, true)
})
