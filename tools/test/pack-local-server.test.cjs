/* The write path of a local pack over HTTP (spec 1.2 rules 28 and 33):
 * api/pack-local takes the same Origin, token and Sec-Fetch checks as every
 * other POST, caps the body, and installs only on the board's second call;
 * no MCP tool and no CLI command can stage or install a local pack. Each test
 * starts its own server on its own port and stops only that process.
 * Invented data. Run: npm test */
const test = require('node:test')
const assert = require('node:assert/strict')
const fs = require('fs')
const http = require('http')
const path = require('path')
const { makeSandbox, hashTree, SEED, startServer, mcpClient } = require('./helpers.cjs')
const { bakeryPack, folderBody, zipOf, zipBody } = require('./pack-fixture.cjs')

const cookies = {}
function req(port, { method = 'GET', url = '/', headers = {}, body } = {}) {
  return new Promise((resolve, reject) => {
    const r = http.request({ host: '127.0.0.1', port, method, path: url, agent: false, headers: Object.assign({ Host: '127.0.0.1:' + port }, cookies[port] ? { Cookie: cookies[port] } : {}, headers) }, (res) => {
      const chunks = []
      res.on('data', (c) => chunks.push(c))
      res.on('end', () => {
        const text = Buffer.concat(chunks).toString('utf8')
        let json = null
        try { json = JSON.parse(text) } catch { /* not json */ }
        resolve({ status: res.statusCode, text, json })
      })
    })
    // a refused upload may be cut off while it is still being sent
    r.on('error', (e) => (e.code === 'ECONNRESET' || e.code === 'EPIPE' ? resolve({ status: 0, text: e.code, json: null }) : reject(e)))
    if (body !== undefined) r.write(typeof body === 'string' ? body : JSON.stringify(body))
    r.end()
  })
}
async function setup(t) {
  const sb = makeSandbox({ packs: true })
  assert.equal(sb.cli('--company-init', '--seed', sb.seed(Object.assign({}, SEED, { company: { name: 'Bluefin Bakery', issuePrefix: 'BLU' } }))).code, 0)
  const { port, child, cookie, token } = await startServer(sb)
  cookies[port] = cookie
  t.after(() => { child.kill(); sb.cleanup() })
  const post = (url, body, extra = {}) => req(port, { method: 'POST', url, body, headers: Object.assign({ Origin: 'http://127.0.0.1:' + port, 'Content-Type': 'application/json', 'X-Dashboard-Token': token }, extra) })
  return { sb, port, post }
}

test('api/pack-local refuses a request without the token, from another Origin or another site, and writes nothing', async (t) => {
  const { sb, port, post } = await setup(t)
  const before = hashTree(sb.root)
  const body = folderBody(bakeryPack())
  const noToken = await req(port, { method: 'POST', url: '/api/pack-local', body, headers: { Origin: 'http://127.0.0.1:' + port, 'Content-Type': 'application/json' } })
  assert.equal(noToken.status, 403)
  assert.equal((await post('/api/pack-local', body, { Origin: 'https://evil.example' })).status, 403)
  assert.equal((await post('/api/pack-local', body, { 'Sec-Fetch-Site': 'cross-site' })).status, 403)
  assert.equal((await post('/api/pack-local', body, { 'Sec-Fetch-Site': 'same-site' })).status, 403)
  assert.equal((await post('/api/pack-local', body, { 'Content-Type': 'text/plain' })).status, 415)
  const noKey = await req(port, { method: 'POST', url: '/api/pack-local', body, headers: { Cookie: 'x=y', Origin: 'http://127.0.0.1:' + port, 'Content-Type': 'application/json' } })
  assert.ok(noKey.status === 401 || noKey.status === 403, 'no key cookie: ' + noKey.status)
  assert.ok([404, 405].includes((await req(port, { url: '/api/pack-local' })).status), 'GET is not a way in')
  assert.deepEqual(hashTree(sb.root), before)
})

