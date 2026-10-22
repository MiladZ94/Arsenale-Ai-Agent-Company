/* Notifications of spec 1.1 (P3; rules 13, 14, 34-40; acceptance tests 8, 9,
 * 25, 26, 27, 29, 30): the owner-only secrets file and the environment
 * winning over it, the config `events`, validation naming the field, test
 * sends, and stall alerts to the phone channels from the server's loop.
 * Nothing goes to the network: ntfy is a local test server, Telegram and
 * Pushover are answered by a stub of notify.request. Invented data. */
const test = require('node:test')
const assert = require('node:assert/strict')
const fs = require('fs')
const http = require('http')
const path = require('path')
const { makeSandbox, startServer } = require('./helpers.cjs')

const MIN = 60000
const NAMES = ['ARSENALE_PHONE_KEY', 'ARSENALE_NTFY_TOKEN', 'ARSENALE_TELEGRAM_TOKEN', 'ARSENALE_PUSHOVER_TOKEN', 'ARSENALE_PUSHOVER_USER']
// invented secrets, long and unusual enough that a match anywhere is a leak
const PUSH_TOKEN = 'apushtokeninvented7f3k2q9w0xz'
const PUSH_USER = 'upushuserinvented4m8n1b6v'

/** A sandbox with none of the owner's own secrets in this process's
 *  environment (they are put back afterwards). */
function box(t) {
  const saved = {}
  for (const n of NAMES) { saved[n] = process.env[n]; delete process.env[n] }
  const sb = makeSandbox({ flat: true })
  for (const n of NAMES) delete sb.env[n]
  t.after(() => { sb.cleanup(); for (const n of NAMES) { if (saved[n] === undefined) delete process.env[n]; else process.env[n] = saved[n] } })
  return sb
}
const mods = (sb) => { const N = sb.mod('notify.cjs'); const req = (n) => require(path.join(sb.tools, n)); return { N, W: req('watch.cjs'), L: req('runlog.cjs') } }
const board = (L) => L.actorFor('dashboard', 'board')

/** A local stand-in for an ntfy server: records every message; `down()` makes
 *  it answer 503. */
async function fakeNtfy(t) {
  const got = []
  let status = 200
  const srv = http.createServer((req, res) => {
    const chunks = []
    req.on('data', (c) => chunks.push(c))
    req.on('end', () => {
      let body = null
      try { body = JSON.parse(Buffer.concat(chunks).toString('utf8')) } catch { /* not json */ }
      got.push({ method: req.method, url: req.url, auth: req.headers.authorization || '', body })
      res.writeHead(status, { 'Content-Type': 'application/json' })
      res.end('{}')
    })
  })
  await new Promise((r) => srv.listen(0, '127.0.0.1', r))
  t.after(() => srv.close())
  return { got, url: 'http://127.0.0.1:' + srv.address().port, down: () => { status = 503 }, posts: () => got.filter((g) => g.method === 'POST') }
}

/** An active run record whose last step was `quietMin` before `now`. */
function active(sb, id, now, quietMin, extra) {
  const iso = (ms) => new Date(ms).toISOString()
  const rec = Object.assign({ id, agent: 'tester', task: 'invented suite for the bakery menu', doing: 'running step four', steps: [{ at: iso(now - quietMin * MIN), text: 'running step four in C:\\work\\menu' }], startedAt: iso(now - (quietMin + 5) * MIN) }, extra || {})
  fs.writeFileSync(path.join(sb.runs, 'active', id + '.json'), JSON.stringify(rec, null, 2))
}

/** Every file under the data folder whose text holds `needle`. */
function filesHolding(dir, needle) {
  const out = []
  const walk = (d) => {
    for (const n of fs.readdirSync(d)) {
      const f = path.join(d, n)
      const s = fs.statSync(f)
      if (s.isDirectory()) { if (n !== 'tools') walk(f); continue }
      if (fs.readFileSync(f).includes(needle)) out.push(path.relative(dir, f))
    }
  }
  walk(dir)
  return out
}

test('AT26 secrets: saved write-only in notify/secrets.json, never in an answer, a log or the activity; the environment wins', async (t) => {
  const sb = box(t)
  sb.cli('--company-init', '--seed', sb.seed())
  const { N, L } = mods(sb)
  const st = await N.configure({ op: 'setup', channel: 'pushover', token: PUSH_TOKEN, user: PUSH_USER }, board(L))
  assert.deepEqual(st.secrets.pushoverToken, { set: true, from: 'file' })
  assert.deepEqual(st.secrets.pushoverUser, { set: true, from: 'file' })
  assert.equal(st.env.pushover, true, 'the 1.0 page sees it as set')
  const file = path.join(sb.root, 'notify', 'secrets.json')
  assert.ok(fs.existsSync(file))
  assert.equal(JSON.parse(fs.readFileSync(file, 'utf8')).values.ARSENALE_PUSHOVER_TOKEN, PUSH_TOKEN)
  if (process.platform !== 'win32') assert.equal(fs.statSync(file).mode & 0o777, 0o600)
  // no answer holds it, and no file but the secrets file
  assert.ok(!JSON.stringify(N.publicState()).includes(PUSH_TOKEN))
  assert.ok(!JSON.stringify(st).includes(PUSH_USER))
  assert.deepEqual(filesHolding(sb.root, PUSH_TOKEN), [path.join('notify', 'secrets.json')])
  const acts = fs.readFileSync(path.join(sb.company, 'activity.jsonl'), 'utf8')
  assert.match(acts, /Pushover application token saved/)
  // the senders use it
  const seen = []
  const real = N.request
  t.after(() => { N.request = real })
  N.request = async (method, url, body) => { seen.push(body); return { status: 200, text: '{}' } }
  await N.configure({ op: 'test', channel: 'pushover' }, board(L))
  assert.equal(seen[0].token, PUSH_TOKEN)
  // an environment variable of the same name wins
  process.env.ARSENALE_PUSHOVER_TOKEN = 'envtokenwins1234'
  assert.equal(N.secret('ARSENALE_PUSHOVER_TOKEN'), 'envtokenwins1234')
  assert.deepEqual(N.publicState().secrets.pushoverToken, { set: true, from: 'env' })
  await N.configure({ op: 'test', channel: 'pushover' }, board(L))
  assert.equal(seen[1].token, 'envtokenwins1234')
  delete process.env.ARSENALE_PUSHOVER_TOKEN
  // removed with null; the other secret stays
  const after = await N.configure({ op: 'setup', channel: 'pushover', token: null }, board(L))
  assert.deepEqual(after.secrets.pushoverToken, { set: false, from: '' })
  assert.equal(after.secrets.pushoverUser.set, true)
  assert.deepEqual(filesHolding(sb.root, PUSH_TOKEN), [])
  // the owner's only (rule 40): an agent and the supervisor are refused, nothing written
  const before = fs.readFileSync(file, 'utf8')
  for (const who of [L.actorFor('mcp', 'agent', { name: 'tester' }), L.actorFor('cli', 'supervisor')]) {
    await assert.rejects(N.configure({ op: 'setup', channel: 'pushover', token: 'sneakytoken99' }, who), (e) => e.code === 403)
    await assert.rejects(N.configure({ op: 'events', channel: 'ntfy', events: { stalled: false } }, who), (e) => e.code === 403)
  }
  assert.equal(fs.readFileSync(file, 'utf8'), before)
})

