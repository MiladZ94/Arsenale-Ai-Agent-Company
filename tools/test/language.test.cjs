/* English only (owner, 2026-10-12). Nothing a person
 * reads may be in Arabic script, in any view of the dashboard; there is no
 * language switch, and neither ?lang=fa nor an old dash-lang=fa cookie
 * brings another language back.
 *
 * "Data" is allowed to be in either language: agent ids, model names, project
 * names and codes, file names and flags, numbers, and what a person typed
 * (task text, decision and gate text).
 *
 * The pages draw themselves with script, so these tests open them in a
 * headless Chrome or Edge (test/browser.cjs). With none installed they skip.
 * Run: node --test "tools/test/*.test.cjs" */
const test = require('node:test')
const assert = require('node:assert/strict')
const fs = require('fs')
const http = require('http')
const path = require('path')
const { makeSandbox, startServer: startWithKey } = require('./helpers.cjs')
const browser = require('./browser.cjs')
const { SEED, TYPED_DECISION, EN_DECISION, EN_TASK, DATA_TYPED, fixture } = require('./language-fixture.cjs')

const SKIP = browser.unavailable()
const ARABIC = /\p{Script=Arabic}/u
const sleep = (ms) => new Promise((r) => setTimeout(r, ms))

// the owner's key cookie per server port, for the JSON reads below
const cookies = {}
async function startServer(sb) {
  const s = await startWithKey(sb)
  cookies[s.port] = s.cookie
  return s
}

function getJson(port, url) {
  return new Promise((resolve, reject) => {
    http.get({ host: '127.0.0.1', port, path: url, agent: false, headers: cookies[port] ? { Cookie: cookies[port] } : {} }, (res) => {
      let s = ''
      res.on('data', (c) => { s += c })
      res.on('end', () => { try { resolve(JSON.parse(s)) } catch (e) { reject(e) } })
    }).on('error', reject)
  })
}

/** Latin words that are data, not interface: every word of the invented data
 *  and the real names of the fixture. */
function dataWords(sb) {
  // model families, tool names, and the words of the command the set-up screen shows (node log-agent-run.cjs --seed <file>)
  const words = new Set(['opus', 'sonnet', 'read', 'grep', 'glob', 'edit', 'write', 'bash', 'powershell', 'agent', 'mystery', 'node', 'file', 'arsenale', 'log', ...BRANDS])
  const add = (s) => { for (const w of String(s).match(/[A-Za-z][A-Za-z0-9_-]*/g) || []) words.add(w.toLowerCase()) }
  const walk = (v) => {
    // a run id is shown by its last four characters
    if (typeof v === 'string') { add(v); if (/\dZ-/.test(v)) words.add(v.slice(-4).replace(/^\d+/, '').toLowerCase()) }
    else if (Array.isArray(v)) v.forEach(walk)
    else if (v && typeof v === 'object') Object.values(v).forEach(walk)
  }
  const dirs = [sb.runs, path.join(sb.runs, 'active'), path.join(sb.runs, 'gates'), path.join(sb.runs, 'decisions')]
  for (const d of dirs) for (const f of fs.existsSync(d) ? fs.readdirSync(d) : []) if (f.endsWith('.json')) walk(JSON.parse(fs.readFileSync(path.join(d, f), 'utf8')))
  // the agent definitions are data too: their names, models and descriptions
  for (const a of fs.readdirSync(sb.agents)) { add(a.replace(/\.md$/, '')); add(fs.readFileSync(path.join(sb.agents, a), 'utf8')) }
  const company = (n) => { try { return JSON.parse(fs.readFileSync(path.join(sb.company, n + '.json'), 'utf8')) } catch { return null } }
  // the company's own name heads the org chart: data, as typed in the wizard
  const co = company('company')
  if (co) add(co.name)
  for (const o of company('offices') || []) { add(o.name); for (const k of ['id', 'leadEmployeeId']) add(o[k] || '') }
  for (const p of company('projects') || []) { add(p.id); add(p.name); add(p.key); (p.aliases || []).forEach(add) }
  for (const e of Object.keys(company('employees') || {})) add(e)
  // the company log is a record on disk, written in English by the CLI: the
  // Activity screen shows its lines as written, like a task text
  try { for (const l of fs.readFileSync(path.join(sb.company, 'activity.jsonl'), 'utf8').split('\n')) if (l.trim()) walk(JSON.parse(l)) } catch { /* no company log */ }
  // the 1.0 records are data too: tasks, comments, deliverables, the clients' names
  const jsonIn = (d) => { try { return fs.readdirSync(d).filter((f) => f.endsWith('.json')).map((f) => JSON.parse(fs.readFileSync(path.join(d, f), 'utf8'))) } catch { return [] } }
  for (const t of jsonIn(path.join(sb.company, 'issues'))) walk([t.id, t.title, t.description, t.links])
  for (const d of jsonIn(path.join(sb.root, 'deliverables', 'index'))) walk([d.title, d.agent, d.url, d.originalPath])
  try { for (const f of fs.readdirSync(path.join(sb.company, 'comments'))) for (const l of fs.readFileSync(path.join(sb.company, 'comments', f), 'utf8').split('\n')) if (l.trim()) walk(JSON.parse(l).text) } catch { /* none */ }
  try { walk(Object.keys(JSON.parse(fs.readFileSync(path.join(sb.root, 'mcp', 'clients.json'), 'utf8')).clients)) } catch { /* none */ }
  return words
}

