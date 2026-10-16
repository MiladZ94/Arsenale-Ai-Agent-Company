  const QUIET_MIN = 10 // minutes without a step before a working agent counts as quiet
  const STATUS = {
    running: { label: T('Working'), g: '▶' },
    ok: { label: T('No issues'), g: '✓' },
    findings: { label: T('Has findings'), g: '!' },
    failed: { label: T('Failed'), g: '✕' },
    stopped: { label: T('Stopped'), g: '■' },
  }
  const stOf = (s) => (Object.prototype.hasOwnProperty.call(STATUS, s) ? s : 'ok')

  const $ = (id) => document.getElementById(id)
  const esc = (s) => String(s == null ? '' : s).replace(/[&<>"']/g, (c) => ({ '&': '&amp;', '<': '&lt;', '>': '&gt;', '"': '&quot;', "'": '&#39;' }[c]))
  const fa = (n) => String(n) // the page's numbers; English only, so the digits stay as they are
  // date locales: the same ones the pre-i18n English-only page used (en-CA for the short
  // y-m-d dates, en-GB for the header's long weekday/day/month/year date).
  const SHORT_LOCALE = 'en-CA'
  const HDR_LOCALE = 'en-GB'
  const ms = (iso) => { const t = new Date(iso).getTime(); return isNaN(t) ? NaN : t }
  const hhmm = (t) => { const d = new Date(t); return isNaN(d) ? '' : String(d.getHours()).padStart(2, '0') + ':' + String(d.getMinutes()).padStart(2, '0') }
  const span = (v) => {
    const s = Math.max(0, Math.floor(v / 1000)); const h = Math.floor(s / 3600); const m = Math.floor((s % 3600) / 60)
    return (h ? h + ':' + String(m).padStart(2, '0') : String(m)) + ':' + String(s % 60).padStart(2, '0')
  }
  const fnum = (s) => String(s)
  const k = (n) => (n >= 1e6 ? fnum((n / 1e6).toFixed(2)) + T('M') : n >= 1e4 ? fnum(Math.round(n / 1000)) + T('k') : n >= 1000 ? fnum((n / 1000).toFixed(1)) + T('k') : fnum(Math.round(n || 0)))
  const usd = (n) => '$' + fnum(n >= 100 ? n.toFixed(0) : n.toFixed(2))
  // a server message is shown as the server wrote it (English only)
  const errTxt = (m) => String(m == null ? '' : m)
  const minsFa = (v) => fa(Math.max(0, Math.round(v / 60000)))
  const cleanTask = (t) => String(t || '').replace(/\s*\(under\s+[^)]*\)\s*/gi, ' ').trim()
  // the heavy tier (AGENT-RULES rule 3): model names that start with one of the
  // prefixes in config.json "heavyModels" (default: Opus)
  const isHeavy = (m) => { const s = String(m || '').toLowerCase(); return (DATA.heavy || ['Opus']).some((p) => p && s.startsWith(String(p).toLowerCase())) }

  // Frontmatter colour -> shirt colour, muted so it never reads as a status.
  const ROLE = {
    blue: '#4F7FD9', green: '#4E9E6E', orange: '#D07F3A', red: '#B8504E', cyan: '#3E9AA6',
    purple: '#8468C2', pink: '#C2628F', yellow: '#C9A63A',
  }
  // Hair and skin per agent, so two agents in the same colour still differ.
  const LOOK = {
    'implementer': ['#2B1D14', '#E0B48C'], 'tester': ['#A8652E', '#F0C9A0'], 'release-builder': ['#111111', '#C68A5E'],
    'release-manager': ['#8C8C8C', '#E8BE96'], 'code-reviewer': ['#3A2A1E', '#D9A77C'], 'security-reviewer': ['#111111', '#9C6B48'],
    'data-migration': ['#D9B46A', '#F2CFAE'], 'architecture-reviewer': ['#6E6E6E', '#E3B58E'], 'performance': ['#4A2F1F', '#B97F57'],
    'domain-validator': ['#1E1E1E', '#DDB08A'], 'spec-writer': ['#7A3E22', '#EFC7A4'], 'ui-designer': ['#1B1B1B', '#D6A07A'],
    'ux-reviewer': ['#B5793E', '#F1CDA8'], 'visual-qa': ['#2E2018', '#C9936A'], 'user-guide': ['#5B3A26', '#E6BC93'],
    'dev-docs': ['#999999', '#DCAE86'], 'docs-explainer': ['#161616', '#E9C29C'], 'agent-builder': ['#6B4226', '#D2A07B'],
  }
  const HAIRS = ['#2B1D14', '#111111', '#6E6E6E', '#A8652E', '#5B3A26', '#D9B46A']
  const SKINS = ['#E0B48C', '#C68A5E', '#F0C9A0', '#9C6B48', '#DDB08A', '#B97F57']
  const hash = (s) => { let h = 7; for (const c of String(s)) h = (h * 31 + c.charCodeAt(0)) >>> 0; return h }

  // Departments and their desks, in floor grid units. Who sits where comes
  // from homeDesks() over the agents that exist; an agent with no desk there
  // takes a guest desk while it works.
  const DEPTS = {
    build: { label: T('Build & release'), slots: [[1, 2], [4.5, 2], [1, 5], [4.5, 5]] },
    review: { label: T('Review'), slots: [[8, 2], [10.5, 2], [13, 2], [8, 5], [10.5, 5], [13, 5]] },
    docs: { label: T('Docs'), slots: [[16, 2], [19, 2], [16, 5], [19, 5]] },
    design: { label: T('Design & spec'), slots: [[1, 9], [4.5, 9], [1, 12], [4.5, 12]] },
  }
  let HOME = homeDesks(DATA.agents, DATA.desks).seats
  // Guest desks for built-in or unknown agents (Explore, general-purpose, …),
  // only drawn while someone sits at one.
  const GUEST = [[12.6, 8.3], [12.7, 12.3]]
  const LOUNGE = [
    { kind: 'sofa', at: [16.7, 8.75], z: 10 }, { kind: 'sofa', at: [17.8, 8.75], z: 10 }, { kind: 'sofa', at: [18.9, 8.75], z: 10 },
    { kind: 'stand', at: [20.9, 9.2], z: 0 }, { kind: 'sofa', at: [20.65, 10.95], z: 9 },
    { kind: 'stand', at: [17.4, 12.2], z: 0 }, { kind: 'stand', at: [19.0, 12.6], z: 0 },
    { kind: 'stand', at: [16.3, 11.1], z: 0 }, { kind: 'stand', at: [20.6, 12.9], z: 0 },
  ]

  // ---------- pixel people
  const STAND = ['..hhhh..', '.hhhhhh.', '.hssssh.', '.sesses.', '..ssss..', '.cccccc.', 'cccccccc', 'cdccccdc',
    's.cccc.s', '..pppp..', '..pppp..', '..p..p..', '..p..p..', '.kk..kk.']
  const SEAT = STAND.slice(0, 8)
  const HANDS = 's.cccc.s'
  const SOFA = STAND.slice(0, 9).concat(['.pppppp.', '.pp..pp.'])
  function shade(hex, k) {
    const n = parseInt(hex.slice(1), 16)
    const f = (v) => Math.max(0, Math.min(255, Math.round(v * k)))
    return '#' + ((1 << 24) | (f(n >> 16) << 16) | (f((n >> 8) & 255) << 8) | f(n & 255)).toString(16).slice(1)
  }
  let AGENT = new Map()
  const CR = controlRoom({ esc, fa, hhmm, ms, span, cleanTask, isHeavy, agents: () => AGENT, T, k, usd, errTxt })
  function palette(agent, dim) {
    let hair, skin, shirt
    if (agent === 'supervisor') { hair = '#3A3A3A'; skin = '#D9A77C'; shirt = '#56606C' } else if (agent === 'board') { hair = '#C8A24A'; skin = '#F0C8A0'; shirt = '#C9A63A' } else {
      const look = (Object.prototype.hasOwnProperty.call(LOOK, agent) && LOOK[agent]) || [HAIRS[hash(agent) % HAIRS.length], SKINS[hash(agent + '.') % SKINS.length]]
      hair = look[0]; skin = look[1]
      const def = AGENT.get(agent)
      shirt = (def && Object.prototype.hasOwnProperty.call(ROLE, def.color) && ROLE[def.color]) || '#6F7B88'
    }
    const p = { h: hair, s: skin, e: '#1A1A1A', c: shirt, d: shade(shirt, 0.72), p: '#2F3A48', k: '#1B222B' }
    if (dim) for (const k of Object.keys(p)) p[k] = shade(p[k], 0.78)
    return p
  }
  function grid(rows, pal, px, x, y, extra) {
    let out = ''
    rows.forEach((row, r) => {
      for (let c = 0; c < row.length; c++) {
        const ch = row[c]
        if (ch !== '.') out += '<rect x="' + (x + c * px) + '" y="' + (y + r * px) + '" width="' + px + '" height="' + px + '" fill="' + pal[ch] + '"/>'
      }
    })
    return '<g ' + (extra || '') + '>' + out + '</g>'
  }
  // anchor (x, y) = bottom centre of the sprite
  function sprite(kind, agent, x, y, px, opts) {
    opts = opts || {}
    const pal = palette(agent, opts.dim)
    const left = x - (8 * px) / 2
    if (kind === 'seat') {
      const top = y - 9 * px
      if (!opts.typing) return grid(SEAT, pal, px, left, top) + grid([HANDS], pal, px, left, top + 8 * px)
      // the two hands tap in turn, so typing reads at a glance
      return grid(SEAT, pal, px, left, top) + grid(['..cccc..'], pal, px, left, top + 8 * px) +
        grid(['s.......'], pal, px, left, top + 8 * px, 'class="hl"') + grid(['.......s'], pal, px, left, top + 8 * px, 'class="hr"')
    }
    if (kind === 'sofa') return grid(SOFA, pal, px, left, y - SOFA.length * px)
    const top = y - STAND.length * px
    let s = grid(STAND, pal, px, left, top)
    if (opts.paper) s += '<rect x="' + (left + 2 * px) + '" y="' + (top + 7 * px) + '" width="' + 4 * px + '" height="' + 3 * px + '" fill="#F4F1EA" stroke="#B9B2A3" stroke-width="0.6"/>'
    return s
  }
  // A walking figure, drawn in its own little svg that CSS moves along a path
  // (offset-path) in office coordinates; its two leg frames swap in turn.
  const LEGS_A = ['..p..p..', '.p....p.', 'kk....kk']
  const LEGS_B = ['..p..p..', '..p..p..', '.kk..kk.']
  function walker(agent, path, dur, el, paper) {
    const pal = palette(agent)
    let s = grid(STAND.slice(0, 11), pal, 3, 0, 0) + grid(LEGS_A, pal, 3, 0, 33, 'class="lf1"') + grid(LEGS_B, pal, 3, 0, 33, 'class="lf2"')
    if (paper) s += '<rect x="6" y="21" width="12" height="9" fill="#F4F1EA" stroke="#B9B2A3" stroke-width="0.6"/>'
    return '<svg class="walker" width="24" height="42" viewBox="0 0 24 42" shape-rendering="crispEdges" aria-hidden="true"' +
      ' style="offset-path:path(\'' + path + '\');animation-duration:' + dur.toFixed(2) + 's;animation-delay:' + (-el).toFixed(2) + 's"><g class="wb">' + s + '</g></svg>'
  }
  function portrait(agent, px, dim) {
    const pal = palette(agent, dim)
    const rows = STAND.slice(0, 9)
    const w = 10 * px, h = rows.length * px + px
    return '<svg class="portrait" width="' + w + '" height="' + h + '" viewBox="0 0 ' + w + ' ' + h + '" shape-rendering="crispEdges" aria-hidden="true">' + grid(rows, pal, px, px, px) + '</svg>'
  }

  // ---------- isometric geometry
  const H = 26, Q = 13, X0 = 426, Y0 = 150
  const P = (gx, gy, z) => [X0 + (gx - gy) * H, Y0 + (gx + gy) * Q - (z || 0)]
  const pts = (arr) => arr.map((p) => p.map((v) => v.toFixed(1)).join(',')).join(' ')
  const poly = (arr, fill, extra) => '<polygon points="' + pts(arr) + '" fill="' + fill + '" ' + (extra || '') + '/>'
  function box(gx, gy, w, d, h, z, top, left, right) {
    return '<g>' +
      poly([P(gx, gy + d, z), P(gx + w, gy + d, z), P(gx + w, gy + d, z + h), P(gx, gy + d, z + h)], left) +
      poly([P(gx + w, gy, z), P(gx + w, gy + d, z), P(gx + w, gy + d, z + h), P(gx + w, gy, z + h)], right) +
      poly([P(gx, gy, z + h), P(gx + w, gy, z + h), P(gx + w, gy + d, z + h), P(gx, gy + d, z + h)], top) + '</g>'
  }

  // ---------- walking routes, in floor grid units
  // Everyone walks along the corridor south of the partitions (y 7.7). The
  // top departments are entered through the gaps between partitions, and a
  // desk is reached down the free column just west of it, so a route never
  // cuts straight through a partition.
  const LOUNGE_DOOR = [17.6, 11.6]
  const HANDIN_AT = [9.4, 12.3]
  function toDesk(gx, gy) {
    const col = gx - 0.35
    const gate = gy < 7 ? (gx < 7.3 ? 6.8 : gx < 14.9 ? 14.3 : 15.5) : null
    const out = gate === null ? [[col, 7.7]] : [[gate, 7.7], [gate, 6.6], [col, 6.6]]
    return out.concat([[col, gy - 0.4], [gx + 0.4, gy - 0.4]])
  }
  function routePath(list) {
    const p = list.map(([gx, gy]) => P(gx, gy))
    let len = 0
    for (let i = 1; i < p.length; i++) len += Math.hypot(p[i][0] - p[i - 1][0], p[i][1] - p[i - 1][1])
    // about a desk width a second: slow enough to follow, short enough not to bore
    return { d: 'M' + p.map((q) => q[0].toFixed(1) + ',' + q[1].toFixed(1)).join(' L'), dur: Math.min(5.5, Math.max(2, len / 120)) }
  }
  const arrivalRoute = (from, desk) => routePath([from || LOUNGE_DOOR, [15.2, 7.9]].concat(toDesk(desk[0], desk[1])))
  const handInRoute = (desk) => routePath(toDesk(desk[0], desk[1]).reverse().concat([[8.6, 7.7], [8.6, 11.8], HANDIN_AT]))

  // ---------- state
  let sel = null          // { key } of the selected run, or { agent }
  let mode = 'office'     // campus | office | org | dec | use
  let officeId = ''       // the office on the floor, when a company is set up
  let railOpen = false    // the folded rail, opened over the page
  let drawerOpen = false
  let filter = ''
  let view = { z: 1, x: 0, y: 0 } // zoom on top of the fit, and pan in screen px
  let view3 = {}                  // the 3D camera, per office
  try {
    const saved = JSON.parse(sessionStorage.getItem('agent-office') || '{}')
    sel = saved.sel || null; drawerOpen = !!saved.drawer; filter = saved.filter || ''
    if (['office', 'dec', 'use', 'campus', 'org', 'act', 'vr', 'tasks', 'appr', 'team', 'dlv', 'set'].includes(saved.mode)) mode = saved.mode
    if (typeof saved.office === 'string') officeId = saved.office
    const v = saved.view
    if (v && [v.z, v.x, v.y].every((n) => typeof n === 'number' && isFinite(n))) view = { z: v.z, x: v.x, y: v.y }
    if (saved.view3 && typeof saved.view3 === 'object') view3 = saved.view3
  } catch { /* a private window simply forgets */ }
  const remember = () => {
    try { sessionStorage.setItem('agent-office', JSON.stringify({ sel, drawer: drawerOpen, filter, view, view3, mode, office: officeId })) } catch { /* ignore */ }
    syncHash()
  }

  // ---------- the company: campus, offices, org chart (agent-company-page.cjs)
  // Every screen has an address (#/campus, #/office/<id>, #/org), so a
  // bookmark or a link opens it; the server needs no new page for that.
  const CO = COMPANY && COMPANY.configured ? companyViews({
    esc, fa, hhmm, ms, T, isHeavy, k, usd, errTxt,
    portrait: (a, px, dim) => portrait(a, px, dim), sprite: (k, a, x, y, px, o) => sprite(k, a, x, y, px, o),
    post: (u, b) => CR.post(u, b), redraw: () => renderAll(), go: (to) => navigate(to), refresh: () => fetchCompany(true),
  }) : null
  const HASH = { campus: 'campus', org: 'org', decisions: 'dec', usage: 'use', office: 'office', activity: 'act', versionrun: 'vr', tasks: 'tasks', approvals: 'appr', team: 'team', deliverables: 'dlv', settings: 'set' }
  const AV = activityView({ esc, fa, hhmm, ms, T, cleanTask, redraw: () => renderAll() })
  const VV = versionRunView({ esc, T, ms, live: () => LIVE, shown: () => mode === 'vr', answerBox: (g) => CR.answerBox(g), redraw: () => renderAll() })
  // the 1.0 screens (everyone-page.cjs): tasks, approvals, team, deliverables, settings, the wizard
  const EV = everyoneViews({ esc, fa, T, errTxt, k, post: (u, b) => CR.post(u, b), redraw: () => redrawLater(), refresh: () => fetchCompany(true) })
  function fromHash() {
    const m = /^#\/(campus|org|decisions|usage|office|activity|versionrun|tasks|approvals|team|deliverables|settings)(?:\/([\w-]+))?/.exec(location.hash || '')
    if (!m) return false
    mode = HASH[m[1]]
    if (m[2]) officeId = m[2]
    return true
  }
  function syncHash() {
    const h = mode === 'office' ? (CO ? '#/office/' + officeId : '#/office') : '#/' + Object.keys(HASH).find((k) => HASH[k] === mode)
    if (location.hash !== h) try { history.replaceState(null, '', h) } catch { /* a file: page may refuse; the view still changes */ }
  }
  function fixOffice() {
    if (!CO) { if (mode === 'org') mode = 'office'; return }
    const list = CO.officeList()
    if (!list.some((o) => o.id === officeId)) officeId = (list.find((o) => o.leadEmployeeId === 'supervisor') || list[0] || { id: 'unassigned' }).id
  }
  function navigate(to) {
    if (to === 'campus' || to === 'org' || EV.MODES.includes(to)) mode = to
    else if (/^office:/.test(to)) { mode = 'office'; officeId = to.slice(7); sel = null }
    fixOffice()
    railOpen = false; omenuOpen = ''
    remember()
    renderAll()
  }
  let omenuOpen = ''        // '' | 'office' | 'legacy': which menu under the view tabs is open
  let hadSaved = false
  try { hadSaved = !!sessionStorage.getItem('agent-office') } catch { /* ignore */ }
  if (!fromHash() && CO && !hadSaved) mode = 'campus'
  fixOffice()
  window.addEventListener('hashchange', () => { if (fromHash()) { fixOffice(); renderAll() } })

  // Panel and drawer sizes outlive the session, so they go to localStorage.
  // dho is the open shift board's height; null means "all the way up".
  let companyTag = '', companyGone = false
  const LAYOUT_KEY = 'agent-office-layout'
  const LAYOUT_DEF = { iw: 380, dh: 132, dho: null }
  let lay = Object.assign({}, LAYOUT_DEF)
  try {
    const l = JSON.parse(localStorage.getItem(LAYOUT_KEY) || '{}')
    for (const k of ['iw', 'dh', 'dho']) if (typeof l[k] === 'number' && isFinite(l[k])) lay[k] = l[k]
  } catch { /* storage blocked: the defaults will do */ }
  const saveLayout = () => { try { localStorage.setItem(LAYOUT_KEY, JSON.stringify(lay)) } catch { /* ignore */ } }

  // Motion. Everything below is keyed by the moment it began, and each
  // redraw hands CSS a negative animation-delay, so a walk that is cut by a
  // redraw carries on from where it was instead of starting over.
  const RM = window.matchMedia ? window.matchMedia('(prefers-reduced-motion: reduce)') : null
  const calm = () => !!(RM && RM.matches)
  let prev = null            // what the last drawing showed
  let S_FULL = null          // the last derived state of the whole company, for the office menu
  const arrive = new Map()   // agent -> { t0, from } walking from the lounge to the desk
  let handWalk = null        // { key, t0, desk } walking a report to the supervisor
  const newsAt = new Map()   // run key -> when its latest step arrived
  let bubK = 1               // how much labels are counter-scaled at this zoom

  function derive() {
    const now = Date.now()
    const d0 = new Date(); d0.setHours(0, 0, 0, 0)
    AGENT = new Map(DATA.agents.map((a) => [a.name, a]))
    const byId = new Map()
    const active = DATA.active.map((a) => {
      const steps = Array.isArray(a.steps) && a.steps.length ? a.steps : (a.doing ? [{ at: a.startedAt, text: a.doing }] : [])
      const lastAt = steps.length ? ms(steps[steps.length - 1].at) : ms(a.startedAt)
      const quiet = now - (isNaN(lastAt) ? now : lastAt)
      const r = Object.assign({}, a, { live: true, key: 'a:' + a.id, steps, start: ms(a.startedAt), end: now, lastAt, quiet, stale: quiet >= QUIET_MIN * 60000 })
      if (a.id) byId.set(a.id, r)
      return r
    })
    const all = DATA.runs.map((r) => {
      const end = ms(r.finishedAt)
      const start = ms(r.startedAt) || (r.durMs ? end - r.durMs : NaN)
      const x = Object.assign({}, r, { live: false, key: 'r:' + (r.id || r.finishedAt + '|' + r.agent + '|' + String(r.task || '').slice(0, 40)), start, end, steps: Array.isArray(r.steps) ? r.steps : null })
      if (r.id) byId.set(r.id, x)
      return x
    })
    const today = all.filter((r) => r.end >= d0.getTime()).sort((a, b) => a.end - b.end)
    const busy = new Map()
    for (const a of active) {
      const list = busy.get(a.agent) || []
      list.push(a); busy.set(a.agent, list)
    }
    for (const list of busy.values()) list.sort((a, b) => b.lastAt - a.lastAt)
    const lastRun = all.slice().sort((a, b) => b.end - a.end)[0] || null
    return { now, active, today, all, byId, busy, lastRun, dayStart: d0.getTime() }
  }

  function deskMap(S) {
    // the agents can change while the page is open (a definition added)
    HOME = homeDesks(DATA.agents, DATA.desks).seats
    if (CO) return CO.desks(S, officeId, { DEPTS, HOME, GUEST })
    const desks = new Map()
    for (const [name, [dept, i]] of Object.entries(HOME)) desks.set(name, DEPTS[dept].slots[i])
    // Guest desks go to whoever is working without a desk, first come first seated.
    let g = 0
    for (const a of S.active) {
      if (desks.has(a.agent)) continue
      if (g < GUEST.length) desks.set(a.agent, GUEST[g++])
    }
    return desks
  }

  function selected(S) {
    if (sel && sel.key) {
      const hit = S.active.find((a) => a.key === sel.key) || S.all.find((r) => r.key === sel.key)
      if (hit) return hit
      // the selected run finished: follow it to its record
      const id = sel.key.slice(2)
      const done = S.all.find((r) => r.id && r.id === id)
      if (done) { sel = { key: done.key }; return done }
    }
    if (sel && sel.agent) {
      const list = S.busy.get(sel.agent)
      if (list) return list[0]
      const last = S.today.filter((r) => r.agent === sel.agent).pop()
      if (last) return last
    }
    // nothing chosen: the busiest thing on the floor
    const recent = S.active.slice().sort((a, b) => b.lastAt - a.lastAt)[0]
    return recent || S.today[S.today.length - 1] || null
  }

  const parentOf = (S, r) => (r.parentId ? S.byId.get(r.parentId) || { agent: '', id: r.parentId, missing: true } : null)
  const childrenOf = (S, r) => (r.id ? S.active.concat(S.today).filter((x) => x.parentId === r.id) : [])