test('the signing key is made at the first save when neither the environment nor the file has one', async (t) => {
  const sb = box(t)
  const { N, L } = mods(sb)
  assert.equal(N.publicState().secrets.phoneKey.set, false)
  // no config.json at all: the event switches read as their defaults
  const ev0 = N.publicState().events
  assert.deepEqual([ev0.desktop.stalled, ev0.ntfy.question, ev0.pushover.queueWait], [true, true, false])
  assert.equal(N.readConfig().events.telegram.stalled, true)
  assert.equal(N.signingKey(), '')
  await N.configure({ op: 'expiry', minutes: 45 }, board(L))
  const st = N.publicState()
  assert.deepEqual(st.secrets.phoneKey, { set: true, from: 'file' })
  assert.equal(st.env.key, true)
  const key = N.secret('ARSENALE_PHONE_KEY')
  assert.match(key, /^[0-9a-f]{64}$/, '32 random bytes')
  // a second save keeps it; with a channel's epoch drawn, buttons can be signed
  await N.configure({ op: 'details', channel: 'ntfy', on: true }, board(L))
  assert.equal(N.secret('ARSENALE_PHONE_KEY'), key)
  assert.ok(N.signingKey().length > 0)
  // with the variable set, no key is written into a new data folder
  const sb2 = box(t)
  process.env.ARSENALE_PHONE_KEY = 'e'.repeat(40)
  const m2 = mods(sb2)
  await m2.N.configure({ op: 'expiry', minutes: 30 }, board(m2.L))
  assert.equal(fs.existsSync(path.join(sb2.root, 'notify', 'secrets.json')), false)
  assert.deepEqual(m2.N.publicState().secrets.phoneKey, { set: true, from: 'env' })
})

test('AT25 rule 38: values are checked before anything is written, and a refusal names the field', async (t) => {
  const sb = box(t)
  const { N, L } = mods(sb)
  const st = await N.configure({ op: 'setup', channel: 'ntfy', server: 'https://ntfy.example.test' }, board(L))
  assert.equal(st.ntfy.server, 'https://ntfy.example.test')
  assert.match(st.ntfy.topic, /^arsenale-[a-z2-7]+$/, 'made when empty')
  assert.equal(N.publicState().ntfy.server, 'https://ntfy.example.test', 'read back')
  const cfg = fs.readFileSync(path.join(sb.root, 'notify', 'config.json'), 'utf8')
  const refused = async (body, field, re) => {
    await assert.rejects(N.configure(body, board(L)), (e) => { assert.equal(e.code, 400); assert.equal(e.field, field); assert.match(e.message, re); return true })
  }
  await refused({ op: 'setup', channel: 'ntfy', topic: 'a b' }, 'topic', /^ntfy topic: 3 to 64 letters, digits, - or _$/)
  await refused({ op: 'setup', channel: 'ntfy', topic: 'ab' }, 'topic', /ntfy topic/)
  await refused({ op: 'setup', channel: 'ntfy', topic: 'x'.repeat(65) }, 'topic', /ntfy topic/)
  await refused({ op: 'setup', channel: 'ntfy', server: 'http://ntfy.example.test' }, 'server', /^ntfy server: an https:\/\/ address/)
  await refused({ op: 'setup', channel: 'ntfy', server: 'https://ntfy.example.test', token: 'has space' }, 'ntfyToken', /^ntfy access token: no spaces/)
  await refused({ op: 'setup', channel: 'pushover', token: 'p'.repeat(201) }, 'pushoverToken', /at most 200 characters/)
  await refused({ op: 'setup', channel: 'pushover', user: '' }, 'pushoverUser', /^Pushover user key: fill it in$/)
  await refused({ op: 'setup', channel: 'telegram', token: 'a\nb' }, 'telegramToken', /no spaces or line breaks/)
  await refused({ op: 'expiry', minutes: 4 }, 'minutes', /from 5 to 1440/)
  await refused({ op: 'expiry', minutes: 30.5 }, 'minutes', /whole number/)
  await refused({ op: 'events', channel: 'ntfy', events: { lunch: true } }, 'events', /unknown event "lunch"/)
  await refused({ op: 'events', channel: 'ntfy', events: { stalled: 'no' } }, 'events', /stalled must be true or false/)
  await assert.rejects(N.configure({ op: 'events', channel: 'email', events: { stalled: true } }, board(L)), (e) => e.code === 400)
  // a refused topic left the saved server and topic as they were; no secret file was made by a refusal
  assert.equal(fs.readFileSync(path.join(sb.root, 'notify', 'config.json'), 'utf8'), cfg)
  assert.equal(N.secret('ARSENALE_NTFY_TOKEN'), '')
  // a good topic and a local server are taken
  const ok = await N.configure({ op: 'setup', channel: 'ntfy', server: 'http://127.0.0.1:8080', topic: 'bakery_alerts-1' }, board(L))
  assert.deepEqual([ok.ntfy.server, ok.ntfy.topic], ['http://127.0.0.1:8080', 'bakery_alerts-1'])
  // a test without a secret names the field to fill in (rule 35)
  await assert.rejects(N.configure({ op: 'test', channel: 'pushover' }, board(L)), (e) => e.code === 400 && e.field === 'pushoverToken' && /^Pushover application token: fill it in$/.test(e.message))
  await assert.rejects(N.configure({ op: 'pair', channel: 'telegram' }, board(L)), (e) => e.field === 'telegramToken')
})

