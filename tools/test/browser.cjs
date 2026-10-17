/* A headless Chrome or Edge driven over the DevTools protocol, with no
 * packages: Node's own WebSocket and the browser already on the machine.
 *
 * The dashboard pages draw themselves with script, so the only honest way to
 * see what a person sees is to run that script. Tests that use this skip
 * (they do not fail) on a machine with no Chromium-based browser, or a Node
 * without a global WebSocket (before v22).
 */
const fs = require('fs')
const os = require('os')
const path = require('path')
const { spawn } = require('child_process')

const CANDIDATES = [
  process.env.CHROME_BIN,
  'C:\\Program Files\\Google\\Chrome\\Application\\chrome.exe',
  'C:\\Program Files (x86)\\Google\\Chrome\\Application\\chrome.exe',
  'C:\\Program Files (x86)\\Microsoft\\Edge\\Application\\msedge.exe',
  'C:\\Program Files\\Microsoft\\Edge\\Application\\msedge.exe',
  '/usr/bin/google-chrome', '/usr/bin/chromium', '/usr/bin/chromium-browser', '/usr/bin/microsoft-edge',
  '/Applications/Google Chrome.app/Contents/MacOS/Google Chrome',
  '/Applications/Microsoft Edge.app/Contents/MacOS/Microsoft Edge',
]

const findBrowser = () => CANDIDATES.find((p) => p && fs.existsSync(p)) || null

/** Why browser tests cannot run here, or '' when they can. */
function unavailable() {
  if (typeof WebSocket !== 'function') return 'this Node has no global WebSocket'
  if (!findBrowser()) return 'no Chrome or Edge found (set CHROME_BIN)'
  return ''
}

const sleep = (ms) => new Promise((r) => setTimeout(r, ms))

/* One Chrome per test file, not per test, and its tabs are reused: starting
 * Chrome costs 5 to 13 seconds and a new tab's renderer another 4 to 7 on a
 * machine with a virus scanner, while a file often opens a dozen pages one
 * after another. A closed page goes back to a pool (what a test sets,
 * such as emulation or injected scripts, belongs to its DevTools session and
 * goes with it; every test has its own server port, and the dashboard's key
 * cookie and storage are named or keyed by port, so nothing is shared). The browser holds no open
 * handle between pages (its DevTools socket is opened per call), so a file can
 * finish; it is killed when the process exits. */
let shared = null
function killShared() {
  if (!shared) return
  const { child, profile } = shared
  shared = null
  try { child.kill() } catch { /* gone */ }
  try { fs.rmSync(profile, { recursive: true, force: true }) } catch { /* Windows may still hold it; the temp folder is cleaned later */ }
}
process.on('exit', killShared)

async function sharedBrowser() {
  if (shared) return shared.ready
  const me = { idle: [] }
  me.ready = (async () => {
    // a Chrome that does not open its port in time under load is started once
    // more before the test fails (spec autonomous-mode 16, rule 3)
    for (let attempt = 1; ; attempt++) {
      const port = await startBrowser(me)
      if (port) return port
      try { me.child.kill() } catch { /* gone */ }
      try { fs.rmSync(me.profile, { recursive: true, force: true }) } catch { /* Windows may still hold it */ }
      if (attempt >= 2) { if (shared === me) shared = null; throw new Error('the browser did not open a DevTools port') }
    }
  })()
  shared = me
  return me.ready
}
async function startBrowser(me) {
  me.profile = fs.mkdtempSync(path.join(os.tmpdir(), 'agent-company-browser-'))
  me.child = spawn(findBrowser(), [
    '--headless=new', '--disable-gpu', '--no-first-run', '--no-default-browser-check',
    '--remote-debugging-port=0', '--user-data-dir=' + me.profile, '--window-size=1600,950', 'about:blank',
  ], { stdio: 'ignore' })
  me.child.unref()
  const portFile = path.join(me.profile, 'DevToolsActivePort')
  for (let i = 0; i < 300; i++) {
    try { const port = Number(fs.readFileSync(portFile, 'utf8').split('\n')[0]) || 0; if (port) return port } catch { /* not written yet */ }
    await sleep(100)
  }
  return 0
}

/** One protocol call on the browser itself, over a socket that is closed again. */
async function browserCall(port, method, params) {
  const info = await (await fetch('http://127.0.0.1:' + port + '/json/version')).json()
  const ws = new WebSocket(info.webSocketDebuggerUrl)
  await new Promise((res, rej) => { ws.onopen = res; ws.onerror = () => rej(new Error('DevTools socket failed')) })
  try {
    return await new Promise((res, rej) => {
      ws.onmessage = (m) => { const msg = JSON.parse(m.data); if (msg.id === 1) msg.error ? rej(new Error(msg.error.message)) : res(msg.result) }
      ws.send(JSON.stringify({ id: 1, method, params: params || {} }))
    })
  } finally { ws.close() }
}

