/* ======================================================================
 * The campus (design C2): a building game board. Lots on a grid, one
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
  const tileIcon = (t) => (icons && icons[t.id] ? '<img src="' + icons[t.id] + '" width="64" height="52" alt="">' : '<svg viewBox="0 0 40 32" width="40" height="32" aria-hidden="true"><path d="M20 4l16 8-16 8-16-8z" fill="#cfd8c4"/></svg>')

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
    if (K && !icons) icons = K.icons(96, 78) || {}
    const build = bm.on && editable() && !!K
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
    K.loadModels(() => { sig = ''; if (model) rebuild() })
    return eng
  }

  const GROUND = '#D8CBB0', PAD = '#CFE4C6', PAD_EDGE = '#8DB58A'
  function rebuild() {
    if (!eng || !model) return
    const c = model.campus
    const next = JSON.stringify([c.grid, c.buildings, (model.cells || []).map((x) => [x.id, x.name, x.color])])
    if (next === sig) return
    sig = next
    const T3 = window.THREE
    if (built) { eng.scene.remove(built.group); built.group.traverse((o) => { if (o.geometry) o.geometry.dispose() }); built.labels.forEach((l) => l.remove()) }
    const group = new T3.Group()
    const { cols, rows } = c.grid
    const W = cols * PITCH, D = rows * PITCH
    K.box(group, W + 0.5, 0.22, D + 0.5, GROUND, 0, -0.22, 0)
    const lots = new Map(c.buildings.map((b) => [b.x + ',' + b.y, b]))
    for (let y = 0; y < rows; y++) for (let x = 0; x < cols; x++) {
      const px = (x - cols / 2 + 0.5) * PITCH, pz = (y - rows / 2 + 0.5) * PITCH
      K.box(group, 1, 0.03, 1, PAD, px, 0, pz)
      if (!lots.has(x + ',' + y)) {
        const e = new T3.LineSegments(new T3.EdgesGeometry(new T3.BoxGeometry(0.94, 0.001, 0.94)), new T3.LineDashedMaterial({ color: PAD_EDGE, dashSize: 0.07, gapSize: 0.05 }))
        e.computeLineDistances(); e.position.set(px, 0.035, pz); group.add(e)
      }
    }
    // trees on the verge, the same ones every time
    let seed = cols * 31 + rows * 17 + c.buildings.length
    const rnd = () => { seed = (seed * 1103515245 + 12345) & 0x7fffffff; return seed / 0x7fffffff }
    for (let i = 0; i < Math.min(14, 4 + cols + rows); i++) {
      const side = i % 4, t = rnd()
      const x = side === 0 ? -W / 2 - 0.22 : side === 1 ? W / 2 + 0.22 : (t - 0.5) * W
      const z = side === 2 ? -D / 2 - 0.22 : side === 3 ? D / 2 + 0.22 : (t - 0.5) * D
      group.add(K.tree(x, z, 0.8 + rnd() * 0.5))
    }
    const things = new Map(), labels = []
    for (const b of c.buildings) {
      const cell = cellOf(b.officeId)
      const g = K.building(b.type, cell.color, b.rot)
      const p = lotOf(b)
      g.position.set(p.x, 0.03, p.z)
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
      things.set(b.id, { id: b.id, group: g, b, lab })
    }
    hl = new T3.LineSegments(new T3.EdgesGeometry(new T3.BoxGeometry(1.04, 0.06, 1.04)), new T3.LineBasicMaterial({ color: '#2F6BE0' }))
    hl.visible = false
    group.add(hl)
    eng.scene.add(group)
    built = { group, things, labels, W, D }
    eng.bounds = { minx: -W / 2 - 0.4, maxx: W / 2 + 0.4, minz: -D / 2 - 0.4, maxz: D / 2 + 0.4, h: 1.2 }
    if (!userView) fitView()
    eng.dirty()
  }

  const padNow = () => (bm.on && editable() ? { l: 84, r: 24, t: 54, b: 150 } : { l: 24, r: 24, t: 56, b: 24 })
  function fitView() { if (eng && eng.bounds) { eng.resize(); eng.fit(padNow()) } }

  // ---------- labels (name, counts), the ghost, the highlights
  const rectsHit = (a, b) => a.l < b.r && a.r > b.l && a.t < b.b && a.b > b.t
  function overlay() {
    if (!built || !model) return
    const placed = []
    const items = [...built.things.values()].map((t) => {
      const p = eng.project(lotOf(t.b).x, 1.0, lotOf(t.b).z)
      return { t, p }
    }).sort((a, b) => b.p.y - a.p.y)
    for (const { t, p } of items) {
      const cell = cellOf(t.b.officeId)
      const full = '<b dir="auto">' + esc(cell.name) + '</b>' + (cell.working ? '<u class="w" title="working"><i></i>' + fa(cell.working) + '</u>' : '') + (cell.waiting ? '<u class="q" title="waiting for you"><i></i>' + fa(cell.waiting) + '</u>' : '')
      const lab = t.lab
      lab.className = 'c3lab' + (bm.sel === t.id ? ' sel' : '') + (bm.hover === t.id ? ' hov' : '')
      lab.style.setProperty('--c', cell.color)
      let form = 'full'
      for (const f of ['full', 'short']) {
        if (lab.dataset.form !== f || lab.dataset.k !== cell.name + '|' + cell.working + '|' + cell.waiting) { lab.innerHTML = f === 'full' ? full : '<b dir="auto">' + esc(cell.name) + '</b>'; lab.dataset.form = f; lab.dataset.k = cell.name + '|' + cell.working + '|' + cell.waiting }
        lab.style.left = p.x + 'px'; lab.style.top = p.y + 'px'
        const r = lab.getBoundingClientRect(), o = eng.host.getBoundingClientRect()
        const box = { l: r.left - o.left, r: r.right - o.left, t: r.top - o.top, b: r.bottom - o.top }
        if (!placed.some((q) => rectsHit(q, box))) { placed.push(box); form = f; lab.hidden = false; break }
        form = ''
      }
      if (!form) { lab.hidden = true }
    }
    const on = built.things.get(bm.sel) || built.things.get(bm.hover)
    if (hl) { hl.visible = !!on; if (on) { const q = lotOf(on.b); hl.position.set(q.x, 0.06, q.z) } }
    const gl = $('c3ghost')
    if (gl && ghost && ghostLot) {
      const p = lotOf(ghostLot)
      const q = eng.project(p.x, 1.25, p.z)
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
    buildings: built ? [...built.things.values()].map((t) => ({ id: t.id, officeId: t.b.officeId, type: t.b.type, x: t.b.x, y: t.b.y, rot: t.b.rot, label: t.lab.hidden ? '' : t.lab.textContent })) : [],
    // the screen position of the middle of a lot (for tests that click)
    lotXY: (x, y) => { const q = lotOf({ x, y }), p = eng.project(q.x, 0.2, q.z), r = eng.canvas.getBoundingClientRect(); return [p.x + r.left, p.y + r.top] },
  })

  return { draw, fit, ST_COL, info, bm, engine: () => eng }
}

module.exports = { campusArt }