test('AT30 an old config.json without events loads with the defaults, and the next save writes them', async (t) => {
  const sb = box(t)
  fs.mkdirSync(path.join(sb.root, 'notify'))
  const old = { schemaVersion: 1, epoch: 'abc', expiryMin: 30, ntfy: { enabled: true, server: 'https://ntfy.example.test', topic: 'old-topic', replyTopic: 'old-reply', details: false, testedAt: '2026-01-02T03:04:05.000Z' }, telegram: { enabled: false }, pushover: { enabled: false } }
  fs.writeFileSync(path.join(sb.root, 'notify', 'config.json'), JSON.stringify(old))
  const { N, L } = mods(sb)
  const ev = N.publicState().events
  assert.deepEqual(Object.keys(ev).sort(), ['desktop', 'ntfy', 'pushover', 'telegram'])
  for (const ch of Object.keys(ev)) assert.deepEqual(ev[ch], { question: true, task: true, budget: true, stalled: true, findings: true, queueWait: false })
  await N.configure({ op: 'events', channel: 'desktop', events: { stalled: false } }, board(L))
  const saved = JSON.parse(fs.readFileSync(path.join(sb.root, 'notify', 'config.json'), 'utf8'))
  assert.equal(saved.events.desktop.stalled, false)
  assert.equal(saved.events.ntfy.stalled, true)
  assert.equal(saved.events.telegram.queueWait, false)
  assert.equal(saved.ntfy.topic, 'old-topic', 'nothing else lost')
  // a newer version's event or channel is kept as it was
  saved.events.ntfy.weekly = true; saved.events.email = { question: false }
  fs.writeFileSync(path.join(sb.root, 'notify', 'config.json'), JSON.stringify(saved))
  await N.configure({ op: 'details', channel: 'ntfy', on: true }, board(L))
  const again = JSON.parse(fs.readFileSync(path.join(sb.root, 'notify', 'config.json'), 'utf8'))
  assert.equal(again.events.ntfy.weekly, true)
  assert.deepEqual(again.events.email, { question: false })
})

test('AT27 test send: one message to a local ntfy, then the switch can go on; with the server down, the reason and the switch stays off', async (t) => {
  const sb = box(t)
  const { N, L } = mods(sb)
  const ntfy = await fakeNtfy(t)
  await N.configure({ op: 'setup', channel: 'ntfy', server: ntfy.url, topic: 'bakery-test', token: 'ntfytokeninvented55' }, board(L))
  await assert.rejects(N.configure({ op: 'enable', channel: 'ntfy' }, board(L)), (e) => e.code === 409, 'not before a test')
  const st = await N.configure({ op: 'test', channel: 'ntfy' }, board(L))
  assert.equal(ntfy.posts().length, 1)
  assert.equal(ntfy.posts()[0].body.topic, 'bakery-test')
  assert.equal(ntfy.posts()[0].auth, 'Bearer ntfytokeninvented55')
  assert.equal(st.ntfy.lastTest.ok, true)
  assert.ok(st.ntfy.testedAt)
  assert.equal((await N.configure({ op: 'enable', channel: 'ntfy' }, board(L))).ntfy.enabled, true)
  // a second data folder whose server is down
  const sb2 = box(t)
  const m2 = mods(sb2)
  const dead = await fakeNtfy(t)
  dead.down()
  await m2.N.configure({ op: 'setup', channel: 'ntfy', server: dead.url, topic: 'bakery-test' }, board(m2.L))
  await assert.rejects(m2.N.configure({ op: 'test', channel: 'ntfy' }, board(m2.L)), (e) => { assert.equal(e.message, 'ntfy answered 503'); return true })
  const s2 = m2.N.publicState()
  assert.deepEqual([s2.ntfy.lastTest.ok, s2.ntfy.lastTest.reason, s2.ntfy.testedAt], [false, 'ntfy answered 503', ''])
  await assert.rejects(m2.N.configure({ op: 'enable', channel: 'ntfy' }, board(m2.L)), (e) => e.code === 409)
  assert.equal(m2.N.publicState().ntfy.enabled, false)
})

