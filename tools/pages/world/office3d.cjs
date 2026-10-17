/* ======================================================================
 * The office floor (design C2): walled zone rooms on a floor slab, a desk
 * and one figure per run, a lounge, and a side list. Drawn in three.js with
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
 *  - idle people are not figures: "N idle" in the lounge and in the list;
 *  - labels are placed one at a time on the nearest free slot, shrink to a
 *    short form and then disappear rather than cover an avatar or another
 *    label; the list always has the full text.
 *
 * Desks, chairs, the lounge sofa and plants come from the manifest's furniture
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
  const ZONE_ORDER = ['lead', 'plan', 'build', 'review', 'verify', 'ship', 'ops', 'docs', 'design', 'data', 'legal', 'guest']
  const CELL_X = 1.9, CELL_Z = 2.1, WALL = 0.5, GAP = 0.45, ROW_W = 11.5
  const role = (z) => PAL.ROLE[z] || PAL.ROLE.guest
  const tint = (z) => PAL.TINT[z] || PAL.TINT.guest
  const zoneName = (z) => PAL.LABEL[z] || (z ? z.charAt(0).toUpperCase() + z.slice(1) : 'Guest')
  const stateOf = (s) => PAL.STATE[s] || PAL.STATE.quiet

  const root = document.createElement('div')
  root.className = 'o3root'
  const side = document.createElement('aside')
  side.className = 'o3side'
  side.setAttribute('aria-label', 'Agents')
  root.append(eng.host, side)
  const ov = eng.ov
  const lines = document.createElementNS('http://www.w3.org/2000/svg', 'svg')
  lines.setAttribute('class', 'o3ln')
  ov.appendChild(lines)

  let key = null, model = null
  let userView = false
  let layoutSig = ''
  let shell = null
  const figs = new Map()    // id -> { g (avatar), el (.o3a), tag (.o3t) }
  const slots = new Map()   // id -> { zone, i }, kept for the life of the figure
  const caps = new Map()    // zone -> desks the room has had
  let rooms = []            // [{ zone, x, z, w, d, cols, rows }]
  let idleOpen = false
  let chips = []            // lounge, reports, groups, room labels (DOM, recreated per layout)
  let last = { ppu: 0 }
  // models load after the first draw: when one arrives the floor and the figures are drawn again
  const useModel = () => !!K.models['character:office']
  K.loadModels(() => { if (!model) return; layoutSig = ''; sync(model) }, ['furniture', 'character'])
  const mix = (hex, to, t) => { const a = parseInt(hex.slice(1), 16), b = parseInt(to.slice(1), 16); const c = (sh) => Math.round(((a >> sh) & 255) * (1 - t) + ((b >> sh) & 255) * t); return '#' + ((1 << 24) | (c(16) << 16) | (c(8) << 8) | c(0)).toString(16).slice(1) }

  // ---------- layout: which rooms, how big, where
  function plan() {
    const figures = model.figures
    // a desk is freed when its figure leaves, before a new figure takes the lowest free desk of its zone
    const ids = new Set(figures.map((f) => f.id))
    for (const id of [...slots.keys()]) if (!ids.has(id)) slots.delete(id)
    for (const f of figures) {
      if (slots.has(f.id)) continue
      const used = new Set([...slots.values()].filter((s) => s.zone === f.zone).map((s) => s.i))
      let i = 0
      while (used.has(i)) i++
      slots.set(f.id, { zone: f.zone, i })
    }
    const count = new Map()
    for (const [id, s] of slots) count.set(s.zone, Math.max(count.get(s.zone) || 0, s.i + 1))
    for (const [z, n] of count) caps.set(z, Math.max(caps.get(z) || 0, n))
    const zones = [...count.keys()].sort((a, b) => (ZONE_ORDER.indexOf(a) + 1 || 99) - (ZONE_ORDER.indexOf(b) + 1 || 99) || a.localeCompare(b))
    const list = zones.map((z) => {
      const cap = caps.get(z)
      const cols = cap <= 2 ? cap : cap <= 4 ? 2 : 3
      const rows = Math.ceil(cap / cols)
      // every other row is shifted by half a desk, so a figure never stands right behind another on the screen's vertical
      return { zone: z, cols, rows, w: cols * CELL_X + (rows > 1 ? CELL_X / 2 : 0) + WALL, d: rows * CELL_Z + WALL }
    })
    list.push({ zone: 'lounge', cols: 2, rows: 1, w: 2 * CELL_X + WALL, d: CELL_Z + WALL })
    // rows of rooms, left to right, a new row when the next room would pass ROW_W
    let x = 0, z = 0, rowD = 0, maxX = 0
    for (const r of list) {
      if (x > 0 && x + r.w > ROW_W) { x = 0; z += rowD + GAP; rowD = 0 }
      r.x = x; r.z = z
      x += r.w + GAP; rowD = Math.max(rowD, r.d); maxX = Math.max(maxX, x - GAP)
    }
    // each row's rooms share the depth of the deepest, so the walls line up
    const rowsZ = [...new Set(list.map((r) => r.z))]
    for (const rz of rowsZ) { const dd = Math.max(...list.filter((r) => r.z === rz).map((r) => r.d)); for (const r of list.filter((q) => q.z === rz)) r.d = dd }
    const totalD = Math.max(...list.map((r) => r.z + r.d))
    for (const r of list) { r.x -= maxX / 2; r.z -= totalD / 2 }
    rooms = list
    return { maxX, totalD }
  }

  const deskPos = (zone, i) => {
    const r = rooms.find((q) => q.zone === zone)
    const col = i % r.cols, row = Math.floor(i / r.cols)
    return { x: r.x + WALL / 2 + (col + 0.5) * CELL_X + (row % 2 ? CELL_X / 2 : 0), z: r.z + WALL / 2 + (row + 0.5) * CELL_Z }
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

  function buildShell(dims) {
    if (shell) { eng.scene.remove(shell); shell.traverse((o) => { if (o.geometry) o.geometry.dispose() }) }
    const g = new T3.Group()
    const W = dims.maxX + 1.0, D = dims.totalD + 1.0
    // a white floor: a pale slab, and every room a two-tone checkerboard of its own tint
    K.box(g, W, 0.16, D, '#D3D8DF', 0, -0.16, 0)
    K.box(g, W - 0.2, 0.03, D - 0.2, '#F4F5F7', 0, 0, 0)
    K.checker(g, W - 0.2, D - 0.2, 0.5, '#F7F8FA', '#E8EBEF', 0, 0.031, 0)
    // the two back walls of the building, with windows
    const wallH = 1.9
    K.box(g, 0.2, wallH, D, '#D3D8DF', -W / 2 + 0.1, 0, 0)
    K.box(g, W, wallH, 0.2, '#E1E5EA', 0, 0, -D / 2 + 0.1)
    for (let i = 0; i < Math.floor(D / 2.2); i++) K.box(g, 0.03, 0.5, 1.1, '#B4D0E6', -W / 2 + 0.22, 1.0, -D / 2 + 1.6 + i * 2.2)
    for (let i = 0; i < Math.floor(W / 2.2); i++) K.box(g, 1.1, 0.5, 0.03, '#B4D0E6', -W / 2 + 1.6 + i * 2.2, 1.0, -D / 2 + 0.22)
    for (const r of rooms) {
      const floor = r.zone === 'lounge' ? '#E4E7EC' : tint(r.zone)
      K.box(g, r.w, 0.05, r.d, floor, r.x + r.w / 2, 0, r.z + r.d / 2)
      K.checker(g, r.w, r.d, 0.5, mix(floor, '#FFFFFF', 0.5), floor, r.x + r.w / 2, 0.051, r.z + r.d / 2)
      // low walls; the front two (towards the camera) have a door gap and are lower, so the room stays open to the eye
      const t = 0.1, hBack = 0.7, hFront = 0.34, c = '#F6F7F9'
      K.box(g, r.w, hBack, t, c, r.x + r.w / 2, 0, r.z + t / 2)
      K.box(g, t, hBack, r.d, c, r.x + t / 2, 0, r.z + r.d / 2)
      const door = 0.9
      for (const [x0, x1] of [[r.x, r.x + r.w / 2 - door / 2], [r.x + r.w / 2 + door / 2, r.x + r.w]]) K.box(g, x1 - x0, hFront, t, c, (x0 + x1) / 2, 0, r.z + r.d - t / 2)
      for (const [z0, z1] of [[r.z, r.z + r.d / 2 - door / 2], [r.z + r.d / 2 + door / 2, r.z + r.d]]) K.box(g, t, hFront, z1 - z0, c, r.x + r.w - t / 2, 0, (z0 + z1) / 2)
      if (r.zone === 'lounge') {
        let sofa = K.furniture('sofa')
        if (!sofa) {
          sofa = new T3.Group()
          K.box(sofa, 1.9, 0.3, 0.6, '#C8B79A', 0, 0, 0)
          K.box(sofa, 1.9, 0.4, 0.16, '#B7A583', 0, 0.3, -0.24)
        }
        sofa.position.set(r.x + 1.5, 0.03, r.z + 0.9)
        g.add(sofa)
        const plant = K.furniture('plant')
        if (plant) { plant.position.set(r.x + r.w - 0.8, 0.03, r.z + r.d - 0.8); g.add(plant) }
        else g.add(K.tree(r.x + r.w - 0.8, r.z + r.d - 0.8, 1.4))
      } else {
        const n = caps.get(r.zone) || 0
        for (let i = 0; i < n; i++) {
          const p = deskPos(r.zone, i)
          const d = makeDesk()
          deskExt = d
          d.g.rotation.y = Math.PI
          d.g.position.set(p.x, 0.03, p.z + 0.12)
          g.add(d.g)
          const chair = K.furniture('chair')
          if (chair) { chair.position.set(p.x, 0.03, p.z - 0.52); g.add(chair) }
        }
      }
    }
    shell = g
    eng.scene.add(g)
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
      if (model) { const p = K.character('office', 'sit'); g.add(p); top = new T3.Box3().setFromObject(p).max.y } else g.add(K.avatar(color))
      const ring = new T3.Mesh(new T3.CylinderGeometry(0.41, 0.41, 0.02, 24), new T3.MeshBasicMaterial({ color: '#19795A' }))
      ring.position.y = 0.037
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
        o = { g, ring, el, tag, color, model, top }
        figs.set(f.id, o)
      }
    }
    if (!o.model && o.color !== color) { o.color = color; o.g.children[0].children[0].material = K.mat(color) }
    o.ring.material.color.set(stateOf(f.state).fill)
    const sl = slots.get(f.id), d = deskPos(sl.zone, sl.i)
    o.g.position.set(d.x, 0.03, d.z - 0.52)
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
    for (const r of rooms) {
      if (r.zone === 'lounge') continue
      for (let i = 0, n = caps.get(r.zone) || 0; i < n; i++) {
        const d = deskPos(r.zone, i)
        let l = Infinity, rr = -Infinity, t = Infinity, b = -Infinity
        // the desk (kit.cjs 1.0 x 0.5, 0.6 high; a model's own extents, with its screen), centred 0.12 in front of its spot
        for (const dx of [-deskExt.hw, deskExt.hw]) for (const dz of [-deskExt.hd, deskExt.hd]) for (const y of [0, deskExt.h]) {
          const p = eng.project(d.x + dx, y, d.z + 0.12 + dz)
          l = Math.min(l, p.x); rr = Math.max(rr, p.x); t = Math.min(t, p.y); b = Math.max(b, p.y)
        }
        deskBoxes.push({ l, r: rr, t, b })
      }
    }
    last.desks = deskBoxes
    for (const f of model.figures) {
      const o = figs.get(f.id)
      if (!o) continue
      const sl = slots.get(f.id)
      const d = deskPos(sl.zone, sl.i)
      const ax = d.x, az = d.z - 0.52
      o.g.position.set(ax, 0.03, az)
      const feet = eng.project(ax, 0.03, az), top = eng.project(ax, o.top, az)
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
    // the chips of the room: groups of runs of one agent first, then the lounge, the reports, the zone names
    ov.querySelectorAll('.o3c,.o3r').forEach((c) => c.remove())
    while (lines.firstChild) lines.removeChild(lines.firstChild)
    const tagged = new Set()
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
    // groups: N runs of one agent share one chip between the figures
    const groups = new Map()
    for (const f of model.figures) if (f.runCount > 1) { const g = groups.get(f.group) || []; g.push(f); groups.set(f.group, g) }
    for (const [name, list] of groups) {
      const pts = list.map((f) => figs.get(f.id).desk)
      const cx = pts.reduce((s, p) => s + p.x, 0) / pts.length, cy = pts.reduce((s, p) => s + p.y, 0) / pts.length + 16
      const c = chip('o3c grp', '<b dir="auto">' + esc(list[0].title) + '</b> ×' + fa(list.length), ring(cx, cy, 5, 14))
      if (!c) continue
      const mx = (c.box.l + c.box.r) / 2, my = (c.box.t + c.box.b) / 2
      for (const f of list) {
        tagged.add(f.id)
        const b = figs.get(f.id).box
        const ln = document.createElementNS('http://www.w3.org/2000/svg', 'line')
        ln.setAttribute('x1', mx); ln.setAttribute('y1', my); ln.setAttribute('x2', (b.l + b.r) / 2); ln.setAttribute('y2', b.b - 2)
        lines.appendChild(ln)
      }
    }
    // name tags under the desk: full, then short, else none (the list has the name)
    const order = model.figures.slice().sort((a, b) => (model.selected === b.key) - (model.selected === a.key) || a.n - b.n)
    for (const f of order) {
      const o = figs.get(f.id)
      const tag = o.tag
      if (tagged.has(f.id)) { tag.style.visibility = 'hidden'; continue }
      let ok = false
      for (const [mode, text] of [['', f.tag], ['short', Array.from(f.tag).slice(0, 7).join('') + (Array.from(f.tag).length > 7 ? '…' : '')]]) {
        tag.className = 'o3t' + (mode ? ' short' : '')
        tag.textContent = text
        tag.dir = 'auto'
        tag.style.visibility = 'hidden'; tag.style.left = '0px'; tag.style.top = '0px'
        const w = tag.offsetWidth, hh = tag.offsetHeight
        for (const [dx, dy] of [[0, 0], [0, 6], [w / 2 + 14, -6], [-w / 2 - 14, -6]]) {
          const b = { l: o.desk.x + dx - w / 2, r: o.desk.x + dx + w / 2, t: o.desk.y + dy + 2, b: o.desk.y + dy + 2 + hh }
          if (inside(b) && free(b)) { tag.style.left = b.l + 'px'; tag.style.top = b.t + 'px'; tag.style.visibility = ''; placed.push(b); ok = true; break }
        }
        if (ok) break
      }
      if (!ok) { tag.style.visibility = 'hidden'; tag.className = 'o3t gone' }
    }
    // lounge
    const lo = rooms.find((r) => r.zone === 'lounge')
    if (lo) {
      const p = eng.project(lo.x + lo.w / 2 - 0.5, 0.3, lo.z + lo.d / 2 + 0.3)
      const n = model.idle.length + (model.away || []).length
      chip('o3c lounge' + (n ? ' btn' : ''), (n ? '<button type="button" data-o3="idle"><i></i>Lounge · ' + fa(model.idle.length) + ' idle</button>' : '<span><i></i>Lounge</span>'), ring(p.x, p.y, 6, 16))
    }
    // zone names, at the back corner of each room
    for (const r of rooms) {
      if (r.zone === 'lounge') continue
      // points along the room's edges, the front (towards the camera) first; the back is where the figures stand
      const at = (u, v) => { const p = eng.project(r.x + u * r.w, 0.1, r.z + v * r.d); return [p.x, p.y] }
      const cands = []
      for (const v of [0.97, 0.5, 0.03]) for (const u of [0.14, 0.86, 0.5, 0.3, 0.7]) cands.push(at(u, v))
      chip('o3r', '<span style="background:' + role(r.zone) + '"></span>' + esc(zoneName(r.zone)), cands)
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
  // the lounge chip and the list's "N idle" row open the list of idle people
  root.addEventListener('keydown', (e) => { if ((e.key === 'Enter' || e.key === ' ') && e.target.classList && e.target.classList.contains('o3a')) { e.preventDefault(); e.target.click() } })
  root.addEventListener('click', (e) => { if (e.target.closest('[data-o3=idle]')) { idleOpen = !idleOpen; renderSide(); eng.dirty() } })

  const padNow = () => ({ l: 16, r: 16, t: (h.pad && h.pad.top) || 16, b: (h.pad && h.pad.bottom) || 16 })
  function fitNow() { eng.resize(); eng.fit(padNow()) }

  const goodView = (v) => !!v && isFinite(v.tx) && isFinite(v.tz) && isFinite(v.zoom)
  function sync(m) {
    const fresh = m.key !== key
    model = m
    if (fresh) { key = m.key; slots.clear(); caps.clear(); layoutSig = ''; userView = goodView(m.view); for (const o of figs.values()) { eng.scene.remove(o.g); o.el.remove(); o.tag.remove() } figs.clear() }
    const dims = plan()
    const sig = JSON.stringify(rooms.map((r) => [r.zone, r.cols, r.rows, r.x, r.z, r.w, r.d]))
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
        figures: model ? model.figures.map((f) => ({ id: f.id, agent: f.agent, key: f.key, n: f.n, state: f.state, zone: f.zone, runCount: f.runCount, box: rect(figs.get(f.id).el), tag: figs.get(f.id).tag.style.visibility === 'hidden' ? null : rect(figs.get(f.id).tag) })) : [],
        desks: (last.desks || []).map((d) => ({ l: d.l + o0().left, r: d.r + o0().left, t: d.t + o0().top, b: d.b + o0().top })),
        idle: model ? model.idle.length : 0, rooms: rooms.map((r) => r.zone), ppu: last.ppu,
        labels: [...ov.querySelectorAll('.o3c,.o3r')].map((c) => ({ cls: c.className, text: c.textContent, box: rect(c) })),
        side: rect(side), scene: rect(eng.host),
      }
    },
    el: root,
  }
}

module.exports = { office3d }