// product names, which are not translated (and the plan names they sell)
const BRANDS = ['claude', 'desktop', 'code', 'cursor', 'gemini', 'codex', 'cli', 'chatgpt', 'mcp', 'http', 'https', 'ntfy', 'telegram', 'pushover', 'botfather', 'api', 'pro', 'plus', 'arsenale', 'board', 'url',
  // the MCP tool names the instructions mention: identifiers, never translated
  // file type codes on the finished-work cards, which stay as written like a file name
  'txt', 'csv', 'png', 'jpg', 'gif', 'webp', 'pdf',
  'hello', 'get_inbox', 'start_job', 'log_step', 'finish_job', 'ask_you', 'get_answers', 'check_action', 'add_deliverable']

const stripData = (text) => DATA_TYPED.reduce((t, d) => t.split(d).join(' '), text)

/** The screens, each a function that brings the open page to that screen. */
const VIEWS = (offices) => [
  ['campus', "location.hash = '#/campus'"],
  ...offices.map((id) => ['office-' + id, "location.hash = '#/office/" + id + "'"]),
  ['org', "location.hash = '#/org'"],
  ['org with retired', "location.hash = '#/org'; setTimeout(() => document.querySelector('[data-retired]').click(), 100)"],
  ['decisions', "location.hash = '#/decisions'"],
  ['usage', "location.hash = '#/usage'"],
  ['activity', "location.hash = '#/activity'"],
  ['office menu', "location.hash = '#/campus'; setTimeout(() => document.getElementById('omenu-office').click(), 100)"],
  ['more menu', "location.hash = '#/campus'; setTimeout(() => document.getElementById('omenu-legacy').click(), 100)"],
  ['waiting rail', "location.hash = '#/office/studio'; setTimeout(() => document.querySelector('[data-railopen]').click(), 100)"],
  ['budget dialog', "location.hash = '#/campus'; setTimeout(() => document.querySelector('[data-budget]').click(), 100)"],
  ['budgets switch armed', "location.hash = '#/campus'; setTimeout(() => document.querySelector('[data-bmaster]').click(), 100)"],
  // the 1.0 screens (everyone-page.cjs); they load their data after the hash
  // changes, so a click waits for its button (WAIT, below)
  ['tasks', "location.hash = '#/tasks'"],
  ['tasks list', "location.hash = '#/tasks'; WAIT('[data-ev=tview][data-arg=list]', (e) => e.click())"],
  // back to the board (the list view was remembered), then a task's page
  ['task detail', "location.hash = '#/tasks'; WAIT('[data-ev=tview][data-arg=board]', (b) => { b.click(); WAIT('.board4 [data-ev=task-open]', (e) => e.click()) })"],
  ['task edit', "location.hash = '#/tasks'; WAIT('.board4 [data-ev=task-open]', (e) => { e.click(); WAIT('[data-ev=task-edit]', (x) => x.click()) })"],
  ['new task', "location.hash = '#/tasks'; WAIT('[data-ev=task-new]', (e) => e.click())"],
  ['approvals', "location.hash = '#/approvals'"],
  // every letter: an action, a hire, a choice, a plain approval
  ...[1, 2, 3, 4].map((n) => ['approvals letter ' + n, "location.hash = '#/approvals'; WAIT('.ai:nth-child(" + n + ")', (e) => { e.click(); WAIT('[data-ev=appr-note]', (x) => x.click()) })"]),
  ['team', "location.hash = '#/team'"],
  ['team profile', "location.hash = '#/team'; WAIT('[data-ev=team-office][data-arg=support]', (o) => { o.click(); WAIT('.desks [data-ev=member-open][data-arg=reply-drafter]', (e) => { e.click(); WAIT('.ev-drawer details', (d) => document.querySelectorAll('.ev-drawer details').forEach((x) => { x.open = true })) }) })"],
  ['hire form', "location.hash = '#/team'; WAIT('[data-ev=hire-new]', (e) => { e.click(); WAIT('.ev-drawer details', (d) => { d.open = true }) })"],
  ['hire review', "location.hash = '#/team'; WAIT('[data-ev=hire-new]', (e) => { e.click(); WAIT('form[data-evform=hire] input[name=title]', (i) => { const f = i.form; f.elements.name.value = 'Sample'; i.value = 'sample title'; f.elements.instructions.value = 'sample instructions, sample reason'; f.requestSubmit() }) })"],
  ['deliverables', "location.hash = '#/deliverables'"],
  ['deliverable preview', "location.hash = '#/deliverables'; WAIT('[data-ev=dlv-open]', (e) => e.click())"],
  ...['assistants', 'phone', 'safety', 'packs', 'privacy'].map((tab) => ['settings ' + tab, "location.hash = '#/settings'; WAIT('[data-ev=stab][data-arg=" + tab + "]', (e) => e.click())"]),
  ['settings assistant steps', "location.hash = '#/settings'; WAIT('[data-ev=stab][data-arg=assistants]', (e) => { e.click(); WAIT('[data-ev=copen][data-arg=claude-code]', (c) => c.click()) })"],
  ['settings pack detail', "location.hash = '#/settings'; WAIT('[data-ev=stab][data-arg=packs]', (e) => { e.click(); WAIT('[data-ev=pack-open][data-arg=finance]', (c) => c.click()) })"],
  ...['telegram', 'pushover'].map((ch) => ['settings phone ' + ch, "location.hash = '#/settings'; WAIT('[data-ev=stab][data-arg=phone]', (e) => { e.click(); WAIT('[data-ev=nchan][data-arg=" + ch + "]', (c) => c.click()) })"]),
]