test('AT8 phone side: 19 min no send, 20 min exactly one ntfy message, 21 min no second', async (t) => {
  const sb = box(t)
  const { N, W, L } = mods(sb)
  const ntfy = await fakeNtfy(t)
  await N.configure({ op: 'setup', channel: 'ntfy', server: ntfy.url, topic: 'bakery-runs' }, board(L))
  await N.configure({ op: 'test', channel: 'ntfy' }, board(L))
  await N.configure({ op: 'enable', channel: 'ntfy' }, board(L))
  const sent = () => ntfy.posts().length - 1
  const t0 = Date.parse('2026-05-04T08:00:00Z')
  active(sb, 'run-a', t0 + 19 * MIN, 19)
  for (const m of [19, 20, 21]) await N.onEvents(W.tick({ now: t0 + m * MIN }).events)
  assert.equal(sent(), 1)
  const msg = ntfy.posts()[1].body
  assert.deepEqual([msg.topic, msg.title, msg.message], ['bakery-runs', 'Arsenale', 'A run has been quiet for 20 min'])
  assert.equal(msg.actions, undefined, 'no buttons')
  assert.ok(N.publicState().ntfy.lastSentAt)
})

test('AT9 phone text: details off, nothing about the run; details on, only the agent name', async (t) => {
  const sb = box(t)
  const { N, L } = mods(sb)
  const ev = { kind: 'stalled', run: 'run-x', agent: 'tester', quietMin: 20 }
  const c = N.readConfig()
  const off = N.alertMessage('stalled', [ev], 'telegram', c).text
  assert.equal(off, 'A run has been quiet for 20 min')
  c.telegram.details = true
  assert.equal(N.alertMessage('stalled', [ev], 'telegram', c).text, 'A run has been quiet for 20 min: tester')
  // several runs in one tick: one message
  const two = N.alertMessage('stalled', [ev, Object.assign({}, ev, { run: 'run-y', agent: 'implementer', quietMin: 34 })], 'telegram', c).text
  assert.equal(two, '2 runs have been quiet for at least 20 min: tester, implementer')
  // through the real sends, with the task, step and path in the record: none of them goes out
  await N.configure({ op: 'setup', channel: 'pushover', token: PUSH_TOKEN, user: PUSH_USER }, board(L))
  await N.configure({ op: 'setup', channel: 'telegram', token: '123456:invented-bot-token' }, board(L))
  const cfg = N.readConfig(); cfg.telegram.chatId = '7001'; cfg.telegram.userId = '7001'; N.saveConfig(cfg)
  const seen = []
  const real = N.request
  t.after(() => { N.request = real })
  N.request = async (method, url, body) => { seen.push({ url, body }); return { status: 200, text: '{}' } }
  for (const ch of ['pushover', 'telegram']) { await N.configure({ op: 'test', channel: ch }, board(L)); await N.configure({ op: 'enable', channel: ch }, board(L)) }
  await N.configure({ op: 'details', channel: 'telegram', on: true }, board(L))
  seen.length = 0
  const rec = { kind: 'stalled', run: 'run-x', agent: 'tester', quietMin: 20, task: 'invented suite for the bakery menu', doing: 'running step four', path: 'C:\\work\\menu' }
  const res = await N.onEvents([rec])
  assert.deepEqual(res.map((r) => [r.channel, r.ok]).sort(), [['pushover', true], ['telegram', true]])
  const push = seen.find((s) => /pushover/.test(s.url)).body.message
  const tg = seen.find((s) => /telegram/.test(s.url)).body.text
  assert.equal(push, 'A run has been quiet for 20 min')
  assert.equal(tg, 'A run has been quiet for 20 min: tester')
  for (const text of [push, tg]) assert.doesNotMatch(text, /bakery|step four|work|menu|run-x/)
  // a dead run closed by Arsenale stays on the dashboard
  seen.length = 0
  await N.onEvents([{ kind: 'closed', run: 'run-z', agent: 'tester', reason: 'pid' }])
  assert.equal(seen.length, 0)
})

test('AT29 per-event switches: stalled off for the phone sends nothing there, the desktop switch stays on; queue waits are off by default', async (t) => {
  const sb = box(t)
  const { N, L } = mods(sb)
  const ntfy = await fakeNtfy(t)
  await N.configure({ op: 'setup', channel: 'ntfy', server: ntfy.url, topic: 'bakery-runs' }, board(L))
  await N.configure({ op: 'test', channel: 'ntfy' }, board(L))
  await N.configure({ op: 'enable', channel: 'ntfy' }, board(L))
  const st = await N.configure({ op: 'events', channel: 'ntfy', events: { stalled: false } }, board(L))
  assert.equal(st.events.ntfy.stalled, false)
  assert.equal(st.events.desktop.stalled, true)
  const before = ntfy.posts().length
  await N.onEvents([{ kind: 'stalled', run: 'r1', agent: 'tester', quietMin: 20 }])
  await N.onEvents([{ kind: 'queue-wait', run: 'r2', agent: 'tester', waitMin: 70, dashboardOnly: true }])
  assert.equal(ntfy.posts().length, before)
  await N.configure({ op: 'events', channel: 'ntfy', events: { stalled: true, queueWait: true } }, board(L))
  await N.onEvents([{ kind: 'queue-wait', run: 'r2', agent: 'tester', waitMin: 70, dashboardOnly: true }])
  assert.equal(ntfy.posts().length, before + 1)
  assert.equal(ntfy.posts().pop().body.message, 'A run has waited 70 min for the test suite')
  // the question switch gates the question messages too
  await N.configure({ op: 'events', channel: 'ntfy', events: { question: false } }, board(L))
  const sup = L.actorFor('cli', 'supervisor')
  N.onQuestion(L.gate({ question: 'Open on Sunday?', kind: 'approval' }, sup))
  await new Promise((r) => setTimeout(r, 300))
  assert.equal(ntfy.posts().length, before + 1)
})