test('a body over 2 MB is cut off with 413; a refused pack says every reason and leaves no staging', async (t) => {
  const { sb, post } = await setup(t)
  const big = await post('/api/pack-local', { op: 'stage', zip: 'A'.repeat(2 * 1024 * 1024 + 8) })
  assert.ok(big.status === 413 || big.status === 0, String(big.status))
  const bad = await post('/api/pack-local', folderBody(bakeryPack({ files: { 'run.ps1': 'x', 'agents/../x.md': 'y' } })))
  assert.equal(bad.status, 400)
  assert.match(bad.json.error, /This pack was refused/)
  assert.match(bad.json.error, /a "\.\." in a path/)
  const staging = path.join(sb.root, 'packs', 'staging')
  assert.deepEqual(fs.existsSync(staging) ? fs.readdirSync(staging) : [], [])
})

test('stage, review, install from a .zip over HTTP; the list marks it local; remove asks about an edited file', async (t) => {
  const { sb, port, post } = await setup(t)
  const st = await post('/api/pack-local', zipBody(zipOf(bakeryPack())))
  assert.equal(st.status, 200, st.text)
  const r = st.json.result
  assert.deepEqual(r.members.map((m) => m.dropped), [['Write'], ['Write']])
  assert.ok(!fs.existsSync(path.join(sb.agents, 'bakery-lead.md')), 'the review installs nothing')
  const ins = await post('/api/pack-local', { op: 'install', stage: r.stage, hash: r.hash, keep: { 'bread-writer': true } })
  assert.equal(ins.status, 200, ins.text)
  assert.match(fs.readFileSync(path.join(sb.agents, 'bakery-lead.md'), 'utf8'), /^tools: Read, Grep, Glob$/m)
  assert.match(fs.readFileSync(path.join(sb.agents, 'bread-writer.md'), 'utf8'), /^tools: Read, Glob, Grep, Write$/m)
  const list = await req(port, { url: '/api/packs' })
  assert.deepEqual(list.json.local.map((p) => [p.id, p.source]), [['demo-bakery-pack', 'local']])
  assert.ok(!list.json.packs.some((p) => p.id === 'demo-bakery-pack'))
  fs.appendFileSync(path.join(sb.agents, 'bread-writer.md'), '\nmine\n')
  const ask = await post('/api/pack', { op: 'remove', id: 'demo-bakery-pack' })
  assert.equal(ask.status, 409)
  assert.equal(ask.json.field, 'keepEdited')
  const rm = await post('/api/pack', { op: 'remove', id: 'demo-bakery-pack', keepEdited: true })
  assert.equal(rm.status, 200, rm.text)
  assert.deepEqual(rm.json.result.kept, ['bread-writer'])
  assert.ok(fs.existsSync(path.join(sb.agents, 'bread-writer.md')) && !fs.existsSync(path.join(sb.agents, 'bakery-lead.md')))
})

test('no other door: MCP has no pack tool and refuses the name; the CLI has no command for it', async (t) => {
  const sb = makeSandbox({ packs: true })
  assert.equal(sb.cli('--company-init', '--seed', sb.seed()).code, 0)
  const c = mcpClient(sb, 'Claude Desktop')
  t.after(() => { c.close(); sb.cleanup() })
  await c.init()
  const names = (await c.rpc('tools/list', {})).result.tools.map((x) => x.name)
  assert.ok(!names.some((n) => /pack|install|stage/.test(n)), names.join(', '))
  const call = await c.rpc('tools/call', { name: 'install_pack', arguments: { zip: 'UEsFBgAAAAAAAAAAAAAAAAAAAAAAAA==' } })
  assert.ok(call.error || call.result.isError, 'an unknown tool')
  for (const args of [['--pack-local', '{}'], ['--install-pack', '{}'], ['--stage-pack', '{}']]) {
    const r = sb.cli(...args)
    assert.notEqual(r.code, 0, args[0])
  }
  assert.ok(!fs.existsSync(path.join(sb.root, 'packs', 'staging')) || fs.readdirSync(path.join(sb.root, 'packs', 'staging')).length === 0)
  const bin = fs.readFileSync(path.join(__dirname, '..', '..', 'bin', 'arsenale.cjs'), 'utf8')
  assert.doesNotMatch(bin, /pack-local/)
})