const WAIT_DEF = "window.WAIT = (sel, f) => { const n = Date.now(); const t = setInterval(() => { const e = document.querySelector(sel); if (e) { clearInterval(t); f(e) } else if (Date.now() - n > 8000) clearInterval(t) }, 100) }; "

async function readViews(page, offices, port) {
  const out = {}
  await page.goto('http://127.0.0.1:' + port + '/?v=1#/campus')
  for (const [name, action] of VIEWS(offices)) {
    await page.eval(WAIT_DEF + action + '; 1')
    await sleep(500)
    out[name] = await page.readable()
    // leave a dialog or menu so it does not cover the next screen
    await page.eval("document.dispatchEvent(new KeyboardEvent('keydown', { key: 'Escape', bubbles: true })); 1")
  }
  await page.goto('http://127.0.0.1:' + port + '/archive')
  out.archive = await page.readable()
  return out
}

let shared = null
async function world() {
  if (shared) return shared
  const sb = fixture()
  const { port, child, url: keyUrl } = await startServer(sb)
  const page = await browser.launch()
  await page.goto(keyUrl)
  const offices = (await getJson(port, '/api/company')).offices.map((o) => o.id)
  const words = dataWords(sb)
  // the connect cards carry this machine's paths and commands, the packs their member ids: data
  const add = (s) => { for (const w of String(s || '').match(/[A-Za-z][A-Za-z0-9_]*(?:-[A-Za-z0-9_]+)*/g) || []) { words.add(w.toLowerCase()); for (const x of w.split('-')) words.add(x.toLowerCase()) } }
  for (const c of (await getJson(port, '/api/connect')).cards) { add(c.command); add(c.snippet); add(c.file); add(c.link) }
  for (const p of (await getJson(port, '/api/packs')).packs) { add(p.version); for (const m of p.members) add(m.id) }
  shared = { sb, port, child, page, offices, words }
  return shared
}

test.after(async () => {
  if (!shared) return
  await shared.page.close()
  shared.child.kill()
  shared.sb.cleanup()
})