test('rule 14: a failed send is kept for Settings with its reason, never with a secret, and never throws', async (t) => {
  const sb = box(t)
  const { N, L } = mods(sb)
  await N.configure({ op: 'setup', channel: 'telegram', token: '123456:invented-bot-token' }, board(L))
  const cfg = N.readConfig(); cfg.telegram.chatId = '7001'; cfg.telegram.userId = '7001'; N.saveConfig(cfg)
  const real = N.request
  t.after(() => { N.request = real })
  N.request = async () => ({ status: 200, text: '{}' })
  await N.configure({ op: 'test', channel: 'telegram' }, board(L))
  await N.configure({ op: 'enable', channel: 'telegram' }, board(L))
  // a failure whose text holds the address with the token in it
  N.request = async (m, url) => { throw new Error('request to ' + url + ' failed') }
  const res = await N.onEvents([{ kind: 'stalled', run: 'r1', agent: 'tester', quietMin: 20 }])
  assert.equal(res[0].ok, false)
  const err = N.publicState().telegram.lastError
  assert.ok(err && err.at)
  assert.equal(err.reason, 'request to https://api.telegram.org/bot***/sendMessage failed')
  assert.ok(!JSON.stringify(N.publicState()).includes('invented-bot-token'))
  assert.deepEqual(filesHolding(sb.root, 'invented-bot-token'), [path.join('notify', 'secrets.json')])
  // the next good send clears it
  N.request = async () => ({ status: 200, text: '{}' })
  await N.onEvents([{ kind: 'stalled', run: 'r1', agent: 'tester', quietMin: 80, repeat: 2 }])
  assert.equal(N.publicState().telegram.lastError, null)
})

test('the server loop: a run already stalled when the server starts goes to the phone once; the API masks secrets and names the field', async (t) => {
  const sb = box(t)
  const { N, L } = mods(sb)
  const ntfy = await fakeNtfy(t)
  await N.configure({ op: 'setup', channel: 'ntfy', server: ntfy.url, topic: 'bakery-runs', token: 'ntfytokeninvented55' }, board(L))
  await N.configure({ op: 'test', channel: 'ntfy' }, board(L))
  await N.configure({ op: 'enable', channel: 'ntfy' }, board(L))
  active(sb, 'run-s', Date.now(), 25, { pid: process.pid })
  const env = Object.fromEntries(NAMES.map((n) => [n, '']))
  const { port, child, cookie, token } = await startServer(sb, { env })
  t.after(() => child.kill())
  const deadline = Date.now() + 15000
  while (ntfy.posts().length < 2 && Date.now() < deadline) await new Promise((r) => setTimeout(r, 100))
  assert.equal(ntfy.posts().length, 2, 'the test, then one stall alert')
  assert.equal(ntfy.posts()[1].body.message, 'A run has been quiet for 25 min')
  const call = (method, url, body) => new Promise((resolve, reject) => {
    const r = http.request({ host: '127.0.0.1', port, method, path: url, agent: false, headers: { Host: '127.0.0.1:' + port, Cookie: cookie, Origin: 'http://127.0.0.1:' + port, 'Content-Type': 'application/json', 'X-Dashboard-Token': token } }, (res) => {
      const chunks = []
      res.on('data', (c) => chunks.push(c))
      res.on('end', () => resolve({ status: res.statusCode, text: Buffer.concat(chunks).toString('utf8') }))
    })
    r.on('error', reject)
    if (body) r.write(JSON.stringify(body))
    r.end()
  })
  const got = await call('GET', '/api/notify')
  assert.equal(got.status, 200)
  assert.ok(!got.text.includes('ntfytokeninvented55'))
  assert.deepEqual(JSON.parse(got.text).secrets.ntfyToken, { set: true, from: 'file' })
  const bad = await call('POST', '/api/notify', { op: 'setup', channel: 'ntfy', topic: 'a b' })
  assert.equal(bad.status, 400)
  assert.deepEqual(JSON.parse(bad.text), { error: 'ntfy topic: 3 to 64 letters, digits, - or _', field: 'topic' })
  const saved = await call('POST', '/api/notify', { op: 'setup', channel: 'pushover', token: PUSH_TOKEN, user: PUSH_USER })
  assert.equal(saved.status, 200)
  assert.ok(!saved.text.includes(PUSH_TOKEN) && !saved.text.includes(PUSH_USER))
  assert.equal(JSON.parse(saved.text).result.secrets.pushoverToken.set, true)
})

test('a changed server, topic or token is an untested target: the test is cleared and the channel goes off; the same values keep it', async (t) => {
  const sb = box(t)
  const { N, L } = mods(sb)
  const ntfy = await fakeNtfy(t)
  const ready = async () => {
    await N.configure({ op: 'test', channel: 'ntfy' }, board(L))
    await N.configure({ op: 'enable', channel: 'ntfy' }, board(L))
    const s = N.publicState().ntfy
    assert.ok(s.testedAt && s.enabled)
  }
  await N.configure({ op: 'setup', channel: 'ntfy', server: ntfy.url, topic: 'bakery-one', token: 'ntfytokeninvented55' }, board(L))
  await ready()
  const epoch = N.readConfig().epoch
  // the same values again: nothing to test again
  let s = (await N.configure({ op: 'setup', channel: 'ntfy', server: ntfy.url, topic: 'bakery-one', token: 'ntfytokeninvented55' }, board(L))).ntfy
  assert.ok(s.testedAt && s.enabled, 'unchanged target keeps its test')
  const server2 = ntfy.url.replace('127.0.0.1', 'localhost')
  for (const change of [{ topic: 'bakery-two' }, { token: 'ntfytokeninvented66' }, { token: null }, { server: server2 }]) {
    s = (await N.configure(Object.assign({ op: 'setup', channel: 'ntfy' }, change), board(L))).ntfy
    assert.deepEqual([s.testedAt, s.lastTest, s.enabled], ['', null, false], JSON.stringify(change))
    await assert.rejects(N.configure({ op: 'enable', channel: 'ntfy' }, board(L)), (e) => e.code === 409)
    if (!change.server) await ready()
  }
  assert.notEqual(N.readConfig().epoch, epoch, 'buttons sent to the old target stop working')
  // Telegram and Pushover: a new token is a new target too
  N.saveConfig(Object.assign(N.readConfig(), { pushover: Object.assign(N.readConfig().pushover, { testedAt: new Date().toISOString(), enabled: true }) }))
  s = (await N.configure({ op: 'setup', channel: 'pushover', token: PUSH_TOKEN, user: PUSH_USER }, board(L))).pushover
  assert.deepEqual([s.testedAt, s.enabled], ['', false])
})

