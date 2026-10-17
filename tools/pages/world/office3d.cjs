/* ======================================================================
 * The office floor (design C2): one open floor, no rooms and no walls, a clean
 * grid of desks (one per run, each on a light tile of its own), a free area
 * where every idle agent sits, and a side list. Drawn in three.js with
 * the shared kit (kit.cjs); returns null without three.js or WebGL, and the
 * page keeps its flat office.
 *
 * Rules the layout keeps (spec 5.15 rules 65 to 67, 16.2 rules 12 to 14):
 *  - one avatar style: the manifest's mini-character (seated at a desk, a round
 *    badge with the person's initials in the zone colour above the head), or,
 *    with no model file, a round head on a coloured body with the initials on
 *    it; a person is drawn once: the figure, never a card as well;
 *  - the figure carries a number badge only, shaped by state (circle working,
 *    triangle quiet, diamond waiting, square failed, ring done); the name,
 *    the step and the state are in the side list, same number;
 *  - N runs of one agent are N figures, each at its own desk, with a shared
 *    "Title x N" chip; a run keeps its desk for its whole life;
 *  - idle people are not working figures: they sit together in the free area,
 *    with an "N idle" label, and are listed in the list;
 *  - above each desk stands ONE short name (<= 14 characters, never cut with
 *    an ellipsis), clear of the head, the badges and other labels; the step
 *    and the full name are in the side list and in a tip on hover or focus of
 *    the figure or its label.
 *
 * Desks, chairs, the free area's sofa and plants come from the manifest's furniture
 * models when they loaded, else from shapes (kit.cjs).
 *
 * h: { esc, fa, onLost() }. model: { key, view, selected (run key),
 *   figures: [{ id, key, agent, label, tag, initials, zone, state, step,
 *     runN, runCount, group }], idle: [{ agent, name, note }], reports,
 *   title }.
 * Never run in Node: the source is written into the page; plain English.
 * ====================================================================== */
