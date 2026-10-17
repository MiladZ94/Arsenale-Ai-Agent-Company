/* ======================================================================
 * The campus (design C2): a building game board. Lots on a grid (implied by one flat checkerboard, outlined only in Build mode), one
 * building per office, drawn in three.js (orthographic, isometric) from the
 * shared kit (kit.cjs). Without WebGL a flat grid of tiles stands in.
 *
 * Normal mode: click a building (or its label) to enter the office.
 * Build mode (the owner's "Build" button): a hotbar of the 12 building types
 * (keys 1 to 9), a tool column (select, move, rotate, archive), a ghost
 * building that follows the pointer (blue on a free lot, red with "Lot taken"
 * on a used one), Done building. Every change goes through POST api/campus,
 * which is the only write path (campus.cjs); the page only asks.
 *
 * h: { esc, fa, go(to), post(url, body), refresh() }. Never run in Node: the
 * source is written into the page. Plain English; no T() or LANG here.
 * draw(m) returns the html, fit() mounts the persistent canvas into it after
 * every redraw. m: { campus: { grid, buildings, types, readOnly }, cells:
 * [{ id, name, color, working, waiting }], canEdit, side }.
 * ====================================================================== */
function campusArt(h) {
  const { esc, fa, go, post, refresh } = h
  const ST_COL = { working: '#19795A', quiet: '#5B6B7C', waiting: '#B45309', paused: '#C62828', idle: '#5B6B7C', away: '#5B6B7C' }
  const PITCH = 1.2 // a lot is 1 wide, the road between two lots 0.2
  let K = typeof worldKit === 'function' ? worldKit() : null
  const bm = { on: false, tool: 'select', type: '', rot: 0, sel: '', armed: '', hover: '', msg: '', bad: false }
  let hl = null, icons = null
  let model = null
  let eng = null
  let sig = ''
  let built = null // { group, things: Map(id -> { id, group, lot, label }), grid }
  let ghost = null, ghostSig = '', ghostLot = null
  let userView = false
  let msgT = 0
  let drag = null

  const lotOf = (b) => ({ x: (b.x - model.campus.grid.cols / 2 + 0.5) * PITCH, z: (b.y - model.campus.grid.rows / 2 + 0.5) * PITCH })
  const cellOf = (id) => (model.cells || []).find((c) => c.id === id) || { id, name: id, color: '#8A97A6', working: 0, waiting: 0 }
  const typeOf = (id) => model.campus.types.find((t) => t.id === id) || { id: 'business', name: 'Office' }
  const byLot = () => new Map(model.campus.buildings.map((b) => [b.x + ',' + b.y, b]))
  const editable = () => !!model.canEdit && !model.campus.readOnly
  const $ = (id) => document.getElementById(id)

  // ---------- the html
  const TOOLS = [['select', 'Select', 'M5 3l14 8-6 1.6L10.5 19z'], ['move', 'Move', 'M12 3v18M3 12h18M12 3l-3 3m3-3l3 3M12 21l-3-3m3 3l3-3M3 12l3-3m-3 3l3 3M21 12l-3-3m3 3l-3 3'], ['rotate', 'Rotate', 'M20 12a8 8 0 1 1-2.6-5.9M20 4v5h-5'], ['archive', 'Archive', 'M5 7h14M9 7V4h6v3M7 7l1 13h8l1-13']]
  const icon = (d) => '<svg viewBox="0 0 24 24" width="22" height="22" fill="none" stroke="currentColor" stroke-width="1.8" stroke-linecap="round" stroke-linejoin="round" aria-hidden="true"><path d="' + d + '"/></svg>'
  const tileIcon = (t) => (icons && icons[t.id] ? '<img src="' + icons[t.id] + '" width="64" height="52" alt="">' : '<svg viewBox="0 0 40 32" width="40" height="32" aria-hidden="true"><path d="M20 4l16 8-16 8-16-8z" fill="#d5dae0"/></svg>')

  function flat(m) {
    const g = m.campus.grid, by = new Map(m.campus.buildings.map((b) => [b.x + ',' + b.y, b]))
    let s = '<div class="c3flat" style="grid-template-columns:repeat(' + g.cols + ',minmax(0,1fr))">'
    for (let y = 0; y < g.rows; y++) for (let x = 0; x < g.cols; x++) {
      const b = by.get(x + ',' + y)
      if (!b) { s += '<div class="lot"></div>'; continue }
      const c = cellOf(b.officeId)
      s += '<button type="button" class="tile" data-goto="office:' + esc(b.officeId) + '" style="--c:' + esc(c.color) + '"><b dir="auto">' + esc(c.name) + '</b><span>' + esc(typeOf(b.type).name) + '</span><i>' + fa(c.working) + ' working</i></button>'
    }
    return s + '</div>'
  }

  function draw(m) {
    model = m
    const c = m.campus
    const used = c.buildings.length, total = c.grid.cols * c.grid.rows
    if (K && !eng) ensure()
    const build = bm.on && editable() && !!K
    // the hotbar pictures are drawn when the hotbar is first shown, and again after a model has loaded (they show the real ones)
    if (build && !icons) icons = K.icons(96, 78) || {}
    let s = '<div class="cwrap"><div class="cmap' + (build ? ' building' : '') + '" id="cmap">'
    s += '<div class="c3bar"><span class="c3cnt" id="c3cnt">' + fa(used) + ' of ' + fa(total) + ' lots</span>'
    if (K) s += '<button type="button" class="c3b" data-c3="fit">Fit</button>'
    if (K && editable()) s += '<button type="button" class="c3b pri" data-c3="build">' + (build ? 'Done building' : 'Build') + '</button>'
    else if (c.readOnly) s += '<span class="c3ro">Read-only: newer file</span>'
    s += '</div><div class="c3stage" id="c3stage">' + (K ? '' : flat(m)) + '</div>'
    if (build) {
      s += '<div class="c3tools" role="toolbar" aria-label="Tools">' + TOOLS.map(([id, name, d]) => '<button type="button" class="c3t' + (bm.tool === id && !bm.type ? ' on' : '') + '" data-c3tool="' + id + '" title="' + name + '">' + icon(d) + '<span>' + name + '</span></button>').join('') + '</div>'
      s += '<div class="c3hot" role="toolbar" aria-label="Building types"><div class="hh"><b>Building types</b><span>Press 1-9 · R rotate · Esc exit</span></div><div class="hs">' +
        c.types.map((t, i) => '<button type="button" class="c3h' + (bm.type === t.id ? ' on' : '') + '" data-c3type="' + t.id + '" title="' + esc(t.name) + '"><em>' + (i < 9 ? i + 1 : '') + '</em>' + tileIcon(t) + '<span>' + esc(String(t.name).split(' ')[0]) + '</span></button>').join('') + '</div></div>'
    }
    s += '<div class="c3msg' + (bm.bad ? ' bad' : '') + '" id="c3msg" role="status"' + (bm.msg ? '' : ' hidden') + '>' + esc(bm.msg) + '</div>'
    // the company summary steps aside while building: the board gets the whole width
    return s + '</div>' + (build ? '' : m.side || '') + '</div>'
  }

  // ---------- the scene
  function ensure() {
    if (eng || !K) return eng
    eng = K.engine({ onLost: () => { eng = null; K = null; if (h.redraw) h.redraw() } })
    if (!eng) { K = null; return null }
    const cv = eng.canvas
    cv.addEventListener('pointerdown', onDown)
    cv.addEventListener('pointermove', onMove)
    cv.addEventListener('pointerup', onUp)
    cv.addEventListener('pointercancel', () => { drag = null })
    cv.addEventListener('pointerleave', () => { bm.hover = ''; clearGhost(); eng.dirty() })
    cv.addEventListener('contextmenu', (e) => e.preventDefault())
    cv.addEventListener('wheel', (e) => {
      e.preventDefault()
      const r = cv.getBoundingClientRect()
      userView = true
      eng.zoomBy(Math.exp(-Math.max(-60, Math.min(60, e.deltaY)) * (e.ctrlKey ? 0.008 : 0.0016)), e.clientX - r.left, e.clientY - r.top)
    }, { passive: false })
    eng.onFrame = overlay
    K.loadModels(() => { sig = ''; icons = null; if (model) rebuild() }, ['building'])
    return eng
  }

  // one continuous flat checkerboard, like the Sims build grid: no slab, no side edges, no tiles with borders.
  // A lot is only implied by the grid; its outline is drawn in Build mode (see setOutlines).
  const FLOOR_A = '#F4F5F7', FLOOR_B = '#DFE3E9', EDGE = '#8E9AA8', TILE = 0.3 // four tiles to a lot pitch, so lot edges fall on tile lines
  let outlines = null, gen = 0
  function rebuild() {
    if (!eng || !model) return
    const c = model.campus
    const next = JSON.stringify([c.grid, c.buildings, (model.cells || []).map((x) => [x.id, x.name, x.color])])
    if (next === sig) return
    sig = next
    gen++
    const T3 = window.THREE
    if (built) { eng.scene.remove(built.group); built.group.traverse((o) => { if (o.geometry) o.geometry.dispose() }); built.labels.forEach((l) => l.remove()); if (built.svg) built.svg.remove() }
    const group = new T3.Group()
    const { cols, rows } = c.grid
    const W = cols * PITCH, D = rows * PITCH
    K.checker(group, W + 1.2, D + 1.2, TILE, FLOOR_A, FLOOR_B, 0, 0, 0)
    // lot outlines, build mode only
    outlines = new T3.Group()
    const lots = new Map(c.buildings.map((b) => [b.x + ',' + b.y, b]))
    for (let y = 0; y < rows; y++) for (let x = 0; x < cols; x++) {
      const px = (x - cols / 2 + 0.5) * PITCH, pz = (y - rows / 2 + 0.5) * PITCH
      const e = new T3.LineSegments(new T3.EdgesGeometry(new T3.BoxGeometry(0.94, 0.001, 0.94)), lots.has(x + ',' + y) ? new T3.LineBasicMaterial({ color: EDGE }) : new T3.LineDashedMaterial({ color: EDGE, dashSize: 0.07, gapSize: 0.05 }))
      e.computeLineDistances(); e.position.set(px, 0.012, pz); outlines.add(e)
    }
    group.add(outlines)
    const things = new Map(), labels = []
    for (const b of c.buildings) {
      const cell = cellOf(b.officeId)
      const g = K.building(b.type, cell.color, b.rot)
      const p = lotOf(b)
      g.position.set(p.x, 0, p.z)
      g.userData.id = b.id
      group.add(g)
      const lab = document.createElement('div')
      lab.className = 'c3lab'
      lab.dataset.b = b.id
      lab.setAttribute('role', 'button'); lab.tabIndex = 0
      // in normal mode a label enters the office, like its building; in build mode it only selects
      const open = () => { if (bm.on && editable()) { bm.sel = b.id; eng.dirty() } else go('office:' + b.officeId) }
      lab.addEventListener('click', open)
      lab.addEventListener('keydown', (e) => { if (e.key === 'Enter' || e.key === ' ') { e.preventDefault(); open() } })
      eng.ov.appendChild(lab)
      labels.push(lab)
      things.set(b.id, { id: b.id, group: g, b, lab, tris: null })
    }
    group.updateMatrixWorld(true)
    // the building's triangles in world space: the titles are kept off what is really drawn, not off a box round it
    for (const t of things.values()) {
      const v = [], p = new T3.Vector3()
      t.group.traverse((o) => {
        if (!o.isMesh || !o.geometry.attributes.position) return
        const pos = o.geometry.attributes.position, idx = o.geometry.index
        const n = idx ? idx.count : pos.count
        for (let i = 0; i < n; i++) { p.fromBufferAttribute(pos, idx ? idx.getX(i) : i).applyMatrix4(o.matrixWorld); v.push(p.x, p.y, p.z) }
      })
      t.tris = new Float32Array(v)
    }
    const svg = document.createElementNS('http://www.w3.org/2000/svg', 'svg')
    svg.setAttribute('class', 'c3ln')
    eng.ov.insertBefore(svg, eng.ov.firstChild) // under the titles
    hl = new T3.LineSegments(new T3.EdgesGeometry(new T3.BoxGeometry(1.04, 0.06, 1.04)), new T3.LineBasicMaterial({ color: '#2F6BE0' }))
    hl.visible = false
    group.add(hl)
    eng.scene.add(group)
    built = { group, things, labels, svg, W, D }
    eng.bounds = { minx: -W / 2 - 0.6, maxx: W / 2 + 0.6, minz: -D / 2 - 0.6, maxz: D / 2 + 0.6, h: 0.3 }
    if (!userView) fitView()
    eng.dirty()
  }

  const padNow = () => (bm.on && editable() ? { l: 84, r: 24, t: 54, b: 150 } : { l: 24, r: 24, t: 56, b: 24 })
  function fitView() { if (eng && eng.bounds) { eng.resize(); eng.fit(padNow()) } }

  // ---------- titles (name, agents working now), the ghost, the highlights
  // A title is a small pill on the ground. It is put on the nearest spot that covers no building (the drawn
  // triangles, from a mask) and no other title, and joined to its lot by a short leader line when it had to move away.
  const OFFS = (() => { const o = []; for (let dy = -150; dy <= 170; dy += 6) for (let dx = -220; dx <= 220; dx += 8) o.push([dx, dy, Math.hypot(dx, dy * 1.2) + (dy < 0 ? 10 : 0)]); return o.sort((a, b) => a[2] - b[2]) })()
  let mask = null
  function ensureMask() {
    const S = 0.5, W = eng.W, H = eng.H
    const o = eng.project(0, 0, 0)
    const key = [W, H, eng.view.ppu.toFixed(3), o.x.toFixed(1), o.y.toFixed(1), gen].join('|')
    if (mask && mask.key === key) return mask
    const w = Math.ceil(W * S) + 2, h = Math.ceil(H * S) + 2
    const cv = document.createElement('canvas'); cv.width = w; cv.height = h
    const cx = cv.getContext('2d', { willReadFrequently: true })
    const T3 = window.THREE
    const m = new T3.Matrix4().multiplyMatrices(eng.cam.projectionMatrix, eng.cam.matrixWorldInverse).elements
    const sx = (x, y, z) => ((m[0] * x + m[4] * y + m[8] * z + m[12]) + 1) / 2 * W * S
    const sy = (x, y, z) => (1 - (m[1] * x + m[5] * y + m[9] * z + m[13])) / 2 * H * S
    cx.fillStyle = '#000'
    for (const t of built.things.values()) {
      const v = t.tris
      cx.beginPath()
      for (let i = 0; i + 8 < v.length; i += 9) {
        const ax = sx(v[i], v[i + 1], v[i + 2]), ay = sy(v[i], v[i + 1], v[i + 2]), bx = sx(v[i + 3], v[i + 4], v[i + 5]), by = sy(v[i + 3], v[i + 4], v[i + 5]), qx = sx(v[i + 6], v[i + 7], v[i + 8]), qy = sy(v[i + 6], v[i + 7], v[i + 8])
        // every triangle the same way round, so overlapping ones add up under the non-zero rule instead of cancelling
        const flip = (bx - ax) * (qy - ay) - (by - ay) * (qx - ax) < 0
        cx.moveTo(ax, ay); if (flip) { cx.lineTo(qx, qy); cx.lineTo(bx, by) } else { cx.lineTo(bx, by); cx.lineTo(qx, qy) }
        cx.closePath()
      }
      cx.fill()
    }
    const px = cx.getImageData(0, 0, w, h).data
    const sat = new Int32Array((w + 1) * (h + 1))
    for (let y = 1; y <= h; y++) { let row = 0; for (let x = 1; x <= w; x++) { row += px[((y - 1) * w + (x - 1)) * 4 + 3] > 0 ? 1 : 0; sat[y * (w + 1) + x] = sat[(y - 1) * (w + 1) + x] + row } }
    mask = { key, S, w, h, sat, covers(b, pad) {
      const l = Math.max(0, Math.floor((b.l - pad) * S)), t = Math.max(0, Math.floor((b.t - pad) * S)), r = Math.min(w, Math.ceil((b.r + pad) * S)), bt = Math.min(h, Math.ceil((b.b + pad) * S))
      if (r <= l || bt <= t) return false
      return sat[bt * (w + 1) + r] - sat[t * (w + 1) + r] - sat[bt * (w + 1) + l] + sat[t * (w + 1) + l] > 0
    } }
    return mask
  }

  const rectsHit = (a, b) => a.l < b.r && a.r > b.l && a.t < b.b && a.b > b.t
  let labKey = ''
  function placeTitles() {
    const pad = padNow()
    const area = { l: pad.l, r: eng.W - pad.r, t: pad.t, b: eng.H - pad.b }
    const mk = ensureMask()
    const key = mk.key + '|' + JSON.stringify([area, bm.sel, bm.hover, (model.cells || []).map((x) => [x.id, x.name, x.working, x.waiting])])
    if (key === labKey) return
    labKey = key
    const placed = []
    const svg = built.svg
    while (svg.firstChild) svg.removeChild(svg.firstChild)
    const items = [...built.things.values()].map((t) => {
      const q = lotOf(t.b)
      return { t, a: eng.project(q.x, 0, q.z), corners: [[-1, -1], [1, -1], [1, 1], [-1, 1]].map(([i, j]) => eng.project(q.x + i * 0.46, 0, q.z + j * 0.46)) }
    }).sort((x, y) => y.a.y - x.a.y)
    for (const { t, a, corners } of items) {
      const cell = cellOf(t.b.officeId)
      const lab = t.lab
      const w = cell.working || 0, q = cell.waiting || 0
      const first = String(cell.name).split(' ')[0]
      const forms = [
        '<b dir="auto">' + esc(cell.name) + '</b><em>· ' + fa(w) + '</em>' + (q ? '<u class="q" title="waiting for you">' + fa(q) + ' waiting</u>' : ''),
        '<b dir="auto">' + esc(first) + '</b><em>· ' + fa(w) + '</em>' + (q ? '<u class="q" title="waiting for you">' + fa(q) + '</u>' : ''),
      ]
      lab.className = 'c3lab' + (bm.sel === t.id ? ' sel' : '') + (bm.hover === t.id ? ' hov' : '')
      lab.style.setProperty('--c', cell.color)
      lab.setAttribute('aria-label', cell.name + ', ' + w + ' working now' + (q ? ', ' + q + ' waiting for you' : ''))
      lab.hidden = false
      let spot = null
      // a title near its lot first, the full form before the short one; then anywhere
      for (const [limit, fi] of [[110, 0], [190, 0], [110, 1], [1e9, 0], [1e9, 1]]) {
        lab.innerHTML = forms[fi]
        lab.style.visibility = 'hidden'; lab.style.left = '0px'; lab.style.top = '0px'
        const lw = lab.offsetWidth, lh = lab.offsetHeight
        for (const [dx, dy, cost] of OFFS) {
          if (cost > limit) break
          const cx = a.x + dx, cy = a.y + dy
          const b = { l: cx - lw / 2, r: cx + lw / 2, t: cy - lh / 2, b: cy + lh / 2 }
          if (b.l < area.l || b.r > area.r || b.t < area.t || b.b > area.b) continue
          if (placed.some((p) => rectsHit(p, { l: b.l - 4, r: b.r + 4, t: b.t - 4, b: b.b + 4 }))) continue
          if (mk.covers(b, 4)) continue
          spot = { b, cx, cy }; break
        }
        if (spot) break
      }
      if (!spot) { lab.hidden = true; continue }
      lab.style.left = spot.cx + 'px'; lab.style.top = spot.cy + 'px'; lab.style.visibility = ''
      placed.push(spot.b)
      // the leader ends at the corner of the lot nearest the title, so it never crosses its own building
      const corner = corners.slice().sort((p, r) => Math.hypot(p.x - spot.cx, p.y - spot.cy) - Math.hypot(r.x - spot.cx, r.y - spot.cy))[0]
      if (Math.hypot(spot.cx - corner.x, spot.cy - corner.y) > 34) {
        // only the parts of the leader that are over open floor are drawn: it never runs across a building
        const N = 48, pt = (k) => ({ x: corner.x + (spot.cx - corner.x) * k / N, y: corner.y + (spot.cy - corner.y) * k / N })
        const open = (k) => { const p = pt(k); return !mk.covers({ l: p.x - 1, r: p.x + 1, t: p.y - 1, b: p.y + 1 }, 0) }
        let from = -1
        for (let k = 0; k <= N + 1; k++) {
          const ok = k <= N && open(k)
          if (ok && from < 0) from = k
          if (!ok && from >= 0) {
            if (k - 1 > from) { const p0 = pt(from), p1 = pt(k - 1), ln = document.createElementNS('http://www.w3.org/2000/svg', 'line'); ln.setAttribute('x1', p0.x); ln.setAttribute('y1', p0.y); ln.setAttribute('x2', p1.x); ln.setAttribute('y2', p1.y); svg.appendChild(ln) }
            from = -1
          }
        }
        if (open(0)) { const dot = document.createElementNS('http://www.w3.org/2000/svg', 'circle'); dot.setAttribute('cx', corner.x); dot.setAttribute('cy', corner.y); dot.setAttribute('r', 2.5); svg.appendChild(dot) }
      }
    }
  }

  function overlay() {
    if (!built || !model) return
    if (outlines) outlines.visible = bm.on && editable()
    placeTitles()
    const on = built.things.get(bm.sel) || built.things.get(bm.hover)
    if (hl) { hl.visible = !!on; if (on) { const q = lotOf(on.b); hl.position.set(q.x, 0.06, q.z) } }
    const gl = $('c3ghost')
    if (gl && ghost && ghostLot) {
      const p = lotOf(ghostLot)
      const q = eng.project(p.x + 0.5, 0, p.z + 0.5) // under the lot, so it does not hide the titles behind it
      gl.style.left = q.x + 'px'; gl.style.top = q.y + 'px'
    }
  }

  function setMsg(text, bad, ms) {
    bm.msg = text; bm.bad = !!bad
    const el = $('c3msg')
    if (el) { el.textContent = text; el.className = 'c3msg' + (bad ? ' bad' : ''); el.hidden = !text }
    clearTimeout(msgT)
    if (text) msgT = setTimeout(() => setMsg('', false), ms || 3500)
  }

  function clearGhost() {
    if (ghost) { eng.scene.remove(ghost); ghost = null; ghostSig = '' }
    const gl = $('c3ghost'); if (gl) gl.remove()
    ghostLot = null
  }
  function showGhost(lot, type, rot, free, text) {
    const T3 = window.THREE
    const key = type + '|' + rot + '|' + (free ? 1 : 0)
    if (!ghost || ghostSig !== key) {
      if (ghost) eng.scene.remove(ghost)
      const g = new T3.Group()
      const b = K.building(type, '#3B6FE0', rot)
      b.traverse((o) => { if (o.material) { o.material = o.material.clone(); o.material.transparent = true; o.material.opacity = 0.68 } })
      g.add(b)
      const tile = new T3.Mesh(new T3.BoxGeometry(1.02, 0.05, 1.02), new T3.MeshBasicMaterial({ color: free ? '#3B6FE0' : '#D64545', transparent: true, opacity: 0.55 }))
      tile.position.y = 0.05
      g.add(tile)
      eng.scene.add(g)
      ghost = g; ghostSig = key
    }
    const p = lotOf(lot)
    ghost.position.set(p.x, 0.03, p.z)
    ghostLot = lot
    let gl = $('c3ghost')
    if (!gl) { gl = document.createElement('div'); gl.id = 'c3ghost'; eng.ov.appendChild(gl) }
    gl.className = 'c3gl' + (free ? '' : ' bad')
    gl.textContent = text
    eng.dirty()
  }

  // ---------- pointer
  function lotAt(px, py) {
    const g = eng.groundAt(px, py), c = model.campus.grid
    const x = Math.floor(g.x / PITCH + c.cols / 2), y = Math.floor(g.z / PITCH + c.rows / 2)
    return x >= 0 && x < c.cols && y >= 0 && y < c.rows ? { x, y } : null
  }
  const at = (e) => { const r = eng.canvas.getBoundingClientRect(); return [e.clientX - r.left, e.clientY - r.top] }
  const pickB = (px, py) => eng.pick(px, py, built ? [...built.things.values()].map((t) => t.group) : [])

  // the building the move tool carries: dragged, or picked up by a click
  const carried = () => (drag && drag.carry) || (bm.on && bm.tool === 'move' && !bm.type ? bm.sel : '')
  function updateGhost(px, py) {
    const buildMode = bm.on && editable()
    const mover = carried() && model.campus.buildings.find((b) => b.id === carried())
    const type = mover ? mover.type : buildMode ? bm.type : ''
    if (!type) { clearGhost(); return }
    const lot = lotAt(px, py)
    if (!lot) { clearGhost(); return }
    const taken = byLot().get(lot.x + ',' + lot.y)
    const free = !taken || (mover && taken.id === mover.id)
    showGhost(lot, type, mover ? mover.rot : bm.rot, free, free ? (mover ? 'Move ' + cellOf(mover.officeId).name + ' here' : typeOf(type).name + ' · click to place') : 'Lot taken: ' + cellOf(taken.officeId).name)
  }

  function onDown(e) {
    const [px, py] = at(e)
    const b = pickB(px, py)
    drag = { id: e.pointerId, x: e.clientX, y: e.clientY, on: false, pan: e.button === 1 || e.button === 2, b, carry: bm.on && editable() && bm.tool === 'move' && !bm.type && e.button === 0 && b ? b : '' }
    try { eng.canvas.setPointerCapture(e.pointerId) } catch (err) { /* a pointer that is gone */ }
  }
  function onMove(e) {
    const [px, py] = at(e)
    if (drag && drag.id === e.pointerId) {
      if (!drag.on && Math.hypot(e.clientX - drag.x, e.clientY - drag.y) > 5) drag.on = true
      // a drag pans; carrying a building with the move tool, it moves the ghost instead
      if (drag.on && !drag.carry) {
        userView = true
        eng.panPx(e.clientX - drag.x, e.clientY - drag.y)
        drag.x = e.clientX; drag.y = e.clientY
        eng.canvas.style.cursor = 'grabbing'
        return
      }
    }
    const b = pickB(px, py)
    if (b !== bm.hover) { bm.hover = b || ''; eng.canvas.style.cursor = b ? 'pointer' : 'default'; eng.dirty() }
    if (bm.on && editable()) updateGhost(px, py)
  }
  async function onUp(e) {
    if (!drag || drag.id !== e.pointerId) return
    const d = drag
    drag = null
    eng.canvas.style.cursor = bm.hover ? 'pointer' : 'default'
    if (d.on && !d.carry) return // it was a pan
    const [px, py] = at(e)
    const build = bm.on && editable()
    const b = pickB(px, py)
    if (!build) { if (b) go('office:' + model.campus.buildings.find((q) => q.id === b).officeId); return }
    const lot = lotAt(px, py)
    const taken = lot ? byLot().get(lot.x + ',' + lot.y) : null
    if (bm.type) {
      if (!lot) return
      if (taken) { setMsg('Lot taken: ' + cellOf(taken.officeId).name, true); return }
      await act({ op: 'place', type: bm.type, x: lot.x, y: lot.y, rot: bm.rot, name: freeName(typeOf(bm.type).name) })
      return
    }
    if (bm.tool === 'move') {
      const id = d.carry && d.on ? d.carry : bm.sel
      if (id && lot && (d.on || !b || b === id) && !(b === id && !d.on && !bm.sel)) {
        if (taken && taken.id !== id) { setMsg('Lot taken: ' + cellOf(taken.officeId).name, true); bm.sel = ''; clearGhost(); return }
        bm.sel = ''; clearGhost()
        if (taken && taken.id === id) return
        await act({ op: 'move', id, x: lot.x, y: lot.y })
        return
      }
      // a plain click picks a building up; the next click on a lot puts it down
      bm.sel = b || ''
      if (b) setMsg('Click a lot to move it there', false, 6000)
      eng.dirty()
      return
    }
    if (bm.tool === 'rotate') { if (b) await act({ op: 'rotate', id: b }); return }
    if (bm.tool === 'archive') { if (b) await archive(b); return }
    bm.sel = b || ''
    eng.dirty()
  }

  const freeName = (base) => {
    const names = new Set((model.cells || []).map((c) => c.name))
    if (!names.has(base)) return base
    for (let n = 2; n < 100; n++) if (!names.has(base + ' ' + n)) return base + ' ' + n
    return base
  }

  async function act(body) {
    try {
      const r = await post('api/campus', body)
      const res = r.result || r.gate || {}
      setMsg((res.summary || 'Saved').replace(/^./, (c) => c.toUpperCase()), false)
      bm.armed = ''
      await refresh()
    } catch (err) { setMsg(String(err && err.message || err), true, 5000) }
  }
  async function archive(id) {
    const b = model.campus.buildings.find((q) => q.id === id)
    if (!b) return
    if (bm.armed !== id) { bm.armed = id; bm.sel = id; setMsg('Click again to archive ' + cellOf(b.officeId).name + ' (its history stays)', false, 6000); eng.dirty(); return }
    bm.armed = ''; bm.sel = ''
    await act({ op: 'remove', id })
  }

  // ---------- buttons and keys (the page's own listeners, one set)
  document.addEventListener('click', (e) => {
    const t = e.target.closest && e.target.closest('[data-c3],[data-c3tool],[data-c3type]')
    if (!t || !model) return
    if (t.dataset.c3 === 'fit') { userView = false; fitView(); return }
    if (t.dataset.c3 === 'build') {
      bm.on = !bm.on; bm.type = ''; bm.tool = 'select'; bm.sel = ''; bm.armed = ''
      h.redraw ? h.redraw() : null
      return
    }
    if (t.dataset.c3tool) { bm.tool = t.dataset.c3tool; bm.type = ''; bm.sel = ''; bm.armed = ''; clearGhost(); h.redraw && h.redraw(); return }
    if (t.dataset.c3type) { bm.type = bm.type === t.dataset.c3type ? '' : t.dataset.c3type; bm.sel = ''; clearGhost(); h.redraw && h.redraw() }
  })
  document.addEventListener('keydown', (e) => {
    if (!model || !bm.on || !editable() || !$('c3stage')) return
    if (e.target && e.target.closest && e.target.closest('input,textarea,select,[contenteditable]')) return
    if (e.ctrlKey || e.metaKey || e.altKey) return
    const n = e.key >= '1' && e.key <= '9' ? Number(e.key) : 0
    if (n && model.campus.types[n - 1]) { const id = model.campus.types[n - 1].id; bm.type = bm.type === id ? '' : id; bm.sel = ''; clearGhost(); h.redraw && h.redraw() }
    else if (e.key === 'r' || e.key === 'R') {
      if (bm.type) { bm.rot = (bm.rot + 1) % 4; ghostSig = ''; if (ghostLot) { const l = ghostLot; updateGhostAtLot(l) } }
      else if (bm.sel) act({ op: 'rotate', id: bm.sel })
    } else if (e.key === 'Delete' || e.key === 'Backspace') { if (bm.sel) archive(bm.sel) }
    else if (e.key === 'v' || e.key === 'V') { bm.tool = 'select'; bm.type = ''; h.redraw && h.redraw() }
    else if (e.key === 'm' || e.key === 'M') { bm.tool = 'move'; bm.type = ''; h.redraw && h.redraw() }
    else if (e.key === 'Escape') { if (bm.type || bm.sel) { bm.type = ''; bm.sel = ''; clearGhost(); h.redraw && h.redraw() } else { bm.on = false; h.redraw && h.redraw() } }
    else return
    e.preventDefault()
  })
  function updateGhostAtLot(l) {
    const taken = byLot().get(l.x + ',' + l.y)
    showGhost(l, bm.type, bm.rot, !taken, !taken ? typeOf(bm.type).name + ' · click to place' : 'Lot taken: ' + cellOf(taken.officeId).name)
  }

  /** Mounts the persistent canvas into the freshly drawn stage. */
  function fit() {
    const st = $('c3stage')
    if (!st || !K || !model) return
    if (!ensure()) return
    if (eng.host.parentNode !== st) st.appendChild(eng.host)
    eng.resize()
    sig = built && eng.host.isConnected ? sig : ''
    rebuild()
    if (!built) return
    const pad = padNow()
    if (!userView && (eng.__pad !== JSON.stringify(pad) || eng.__w !== eng.W || eng.__h !== eng.H)) { eng.__pad = JSON.stringify(pad); eng.__w = eng.W; eng.__h = eng.H; eng.fit(pad) }
    eng.renderNow()
  }

  const info = () => ({
    on: !!eng, build: bm.on, type: bm.type, tool: bm.tool, sel: bm.sel, ghost: ghostLot,
    buildings: built ? [...built.things.values()].map((t) => ({ id: t.id, officeId: t.b.officeId, type: t.b.type, x: t.b.x, y: t.b.y, rot: t.b.rot, label: t.lab.hidden ? '' : t.lab.textContent, box: t.lab.hidden ? null : (() => { const r = t.lab.getBoundingClientRect(); return { l: r.left, t: r.top, r: r.right, b: r.bottom } })() })) : [],
    // the id of the building drawn at a viewport point (a ray, independent of the title mask), and the lot outlines' visibility
    buildingAt: (x, y) => { const r = eng.canvas.getBoundingClientRect(); return pickB(x - r.left, y - r.top) },
    outlines: !!(outlines && outlines.visible),
    // the pieces of the ground: one continuous checkerboard, so exactly one mesh that is not a building or an outline
    floorMeshes: built ? built.group.children.filter((o) => o.isMesh).length : 0,
    // anything else standing on the ground that is not a building, the lot outlines or the selection frame (a tree, say)
    loose: built ? built.group.children.filter((o) => !o.isMesh && o !== outlines && o !== hl && !(o.userData && o.userData.id)).length : 0,
    // the screen position of the middle of a lot (for tests that click)
    lotXY: (x, y) => { const q = lotOf({ x, y }), p = eng.project(q.x, 0.2, q.z), r = eng.canvas.getBoundingClientRect(); return [p.x + r.left, p.y + r.top] },
  })

  return { draw, fit, ST_COL, info, bm, engine: () => eng }
}

module.exports = { campusArt }