test('config.json from a newer Arsenale: saveConfig refuses it, and a settings change writes nothing at all', async (t) => {
  const sb = box(t)
  const { N, L } = mods(sb)
  const file = path.join(sb.root, 'notify', 'config.json')
  fs.mkdirSync(path.dirname(file), { recursive: true })
  const newer = JSON.stringify({ schemaVersion: 2, epoch: 'e', expiryMin: 30, futureKey: { keep: true } })
  fs.writeFileSync(file, newer)
  assert.throws(() => N.saveConfig(N.readConfig()), (e) => e.code === 409)
  assert.equal(N.publicState().readOnly, true)
  await assert.rejects(N.configure({ op: 'setup', channel: 'pushover', token: PUSH_TOKEN, user: PUSH_USER }, board(L)), (e) => e.code === 409)
  await assert.rejects(N.configure({ op: 'expiry', minutes: 60 }, board(L)), (e) => e.code === 409)
  assert.equal(fs.readFileSync(file, 'utf8'), newer, 'the newer file is untouched')
  assert.equal(fs.existsSync(path.join(sb.root, 'notify', 'secrets.json')), false, 'no secret was written either')
})

test('rule 33: build and publish approvals never get phone buttons, whatever the safety rules allow; merge may', (t) => {
  const sb = box(t)
  const { N } = mods(sb)
  const g = (type) => ({ kind: 'approval', approvalType: 'action', action: { category: 'share.external', type } })
  assert.deepEqual(['build', 'publish'].map((x) => N.eligible(g(x)).buttons), [false, false])
  assert.deepEqual(['merge', 'next-phase', ''].map((x) => N.eligible(g(x)).buttons), [true, true, true])
})

test('a phone tap hands the hash it was signed with to the answer, which checks it again under the gate lock', (t) => {
  const sb = box(t)
  process.env.ARSENALE_PHONE_KEY = 'k'.repeat(40)
  const { N, L } = mods(sb)
  N.rotate()
  // an action approval in a category the phone may approve, as check_action writes it
  const g = { id: 'g-phone-hash', project: '', kind: 'approval', approvalType: 'action', question: 'Post the invented autumn menu?', label: '', choices: [], status: 'waiting', answer: '', by: '', run: '', askedBy: 'supervisor', askedAt: new Date().toISOString(), answeredAt: '', history: [], action: { category: 'post.public', target: 'invented page' } }
  fs.writeFileSync(path.join(sb.runs, 'gates', g.id + '.json'), JSON.stringify(g, null, 2))
  const tok = N.sign(g, 'approve', { channel: 'ntfy' })
  const orig = L.answer
  let seen = null
  L.answer = (id, text, actor, opts) => { seen = opts; return orig(id, text, actor, opts) }
  t.after(() => { L.answer = orig })
  assert.equal(N.accept(tok, 'ntfy').ok, true)
  assert.equal(seen.hash, N.questionHash(g))
  assert.equal(seen.via, 'phone:ntfy')
})

// ---------- the final security review of 1.1

/** A waiting action approval the phone may approve, as check_action writes it. */
function phoneGate(sb, id) {
  const g = { id, project: '', kind: 'approval', approvalType: 'action', question: 'Post the invented autumn menu?', label: '', choices: [], status: 'waiting', answer: '', by: '', run: '', askedBy: 'supervisor', askedAt: new Date().toISOString(), answeredAt: '', history: [], action: { category: 'post.public', target: 'invented page' } }
  fs.writeFileSync(path.join(sb.runs, 'gates', g.id + '.json'), JSON.stringify(g, null, 2))
  return g
}
/** notify.request answered here; `seen` holds what would have gone out. */
function stubRequest(t, N) {
  const seen = []
  const real = N.request
  t.after(() => { N.request = real })
  N.request = async (method, url, body) => { seen.push({ method, url, body }); return { status: 200, text: '{}' } }
  return seen
}
const until = async (fn) => { for (let i = 0; i < 200 && !fn(); i++) await new Promise((r) => setTimeout(r, 10)) }