test('English: no Arabic script on any screen, and the typed text is shown as written', { skip: SKIP || false }, async (t) => {
  const w = await world()
  const views = await readViews(w.page, w.offices, w.port)
  for (const [name, text] of Object.entries(views)) {
    const left = stripData(text).split('\n').filter((l) => ARABIC.test(l))
    assert.deepEqual(left, [], 'English "' + name + '" shows Arabic script: ' + left.slice(0, 3).join(' | '))
  }
  // the free text is data and is shown as typed
  assert.ok(views.decisions.includes(TYPED_DECISION), 'a decision text keeps its language')
  assert.ok(views.campus.includes('Engineering') && views.campus.includes('Operations'), 'English office names')
  // the 1.0 screens were drawn with their data, not left loading
  const drawn = { tasks: EN_TASK + ' six', 'tasks list': 'not seen yet', 'task detail': 'Copy a message for your assistant', 'task edit': 'Ask me before it is finished', 'new task': 'File paths, one per line', approvals: 'sample title', 'approvals letter 1': 'Why it matters', 'approvals letter 2': 'If you say no', team: 'Your campus', 'team profile': 'Safety rules for this member', 'hire form': 'Pick a look', 'hire review': 'This is the file Arsenale will write', deliverables: 'deliverable sample', 'deliverable preview': 'Close', 'settings assistants': 'Claude Desktop', 'settings phone': 'Sign out all phones', 'settings safety': 'Paying or spending money', 'settings packs': 'Customer support', 'settings privacy': 'api.telegram.org', 'settings assistant steps': 'Let Arsenale add itself', 'settings pack detail': 'Add this office', 'settings phone telegram': 'Telegram', 'settings phone pushover': 'Pushover' }
  for (const [name, text] of Object.entries(drawn)) assert.ok(views[name].includes(text), name + ' shows "' + text + '"')
})

test('English: the same numbers keep Latin digits and the dot', { skip: SKIP || false }, async (t) => {
  const w = await world()
  await w.page.goto('http://127.0.0.1:' + w.port + '/?v=2#/campus')
  const t1 = await w.page.eval("document.querySelector('.ckpis').textContent")
  assert.match(t1, /[0-9]/)
  assert.doesNotMatch(t1, /\p{Script=Arabic}/u)
})

test('budget dialog: a refused save shows its reason, in English', { skip: SKIP || false }, async (t) => {
  const w = await world()
  {
    await w.page.goto('http://127.0.0.1:' + w.port + '/?v=3#/campus')
    await w.page.eval("document.querySelector('[data-budget]').click(); 1")
    await w.page.waitFor("document.querySelector('form[data-bform]')")
    await w.page.eval("const f = document.querySelector('form[data-bform]'); f.elements.monthlyTokens.value = 'abc'; f.requestSubmit(); 1")
    await w.page.waitFor("document.getElementById('cdlg-msg').className.includes('err')")
    const msg = await w.page.eval("document.getElementById('cdlg-msg').textContent")
    assert.ok(msg.length > 10, 'a reason is shown')
    assert.ok(!ARABIC.test(msg), msg)
  }
})

test('no company: the single-office page and the archive are English', { skip: SKIP || false }, async (t) => {
  const sb = makeSandbox()
  const { port, child, url: keyUrl } = await startServer(sb)
  t.after(() => { child.kill(); sb.cleanup() })
  sb.measured('implementer', 'democalc', 1000, { task: EN_TASK })
  const words = dataWords(sb)
  const page = await browser.launch()
  t.after(() => page.close())
  await page.goto(keyUrl)
  {
    await page.goto('http://127.0.0.1:' + port + '/')
    const texts = [await page.readable()]
    for (const h of ['#/campus', '#/decisions', '#/usage', '#/activity', '#/office']) { await page.eval("location.hash = '" + h + "'; 1"); await sleep(400); texts.push(await page.readable()) }
    await page.goto('http://127.0.0.1:' + port + '/archive')
    texts.push(await page.readable())
    for (const text of texts) assert.ok(!ARABIC.test(text), 'the page shows Arabic script')
    assert.ok(words.size > 0)
  }
})