async function launch() {
  const port = await sharedBrowser()
  const targetId = shared.idle.pop() || (await browserCall(port, 'Target.createTarget', { url: 'about:blank' })).targetId
  const list = await (await fetch('http://127.0.0.1:' + port + '/json/list')).json()
  const target = list.find((t) => t.id === targetId)
  const ws = new WebSocket(target.webSocketDebuggerUrl)
  await new Promise((res, rej) => { ws.onopen = res; ws.onerror = () => rej(new Error('DevTools socket failed')) })
  let id = 0
  const waiting = new Map()
  const listeners = []
  ws.onmessage = (m) => {
    const msg = JSON.parse(m.data)
    if (msg.id && waiting.has(msg.id)) { const w = waiting.get(msg.id); waiting.delete(msg.id); msg.error ? w.rej(new Error(msg.error.message)) : w.res(msg.result) } else for (const l of listeners) l(msg)
  }
  const send = (method, params) => new Promise((res, rej) => { const n = ++id; waiting.set(n, { res, rej }); ws.send(JSON.stringify({ id: n, method, params: params || {} })) })
  await send('Page.enable')
  await send('Runtime.enable')

  const api = {
    /** Open an address and wait for the load event and half a second of drawing. */
    async goto(url) {
      // tabs share one browser: a tab in the background draws no animation frames
      try { await browserCall(port, 'Target.activateTarget', { targetId }) } catch { /* the browser is already gone */ }
      const loaded = new Promise((res) => { const l = (msg) => { if (msg.method === 'Page.loadEventFired') { listeners.splice(listeners.indexOf(l), 1); res() } }; listeners.push(l) })
      await send('Page.navigate', { url })
      await loaded
      await sleep(500)
    },
    /** Run an expression in the page; the value comes back as plain data. */
    async eval(expr) {
      const r = await send('Runtime.evaluate', { expression: expr, returnByValue: true, awaitPromise: true })
      if (r.exceptionDetails) throw new Error('page error: ' + (r.exceptionDetails.exception && r.exceptionDetails.exception.description || r.exceptionDetails.text))
      return r.result.value
    },
    /** The readable text once it stops changing: a slow machine finishes drawing later. */
    async readable() {
      let last = null
      for (let i = 0; i < 40; i++) {
        const now = await api.eval(READABLE)
        if (now === last) return now
        last = now
        await sleep(250)
      }
      return last
    },
    /** Wait until an expression is true in the page. */
    async waitFor(expr, ms) {
      const end = Date.now() + Math.max(ms || 0, 20000)
      while (Date.now() < end) { if (await api.eval('!!(' + expr + ')')) return; await sleep(100) }
      throw new Error('the page never became: ' + expr)
    },
    sleep,
    /** The page at this size, as a PNG file. */
    async screenshot(file, width, height) {
      await send('Emulation.setDeviceMetricsOverride', { width: width || 1440, height: height || 900, deviceScaleFactor: 1, mobile: false })
      await sleep(900)
      const r = await send('Page.captureScreenshot', { format: 'png' })
      fs.writeFileSync(file, Buffer.from(r.data, 'base64'))
    },
    /** Messages the page wrote to its console, and CSP or script errors. */
    async logEvents() {
      await send('Log.enable')
      const seen = []
      listeners.push((msg) => { if (msg.method === 'Log.entryAdded' || msg.method === 'Runtime.exceptionThrown' || msg.method === 'Runtime.consoleAPICalled') seen.push(msg) })
      return seen
    },
    /** Run a script in every page this tab opens from now on, before the page's own (to take WebGL away, say). */
    async onNewDocument(source) { await send('Page.addScriptToEvaluateOnNewDocument', { source }) },
    async close() {
      // off the page first: a 3D office left running would keep the CPU busy
      try { await send('Page.navigate', { url: 'about:blank' }) } catch { /* already gone */ }
      try { ws.close() } catch { /* already gone */ }
      if (shared) shared.idle.push(targetId)
    },
  }
  return api
}

/** What a person can read on the page: every text, plus the words in tooltips,
 *  aria-labels, placeholders and the tab title. Script, style and the archive's
 *  decorative terminal prompt are not text for a person. */
const READABLE = `(() => {
  const out = []
  const w = document.createTreeWalker(document.body, NodeFilter.SHOW_TEXT)
  while (w.nextNode()) {
    const n = w.currentNode, p = n.parentElement
    if (!p || /^(SCRIPT|STYLE)$/.test(p.tagName) || p.closest('.shell-prompt')) continue
    const t = n.nodeValue.trim()
    if (t) out.push(t)
  }
  document.querySelectorAll('[title],[aria-label],[placeholder],[alt]').forEach((e) => {
    for (const a of ['title', 'aria-label', 'placeholder', 'alt']) { const v = e.getAttribute(a); if (v) out.push(v) }
  })
  out.push(document.title)
  return out.join('\\n')
})()`

module.exports = { launch, unavailable, READABLE }