test('ntfy on a public server without a token: a typed topic under 20 characters is refused, and only the generated topic or a token gets buttons', async (t) => {
  const sb = box(t)
  const { N, L } = mods(sb)
  const seen = stubRequest(t, N)
  const PUBLIC = 'https://ntfy.example.test'
  await assert.rejects(N.configure({ op: 'setup', channel: 'ntfy', server: PUBLIC, topic: 'bakery-alerts' }, board(L)), (e) => {
    assert.equal(e.code, 400); assert.equal(e.field, 'topic')
    assert.equal(e.message, 'ntfy topic: use at least 20 characters or the generated topic, or set an access token')
    return true
  })
  assert.equal(fs.existsSync(path.join(sb.root, 'notify', 'config.json')), false, 'nothing written by the refusal')
  // a server on this computer: nobody else reads it, the short topic is fine
  assert.equal((await N.configure({ op: 'setup', channel: 'ntfy', server: 'http://127.0.0.1:8080', topic: 'bakery-alerts' }, board(L))).ntfy.buttons, true)
  // moving that short topic to a public server is refused too
  await assert.rejects(N.configure({ op: 'setup', channel: 'ntfy', server: PUBLIC }, board(L)), (e) => e.field === 'topic')
  // a long typed topic is taken, but carries no buttons, and Settings says so
  let st = await N.configure({ op: 'setup', channel: 'ntfy', server: PUBLIC, topic: 'bakery-alerts-invented-long' }, board(L))
  assert.equal(st.ntfy.buttons, false)
  await N.configure({ op: 'test', channel: 'ntfy' }, board(L))
  await N.configure({ op: 'enable', channel: 'ntfy' }, board(L))
  await N.configure({ op: 'details', channel: 'ntfy', on: true }, board(L))
  const ask = async (id) => { seen.length = 0; N.onQuestion(phoneGate(sb, id)); await until(() => seen.length > 0); return seen[0].body }
  let sent = await ask('g-typed-long')
  assert.equal(sent.topic, 'bakery-alerts-invented-long')
  assert.equal(sent.actions, undefined, 'no signed token on a guessable topic')
  assert.match(sent.message, /Open Arsenale to answer$/)
  // with an access token the short topic is allowed and the buttons go out
  st = await N.configure({ op: 'setup', channel: 'ntfy', topic: 'bakery-alerts', token: 'ntfytokeninvented55' }, board(L))
  assert.deepEqual([st.ntfy.topic, st.ntfy.buttons], ['bakery-alerts', true])
  // removing the token under the short topic is refused
  await assert.rejects(N.configure({ op: 'setup', channel: 'ntfy', token: null }, board(L)), (e) => e.field === 'topic')
  await N.configure({ op: 'test', channel: 'ntfy' }, board(L))
  await N.configure({ op: 'enable', channel: 'ntfy' }, board(L))
  sent = await ask('g-token')
  assert.deepEqual(sent.actions.map((a) => a.label), ['Approve', 'Reject'])
  // the generated topic (topic: null asks for a new one) without a token: buttons again
  await N.configure({ op: 'setup', channel: 'ntfy', topic: 'bakery-alerts-invented-long', token: null }, board(L))
  st = await N.configure({ op: 'setup', channel: 'ntfy', topic: null }, board(L))
  assert.match(st.ntfy.topic, /^arsenale-[a-z2-7]{26}$/)
  assert.equal(st.ntfy.buttons, true)
  await N.configure({ op: 'test', channel: 'ntfy' }, board(L))
  await N.configure({ op: 'enable', channel: 'ntfy' }, board(L))
  sent = await ask('g-made')
  assert.equal(sent.actions.length, 2)
  // a short typed topic in place of the generated one is refused
  await assert.rejects(N.configure({ op: 'setup', channel: 'ntfy', topic: 'bakery-x' }, board(L)), (e) => e.field === 'topic')
  // a config.json from before the flag: its generated topic still counts as generated
  const c = N.readConfig(); delete c.ntfy.topicMade; N.saveConfig(c)
  assert.equal(N.publicState().ntfy.buttons, true)
  const c2 = N.readConfig(); c2.ntfy.topic = 'bakery-alerts-invented-long'; delete c2.ntfy.topicMade; N.saveConfig(c2)
  assert.equal(N.publicState().ntfy.buttons, false)
})

