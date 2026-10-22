  // ---------- people on the move. Starting a task: from the lounge to the
  // supervisor (the task is handed over), then to the desk. Finishing: to the
  // supervisor (the report goes in the tray), then back to the lounge. The
  // page only says each person's state; the walks come from its changes, so
  // a redraw never restarts a walk, and a change halfway is taken from where
  // the person is. People walk the aisles between the stations: every route
  // runs from a station's corner of the aisles ("net" points) along one aisle
  // and then another.
  const SPEED = 1.5, PAUSE = { receive: 1.5, handin: 1.8 }
  let pace = 1
  const walkers = new Map() // podium id -> walker; kept through a rebuild, dropped with a change of office
  let walkersKey = ''
  const BUSY = new Set(['working', 'quiet'])
  // waiting: the run asked the owner something, so its person waits at the desk for the answer
  const restOf = (state) => (BUSY.has(state) || state === 'waiting' ? 'desk' : 'lounge')
  const floorY = (x, z) => (Math.abs(x) < SUP_S / 2 && Math.abs(z) < SUP_S / 2 ? DAIS : 0)
  const seatedTpl = (p) => { const t = tplFor(p.src); return !t || !!t.seated }
  const near = (a, b) => Math.abs(a.x - b.x) < 1e-3 && Math.abs(a.z - b.z) < 1e-3
  const wrapA = (a) => Math.atan2(Math.sin(a), Math.cos(a))
  function claim(list, taken, w, key) {
    if (w[key] >= 0 && taken.get(w[key]) === w.id) return w[key]
    const pref = w[key + 'Pref']
    let i = pref >= 0 && pref < list.length && !taken.has(pref) ? pref : list.findIndex((s, k) => !taken.has(k))
    if (i < 0) i = hash(w.id) % list.length // every place taken: two share one
    taken.set(i, w.id); w[key] = i; w[key + 'Pref'] = i
    return i
  }
  function release(w) {
    if (!O) return
    if (w.seat >= 0 && O.lounge.taken.get(w.seat) === w.id) O.lounge.taken.delete(w.seat)
    if (w.visit >= 0 && O.sup.taken.get(w.visit) === w.id) O.sup.taken.delete(w.visit)
    w.seat = -1; w.visit = -1
  }
  /** Where `loc` is for this walker: the corner of the aisles it is reached
   *  from, the way in from there, and the place itself (with the way to face). */
  function spot(w, loc) {
    const p = O.byId.get(w.id), seated = seatedTpl(p)
    if (loc === 'desk') return { exit: p.exit, inward: [p.front], final: seated ? p.sit : p.stand }
    if (loc === 'sup') return { exit: O.sup.exit, inward: [], final: O.sup.visits[claim(O.sup.visits, O.sup.taken, w, 'visit')] }
    const s = O.lounge.seats[claim(O.lounge.seats, O.lounge.taken, w, 'seat')]
    return { exit: s.exit, inward: s.inward, final: s.sofa && seated ? s.sit : s.front }
  }
  // from one corner of the aisles to another: along the first one's aisle, then along the other's
  function route(a, b) {
    if (near(a, b)) return []
    const bend = { x: b.x, z: a.z, net: true }
    return near(bend, a) || near(bend, b) ? [b] : [bend, b]
  }
  // the first corner of the aisles to make for when the plan changes halfway
  function headBack(w) {
    const ahead = w.path, k = ahead.findIndex((q) => q.net)
    if (w.lastNet && w.since.length) return w.since.slice().reverse().concat([w.lastNet]) // inside a station: back the way we came
    if (w.lastNet && k === 0) return [Math.hypot(w.pos.x - w.lastNet.x, w.pos.z - w.lastNet.z) < Math.hypot(w.pos.x - ahead[0].x, w.pos.z - ahead[0].z) ? w.lastNet : ahead[0]]
    if (w.lastNet) return [w.lastNet]
    if (k >= 0) return ahead.slice(0, k + 1) // still leaving a place: carry on to its corner
    const P2 = PITCH / 2
    return [{ x: Math.round((w.pos.x - P2) / PITCH) * PITCH + P2, z: Math.round((w.pos.z - P2) / PITCH) * PITCH + P2, net: true }]
  }
  function plan(w, loc) {
    let path
    if (w.path.length) path = headBack(w)
    else {
      // leaving a place the walker rests at: back out the way in
      const from = spot(w, w.loc)
      path = from.inward.slice().reverse().concat([from.exit])
      w.lastNet = null; w.since = []
    }
    release(w)
    const to = spot(w, loc)
    path = path.concat(route(path[path.length - 1], to.exit), to.inward, [to.final])
    // no point twice in a row, and none where the walker already stands
    w.path = path.filter((q, i) => !(i ? near(q, path[i - 1]) : near(q, w.pos)))
    if (!w.path.length) w.path = [to.final]
    w.goal = loc
    note(w, 'walk')
  }
  function note(w, what) { if (w.trail[w.trail.length - 1] !== what) { w.trail.push(what); if (w.trail.length > 24) w.trail.shift() } }
  function snap(w, loc) {
    release(w)
    w.loc = loc; w.goal = loc
    const f = spot(w, loc).final
    w.pos = { x: f.x, z: f.z }; w.rot = f.rot; w.head = f.rot
    w.path = []; w.queue = []; w.pause = 0; w.act = null; w.since = []; w.lastNet = null
    note(w, loc)
  }
  function go(w) {
    const g = w.queue[0]
    if (!g) return
    if (!w.path.length && w.pause <= 0 && w.loc === g.loc) arrived(w)
    else plan(w, g.loc)
  }
  function arrived(w) {
    const g = w.queue[0]
    if (!g || g.loc !== w.loc) return
    if (g.act && !w.act) { w.act = g.act; w.pause = PAUSE[g.act]; note(w, g.act); paperFly(w, g.act); return }
    w.act = null; w.queue.shift()
    if (w.queue.length) go(w)
  }
  function setQueue(w, goals) { w.queue = goals; w.pause = 0; w.act = null; go(w) }
  function newWalker(id) { return { id, pos: { x: 0, z: 0 }, rot: 0, head: 0, loc: '', goal: '', path: [], queue: [], pause: 0, act: null, since: [], lastNet: null, seat: -1, visit: -1, seatPref: -1, visitPref: -1, trail: [], h: 1.2, rebuilt: false } }
  function syncWalker(p, src) {
    let w = walkers.get(p.id)
    if (!src.present) { if (w) { release(w); walkers.delete(p.id) } p.w = null; return }
    if (!w) { w = newWalker(p.id); walkers.set(p.id, w); w.state = src.state; snap(w, restOf(src.state)) }
    p.w = w
    if (w.rebuilt) {
      // the room was built again: a walker on the way plans again from where it is, one at rest takes its (new) place
      w.rebuilt = false
      if (w.path.length) plan(w, w.goal)
      else { const f = spot(w, w.loc).final; w.pos = { x: f.x, z: f.z }; w.rot = f.rot }
    }
    if (src.state === w.state) return
    const was = w.state
    w.state = src.state
    if (h.calm && h.calm()) { snap(w, restOf(src.state)); return }
    if (BUSY.has(src.state) && !BUSY.has(was)) setQueue(w, [{ loc: 'sup', act: 'receive' }, { loc: 'desk' }])
    else if (!BUSY.has(src.state) && BUSY.has(was)) setQueue(w, [{ loc: 'sup', act: 'handin' }, { loc: restOf(src.state) }])
    else if (!w.queue.length ? w.loc !== restOf(src.state) : w.queue[w.queue.length - 1].loc !== restOf(src.state)) setQueue(w, [{ loc: restOf(src.state) }])
  }
  // the sheet that changes hands at the supervisor's desk
  function paperFly(w, act) {
    if (h.calm && h.calm()) return
    const f = w.rot || 0, hand = new T3.Vector3(w.pos.x + Math.sin(f) * 0.32, DAIS + 1.0, w.pos.z + Math.cos(f) * 0.32)
    const tray = O.byId.get([...O.byId.keys()].find((id) => O.byId.get(id).kind === 'tray') || '')
    const into = O.sup.trayAt.clone().add(new T3.Vector3(0, 0.05 + Math.min((tray && tray.src.count) || 0, TRAY_MAX) * 0.016, 0))
    fly = act === 'handin' ? { from: hand, to: into, t: 0, d: 1.2 } : { from: O.sup.hand.clone(), to: hand, t: 0, d: 1.0 }
  }
  function stepWalker(w, dt) {
    if (w.pause > 0) {
      w.pause -= dt * pace
      if (w.pause <= 0) { w.pause = 0; arrived(w) }
      return false
    }
    if (!w.path.length) return false
    let d = SPEED * pace * dt
    while (d > 0 && w.path.length) {
      const q = w.path[0], dx = q.x - w.pos.x, dz = q.z - w.pos.z, L = Math.hypot(dx, dz)
      if (L > 1e-4) w.head = Math.atan2(dx, dz)
      if (L <= d) {
        w.pos.x = q.x; w.pos.z = q.z; d -= L; w.path.shift()
        if (q.net) { w.lastNet = q; w.since = [] } else w.since.push(q)
        if (!w.path.length) { w.loc = w.goal; w.rot = q.rot !== undefined ? q.rot : w.head; note(w, w.loc); arrived(w) }
      } else { w.pos.x += dx / L * d; w.pos.z += dz / L * d; d = 0 }
    }
    return true
  }

  // ---------- the labels (html over the canvas): one small pill over each head
  // A status dot, the name, and a status word; no portrait. The page says which
  // tone the pill has (working, waiting, quiet, stalled, dead, free) and what it
  // reads; a click on it selects the person like a click on the figure.
  const cards = new Map()
  const TRAY_ICON = '<svg viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2.4" aria-hidden="true"><path d="M3 13h5l1.5 3h5L16 13h5v6H3zM6 13l2-8h8l2 8"/></svg>'
  function syncCards(model) {
    const seen = new Set()
    for (const src of model.podiums) {
      seen.add(src.id)
      let c = cards.get(src.id)
      if (!c) {
        c = { el: document.createElement('button'), key: '' }
        c.el.type = 'button'
        // the tray's count sits on the tray itself, never over a head
        c.el.dataset.anchor = src.id; c.el.dataset.at = src.kind === 'tray' ? 'tray' : 'pill'
        cards.set(src.id, c)
        cardsEl.appendChild(c.el)
      }
      const glb = templates.has(src.agent)
      const pill = src.pill || { tone: 'idle', word: '' }
      const k = [src.state, src.name, pill.tone, pill.word, src.attrs, src.aria, src.present, model.selected === src.id, glb, src.count].join('|')
      if (k === c.key) continue
      c.key = k
      const el = c.el
      // the page's own attributes (data-key, data-open, …) say what a click does there
      for (const a of [...el.attributes]) if (/^data-(?!anchor$|at$)/.test(a.name)) el.removeAttribute(a.name)
      const tmp = document.createElement('div'); tmp.innerHTML = '<i ' + (src.attrs || '') + '></i>'
      for (const a of [...tmp.firstChild.attributes]) if (/^data-/.test(a.name)) el.setAttribute(a.name, a.value)
      el.className = 'w3card tone-' + (src.kind === 'tray' ? 'tray' : pill.tone) + ' st-' + src.state + (src.kind === 'tray' ? ' tray' : '') + (model.selected === src.id ? ' sel' : '') + (src.state === 'away' ? ' away' : '') + (src.present === false && src.kind !== 'tray' ? ' absent' : '') + (glb ? ' glb' : '') + (src.kind === 'tray' ? ' badge' + (src.count ? '' : ' off') : '')
      el.setAttribute('aria-label', src.aria || src.name || '')
      // one line (owner, 1.2): the dot and the name; the status word is the tooltip. The tray shows
      // only its count, and nothing at all while it is 0 ("0 reports handed in" is never drawn)
      el.title = src.kind === 'tray' ? src.name || '' : pill.word || ''
      el.innerHTML = src.kind === 'tray' ? '<span class="ic">' + TRAY_ICON + '</span><b>' + esc(h.digits ? h.digits(src.count || 0) : String(src.count || 0)) + '</b>'
        : '<i class="dot" aria-hidden="true"></i><b dir="auto">' + esc(src.name || '') + '</b>'
    }
    for (const [id, c] of cards) if (!seen.has(id)) { c.el.remove(); cards.delete(id) }
  }

  // ---------- the project screens on the side wall: the projects that had
  // work today, as the page lists them ({ title, lines: [text], bad })
  function syncBoards(list) {
    const sig = JSON.stringify(list || [])
    if (!O || sig === O.boardSig) return
    O.boardSig = sig
    if (O.boards) { O.group.remove(O.boards); O.boards.traverse((o) => { if (o.material && o.material.map) { o.material.map.dispose(); o.material.dispose() } }) }
    const g = new T3.Group(), r = O.r
    const items = list && list.length ? list.slice(0, 3) : [{ title: T('No project work today'), lines: [], quiet: true }]
    const z0 = r.za + 0.6, z1 = r.zb - 0.4, step = (z1 - z0) / items.length
    items.forEach((b, i) => {
      const z = z0 + step * (i + 0.5), x = r.X0
      mesh(G.rbox(0.05, 1.42, 2.46, 0.02), mat('#2F343B'), x + 0.03, 1.6, z, g)
      const lines = [{ text: b.title || '', size: 104, color: b.quiet ? '#7A8591' : '#17212B', y: b.lines && b.lines.length ? 140 : 288 }]
      ;(b.lines || []).slice(0, 2).forEach((l, k) => lines.push({ text: l, size: 72, bold: false, color: k === 1 && b.bad ? '#B91C1C' : '#4A5663', y: 300 + k * 110 }))
      const tex = textTex(lines, { w: 1024, h: 576, bg: '#FFFFFF', align: 'left', pad: 56 })
      const sc = new T3.Mesh(geo('board', () => new T3.PlaneGeometry(2.34, 1.32)), new T3.MeshBasicMaterial({ map: tex, toneMapped: false }))
      sc.position.set(x + 0.06, 1.6, z); sc.rotation.y = Math.PI / 2
      g.add(sc)
      // the screen's own colour bar along the top
      mesh(G.box(0.01, 0.06, 2.34), mat(b.bad ? '#E07F5C' : b.quiet ? '#C3CCD5' : '#7FB58E'), x + 0.065, 2.24, z, g)
    })
    O.boards = g
    O.group.add(g)
  }

  // ---------- placing the html labels over the 3D points
  const _v = new T3.Vector3()
  let ovDirty = true, declutterT = 0
  function anchorPoint(el) {
    const p = O && O.byId.get(el.dataset.anchor)
    if (!p) return null
    const at = el.dataset.at
    // 'pill': just over the person's head, wherever they are now; with no figure yet, over the desk
    if (at === 'pill') {
      if (p.ch) { const hp = p.ch.holder.position; return _v.set(hp.x, hp.y + (p.w ? p.w.h : p.ch.height) + 0.18, hp.z) }
      return p.kind === 'lead' ? _v.set(p.x - 0.55, 2.0, p.z - 1.0) : _v.set(p.x - p.S * 0.14, 1.7, p.z - p.S * 0.14)
    }
    if (at === 'card') return p.kind === 'tray' ? _v.set(p.x + 0.35, 1.75, p.z + 0.35) : p.kind === 'lead' ? _v.set(p.x - 0.55, 2.6, p.z - 1.0) : _v.set(p.x - p.S * 0.14, 1.95, p.z - p.S * 0.14)
    if (at === 'tray') return _v.set(p.x, 1.25, p.z)
    // 'who': the person, wherever they are now
    if (at === 'who') { if (!p.ch) return null; const hp = p.ch.holder.position; return _v.set(hp.x, hp.y + (p.w ? p.w.h : p.ch.height) + 0.4, hp.z) }
    if (at === 'mid') {
      const q = O.byId.get(el.dataset.anchor2)
      if (!q) return null
      return _v.set((p.x + q.x) / 2, 1.7, (p.z + q.z) / 2)
    }
    // 'head': just above the person
    const sp = p.sit || { x: p.x, z: p.z }
    return _v.set(sp.x, (p.ch ? p.ch.height : 1.4) + 0.55, sp.z)
  }
  function placeOverlay() {
    if (!O) return
    const zoomRel = view.zoom / (overview ? overview.zoom : 1)
    ov.style.setProperty('--bs', clamp(0.9 + (zoomRel - 1) * 0.22, 0.82, 1.25).toFixed(3))
    for (const el of ov.querySelectorAll('[data-anchor]')) {
      const pt = anchorPoint(el)
      if (!pt) { el.style.display = 'none'; continue }
      pt.project(cam)
      const x = (pt.x + 1) / 2 * W, y = (1 - pt.y) / 2 * H
      el.style.display = pt.z > 1 || x < -200 || x > W + 200 || y < -200 || y > H + 300 || el.classList.contains('off') ? 'none' : ''
      el.style.left = x.toFixed(1) + 'px'; el.style.top = y.toFixed(1) + 'px'
      el.classList.toggle('dim', !!focusId && el.dataset.anchor !== focusId && el.classList.contains('w3card'))
    }
    clearTimeout(declutterT)
    declutterT = setTimeout(declutter, 120)
  }
  // A speech bubble that would cover a card or a more important bubble
  // shrinks to its name tag, and with no room even for that it waits out of
  // sight; the card still says the person is working. The selected one always shows.
  // Pills that would touch step up, one pill-height at a time, until they clear. The
  // selected one stays put, then the ones lower on the screen (nearer the viewer).
  // A free or finished person's pill waits out of sight until hovered, focused or selected, and takes no room.
  const stepsBack = (c) => c.classList.contains('tone-idle') && !c.classList.contains('sel') && !c.classList.contains('hov') && c !== document.activeElement
  /** Every head on the screen, as a box no pill may cover (the person's own pill hangs just above it). */
  function headBoxes() {
    if (!O) return []
    const r0 = ov.getBoundingClientRect(), out = []
    for (const p of O.byId.values()) {
      if (!p.ch || p.kind === 'tray') continue
      const hp = p.ch.holder.position, top = hp.y + (p.w ? p.w.h : p.ch.height)
      _v.set(hp.x, top, hp.z).project(cam)
      const x = (_v.x + 1) / 2 * W + r0.left, y0 = (1 - _v.y) / 2 * H + r0.top
      _v.set(hp.x, top - 0.34, hp.z).project(cam)
      const y1 = (1 - _v.y) / 2 * H + r0.top, hw = Math.max(5, (y1 - y0) * 0.55)
      out.push({ id: p.id, left: x - hw, right: x + hw, top: y0, bottom: y1 })
    }
    return out
  }
  function liftPills() {
    const all = [...cardsEl.children].filter((c) => c.classList.contains('w3card') && c.style.display !== 'none')
    for (const e of all) { e.style.marginTop = ''; e.classList.remove('w3gone') }
    // close pills of one state become a counter chip, and the showcase keeps the four most urgent
    if (h.crowd) h.crowd(cardsEl, all.filter((c) => !stepsBack(c)), () => { clearTimeout(declutterT); declutterT = setTimeout(declutter, 30) })
    const els = [...cardsEl.children].filter((c) => c.style.display !== 'none' && !c.classList.contains('w3in') && (c.classList.contains('w3chip') || !stepsBack(c)))
    // a pill lifted up under the office strip would sit on text: it waits out of sight (the person
    // still shows in the lounge and the list); the selected one always shows
    const floorTop = ov.getBoundingClientRect().top + ((h.pad && h.pad.top) || 0)
    const list = els.map((e) => ({ e, r: e.getBoundingClientRect() }))
    list.sort((a, b) => (b.e.classList.contains('sel') - a.e.classList.contains('sel')) || b.r.bottom - a.r.bottom)
    // the heads are there first: a pill steps up past any head it would cover
    const placed = headBoxes()
    for (const q of list) {
      let top = q.r.top, bottom = q.r.bottom, lift = 0
      for (let i = 0; i < 16; i++) {
        const hit = placed.find((p) => q.r.left < p.right - 1 && q.r.right > p.left + 1 && top < p.bottom - 1 && bottom > p.top + 1)
        if (!hit) break
        const d = bottom - hit.top + 2
        top -= d; bottom -= d; lift += d
      }
      if (lift) q.e.style.marginTop = (-lift).toFixed(1) + 'px'
      if (top < floorTop && !q.e.classList.contains('sel')) q.e.classList.add('w3gone')
      placed.push({ left: q.r.left, right: q.r.right, top, bottom })
    }
  }
  function declutter() {
    liftPills()
    // a bubble hangs off its own card, so that card never counts against it
    const placed = [...cardsEl.children].filter((c) => c.style.display !== 'none').map((c) => ({ r: c.getBoundingClientRect(), id: c.dataset.anchor }))
    const hit = (r, id) => placed.some(({ r: p, id: o }) => o !== id && r.left < p.right - 2 && r.right > p.left + 2 && r.top < p.bottom - 2 && r.bottom > p.top + 2)
    const bubs = [...pageEl.querySelectorAll('.bub[data-anchor]')].filter((b) => b.style.display !== 'none')
    bubs.sort((a, b) => Number(b.dataset.prio || 0) - Number(a.dataset.prio || 0))
    // a bubble that would run past the edge of the floor hangs on the card's other side
    const edge = ov.getBoundingClientRect()
    const out = (r) => r.right > edge.right - 4
    for (const b of bubs) {
      b.classList.remove('mini', 'w3gone', 'w3flip')
      if (out(b.getBoundingClientRect())) b.classList.add('w3flip')
      const id = b.dataset.anchor
      if (b.classList.contains('sel') || !hit(b.getBoundingClientRect(), id)) { placed.push({ r: b.getBoundingClientRect() }); continue }
      b.classList.add('mini')
      if (hit(b.getBoundingClientRect(), id)) b.classList.add('w3gone')
      else placed.push({ r: b.getBoundingClientRect() })
    }
  }

  // ---------- picking, pan, orbit, zoom
  const ray = new T3.Raycaster(), ndc = new T3.Vector2()
  function pickAt(cx, cy) {
    if (!O) return null
    const r = cvs.getBoundingClientRect()
    ndc.set((cx - r.left) / r.width * 2 - 1, -((cy - r.top) / r.height) * 2 + 1)
    ray.setFromCamera(ndc, cam)
    const hitObj = ray.intersectObjects(O.pick, false)[0]
    return hitObj ? O.byId.get(hitObj.object.userData.id) : null
  }
  let hovId = null
  function showHover(p, col) {
    // a free or finished person shows the name only while hovered (or focused, or selected): see .w3card.tone-idle
    const id = p ? p.id : null
    if (id !== hovId) {
      for (const c of cardsEl.querySelectorAll('.w3card.hov')) c.classList.remove('hov')
      const c = id && cards.get(id)
      if (c) c.el.classList.add('hov')
      hovId = id
      ovDirty = true; clearTimeout(declutterT); declutterT = setTimeout(declutter, 60)
    }
    if (!p) { hovRing.visible = false; return }
    hovRing.visible = true; hovRing.geometry = podRing(p.S, 0.05); hovRing.position.set(p.x, p.ringY - 0.001, p.z); hovRing.material.color.set(col || '#94a3b8')
  }
  function panBy(dx, dy) {
    const upp = (FR / view.zoom) / H
    const right = new T3.Vector3(Math.cos(view.azim), 0, -Math.sin(view.azim)), fwd = new T3.Vector3(-Math.sin(view.azim), 0, -Math.cos(view.azim))
    view.target.addScaledVector(right, -dx * upp).addScaledVector(fwd, dy * upp / Math.sin(view.elev))
    clampTarget(); applyCam(); viewChanged(true)
  }
  function clampTarget() {
    if (!O) return
    const b = O.bounds, m = 4
    view.target.x = clamp(view.target.x, b.minX - m, b.maxX + m); view.target.z = clamp(view.target.z, b.minZ - m, b.maxZ + m)
  }
  const zMin = () => (overview ? overview.zoom * 0.45 : 0.2), zMax = () => (overview ? Math.max(4.5, overview.zoom * 6) : 4.5)
  function zoomBy(f) { tween = null; view.zoom = clamp(view.zoom * f, zMin(), zMax()); applyCam(); viewChanged(true) }
  let drag = null
  cvs.addEventListener('pointerdown', (e) => {
    if (e.button !== 0 && e.button !== 1 && e.button !== 2) return
    drag = { x: e.clientX, y: e.clientY, b: e.button, moved: false, az: view.azim, el: view.elev, t: view.target.clone(), shift: e.shiftKey }
    cvs.setPointerCapture(e.pointerId); tween = null
  })
  cvs.addEventListener('pointermove', (e) => {
    if (!drag) { const p = pickAt(e.clientX, e.clientY); cvs.style.cursor = p ? 'pointer' : 'grab'; showHover(p); return }
    const dx = e.clientX - drag.x, dy = e.clientY - drag.y
    if (Math.hypot(dx, dy) > 4) drag.moved = true
    if (!drag.moved) return
    if (drag.b === 2 || drag.shift) {
      view.azim = clamp(drag.az - dx * 0.006, VIEW0.azim - 1.0, VIEW0.azim + 1.0); view.elev = clamp(drag.el + dy * 0.004, 0.38, 1.1)
      applyCam(); viewChanged(true)
    } else {
      view.target.copy(drag.t); panBy(dx, dy)
    }
    cvs.style.cursor = 'grabbing'
  })
  cvs.addEventListener('pointerup', (e) => {
    if (drag && !drag.moved && drag.b === 0) {
      const p = pickAt(e.clientX, e.clientY)
      if (p) { focus(p.id); if (h.onPick) h.onPick(p.id, p.src) }
    }
    drag = null; cvs.style.cursor = 'grab'
  })
  cvs.addEventListener('pointerleave', () => { if (!drag) showHover(null) })
  cvs.addEventListener('contextmenu', (e) => e.preventDefault())
  cvs.addEventListener('wheel', (e) => { e.preventDefault(); e.stopPropagation(); zoomBy(Math.exp(-Math.max(-60, Math.min(60, e.deltaY)) * (e.ctrlKey ? 0.008 : 0.0016))) }, { passive: false })
  // a click on a card flies there too; the page's own handler selects
  ov.addEventListener('click', (e) => { const c = e.target.closest('.w3card'); if (c && c.dataset.anchor) focus(c.dataset.anchor) })
  cvs.addEventListener('webglcontextlost', (e) => { e.preventDefault(); if (h.onLost) h.onLost() })

  // ---------- your own characters: drag a .glb onto a desk, or pick one
  let toastT = 0
  function toast(msg, bad) {
    toastEl.textContent = msg; toastEl.classList.toggle('bad', !!bad); toastEl.classList.add('on')
    clearTimeout(toastT); toastT = setTimeout(() => toastEl.classList.remove('on'), 3200)
  }
  let lastModel = null
  async function useFile(agent, buf, name) {
    try {
      await addTemplate(agent, buf, name, 'dropped')
      idbPut(agent, { name, buf })
      refreshCharacters()
      toast(agent + T(' now uses ') + name)
    } catch (err) {
      toast(T('Could not read ') + name, true)
    }
  }
  function refreshCharacters() {
    if (!O) return
    for (const p of O.byId.values()) if (!p.ch || p.charSig !== charSigOf(p.src)) placeCharacter(p)
    if (lastModel) { for (const c of cards.values()) c.key = ''; syncCards(lastModel) }
    ovDirty = true
  }
  let pickFor = ''
  fileIn.addEventListener('change', async () => {
    const f = fileIn.files && fileIn.files[0]
    if (f && pickFor) await useFile(pickFor, await f.arrayBuffer(), f.name)
    fileIn.value = ''
  })
  document.addEventListener('click', (e) => {
    const l = e.target.closest && e.target.closest('[data-w3load],[data-w3reset]')
    if (!l) return
    if (l.dataset.w3load) { pickFor = l.dataset.w3load; fileIn.click() }
    else { templates.delete(l.dataset.w3reset); idbDel(l.dataset.w3reset); const b = (h.characters && h.characters.byAgent) || {}; if (b[l.dataset.w3reset]) addTemplate(l.dataset.w3reset, fromB64(b[l.dataset.w3reset]), l.dataset.w3reset + '.glb', 'file').then(refreshCharacters); else refreshCharacters() }
  })
  let dragDepth = 0
  const isFileDrag = (e) => e.dataTransfer && [...(e.dataTransfer.types || [])].includes('Files')
  host.addEventListener('dragenter', (e) => { if (!isFileDrag(e)) return; dragDepth++; dropEl.classList.add('on') })
  host.addEventListener('dragleave', (e) => { if (!isFileDrag(e)) return; dragDepth = Math.max(0, dragDepth - 1); if (!dragDepth) { dropEl.classList.remove('on'); showHover(null) } })
  host.addEventListener('dragover', (e) => { if (!isFileDrag(e)) return; e.preventDefault(); e.dataTransfer.dropEffect = 'copy'; const p = pickAt(e.clientX, e.clientY); showHover(p && p.src.agent ? p : null, '#2563eb') })
  host.addEventListener('drop', async (e) => {
    if (!isFileDrag(e)) return
    e.preventDefault(); dragDepth = 0; dropEl.classList.remove('on'); showHover(null)
    const f = [...(e.dataTransfer.files || [])].find((x) => /\.glb$/i.test(x.name))
    if (!f) return toast(T('Only .glb files can be dropped'), true)
    const p = pickAt(e.clientX, e.clientY)
    if (!p || !p.src.agent) return toast(T('Drop the .glb onto a desk with a person'), true)
    await useFile(p.src.agent, await f.arrayBuffer(), f.name)
  })
  /** The inspector's "Character" box for one person. */
  function characterBox(agent) {
    const own = templates.get(agent)
    const ch = O && [...O.byId.values()].find((p) => p.src.agent === agent && p.ch)
    const tpl = own || (ch ? ch.tpl : templates.get(''))
    if (!tpl) return ''
    const map = ch ? Object.entries(ch.ch.map).map(([k, v]) => T(k) + ' → ' + (v || '—')).join(' · ') : ''
    // no file of the person's own: one of the shipped set (KayKit), picked by the person's look
    const src = !own ? T('One of the shipped characters') : own.source === 'dropped' ? T('remembered in this browser') : T('from the characters folder')
    return '<h3 class="sect">' + T('Character') + '</h3><div class="w3box"><div class="h"><b dir="ltr">' + esc(tpl.name) + '</b><span class="dim">' + src + '</span></div>' +
      (map ? '<div class="map" dir="ltr">' + esc(map) + '</div>' : '') +
      '<div class="acts"><button type="button" data-w3load="' + esc(agent) + '">' + T('Load .glb…') + '</button>' +
      (own && own.source === 'dropped' ? '<button type="button" data-w3reset="' + esc(agent) + '">' + T('Use default') + '</button>' : '') + '</div></div>'
  }

  // ---------- sync: called by every redraw of the page
  let sig = ''
  function sync(model) {
    lastModel = model
    const s = layoutSig(model)
    const officeChanged = !O || O.key !== model.key
    if (s !== sig) {
      sig = s
      build(model)
      if (officeChanged) {
        const v = model.view
        if (v && [v.tx, v.ty, v.tz, v.azim, v.elev, v.zoom].every((n) => typeof n === 'number' && isFinite(n))) { setView(v); view.auto = v.auto !== false } else fit(false)
        focusId = null
      } else if (view.auto) fit(false) // a new podium joins a view nobody moved: keep the whole office in it
    }
    // what changes on every poll: the state, the clip, the tray, the selection
    for (const src of model.podiums) {
      const p = O.byId.get(src.id)
      p.src = src
      if ((!!p.ch) !== (!!src.present) || (p.ch && p.charSig !== charSigOf(src))) placeCharacter(p)
      if (p.kind === 'desk') syncWalker(p, src)
      else if (p.ch) playState(p.ch, src.anim === 'celebrate' && p.ch.tpl.seated ? 'idle' : src.anim || 'idle')
      if (p.pb) {
        const col = STATE_COL[src.state] || STATE_COL.none
        p.pb.material.color.set(col); p.pb.material.emissive.set(col)
        p.pb.visible = !!p.ch
      }
      if (p.trayAt) {
        const n = Math.min(src.count || 0, TRAY_MAX), m4 = new T3.Matrix4(), q = new T3.Quaternion(), e = new T3.Euler()
        for (let i = 0; i < n; i++) { e.set(0, (i % 3 - 1) * 0.07, 0); q.setFromEuler(e); m4.compose(new T3.Vector3(p.trayAt.x + (i % 2 ? 0.012 : -0.01), p.trayAt.y + i * 0.016, p.trayAt.z + (i % 3 - 1) * 0.01), q, new T3.Vector3(1, 1, 1)); trayPapers.setMatrixAt(i, m4) }
        trayPapers.count = n; trayPapers.instanceMatrix.needsUpdate = true
      }
    }
    for (const id of [...walkers.keys()]) if (!O.byId.has(id)) { release(walkers.get(id)); walkers.delete(id) }
    trayPapers.visible = model.podiums.some((p) => p.kind === 'tray')
    const sel = model.selected && O.byId.get(model.selected)
    selRing.visible = !!sel
    if (sel) { selRing.geometry = podRing(sel.S, 0.05); selRing.position.set(sel.x, sel.ringY, sel.z) }
    syncBoards(model.boards)
    // delegation: a dashed arc from the one who handed the work over to the one doing it
    const ls = (model.links || []).filter(([a, b]) => O.byId.has(a) && O.byId.has(b)).map((l) => l.join('>')).join(',') + '|' + sig
    if (ls !== linkSig) {
      linkSig = ls
      if (links) { scene.remove(links); links.children.forEach((l) => l.geometry.dispose()) }
      links = new T3.Group()
      for (const [a, b] of (model.links || [])) {
        const p = O.byId.get(a), q = O.byId.get(b)
        if (!p || !q) continue
        const pts = []
        for (let i = 0; i <= 24; i++) { const t = i / 24; pts.push(new T3.Vector3(lerp(p.x, q.x, t), 1.1 + Math.sin(t * Math.PI) * 1.4, lerp(p.z, q.z, t))) }
        const l = new T3.Line(new T3.BufferGeometry().setFromPoints(pts), linkMat); l.computeLineDistances(); links.add(l)
      }
      scene.add(links)
    }
    // a report handed in: the sheet flies when its person reaches the supervisor (paperFly), so model.fly is not used
    syncCards(model)
    pageEl.innerHTML = model.overlay || ''
    projEl.innerHTML = model.projects || ''
    ovDirty = true
  }

  // ---------- the loop: about 30 frames a second while the window has the
  // focus, 8 when it does not (a dashboard left open all day in a corner),
  // nothing while hidden. A camera flight or a drag always runs at full rate.
  let last = performance.now(), lastDraw = 0, running = false, mounted = null
  function frame(now) {
    if (!running) return
    requestAnimationFrame(frame)
    if (document.hidden || !mounted || !mounted.offsetParent) { last = now; return }
    if (now - lastDraw < (document.hasFocus() ? 30 : 120) * (soft ? 3 : 1) && !tween && !drag) return
    const rdt = (now - last) / 1000, dt = Math.min(0.05, rdt)
    last = now; lastDraw = now
    if (tween) {
      tween.t += dt / tween.d
      const e = tween.t >= 1 ? 1 : 1 - Math.pow(1 - tween.t, 3), f = tween.from, g = tween.to
      view.target.set(lerp(f.tx, g.tx, e), lerp(f.ty, g.ty, e), lerp(f.tz, g.tz, e)); view.azim = lerp(f.azim, g.azim, e); view.elev = lerp(f.elev, g.elev, e); view.zoom = lerp(f.zoom, g.zoom, e)
      applyCam()
      if (tween.t >= 1) { tween = null; viewChanged(false) }
    }
    const calm = h.calm && h.calm()
    if (O) {
      // the walkers move by the real time that passed, not by the capped animation step
      const wdt = Math.min(0.5, rdt)
      for (const p of O.byId.values()) {
        const w = p.w
        if (p.ch && w) {
          if (stepWalker(w, wdt)) ovDirty = true
          // standing at the bar is "stand", on a sofa "idle" (seated); a report handed in as "done" is cheered once
          const sofa = w.loc === 'lounge' && w.seat >= 0 && O.lounge.seats[w.seat] && O.lounge.seats[w.seat].sofa
          const clip = w.path.length ? 'walk' : w.act === 'handin' && p.src.state === 'done' ? 'celebrate' : w.pause > 0 || w.loc === 'sup' ? 'stand' : w.loc === 'desk' ? (p.src.anim === 'celebrate' ? 'idle' : p.src.anim || 'idle') : w.loc === 'lounge' && !sofa ? 'stand' : 'idle'
          playState(p.ch, clip)
          const hp = p.ch.holder
          hp.position.set(w.pos.x, floorY(w.pos.x, w.pos.z), w.pos.z)
          const want = w.path.length ? w.head : w.rot
          hp.rotation.y = calm ? want : hp.rotation.y + wrapA(want - hp.rotation.y) * Math.min(1, wdt * 9)
          w.h = clip === 'walk' || clip === 'stand' || clip === 'celebrate' || !p.ch.tpl.seated ? p.ch.standH : p.ch.height
        }
        if (p.ch && !calm) p.ch.mixer.update(dt)
        if (p.pb) {
          const hp = p.ch ? p.ch.holder.position : { x: p.x, y: 0, z: p.z }
          p.pb.position.set(hp.x, hp.y + (p.w ? p.w.h : p.ch ? p.ch.height : 1.4) + 0.3 + (calm ? 0 : Math.sin(now / 450 + hash(p.id) % 7) * 0.03), hp.z)
          if (!calm) p.pb.rotation.y += dt * 1.1
        }
      }
    }
    if (fly) {
      fly.t += dt / (fly.d || 1.5)
      const t = Math.min(1, fly.t), e = t < 0.5 ? 2 * t * t : 1 - Math.pow(-2 * t + 2, 2) / 2
      flyPaper.visible = true
      flyPaper.position.lerpVectors(fly.from, fly.to, e); flyPaper.position.y += Math.sin(t * Math.PI) * 2.2
      flyPaper.rotation.set(Math.sin(t * 9) * 0.4, t * 5, Math.cos(t * 7) * 0.3)
      if (t >= 1) { fly = null; flyPaper.visible = false }
    }
    renderer.render(scene, cam)
    if (ovDirty) { ovDirty = false; placeOverlay() }
  }
  function resize() {
    if (!mounted) return
    const w = mounted.clientWidth, hh = mounted.clientHeight
    if (!w || !hh) return
    if (w === W && hh === H && renderer.getSize(new T3.Vector2()).x === w) return
    W = w; H = hh
    renderer.setSize(w, hh, false)
    computeOverview()
    if (view.auto && overview) setView(overview)
    applyCam()
  }
  let mountedOn = null
  function mount(stage) {
    if (mountedOn === stage) return host
    mountedOn = stage
    stage.appendChild(host)
    mounted = host
    if (window.ResizeObserver) new ResizeObserver(resize).observe(host)
    resize()
    if (!running) { running = true; requestAnimationFrame(frame) }
    return host
  }

  // the default character, the characters folder, and what was dropped in this browser
  const chars = h.characters || {}
  const boot = (async () => {
    if (chars.default) { try { await addTemplate('', fromB64(chars.default), 'default.glb', 'default') } catch (e) { /* no default: the podiums stay empty */ } }
    for (const [name, b64] of Object.entries(chars.set || {})) { try { await addTemplate('~set:' + name, fromB64(b64), 'person-' + name + '.glb', 'set') } catch (e) { /* a broken file: that look falls back to the default */ } }
    for (const [agent, b64] of Object.entries(chars.byAgent || {})) { try { await addTemplate(agent, fromB64(b64), agent + '.glb', 'file') } catch (e) { /* a broken file: that person keeps the default */ } }
    await idbOpen()
    for (const [k, v] of await idbAll()) if (v && v.buf) { try { await addTemplate(k, v.buf, v.name, 'dropped') } catch (e) { idbDel(k) } }
    booted = true
    refreshCharacters()
  })()

  return {
    mount, sync, fit: () => fit(true), focus, zoomBy, panBy, characterBox, resize, ready: boot,
    /** Walk faster (tests, a demo): k times the speed, the pauses k times shorter. */
    pace: (k) => { pace = Math.max(0.1, Math.min(50, Number(k) || 1)) },
    /** Fly the camera to a point of the floor, k times the overview's zoom. */
    aim: (x, z, k) => { if (!overview) return; startTween({ tx: x, ty: 0.6, tz: z, azim: VIEW0.azim, elev: VIEW0.elev, zoom: overview.zoom * (k || 2) }, 0.01); view.auto = false; viewChanged(false) },
    zoomPct: () => Math.round(view.zoom / (overview ? overview.zoom : 1) * 100),
    view: () => Object.assign(viewOf(), { auto: view.auto }),
    /** What is on the floor, for tests and for the curious. */
    info: () => ({
      key: O ? O.key : '', calls: renderer.info.render.calls, soft,
      podiums: O ? [...O.byId.values()].map((p) => ({
        id: p.id, kind: p.kind, agent: p.src.agent || '', state: p.src.state, tone: (p.src.pill && p.src.pill.tone) || '', character: !!p.ch, model: p.ch ? p.ch.tpl.name : null, clip: p.ch ? p.ch.cur : null, cell: [p.x / PITCH, p.z / PITCH],
        // where the person is: 'desk', 'lounge', 'sup' (at the supervisor) or 'walk'; the lead is always at the supervisor's desk
        loc: p.w ? (p.w.path.length ? 'walk' : p.w.loc) : p.kind === 'lead' && p.ch ? 'sup' : null,
        act: p.w ? p.w.act : null, trail: p.w ? p.w.trail.slice() : [],
        // the clip that really plays: a file without a walk or standing clip falls back to its idle
        clipName: p.ch && p.ch.cur ? p.ch.map[p.ch.cur] || p.ch.map.idle : null,
        pos: p.ch ? [p.ch.holder.position.x, p.ch.holder.position.y, p.ch.holder.position.z] : null,
      })) : [],
      cards: cards.size,
      // where each head is on the screen (no pill may cover one)
      heads: headBoxes(),
      // the fixed places of the floor
      spots: O ? { supervisor: { x: O.sup.x, z: O.sup.z, visits: O.sup.visits.length, tray: [O.sup.trayAt.x, O.sup.trayAt.z] }, lounge: { seats: O.lounge.seats.filter((s) => s.sofa).length, standing: O.lounge.seats.filter((s) => !s.sofa).length }, room: O.r } : null,
      // nothing casts or takes a shadow, and nothing hangs below the floor
      shadows: { map: renderer.shadowMap.enabled, casters: (() => { let n = 0; scene.traverse((o) => { if (o.castShadow || o.receiveShadow) n++ }); return n })() },
      floorMinY: O ? new T3.Box3().setFromObject(O.merged).min.y : null,
    }),
  }