function office3d(h) {
  const K = typeof worldKit === 'function' ? worldKit() : null
  if (!K || !window.THREE) return null
  const eng = K.engine({ onLost: () => { if (h.onLost) h.onLost() } })
  if (!eng) return null
  const T3 = window.THREE
  const { esc, fa } = h
  const PAL = WORLD_PALETTE
  // the desk pitch is chosen so that two figures diagonal to each other (one column and one row apart) never stand above one another on the screen:
  // on the 45 degree camera that needs |CELL_X - CELL_Z| of about 1.1 or more
  const CELL_X = 2.4, CELL_Z = 3.6, FREE_W = 3.4, FREE_GAP = 1.0, MAX_SEATED = 5
  const role = (z) => PAL.ROLE[z] || PAL.ROLE.guest
  // the suit a person wears: a stable hash of the agent id (palette.cjs), so the same agent looks the same here, on the campus and on every portrait
  const suit = (id) => (typeof outfitIndex === 'function' ? outfitIndex(id) : 0)
  const tint = (z) => PAL.TINT[z] || PAL.TINT.guest
  const stateOf = (s) => PAL.STATE[s] || PAL.STATE.quiet

  const root = document.createElement('div')
  root.className = 'o3root'
  const side = document.createElement('aside')
  side.className = 'o3side'
  side.setAttribute('aria-label', 'Agents')
  root.append(eng.host, side)
  const ov = eng.ov

  let key = null, model = null
  let userView = false
  let layoutSig = ''
  let shell = null
  const figs = new Map()    // id -> { g (avatar), el (.o3a), tag (.o3t) }
  const slots = new Map()   // id -> { zone, i }, kept for the life of the figure
  let cap = 0               // desks the floor has had
  let lockCols = 0          // desk columns, kept so a desk stays where it is while the floor grows rows
  let deskZones = []        // the zone of the run at each desk, for its tile
  let freeBox = null        // screen box of the free area's furniture and people, for the labels
  let freeGroup = null
  let rooms = []            // [{ zone ('desks' | 'free'), x, z, w, d, cols, rows }]
  let idleOpen = false
  let last = { ppu: 0 }
  // models load after the first draw: when one arrives the floor and the figures are drawn again
  const useModel = () => !!K.models['character:office']
  K.loadModels(() => { if (!model) return; layoutSig = ''; sync(model) }, ['furniture', 'character'])
  const mix = (hex, to, t) => { const a = parseInt(hex.slice(1), 16), b = parseInt(to.slice(1), 16); const c = (sh) => Math.round(((a >> sh) & 255) * (1 - t) + ((b >> sh) & 255) * t); return '#' + ((1 << 24) | (c(16) << 16) | (c(8) << 8) | c(0)).toString(16).slice(1) }

  // ---------- layout: one grid of desks and the free area beside it
  function plan() {
    const figures = model.figures
    // a desk is freed when its figure leaves, before a new figure takes the lowest free desk
    const ids = new Set(figures.map((f) => f.id))
    for (const id of [...slots.keys()]) if (!ids.has(id)) slots.delete(id)
    for (const f of figures) {
      if (slots.has(f.id)) continue
      const used = new Set([...slots.values()].map((s) => s.i))
      let i = 0
      while (used.has(i)) i++
      slots.set(f.id, { zone: f.zone, i })
    }
    for (const s of slots.values()) cap = Math.max(cap, s.i + 1)
    deskZones = []
    for (const s of slots.values()) deskZones[s.i] = s.zone
    const cols = cap ? Math.max(lockCols, cap <= 3 ? cap : Math.ceil(Math.sqrt(cap * 1.6))) : 0
    lockCols = cols
    const rows = cols ? Math.ceil(cap / cols) : 0
    const deskW = cols * CELL_X, deskD = rows * CELL_Z
    const freeD = Math.max(deskD, 3.4)
    const maxX = deskW + (cols ? FREE_GAP : 0) + FREE_W, totalD = freeD
    const list = []
    if (cols) list.push({ zone: 'desks', cols, rows, x: -maxX / 2, z: -totalD / 2, w: deskW, d: deskD })
    list.push({ zone: 'free', cols: 0, rows: 0, x: -maxX / 2 + deskW + (cols ? FREE_GAP : 0), z: -totalD / 2, w: FREE_W, d: freeD })
    rooms = list
    return { maxX, totalD }
  }

  const deskPos = (i) => {
    const r = rooms.find((q) => q.zone === 'desks')
    return { x: r.x + (i % r.cols + 0.5) * CELL_X, z: r.z + (Math.floor(i / r.cols) + 0.5) * CELL_Z }
  }

  /** One desk with its screen, standing on y = 0 and facing +z (the person sits at its -z side once it is turned round), from the models or from shapes; with its extents for the label boxes. */
  function makeDesk() {
    const dk = K.furniture('desk')
    if (!dk) return { g: K.desk(), hw: 0.5, hd: 0.25, h: 0.6 }
    const g = new T3.Group()
    g.add(dk)
    const top = new T3.Box3().setFromObject(dk).max.y
    const sc = K.furniture('screen')
    if (sc) { sc.position.set(0, top, -0.08); g.add(sc) }
    const b = new T3.Box3().setFromObject(g)
    return { g, hw: Math.max(-b.min.x, b.max.x), hd: Math.max(-b.min.z, b.max.z), h: b.max.y }
  }
  let deskExt = { hw: 0.5, hd: 0.25, h: 0.6 }
  const SOFA_LIFT = 0.12 // a person seated on the sofa sits higher than on a chair

  function buildShell(dims) {
    if (shell) { eng.scene.remove(shell); shell.traverse((o) => { if (o.geometry) o.geometry.dispose() }) }
    const g = new T3.Group()
    const W = dims.maxX + 1.4, D = dims.totalD + 1.4
    // one flat open floor, the same checkerboard as the campus: no slab, no walls, no rooms
    K.checker(g, W, D, 0.5, '#F7F8FA', '#E8EBEF', 0, 0, 0)
    const Y = 0.022 // furniture stands on the tiles
    const desks = rooms.find((r) => r.zone === 'desks')
    if (desks) for (let i = 0; i < cap; i++) {
      const p = deskPos(i)
      // the personal space: a light tile in the run's role colour under the desk and the chair
      K.box(g, CELL_X - 0.3, 0.02, CELL_Z - 0.6, mix(role(deskZones[i] || 'guest'), '#FFFFFF', 0.86), p.x, 0.002, p.z + 0.1)
      const d = makeDesk()
      deskExt = d
      d.g.rotation.y = Math.PI
      d.g.position.set(p.x, Y, p.z + 0.12)
      g.add(d.g)
      const chair = K.furniture('chair')
      if (chair) { chair.position.set(p.x, Y, p.z - 0.52); g.add(chair) }
    }
    // the free area: one open tile with a sofa and chairs, where every idle agent sits
    const fr = rooms.find((r) => r.zone === 'free')
    freeGroup = new T3.Group()
    const fcx = fr.x + fr.w / 2, fz = fr.z
    K.box(g, fr.w - 0.3, 0.02, fr.d - 0.3, '#DCE6F0', fcx, 0.002, fr.z + fr.d / 2)
    let sofa = K.furniture('sofa')
    if (!sofa) {
      sofa = new T3.Group()
      K.box(sofa, 1.9, 0.3, 0.6, '#C8B79A', 0, 0, 0)
      K.box(sofa, 1.9, 0.4, 0.16, '#B7A583', 0, 0.3, -0.24)
    }
    sofa.position.set(fcx, Y, fz + 0.8)
    freeGroup.add(sofa)
    const seats = [[fcx - 0.38, fz + 0.8, 0, 'sofa'], [fcx + 0.38, fz + 0.8, 0, 'sofa'], [fcx - 1.0, fz + 2.5, Math.PI, 'chair'], [fcx, fz + 2.5, Math.PI, 'chair'], [fcx + 1.0, fz + 2.5, Math.PI, 'chair']]
    const idleN = Math.min(MAX_SEATED, model.idle.length)
    seats.forEach(([x, z, ry, kind], k) => {
      if (kind === 'chair') { const c = K.furniture('chair'); if (c) { c.position.set(x, Y, z); c.rotation.y = ry; freeGroup.add(c) } }
      if (k >= idleN) return
      const who = model.idle[k]
      const person = useModel() ? K.character('office', 'sit', suit(who && who.agent)) : K.avatar('#9AA5B1')
      if (!person) return
      person.position.set(x, Y + (kind === 'sofa' ? SOFA_LIFT : 0), z + (kind === 'sofa' ? 0.05 : 0))
      person.rotation.y = ry
      freeGroup.add(person)
    })
    const plant = K.furniture('plant')
    if (plant) { plant.position.set(fr.x + fr.w - 0.5, Y, fr.z + fr.d - 0.5); freeGroup.add(plant) }
    g.add(freeGroup)
    shell = g
    eng.scene.add(g)
    g.updateMatrixWorld(true)
    const fb = new T3.Box3().setFromObject(freeGroup)
    freeBox = { min: fb.min.clone(), max: fb.max.clone() }
    eng.bounds = { minx: -W / 2, maxx: W / 2, minz: -D / 2, maxz: D / 2, h: 1.9 }
    return g
  }

  // ---------- the figures
  function avatarFor(f) {
    let o = figs.get(f.id)
    const color = role(f.zone)
    const model = useModel()
    if (o && o.model !== model) { eng.scene.remove(o.g); o.g = null } // a model arrived since: the figure is drawn again
    if (!o || !o.g) {
      const g = new T3.Group()
      let top = K.AVATAR_H
      if (model) { const p = K.character('office', 'sit', suit(f.agent || f.id)); g.add(p); top = new T3.Box3().setFromObject(p).max.y } else g.add(K.avatar(color))
      const ring = new T3.Mesh(new T3.CylinderGeometry(0.41, 0.41, 0.02, 24), new T3.MeshBasicMaterial({ color: '#19795A' }))
      ring.position.y = 0.012
      g.add(ring)
      g.userData.id = f.id
      eng.scene.add(g)
      if (o) Object.assign(o, { g, ring, model, top })
      else {
        const el = document.createElement('div')
        el.className = 'o3a'
        el.dataset.id = f.id
        const tag = document.createElement('div')
        tag.className = 'o3t'
        ov.append(el, tag)
        for (const t of [el, tag]) {
          t.addEventListener('mouseenter', () => tip(f.id, t)); t.addEventListener('mouseleave', hideTip)
          if (t === el) { t.addEventListener('focus', () => tip(f.id, t)); t.addEventListener('blur', hideTip) }
        }
        tag.addEventListener('click', () => el.click())
        o = { g, ring, el, tag, color, model, top }
        figs.set(f.id, o)
      }
    }
    if (!o.model && o.color !== color) { o.color = color; o.g.children[0].children[0].material = K.mat(color) }
    o.ring.material.color.set(stateOf(f.state).fill)
    const sl = slots.get(f.id), d = deskPos(sl.i)
    o.g.position.set(d.x, 0.022, d.z - 0.52)
    return o
  }

  const shapeSvg = (shape, fill, n) => {
    const w = '<text x="10" y="14" text-anchor="middle" font-size="11" font-weight="700" fill="#fff">' + esc(String(n)) + '</text>'
    const sh = shape === 'diamond' ? '<path d="M10 0.5L19.5 10 10 19.5 0.5 10z" fill="' + fill + '"/>'
      : shape === 'square' ? '<rect x="1" y="1" width="18" height="18" rx="2" fill="' + fill + '"/>'
        : shape === 'triangle' ? '<path d="M10 1L19.5 18.5H0.5z" fill="' + fill + '"/>'
          : shape === 'ring' ? '<circle cx="10" cy="10" r="8.5" fill="' + fill + '"/><circle cx="10" cy="10" r="6.2" fill="none" stroke="#fff" stroke-width="1.4"/>'
            : '<circle cx="10" cy="10" r="9.5" fill="' + fill + '"/>'
    return '<svg viewBox="0 0 20 20" width="20" height="20" aria-hidden="true">' + sh + (shape === 'triangle' ? '<text x="10" y="16" text-anchor="middle" font-size="10" font-weight="700" fill="#fff">' + esc(String(n)) + '</text>' : w) + '</svg>'
  }

  // ---------- the side list
  function renderSide() {
    const fs = model.figures
    let s = '<h3>Agents <span>' + fa(fs.length) + '</span></h3>' + (model.reports ? '<button type="button" class="o3rep" data-open="1">' + fa(model.reports) + ' report' + (model.reports === 1 ? '' : 's') + ' handed in <span>›</span></button>' : '') + '<ol>'
    for (const f of fs) {
      const st = stateOf(f.state)
      s += '<li><button type="button" class="o3row' + (model.selected && model.selected === f.key ? ' sel' : '') + '" data-key="' + esc(f.key) + '" data-fig="' + esc(f.id) + '">' +
        '<i class="o3b" aria-hidden="true">' + shapeSvg(st.shape, st.fill, f.n) + '</i><span class="nm"><b dir="auto">' + esc(f.label) + '</b><small dir="auto">' + esc(f.step) + '</small></span><em class="st" style="color:' + st.fill + '">' + esc(st.word) + '</em></button></li>'
    }
    const idle = model.idle, away = model.away || []
    if (idle.length || away.length) {
      s += '<li class="idle"><button type="button" class="o3idle" data-o3="idle" aria-expanded="' + idleOpen + '"><span class="faces" aria-hidden="true">' + idle.concat(away).slice(0, 6).map(() => '<u></u>').join('') + '</span><b>' + fa(idle.length) + ' idle' + (away.length ? ' · ' + fa(away.length) + ' away' : '') + '</b><span class="more">' + (idleOpen ? '‹' : '›') + '</span></button>'
      if (idleOpen) s += '<ul>' + idle.concat(away).map((a) => '<li dir="auto">' + esc(a.name) + (a.note ? '<small>' + esc(a.note) + '</small>' : '') + '</li>').join('') + '</ul>'
      s += '</li>'
    }
    s += '</ol><div class="o3key" aria-label="State shapes">' + ['working', 'waiting', 'failed', 'quiet', 'done'].map((k) => '<span>' + shapeSvg(stateOf(k).shape, stateOf(k).fill, '') + stateOf(k).word + '</span>').join('') + '</div><p class="note">The number on a figure is its number in this list.</p>'
    side.innerHTML = s
  }

  // the full name and step of a run, shown on hover or focus of its figure or short name
  const tipEl = document.createElement('div')
  tipEl.className = 'o3tip'; tipEl.setAttribute('role', 'tooltip'); tipEl.style.visibility = 'hidden'
  ov.appendChild(tipEl)
  function tip(id, anchor) {
    const f = model && model.figures.find((x) => x.id === id)
    if (!f) return
    tipEl.innerHTML = '<b dir="auto">' + esc(f.label) + '</b>' + (f.step ? '<span dir="auto">' + esc(f.step) + '</span>' : '')
    tipEl.style.visibility = 'hidden'; tipEl.style.left = '0px'; tipEl.style.top = '0px'
    const r = anchor.getBoundingClientRect(), o = eng.host.getBoundingClientRect(), w = tipEl.offsetWidth, hh = tipEl.offsetHeight
    const x = Math.max(4, Math.min(eng.W - w - 4, r.left - o.left + r.width / 2 - w / 2))
    const y = r.top - o.top - hh - 6 < 4 ? r.bottom - o.top + 6 : r.top - o.top - hh - 6
    tipEl.style.left = x + 'px'; tipEl.style.top = y + 'px'; tipEl.style.visibility = ''
  }
  function hideTip() { tipEl.style.visibility = 'hidden' }

  // ---------- the short name above a desk: the display name when it fits 14 characters, else its words abbreviated, else the first words that fit; never cut mid-word with a dot
  // words that may be shortened, only when the whole name would not fit
  const ABBR = { manager: 'mgr', reviewer: 'rev', validator: 'valid', builder: 'build', engineer: 'eng', engineering: 'eng', specialist: 'spec', architecture: 'arch', architect: 'arch', developer: 'dev', assistant: 'asst', director: 'dir', coordinator: 'coord', administrator: 'admin', documentation: 'docs', migration: 'migr' }
  function shortName(title, run) {
    const suffix = run ? ' ' + fa(run) : ''
    const max = 14 - Array.from(suffix).length
    const len = (w) => Array.from(w.join(' ')).length
    const words = String(title || '').trim().split(/\s+/).filter(Boolean)
    // 1. the name as it is; 2. its longest shortenable words shortened one at a time; 3. fewer words; 4. the first letters (never an ellipsis)
    const ab = words.slice()
    const order = ab.map((w, i) => i).sort((x, y) => ab[y].length - ab[x].length)
    for (const i of order) {
      if (len(ab) <= max) break
      const short = ABBR[ab[i].toLowerCase()]
      if (short) ab[i] = ab[i][0] === ab[i][0].toUpperCase() ? short[0].toUpperCase() + short.slice(1) : short
    }
    while (len(ab) > max && ab.length > 1) ab.pop()
    let cur = ab.join(' ')
    if (len(ab) > max) cur = Array.from(cur).slice(0, max).join('').trim()
    return (cur || 'Agent') + suffix
  }

  // ---------- labels: placed one at a time, never over an avatar or another label
  const hit = (a, b) => a.l < b.r && a.r > b.l && a.t < b.b && a.b > b.t
  const boxOf = (el) => { const r = el.getBoundingClientRect(), o = eng.host.getBoundingClientRect(); return { l: r.left - o.left, r: r.right - o.left, t: r.top - o.top, b: r.bottom - o.top } }
  function layoutLabels() {
    if (!model || !eng.W) return
    const ppu = eng.view.ppu
    last.ppu = ppu
    const obstacles = []   // avatar boxes
    const deskBoxes = []   // every desk drawn: no label may touch one (an avatar stands behind its desk, so desks are not avatar obstacles)
    const placed = []      // label boxes
    const pos = new Map()
    for (let i = 0; i < cap; i++) {
      const d = deskPos(i)
      let l = Infinity, rr = -Infinity, t = Infinity, b = -Infinity
      // the desk (kit.cjs 1.0 x 0.5, 0.6 high; a model's own extents, with its screen), centred 0.12 in front of its spot
      for (const dx of [-deskExt.hw, deskExt.hw]) for (const dz of [-deskExt.hd, deskExt.hd]) for (const y of [0, deskExt.h]) {
        const p = eng.project(d.x + dx, y, d.z + 0.12 + dz)
        l = Math.min(l, p.x); rr = Math.max(rr, p.x); t = Math.min(t, p.y); b = Math.max(b, p.y)
      }
      deskBoxes.push({ l, r: rr, t, b })
    }
    // the free area's sofa, chairs and seated people: no label may touch them either
    if (freeBox) {
      let l = Infinity, rr = -Infinity, t = Infinity, b = -Infinity
      for (const x of [freeBox.min.x, freeBox.max.x]) for (const y of [freeBox.min.y, freeBox.max.y]) for (const z of [freeBox.min.z, freeBox.max.z]) {
        const p = eng.project(x, y, z)
        l = Math.min(l, p.x); rr = Math.max(rr, p.x); t = Math.min(t, p.y); b = Math.max(b, p.y)
      }
      deskBoxes.push({ l, r: rr, t, b })
    }
    last.desks = deskBoxes
    for (const f of model.figures) {
      const o = figs.get(f.id)
      if (!o) continue
      const sl = slots.get(f.id)
      const d = deskPos(sl.i)
      const ax = d.x, az = d.z - 0.52
      o.g.position.set(ax, 0.022, az)
      const feet = eng.project(ax, 0.022, az), top = eng.project(ax, o.top, az)
      const half = Math.max(12, 0.3 * ppu)
      // with a model the zone-colour badge floats above the head (dia px) and the number badge above it; else the badge is the body
      const dia = o.model ? Math.round(Math.max(22, Math.min(30, 0.5 * ppu))) : 0
      const box = { l: feet.x - half, r: feet.x + half, t: top.y - (o.model ? dia + 26 : 24), b: feet.y + 2 }
      o.box = box; o.desk = eng.project(d.x, 0, d.z + 0.62)
      pos.set(f.id, { feet, top })
      obstacles.push(box)
      const el = o.el
      el.style.cssText = 'left:' + box.l.toFixed(1) + 'px;top:' + box.t.toFixed(1) + 'px;width:' + (box.r - box.l).toFixed(1) + 'px;height:' + (box.b - box.t).toFixed(1) + 'px'
      const st = stateOf(f.state)
      const fz = Math.max(8, Math.min(13, 0.19 * ppu))
      el.dataset.key = f.key
      el.className = 'o3a' + (model.selected && model.selected === f.key ? ' sel' : '')
      el.setAttribute('role', 'button'); el.tabIndex = 0
      el.setAttribute('aria-label', f.label + ', ' + st.word + '. ' + f.step)
      const k = f.n + '|' + f.state + '|' + f.initials + '|' + role(f.zone) + '|' + o.model
      if (el.dataset.k !== k) { el.dataset.k = k; el.innerHTML = '<span class="n">' + shapeSvg(st.shape, st.fill, f.n) + '</span><span class="body' + (o.model ? ' dot' : '') + '" style="background:' + role(f.zone) + '"></span><span class="ini" dir="auto">' + esc(f.initials) + '</span>' }
      const ini = el.querySelector('.ini'), body = el.querySelector('.body')
      ini.style.fontSize = (o.model ? Math.max(9, dia * 0.42) : fz) + 'px'
      ini.style.display = ppu < 24 ? 'none' : ''
      if (o.model) {
        body.style.cssText = 'background:' + role(f.zone) + ';left:' + (half - dia / 2).toFixed(1) + 'px;width:' + dia + 'px;height:' + dia + 'px;top:24px;border-radius:50%'
        ini.style.top = (24 + dia / 2 - Math.max(9, dia * 0.42) / 2 - 0.5).toFixed(1) + 'px'
      } else {
        body.style.cssText = 'background:' + role(f.zone) + ';left:' + (half - 0.23 * ppu).toFixed(1) + 'px;width:' + (0.46 * ppu).toFixed(1) + 'px;top:' + (top.y - box.t + 0.36 * ppu).toFixed(1) + 'px;height:' + (0.8 * ppu).toFixed(1) + 'px;border-radius:' + (0.23 * ppu).toFixed(1) + 'px'
        ini.style.top = (top.y - box.t + 0.67 * ppu - fz / 2 - 1).toFixed(1) + 'px'
      }
    }
    // the chips and labels of the floor
    ov.querySelectorAll('.o3c').forEach((c) => c.remove())
    const free = (b, ignore) => !obstacles.some((q) => hit(q, b)) && !deskBoxes.some((q) => hit(q, b)) && !placed.some((q) => q !== ignore && hit(q, b))
    const inside = (b) => b.l >= 2 && b.t >= 2 && b.r <= eng.W - 2 && b.b <= eng.H - 2
    const chip = (cls, html, cands, extra) => {
      const c = document.createElement('div')
      c.className = cls
      c.innerHTML = html
      if (extra) for (const [k, v] of Object.entries(extra)) c.setAttribute(k, v)
      c.style.left = '0px'; c.style.top = '0px'; c.style.visibility = 'hidden'
      ov.appendChild(c)
      const w = c.offsetWidth, hh = c.offsetHeight
      for (const [px, py] of cands) {
        const b = { l: px - w / 2, r: px + w / 2, t: py - hh / 2, b: py + hh / 2 }
        if (inside(b) && free(b)) { c.style.left = b.l + 'px'; c.style.top = b.t + 'px'; c.style.visibility = ''; placed.push(b); return { el: c, box: b } }
      }
      c.remove()
      return null
    }
    // candidate centres: the anchor, then rings of 8 points round it, nearest first
    const ring = (cx, cy, n, r) => { const out = [[cx, cy]]; for (let k = 1; k <= n; k++) for (let a = 0; a < 8; a++) out.push([cx + Math.cos(a * Math.PI / 4) * r * k, cy + Math.sin(a * Math.PI / 4) * r * k]); return out }
    // every run has its own desk and one SHORT name above the person (<= 14 characters, never an ellipsis); the step lives in the list and in the hover/focus tip
    const order = model.figures.slice().sort((a, b) => (model.selected === b.key) - (model.selected === a.key) || a.n - b.n)
    const GAP = 8   // clear distance above the badges; heads keep 6px of air from a label, labels 3px from each other
    const grow = (b, m) => ({ l: b.l - m, r: b.r + m, t: b.t - m, b: b.b + m })
    const clear = (b) => !obstacles.some((q) => hit(q, grow(b, 6))) && !deskBoxes.some((q) => hit(q, b)) && !placed.some((q) => hit(q, grow(b, 3)))
    for (const f of order) {
      const o = figs.get(f.id)
      const tag = o.tag
      const text = shortName(f.title, f.runCount > 1 ? f.runN : 0)
      let ok = false
      tag.className = 'o3t'
      tag.textContent = text
      tag.dir = 'auto'
      tag.style.borderBottomColor = role(f.zone) // the colour of its desk tile
      tag.style.visibility = 'hidden'; tag.style.left = '0px'; tag.style.top = '0px'
      const w = tag.offsetWidth, hh = tag.offsetHeight
      const cx = (o.box.l + o.box.r) / 2
      // straight above the badges first, then raised higher and nudged sideways (still above the head), and only then on the tile in front of the desk
      const spots = []
      for (const up of [0, 14, 28]) for (const dx of [0, 14, -14]) spots.push([cx + dx, o.box.t - GAP - up - hh / 2])
      spots.push([o.desk.x, o.desk.y + 4 + hh / 2], [o.desk.x, o.desk.y + 12 + hh / 2])
      for (const [px, py] of spots) {
        const b = { l: px - w / 2, r: px + w / 2, t: py - hh / 2, b: py + hh / 2 }
        if (inside(b) && clear(b)) { tag.style.left = b.l + 'px'; tag.style.top = b.t + 'px'; tag.style.visibility = ''; placed.push(b); ok = true; break }
      }
      if (!ok) { tag.style.visibility = 'hidden'; tag.className = 'o3t gone' }
    }
    // the free area: one label with the number of idle agents
    const fr = rooms.find((r) => r.zone === 'free')
    if (fr) {
      const p = eng.project(fr.x + fr.w / 2, 0, fr.z + fr.d + 0.2)
      const n = model.idle.length
      chip('o3c lounge btn', '<button type="button" data-o3="idle"><i></i>Free area · ' + fa(n) + ' idle</button>', ring(p.x, p.y + 4, 8, 16))
    }
  }

  // a window of another size (or a stage that was hidden when the floor was first fitted) fits again, unless the owner moved the view
  let fitW = 0, fitH = 0
  eng.onFrame = () => {
    if (!userView && model && (eng.W !== fitW || eng.H !== fitH)) { fitW = eng.W; fitH = eng.H; eng.fit(padNow()); eng.dirty() }
    layoutLabels()
  }
  eng.canvas.addEventListener('wheel', (e) => {
    e.preventDefault()
    const r = eng.canvas.getBoundingClientRect()
    userView = true
    eng.zoomBy(Math.exp(-Math.max(-60, Math.min(60, e.deltaY)) * 0.0016), e.clientX - r.left, e.clientY - r.top)
    if (h.onView) h.onView(eng.getView())
  }, { passive: false })
  let drag = null
  eng.canvas.addEventListener('pointerdown', (e) => { drag = { id: e.pointerId, x: e.clientX, y: e.clientY, on: false }; try { eng.canvas.setPointerCapture(e.pointerId) } catch (err) { /* a pointer that is gone */ } })
  eng.canvas.addEventListener('pointermove', (e) => {
    if (!drag || drag.id !== e.pointerId) return
    if (!drag.on && Math.hypot(e.clientX - drag.x, e.clientY - drag.y) > 4) drag.on = true
    if (!drag.on) return
    userView = true
    eng.panPx(e.clientX - drag.x, e.clientY - drag.y)
    drag.x = e.clientX; drag.y = e.clientY
  })
  const endDrag = () => { if (drag && drag.on && h.onView) h.onView(eng.getView()); drag = null }
  eng.canvas.addEventListener('pointerup', endDrag)
  eng.canvas.addEventListener('pointercancel', endDrag)
  // the free area's chip and the list's "N idle" row open the list of idle people
  root.addEventListener('keydown', (e) => { if ((e.key === 'Enter' || e.key === ' ') && e.target.classList && e.target.classList.contains('o3a')) { e.preventDefault(); e.target.click() } })
  root.addEventListener('click', (e) => { if (e.target.closest('[data-o3=idle]')) { idleOpen = !idleOpen; renderSide(); eng.dirty() } })

  const padNow = () => ({ l: 16, r: 16, t: (h.pad && h.pad.top) || 16, b: (h.pad && h.pad.bottom) || 16 })
  function fitNow() { eng.resize(); eng.fit(padNow()) }

  const goodView = (v) => !!v && isFinite(v.tx) && isFinite(v.tz) && isFinite(v.zoom)
  function sync(m) {
    const fresh = m.key !== key
    model = m
    if (fresh) { key = m.key; slots.clear(); cap = 0; lockCols = 0; layoutSig = ''; userView = goodView(m.view); for (const o of figs.values()) { eng.scene.remove(o.g); o.el.remove(); o.tag.remove() } figs.clear() }
    const dims = plan()
    const sig = JSON.stringify([rooms.map((r) => [r.zone, r.cols, r.rows, r.x, r.z, r.w, r.d]), cap, deskZones, Math.min(MAX_SEATED, m.idle.length)])
    const resized = sig !== layoutSig
    if (resized) { layoutSig = sig; buildShell(dims) }
    const ids = new Set(m.figures.map((f) => f.id))
    for (const [id, o] of figs) if (!ids.has(id)) { eng.scene.remove(o.g); o.el.remove(); o.tag.remove(); figs.delete(id) }
    for (const f of m.figures) avatarFor(f)
    renderSide()
    eng.resize()
    // a view saved by an older page has other keys: it is ignored
    if (fresh && goodView(m.view)) eng.setView(m.view)
    else if ((fresh || resized) && !userView) eng.fit(padNow())
    eng.renderNow()
  }

  return {
    mount(stage) { stage.appendChild(root) },
    sync, fit() { userView = false; fitNow(); eng.dirty() },
    zoomBy(f) { userView = true; eng.zoomBy(f); if (h.onView) h.onView(eng.getView()) },
    panBy(dx, dy) { userView = true; eng.panPx(dx, dy); if (h.onView) h.onView(eng.getView()) },
    zoomPct: () => eng.zoomPct(),
    view: () => eng.getView(),
    info() {
      const o0 = () => eng.host.getBoundingClientRect()
      const rect = (el) => { const r = el.getBoundingClientRect(); return { l: r.left, t: r.top, r: r.right, b: r.bottom, w: r.width, h: r.height } }
      return {
        figures: model ? model.figures.map((f) => ({ id: f.id, agent: f.agent, key: f.key, n: f.n, state: f.state, zone: f.zone, runCount: f.runCount, box: rect(figs.get(f.id).el), tag: figs.get(f.id).tag.style.visibility === 'hidden' ? null : rect(figs.get(f.id).tag), tagText: figs.get(f.id).tag.textContent, tagFull: figs.get(f.id).tag.scrollWidth > figs.get(f.id).tag.clientWidth + 1 ? false : true })) : [],
        desks: (last.desks || []).map((d) => ({ l: d.l + o0().left, r: d.r + o0().left, t: d.t + o0().top, b: d.b + o0().top })),
        idle: model ? model.idle.length : 0, seated: Math.min(MAX_SEATED, model ? model.idle.length : 0), rooms: rooms.map((r) => r.zone), ppu: last.ppu,
        labels: [...ov.querySelectorAll('.o3c')].map((c) => ({ cls: c.className, text: c.textContent, box: rect(c) })),
        side: rect(side), scene: rect(eng.host),
      }
    },
    el: root,
  }
}

module.exports = { office3d }