test('a phone token names its channel: one signed for Telegram is refused on ntfy, and one with no channel everywhere', (t) => {
  const sb = box(t)
  process.env.ARSENALE_PHONE_KEY = 'k'.repeat(40)
  const { N } = mods(sb)
  N.rotate()
  const g = phoneGate(sb, 'g-channel')
  assert.throws(() => N.sign(g, 'approve'), /opts\.channel/)
  const tg = N.sign(g, 'approve', { channel: 'telegram' })
  const out = N.accept(tg, 'ntfy')
  assert.deepEqual([out.ok, out.reason], [false, 'channel'])
  assert.equal(N.readConfig().ntfy.invalidToday, 1, 'counted as an invalid message')
  assert.equal(sb.read('agent-runs/gates/g-channel.json').status, 'waiting')
  // a token as 1.1 builds before this signed it: no channel at all
  const b64u = (buf) => Buffer.from(buf).toString('base64').replace(/\+/g, '-').replace(/\//g, '_').replace(/=+$/, '')
  const payload = b64u(JSON.stringify({ g: g.id, d: 'approve', e: Date.now() + 60000, n: 'invented-nonce-1', q: N.questionHash(g) }))
  const old = payload + '.' + b64u(require('crypto').createHmac('sha256', N.signingKey()).update(payload).digest())
  for (const ch of ['ntfy', 'telegram']) assert.equal(N.accept(old, ch).reason, 'channel', ch)
  // the right channel still works
  assert.equal(N.accept(tg, 'telegram').ok, true)
})

test('macOS and Linux: notify/ is 0700 at every write, its files 0600, and the page checks the folder too', async (t) => {
  const sb = box(t)
  process.env.ARSENALE_PHONE_KEY = 'k'.repeat(40)
  const { N, L } = mods(sb)
  const dir = path.join(sb.root, 'notify')
  // an older build made the folder with the umask
  fs.mkdirSync(dir)
  // the platform and the calls into fs, faked so this runs on Windows as well
  const realPlatform = Object.getOwnPropertyDescriptor(process, 'platform')
  Object.defineProperty(process, 'platform', { value: 'linux' })
  const { chmodSync, openSync, statSync } = fs
  const chmods = [], opens = []
  fs.chmodSync = (p, m) => { chmods.push([path.resolve(String(p)), m]); return chmodSync(p, m) }
  fs.openSync = (p, f, m) => { opens.push([path.resolve(String(p)), m]); return openSync(p, f, m) }
  t.after(() => { Object.defineProperty(process, 'platform', realPlatform); Object.assign(fs, { chmodSync, openSync, statSync }) })
  const seen = stubRequest(t, N)
  await N.configure({ op: 'setup', channel: 'telegram', token: '123456:invented-bot-token' }, board(L))
  assert.ok(chmods.some(([p, m]) => p === dir && m === 0o700), 'an existing notify/ is closed again')
  const cfg = N.readConfig(); cfg.telegram.chatId = '7001'; cfg.telegram.userId = '7001'; N.saveConfig(cfg)
  await N.configure({ op: 'test', channel: 'telegram' }, board(L))
  await N.configure({ op: 'enable', channel: 'telegram' }, board(L))
  await N.configure({ op: 'details', channel: 'telegram', on: true }, board(L))
  const g = phoneGate(sb, 'g-modes')
  seen.length = 0
  N.onQuestion(g)
  await until(() => seen.length > 0)
  const pending = path.join(dir, 'pending')
  assert.ok(chmods.some(([p, m]) => p === pending && m === 0o700), 'pending/ too')
  // a tap: the nonce file is written
  const id = /^a:(.+)$/.exec(seen[0].body.reply_markup.inline_keyboard[0][0].callback_data)[1]
  const out = N.telegramUpdate({ callback_query: { id: 'cb1', from: { id: 7001 }, message: { chat: { id: 7001 } }, data: 'a:' + id } })
  assert.match(out.reply, /^Approved/)
  // every file written in notify/ was opened 0600 (the temp file of the atomic write)
  const inNotify = opens.filter(([p]) => p.startsWith(dir + path.sep))
  const kind = (re) => inNotify.filter(([p]) => re.test(path.basename(p)))
  for (const [name, re] of [['config.json', /^config\.json\./], ['secrets.json', /^secrets\.json\./], ['used-nonces.jsonl', /^used-nonces\.jsonl\./], ['a pending file', /^[\w-]+\.json\.\d+-/]]) {
    const files = kind(re)
    assert.ok(files.length, name + ' was written')
    for (const [p, m] of files) assert.equal(m, 0o600, name + ': ' + path.basename(p))
  }
  // the page: a 0600 file in a folder others can enter is not owner-only
  const SECRETS = path.join(dir, 'secrets.json')
  const mode = { file: 0o100600, dir: 0o40755 }
  fs.statSync = (p, o) => { const r = path.resolve(String(p)); if (r === SECRETS) return { mode: mode.file }; if (r === dir) return { mode: mode.dir }; return statSync(p, o) }
  assert.equal(N.publicState().secretsFile.ownerOnly, false)
  mode.dir = 0o40700
  assert.equal(N.publicState().secretsFile.ownerOnly, true)
  mode.file = 0o100644
  assert.equal(N.publicState().secretsFile.ownerOnly, false)
})

test('macOS and Linux, real modes: notify/ 0700, config.json and secrets.json 0600', { skip: process.platform === 'win32' && 'POSIX modes' }, async (t) => {
  const sb = box(t)
  const { N, L } = mods(sb)
  const dir = path.join(sb.root, 'notify')
  fs.mkdirSync(dir, { mode: 0o755 })
  fs.chmodSync(dir, 0o755)
  await N.configure({ op: 'setup', channel: 'ntfy', server: 'http://127.0.0.1:8080', topic: 'bakery-alerts' }, board(L))
  assert.equal(fs.statSync(dir).mode & 0o777, 0o700)
  for (const f of ['config.json', 'secrets.json']) assert.equal(fs.statSync(path.join(dir, f)).mode & 0o777, 0o600, f)
  assert.equal(N.publicState().secretsFile.ownerOnly, true)
  fs.chmodSync(dir, 0o755)
  assert.equal(N.publicState().secretsFile.ownerOnly, false)
})

test('Windows: each arsenale serve reads the notify folder ACL back and re-applies it, mark or not; the page reads the real ACL', { skip: process.platform !== 'win32' && 'Windows ACLs' }, async (t) => {
  const { spawn, spawnSync } = require('child_process')
  const sb = box(t)
  const { N, L } = mods(sb)
  const dir = path.join(sb.root, 'notify')
  // a folder an earlier start marked as done, whose ACL is (again) inherited
  fs.mkdirSync(dir)
  fs.writeFileSync(path.join(dir, '.owner-only'), '2026-01-01T00:00:00.000Z\n')
  await N.configure({ op: 'setup', channel: 'pushover', token: PUSH_TOKEN, user: PUSH_USER }, board(L))
  const acl = () => spawnSync('icacls', [dir], { encoding: 'utf8', windowsHide: true }).stdout
  assert.match(acl(), /\(I\)/, 'inherited to begin with')
  assert.equal(N.publicState().secretsFile.ownerOnly, false, 'the mark alone is not believed')
  const port = 47000 + Math.floor(Math.random() * 2000)
  const child = spawn(process.execPath, [path.join(__dirname, '..', '..', 'bin', 'arsenale.cjs'), 'serve', '--no-open', '--port', String(port)], { env: sb.env, stdio: ['ignore', 'pipe', 'pipe'], windowsHide: true })
  t.after(() => { try { child.kill() } catch { /* gone */ } })
  let out = ''
  await new Promise((resolve, reject) => {
    const to = setTimeout(() => reject(new Error('serve did not start: ' + out)), 30000)
    child.stdout.on('data', (d) => { out += d; if (/Arsenale dashboard: /.test(out)) { clearTimeout(to); resolve() } })
    child.stderr.on('data', (d) => { out += d })
    child.on('exit', (c) => { clearTimeout(to); reject(new Error('serve exited ' + c + ': ' + out)) })
  })
  child.kill()
  assert.doesNotMatch(out, /Warning: could not limit/)
  const lines = acl().split(/\r?\n/).filter((l) => /:\(/.test(l))
  assert.equal(lines.length, 1, acl())
  assert.doesNotMatch(lines[0], /\(I\)/)
  assert.match(lines[0], /\(OI\)\(CI\)\(F\)/)
  assert.equal(require(path.join(sb.tools, 'owner-only.cjs')).check(dir).ok, true)
})