test('the campus set-up note, the newer-data banner and a broken file are in English', { skip: SKIP || false }, async (t) => {
  const sb = makeSandbox()
  assert.equal(sb.cli('--company-init', '--seed', sb.seed(SEED)).code, 0)
  const c = sb.read('company/company.json')
  c.schemaVersion = 2
  fs.writeFileSync(path.join(sb.company, 'company.json'), JSON.stringify(c))
  fs.writeFileSync(path.join(sb.company, 'projects.json'), '"not a list"')
  const { port, child, url: keyUrl } = await startServer(sb)
  t.after(() => { child.kill(); sb.cleanup() })
  const words = dataWords(sb)
  const page = await browser.launch()
  t.after(() => page.close())
  await page.goto(keyUrl)
  await page.goto('http://127.0.0.1:' + port + '/?v=4#/campus')
  const en = await page.readable()
  assert.match(en, /newer dashboard/)
  assert.match(en, /projects\.json is not a list/)
  assert.ok(!ARABIC.test(en))

})

test('the first-start wizard: every one of its four steps is English, with no language choice', { skip: SKIP || false }, async (t) => {
  const sb = makeSandbox({ packs: true })
  const { port, child, url: keyUrl } = await startServer(sb)
  t.after(() => { child.kill(); sb.cleanup() })
  const page = await browser.launch()
  t.after(() => page.close())
  await page.goto(keyUrl)
  const words = dataWords(sb)
  // the packs' names and member ids are data; the typed company name too
  for (const p of (await getJson(port, '/api/packs')).packs) for (const m of p.members) for (const w of m.id.split('-').concat([m.id])) words.add(w)
  for (const w of ['lumen', 'atelier', 'print', 'studio', 'english', 'demo']) words.add(w) // and the command "arsenale demo"
  for (const c of (await getJson(port, '/api/connect')).cards) for (const w of String((c.command || '') + ' ' + (c.snippet || '') + ' ' + (c.file || '')).match(/[A-Za-z][A-Za-z0-9_]*/g) || []) words.add(w.toLowerCase())
  {
    await page.goto('http://127.0.0.1:' + port + '/')
    await page.waitFor("!!document.querySelector('.wz input[name=name]')")
    assert.equal(await page.eval("document.querySelectorAll('[data-lang]').length"), 0, 'no language buttons in the wizard')
    const texts = [await page.readable()]
    await page.eval("const f = document.querySelector('.wz form'); f.elements.name.value = 'Lumen Atelier'; f.elements.mission.value = 'A print studio'; f.requestSubmit(); 1")
    for (const sel of ['.wz input[name=pack]', '.wz .step', '.wz pre']) {
      await page.waitFor('!!document.querySelector(' + JSON.stringify(sel) + ')')
      texts.push(await page.readable())
      if (sel !== '.wz pre') await page.eval("document.querySelector('.wz form').requestSubmit(); 1")
    }
    for (const text of texts) assert.ok(!ARABIC.test(text), 'the wizard shows Arabic script')
    assert.equal(fs.existsSync(sb.company), false, 'reading the steps writes nothing')
  }
})

test('English only: no EN/FA switch, and ?lang=fa or an old dash-lang=fa cookie still gives English', { skip: SKIP || false }, async (t) => {
  const w = await world()
  for (const url of ['/?lang=fa#/campus', '/archive?lang=fa']) {
    await w.page.goto('http://127.0.0.1:' + w.port + url)
    const got = await w.page.eval("({ lang: document.documentElement.lang, dir: document.documentElement.dir, sw: document.querySelectorAll('.langsw, [data-lang]').length, LANG: typeof LANG === 'string' ? LANG : '' })")
    got.fa = stripData(await w.page.readable()).split('\n').some((l) => ARABIC.test(l))
    assert.equal(got.lang, 'en', url)
    assert.equal(got.dir, 'ltr', url)
    assert.equal(got.sw, 0, 'no language switch on ' + url)
    if (!url.startsWith('/archive')) assert.equal(got.LANG, 'en')
    assert.equal(got.fa, false, 'no Arabic-script interface on ' + url)
  }
  // a cookie an older dashboard set is ignored: the server answers in English and sets no cookie
  const res = await new Promise((resolve, reject) => {
    http.get({ host: '127.0.0.1', port: w.port, path: '/?lang=fa', agent: false, headers: { Cookie: 'dash-lang=fa; ' + (cookies[w.port] || '') } }, (r) => { let b = ''; r.on('data', (c) => { b += c }); r.on('end', () => resolve({ headers: r.headers, body: b })) }).on('error', reject)
  })
  assert.match(res.body, /<html lang="en" dir="ltr">/)
  assert.ok(!res.headers['set-cookie'] || !String(res.headers['set-cookie']).includes('dash-lang'), 'no language cookie is set')
})
