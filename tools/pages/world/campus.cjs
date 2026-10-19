/* ======================================================================
 * The campus. One plot per office on a plain grid of lots, with no streets
 * between: a building never stands in front of another, so each plot is
 * drawn back to front on its own. x and y are plot tiles, z is pixels.
 * The page calls draw() on every poll; the zoom and pan are kept here and
 * laid back on after each drawing (fit()).
 *
 * The layout is the server's (campus.cjs): a grid of lots, a building on a
 * lot, 12 building types. Normal mode shows the lots that are in use; build
 * mode (the owner's "Build" button) shows the whole grid with a hotbar of the
 * 12 types (keys 1 to 9), a tool column (select, move, rotate, archive), a
 * ghost building on the lot under the pointer (blue on a free lot, red with
 * "Lot taken" on a used one) and "Done building". Every change goes through
 * POST api/campus, the only write path; the page only asks.
 *
 * h: { esc, fa, go(to), post(url, body), refresh(), redraw() }. Never run in
 * Node: the source is written into the page.
 * ====================================================================== */
function campusArt(h) {
  const { esc, fa, post, refresh } = h
  // the window colours: an idle person's window is "lights off", darker than
  // the plain glass of a window nobody has
  const ST_COL = { working: '#3BE8B0', quiet: '#E5A33D', waiting: '#E5A33D', paused: '#FF5F5F', idle: '#6B7A8A', away: '#8E9BA8' }
  const cv = { z: 1, x: 0, y: 0, W: 1060, H: 848, SW: 0, SH: 0, kbd: false }
  // the plinth stops E tiles in from the edge of its plot
  const TW = 56, TH = 28, PLOT = 8, E = 0.5, CW = 448, CH = 448, MX = 56, MY = 44
  const WALL = ['#EEF1F4', '#FBFCFD', '#D5DBE1'] // roof rim, street face, side face
  const ROOF = '#DCE1E6'
  const GLASS = ['#C3D1DD', '#AEBDCB']
  const PLINTH = ['#F7F8FA', '#DEE3E8', '#CBD2D9']
  // The 12 office types in the four shapes of the campus (0 shop, 1 tower with
  // an annex, 2 corner, 3 wide block): a type that shares a shape is told
  // apart by its height and by what stands on its roof.
  const ART = {
    engineering: { k: 0 }, verification: { k: 0, up: 1, crown: 'tank' }, docs: { k: 0, crown: 'solar' },
    planning: { k: 1 }, design: { k: 1, crown: 'solar' },
    domain: { k: 2 }, release: { k: 2, crown: 'mast' }, legal: { k: 2, up: 1 },
    business: { k: 3 }, security: { k: 3, crown: 'mast' }, data: { k: 3, up: 1 }, archive: { k: 3, crown: 'tank' },
  }
  const artOf = (type) => ART[type] || ART.business
  const bm = { on: false, tool: 'select', type: '', rot: 0, sel: '', armed: '', msg: '', bad: false }
  let model = null, lay = null, ghostLot = null, msgT = 0
  const $ = (id) => document.getElementById(id)
  const cellOf = (id) => ((model && model.cells) || []).find((c) => c.id === id) || { id, name: id, color: '#8A97A6' }
  const typeOf = (id) => (model.campus.types || []).find((t) => t.id === id) || { id: 'business', name: 'Office' }
  const editable = () => !!model && !!model.canEdit && !model.campus.readOnly
  const building$ = () => bm.on && editable()
  const byLot = () => new Map(model.campus.buildings.map((b) => [b.x + ',' + b.y, b]))

  function iso(ox, oy) {
    const P = (x, y, z) => [ox + (x - y) * TW / 2, oy + (x + y) * TH / 2 - (z || 0)]
    const pts = (a) => a.map((p) => p.map((n) => Math.round(n * 10) / 10).join(',')).join(' ')
    // the stroke in the fill's own colour closes the hairline seams anti-aliasing leaves between faces
    const poly = (a, fill, extra) => '<polygon points="' + pts(a) + '" fill="' + fill + '" stroke="' + fill + '" stroke-width=".6" stroke-linejoin="round"' + (extra || '') + '/>'
    const flat = (a, fill, extra) => '<polygon points="' + pts(a) + '" fill="' + fill + '"' + (extra || '') + '/>'
    const box = (x, y, w, d, z, hgt, c) =>
      poly([P(x, y + d, z), P(x + w, y + d, z), P(x + w, y + d, z + hgt), P(x, y + d, z + hgt)], c[1]) +
      poly([P(x + w, y, z), P(x + w, y + d, z), P(x + w, y + d, z + hgt), P(x + w, y, z + hgt)], c[2]) +
      poly([P(x, y, z + hgt), P(x + w, y, z + hgt), P(x + w, y + d, z + hgt), P(x, y + d, z + hgt)], c[0])
    // a rectangle on a street face (the plane y = Y) or a side face (x = X)
    const onL = (Y, x0, x1, z0, z1, f) => poly([P(x0, Y, z0), P(x1, Y, z0), P(x1, Y, z1), P(x0, Y, z1)], f)
    const onR = (X, y0, y1, z0, z1, f) => poly([P(X, y0, z0), P(X, y1, z0), P(X, y1, z1), P(X, y0, z1)], f)
    return { P, pts, poly, flat, box, onL, onR }
  }
  const shade = (hex, f) => '#' + [1, 3, 5].map((i) => Math.max(0, Math.min(255, Math.round(parseInt(hex.substr(i, 2), 16) * f))).toString(16).padStart(2, '0')).join('')

  /** One building on its plot. `kind` picks the shape (0 shop with an awning,
   *  1 tower with a low annex, 2 corner L, 3 wide low block, 'shed'). The panes
   *  of the blocks marked `staff` are the people's, one each, filled from the
   *  top floor down. Returns the svg, its highest point (the card hangs there)
   *  and the door (visitors stand there). */
  function building(I, art, c, wins) {
    const kind = art.k, up = art.up || 0
    const { P, poly, box, onL, onR } = I
    const FH = 30
    let s = '', n = 0, top = Infinity
    const pane = (f, side) => { const who = wins[n++]; return who ? (side ? shade(ST_COL[who.s], 0.86) : ST_COL[who.s]) : f }
    const per = (b) => Math.max(1, Math.round(b.w / 0.62)) + Math.max(1, Math.round(b.d / 0.62))
    const floorsFor = (b, min, max) => Math.max(min + up, Math.min(max + up, Math.ceil(wins.length / per(b))))
    function block(b) {
      const z = b.z || 0, base = b.base || 0, hgt = base + b.floors * FH + 8
      s += box(b.x, b.y, b.w, b.d, z, hgt, WALL)
      const i = 0.17
      s += poly([P(b.x + i, b.y + i, z + hgt), P(b.x + b.w - i, b.y + i, z + hgt), P(b.x + b.w - i, b.y + b.d - i, z + hgt), P(b.x + i, b.y + b.d - i, z + hgt)], b.roof || ROOF)
      if (b.band) s += onL(b.y + b.d, b.x, b.x + b.w, z + hgt - 8, z + hgt - 2, c) + onR(b.x + b.w, b.y, b.y + b.d, z + hgt - 8, z + hgt - 2, shade(c, 0.8))
      const nl = Math.max(1, Math.round(b.w / 0.62)), nr = Math.max(1, Math.round(b.d / 0.62))
      for (let f = b.floors - 1; f >= 0; f--) {
        const z0 = z + base + f * FH + 8, z1 = z0 + FH - 14
        for (let k = 0; k < nl; k++) s += onL(b.y + b.d, b.x + (k + 0.16) * b.w / nl, b.x + (k + 0.84) * b.w / nl, z0, z1, b.staff ? pane(GLASS[0]) : GLASS[0])
        for (let k = 0; k < nr; k++) s += onR(b.x + b.w, b.y + (k + 0.16) * b.d / nr, b.y + (k + 0.84) * b.d / nr, z0, z1, b.staff ? pane(GLASS[1], 1) : GLASS[1])
      }
      top = Math.min(top, P(b.x, b.y, z + hgt)[1])
      return z + hgt
    }
    // a glazed ground floor, its glass split by thin mullions
    function shopL(Y, x0, x1, z0, z1) {
      s += onL(Y, x0, x1, z0, z1, GLASS[0])
      const k = Math.max(2, Math.round((x1 - x0) / 0.7))
      for (let j = 1; j < k; j++) { const a = x0 + j * (x1 - x0) / k; s += onL(Y, a - 0.03, a + 0.03, z0, z1, WALL[1]) }
    }
    function shopR(X, y0, y1, z0, z1) {
      s += onR(X, y0, y1, z0, z1, GLASS[1])
      const k = Math.max(2, Math.round((y1 - y0) / 0.7))
      for (let j = 1; j < k; j++) { const a = y0 + j * (y1 - y0) / k; s += onR(X, a - 0.03, a + 0.03, z0, z1, WALL[2]) }
    }
    // striped awnings in the office colour, over a street face or a side face
    function awningL(Y, x0, x1, za) {
      const k = Math.max(3, Math.round((x1 - x0) / 0.26))
      for (let j = 0; j < k; j++) {
        const a = x0 + j * (x1 - x0) / k, e = a + (x1 - x0) / k
        s += poly([P(a, Y, za), P(e, Y, za), P(e, Y + 0.42, za - 9), P(a, Y + 0.42, za - 9)], j % 2 ? '#FFFFFF' : c)
        s += poly([P(a, Y + 0.42, za - 9), P(e, Y + 0.42, za - 9), P(e, Y + 0.42, za - 13), P(a, Y + 0.42, za - 13)], j % 2 ? '#E6E9EC' : shade(c, 0.84))
      }
    }
    function awningR(X, y0, y1, za) {
      const k = Math.max(3, Math.round((y1 - y0) / 0.26))
      for (let j = 0; j < k; j++) {
        const a = y0 + j * (y1 - y0) / k, e = a + (y1 - y0) / k
        s += poly([P(X, a, za), P(X, e, za), P(X + 0.42, e, za - 9), P(X + 0.42, a, za - 9)], j % 2 ? '#E9ECEF' : shade(c, 0.86))
        s += poly([P(X + 0.42, a, za - 9), P(X + 0.42, e, za - 9), P(X + 0.42, e, za - 13), P(X + 0.42, a, za - 13)], j % 2 ? '#D3D9DF' : shade(c, 0.7))
      }
    }
    // the way in: a door, and a flat canopy in the office colour on two posts
    function entrance(Y, x0, x1, za) {
      s += onL(Y, x0 + 0.2, x1 - 0.2, 0, za - 2, '#5F7385')
      s += onL(Y, (x0 + x1) / 2 - 0.02, (x0 + x1) / 2 + 0.02, 0, za - 2, '#8FA1B2')
      for (const px of [x0 + 0.08, x1 - 0.12]) s += box(px, Y + 0.62, 0.05, 0.05, 0, za, ['#B8C1CA', '#AAB4BE', '#97A2AD'])
      s += box(x0, Y, x1 - x0, 0.7, za, 4, [shade(c, 1.12), c, shade(c, 0.74)])
    }
    function unit(x, y, z, w, d, hh, fan) {
      s += box(x, y, w, d, z, hh, ['#EEF1F4', '#CDD4DB', '#B7C0C9'])
      if (fan) { const [fx, fy] = P(x + w / 2, y + d / 2, z + hh); s += '<ellipse cx="' + fx.toFixed(1) + '" cy="' + fy.toFixed(1) + '" rx="' + (w * TW * 0.3).toFixed(1) + '" ry="' + (w * TH * 0.3).toFixed(1) + '" fill="#AFB9C3"/>' }
    }
    // what stands on the roof of the types that share a shape: a tank, a mast or solar panels
    function crown(x, y, z) {
      const post = ['#B8C1CA', '#AAB4BE', '#97A2AD'], cap = [shade(c, 1.12), c, shade(c, 0.74)]
      if (art.crown === 'tank') { s += box(x, y, 0.7, 0.7, z, 11, ['#CBD2D9', '#AEB8C2', '#98A3AF']) + box(x - 0.05, y - 0.05, 0.8, 0.8, z + 11, 4, cap); top = Math.min(top, P(x, y, z + 15)[1]) }
      else if (art.crown === 'mast') { s += box(x, y, 0.08, 0.08, z, 40, post) + box(x - 0.05, y - 0.05, 0.18, 0.18, z + 40, 5, cap); top = Math.min(top, P(x, y, z + 45)[1]) }
      else if (art.crown === 'solar') { for (const dx of [0, 1.1]) s += box(x + dx, y, 1.0, 0.7, z, 4, ['#8FA6C4', '#6F88AA', '#586F90']) }
    }
    let door
    if (kind === 'shed') {
      const b = { x: 1.4, y: 1.5, w: 2.6, d: 2.1, base: 28, floors: 0, roof: '#D3D9DF' }
      block(b)
      s += onL(b.y + b.d, b.x + 0.5, b.x + 1.9, 0, 17, '#C5CDD5')
      for (let z = 3; z < 17; z += 3) s += onL(b.y + b.d, b.x + 0.5, b.x + 1.9, z, z + 0.8, '#B2BCC6')
      unit(b.x + 1.6, b.y + 0.4, 30, 0.6, 0.6, 6, true)
      door = [b.x + 1.2, b.y + b.d + 0.7]
    } else if (kind === 1) {
      // a tower with ribbon windows over a low glazed annex
      const m = { x: 2.3, y: 1.2, w: 3.6, d: 3.2, staff: 1, band: 1 }
      m.floors = floorsFor(m, 3, 6)
      const rz = block(m)
      crown(m.x + 1.0, m.y + 1.7, rz)
      s += box(m.x + 0.5, m.y + 0.45, 1.7, 0.18, rz, 13, [shade(c, 1.1), c, shade(c, 0.72)])
      unit(m.x + 2.4, m.y + 1.2, rz, 0.8, 0.8, 9, true)
      const a = { x: 1.2, y: 4.4, w: 3.6, d: 1.9, base: 32, floors: 0, band: 1 }
      block(a)
      shopL(a.y + a.d, a.x + 0.15, a.x + a.w - 0.15, 4, 23)
      shopR(a.x + a.w, a.y + 0.2, a.y + a.d - 0.2, 4, 23)
      entrance(a.y + a.d, a.x + 1.3, a.x + 2.4, 26)
      door = [a.x + 1.85, a.y + a.d + 0.9]
    } else if (kind === 2) {
      // a corner building: a long back wing and a front wing, an awning along both
      const bk = { x: 1.2, y: 1.2, w: 5.2, d: 2.1, base: 34, staff: 1, band: 1 }
      bk.floors = floorsFor(bk, 1, 4)
      const rz = block(bk)
      crown(bk.x + 2.0, bk.y + 0.9, rz)
      shopL(bk.y + bk.d, bk.x + 2.4, bk.x + bk.w - 0.15, 4, 24)
      shopR(bk.x + bk.w, bk.y + 0.2, bk.y + bk.d - 0.2, 4, 24)
      awningL(bk.y + bk.d, bk.x + 2.35, bk.x + bk.w - 0.1, 33)
      unit(bk.x + 3.2, bk.y + 0.4, rz, 1.1, 0.8, 8)
      unit(bk.x + 0.5, bk.y + 0.5, rz, 0.6, 0.6, 6, true)
      const fr = { x: 1.2, y: 3.3, w: 2.3, d: 3.0, base: 34, staff: 1, band: 1, floors: Math.max(1, bk.floors - 1) }
      block(fr)
      shopL(fr.y + fr.d, fr.x + 0.15, fr.x + fr.w - 0.15, 4, 24)
      shopR(fr.x + fr.w, fr.y + 0.2, fr.y + fr.d - 0.2, 4, 24)
      awningL(fr.y + fr.d, fr.x + 0.1, fr.x + fr.w - 0.1, 33)
      awningR(fr.x + fr.w, fr.y + 0.1, fr.y + fr.d - 0.1, 33)
      door = [fr.x + fr.w + 1.0, bk.y + bk.d + 0.8]
    } else if (kind === 3) {
      // a wide low block with a deep fascia and a plant room on the roof
      const m = { x: 1.0, y: 1.7, w: 5.4, d: 4.4, staff: 1, base: 0 }
      m.floors = floorsFor(m, 1, 3)
      const rz = block(m)
      crown(m.x + 4.2, m.y + 2.7, rz)
      s += onL(m.y + m.d, m.x, m.x + m.w, rz - 12, rz - 2, c) + onR(m.x + m.w, m.y, m.y + m.d, rz - 12, rz - 2, shade(c, 0.8))
      block({ x: m.x + 1.6, y: m.y + 1.0, w: 2.2, d: 1.8, z: rz, base: 10, floors: 0, roof: '#D3D9DF' })
      unit(m.x + 0.5, m.y + 0.6, rz, 0.7, 0.7, 7, true)
      unit(m.x + 4.2, m.y + 0.7, rz, 0.8, 1.2, 8)
      entrance(m.y + m.d, m.x + 2.2, m.x + 3.4, 27)
      door = [m.x + 2.8, m.y + m.d + 0.9]
    } else {
      // a two-storey shop: glazed ground floor under a full-width awning
      const m = { x: 1.3, y: 1.3, w: 4.6, d: 4.0, base: 36, staff: 1, band: 1 }
      m.floors = floorsFor(m, 1, 4)
      const rz = block(m)
      crown(m.x + 1.9, m.y + 1.5, rz)
      shopL(m.y + m.d, m.x + 0.15, m.x + m.w - 0.15, 3, 26)
      shopR(m.x + m.w, m.y + 0.25, m.y + m.d - 0.25, 5, 26)
      s += onL(m.y + m.d, m.x + 1.9, m.x + 2.7, 0, 26, '#5F7385')
      awningL(m.y + m.d, m.x + 0.05, m.x + m.w - 0.05, 35)
      unit(m.x + 0.6, m.y + 0.5, rz, 1.1, 0.8, 9)
      unit(m.x + 3.0, m.y + 0.6, rz, 0.7, 0.7, 7, true)
      door = [m.x + 2.3, m.y + m.d + 0.9]
    }
    return { svg: s, top, door }
  }

  /** The office's sign: a slab on two posts along the right-hand front edge
   *  of the plot (the street side is the door's), the name on it in the
   *  office colour. A long name is squeezed to fit. */
  function nameSign(I, name, c, X, y1) {
    const { P, box } = I
    const est = name.length * 7.4 + 20
    const L = Math.min(5.2, Math.max(2.2, est / (TW / 2)))
    const y0 = y1 - L
    const post = ['#B8C1CA', '#AAB4BE', '#97A2AD']
    let s = box(X - 0.1, y0 + 0.3, 0.06, 0.06, 0, 5, post) + box(X - 0.1, y1 - 0.36, 0.06, 0.06, 0, 5, post)
    s += box(X - 0.14, y0, 0.14, L, 5, 22, [shade(c, 1.15), shade(c, 0.72), c])
    // the text runs up the face, from its near end (y1) to its far end (y0)
    const [px, py] = P(X, y1, 5)
    const room = L * TW / 2 - 14
    return s + '<text transform="matrix(1,-.5,0,1,' + px.toFixed(1) + ',' + py.toFixed(1) + ')" x="' + (L * TW / 4).toFixed(1) + '" y="-7" text-anchor="middle" font-size="13" fill="#fff" direction="' + 'ltr' + '"' +
      (est - 18 > room ? ' textLength="' + room.toFixed(0) + '" lengthAdjust="spacingAndGlyphs"' : '') + '>' + esc(name) + '</text>'
  }

  /** The lots on show. Normal mode: the box round the lots in use (and the
   *  shed of unassigned work on a free lot of it). Build mode: the whole grid. */
  function layoutOf(m) {
    const g = m.campus.grid, bs = m.campus.buildings
    const build = bm.on && editable()
    let x0 = 0, y0 = 0, x1 = g.cols - 1, y1 = g.rows - 1
    if (!build) {
      if (bs.length) { x0 = Math.min(...bs.map((b) => b.x)); x1 = Math.max(...bs.map((b) => b.x)); y0 = Math.min(...bs.map((b) => b.y)); y1 = Math.max(...bs.map((b) => b.y)) }
      else { x1 = Math.min(g.cols - 1, 2); y1 = 0 }
    }
    const taken = new Set(bs.map((b) => b.x + ',' + b.y))
    const unassigned = build ? null : (m.cells || []).find((c) => c.kind === 'shed') || null
    let shed = null
    if (unassigned) {
      for (let y = y0; y <= y1 && !shed; y++) for (let x = x0; x <= x1 && !shed; x++) if (!taken.has(x + ',' + y)) shed = { x, y }
      if (!shed && x1 + 1 < g.cols) { x1++; shed = { x: x1, y: y0 } }
    }
    // build mode leaves room above the first row for the cards, under the page's own strip
    return { x0, y0, x1, y1, cols: x1 - x0 + 1, rows: y1 - y0 + 1, build, shed, unassigned, my: build ? MY + 80 : MY }
  }
  /** Where a plot's corner stands: the lot's cell on the screen grid. */
  function origin(L, x, y, PL) {
    const ox = MX + (x - L.x0) * CW + CW / 2
    let oy = L.my + (y - L.y0) * CH + 196 + (PLOT - PL) * TH / 2
    // the plot's corner sits on a corner of the ground grid, so the grid runs on under the plinth
    if ((Math.round(ox / (TW / 2)) + Math.round(oy / (TH / 2))) % 2 === 0) oy += TH / 2
    return [ox, oy]
  }
  const mirrored = (g, ox) => '<g transform="translate(' + ox * 2 + ',0) scale(-1,1)">' + g + '</g>'

  /** The whole campus. m.campus: { grid, buildings: [{ id, officeId, type, x, y,
   *  rot }], types, readOnly }; m.cells: [{ id, name, color, wins:[{s}], label,
   *  sign (the card's html), small, kind ('shed' for the unassigned work) }];
   *  m.hq: the office whose plot has the supervisor's kiosk ({ id, lit, label });
   *  m.visitors: [{ officeId, draw(x, y) }]; m.canEdit; m.legend, m.tip and
   *  m.side: html the page made. */
  function draw(m) {
    model = m
    const c = m.campus
    const L = lay = layoutOf(m)
    const W = MX * 2 + L.cols * CW, H = L.my + MY + L.rows * CH
    cv.W = W; cv.H = H
    let s = '<svg width="' + W + '" height="' + H + '" viewBox="0 0 ' + W + ' ' + H + '" aria-hidden="true">' +
      '<defs><pattern id="cmap-grid" width="' + TW + '" height="' + TH + '" patternUnits="userSpaceOnUse"><path d="M0 ' + TH / 2 + 'L' + TW / 2 + ' 0L' + TW + ' ' + TH / 2 + 'L' + TW / 2 + ' ' + TH + 'Z" fill="none" stroke="#E2E6EA" stroke-width="1"/></pattern></defs>' +
      // the grid runs well past the campus, so zooming out never shows its edge
      '<rect x="' + -2 * W + '" y="' + -2 * H + '" width="' + 5 * W + '" height="' + 5 * H + '" fill="url(#cmap-grid)"/>'
    const used = byLot()
    // build mode: every free lot is an outline
    if (L.build) {
      for (let y = L.y0; y <= L.y1; y++) for (let x = L.x0; x <= L.x1; x++) {
        if (used.has(x + ',' + y)) continue
        const [ox, oy] = origin(L, x, y, PLOT), { P, pts } = iso(ox, oy)
        s += '<polygon class="lot" points="' + pts([P(E, E, 0), P(PLOT - E, E, 0), P(PLOT - E, PLOT - E, 0), P(E, PLOT - E, 0)]) + '" fill="none" stroke="#AEB8C4" stroke-width="1.5" stroke-dasharray="7 5"/>'
      }
    }
    const items = c.buildings.map((b) => ({ b, x: b.x, y: b.y, cell: cellOf(b.officeId), shed: false }))
    if (L.shed) items.push({ b: null, x: L.shed.x, y: L.shed.y, cell: L.unassigned, shed: true })
    // back to front: the lots further up the screen first
    items.sort((p, q) => p.y - q.y || p.x - q.x)
    const signs = []
    for (const { b, x, y, cell, shed } of items) {
      const PL = shed ? 6 : PLOT
      const [ox, oy] = origin(L, x, y, PL)
      const I = iso(ox, oy)
      const { P, poly, flat, box } = I
      const col = cell.color || '#8A97A6'
      // the plot is paved flush with the ground, behind a kerb a few centimetres high: no island, no shadow
      let g = box(E, E, PL - 2 * E, PL - 2 * E, 0, 3, PLINTH)
      g += poly([P(E, E, 3), P(PL - E, E, 3), P(PL - E, PL - E, 3), P(E, PL - E, 3)], PLINTH[0], ' class="pl"')
      const bl = building(I, shed ? { k: 'shed' } : artOf(b.type), col, shed ? [] : cell.wins || [])
      // a paved way from the door to the edge of the plot
      g += flat([P(bl.door[0] - 0.45, bl.door[1] - 0.6, 3), P(bl.door[0] + 0.45, bl.door[1] - 0.6, 3), P(bl.door[0] + 0.45, PL - E, 3), P(bl.door[0] - 0.45, PL - E, 3)], '#E6EAEE')
      g += bl.svg
      // a turned building is the same drawing seen from the other side; its sign and its door stay readable
      const flip = !shed && b.rot % 2 === 1
      if (flip) g = mirrored(g, ox)
      if (!shed) g += nameSign(I, cell.name, col, PL - E - 0.4, PL - E - 0.45)
      const attrs = L.build
        ? ' data-b="' + esc(b.id) + '" data-office="' + esc(cell.id) + '"'
        : ' data-goto="office:' + esc(cell.id) + '" data-office="' + esc(cell.id) + '"'
      s += '<g class="bld' + (b && bm.sel === b.id && L.build ? ' sel' : '') + '" style="--c:' + esc(col) + '"' + attrs + ' role="button" tabindex="0" aria-label="' + esc(cell.label || cell.name) + '">' + g + '</g>'
      if (m.hq && cell.id === m.hq.id && !shed) {
        // the supervisor's kiosk at the corner of its office's plot; the flag is up while it is active
        const [kx, ky] = P(6.85, 1.25, 26)
        s += '<g class="bld" style="--c:#C9B6F2"' + attrs + ' role="button" tabindex="0" aria-label="' + esc(m.hq.label) + '">' +
          box(6.5, 0.9, 0.7, 0.7, 0, 22, ['#E4DAF8', '#C9B6F2', '#9C8BC8']) + box(6.37, 0.77, 0.96, 0.96, 22, 4, ['#F1ECFB', '#B8A6E4', '#8E7DBA']) +
          '<rect x="' + (kx - 0.8).toFixed(1) + '" y="' + (ky - 30).toFixed(1) + '" width="1.6" height="30" fill="#8A97A6"/>' +
          '<rect x="' + (kx + 0.8).toFixed(1) + '" y="' + (ky - 30).toFixed(1) + '" width="15" height="9" fill="' + (m.hq.lit ? '#FFC23D' : '#AEB8C2') + '"/></g>'
      }
      // visitors: one figure at the door for each person working here from another office
      let v = 0
      for (const vis of m.visitors || []) {
        if (vis.officeId !== cell.id || v >= 4) continue
        let [px, py] = P(bl.door[0] + (v % 2 ? 0.6 : -0.6) * Math.ceil(v / 2 + 0.5), bl.door[1] + 0.2)
        if (flip) px = ox * 2 - px
        s += '<g shape-rendering="crispEdges">' + vis.draw(px, py) + '</g>'
        v++
      }
      signs.push({ cell, x: ox, y: bl.top - 16 })
    }
    s += '</svg>'
    const html = signs.map(({ cell, x, y }) => '<div class="sign' + (cell.small ? ' small' : '') + '" style="--c:' + esc(cell.color || '#8A97A6') + ';left:' + x + 'px;top:' + Math.round(y) + 'px">' + cell.sign + '</div>').join('')
    const total = c.grid.cols * c.grid.rows
    const zoom = '<div class="czoom" id="czoom" role="group" aria-label="' + T('Campus zoom') + '"><button type="button" data-czoom="out" title="' + T('Zoom out (-)') + '" aria-label="' + T('Zoom out') + '">−</button><output id="czoomv">' + fa(Math.round(cv.z * 100)) + T('%') + '</output><button type="button" data-czoom="in" title="' + T('Zoom in (+)') + '" aria-label="' + T('Zoom in') + '">+</button><button type="button" class="fitb" data-czoom="fit" title="' + T('Fit whole campus (0)') + '">' + T('Fit all') + '</button>' +
      (editable() ? '<button type="button" class="cbuild' + (L.build ? ' on' : '') + '" data-c3="build">' + (L.build ? 'Done building' : 'Build') + '</button>' : '') +
      '<span class="zh">' + (L.build ? fa(c.buildings.length) + ' of ' + fa(total) + ' lots' : c.readOnly ? 'Read-only: newer file' : T('Mouse wheel: zoom · Drag: pan')) + '</span></div>'
    let tools = ''
    if (L.build) {
      tools = '<div class="c3tools" role="toolbar" aria-label="Tools">' + TOOLS.map(([id, name, d]) => '<button type="button" class="c3t' + (bm.tool === id && !bm.type ? ' on' : '') + '" data-c3tool="' + id + '" title="' + name + '">' + icon(d) + '<span>' + name + '</span></button>').join('') + '</div>' +
        '<div class="c3hot" role="toolbar" aria-label="Building types"><div class="hh"><b>Building types</b><span>Press 1-9 · R rotate · Esc exit</span></div><div class="hs">' +
        c.types.map((t, i) => '<button type="button" class="c3h' + (bm.type === t.id ? ' on' : '') + '" data-c3type="' + t.id + '" title="' + esc(t.name) + '"><em>' + (i < 9 ? i + 1 : '') + '</em>' + tileIcon(t.id) + '<span>' + esc(String(t.name).split(' ')[0]) + '</span></button>').join('') + '</div></div>'
    }
    const msg = '<div class="c3msg' + (bm.bad ? ' bad' : '') + '" id="c3msg" role="status"' + (bm.msg ? '' : ' hidden') + '>' + esc(bm.msg) + '</div>'
    // the company summary steps aside while building: the board gets the whole width
    return '<div class="cwrap"><div class="cmap' + (L.build ? ' building' : '') + '" id="cmap" tabindex="0" aria-label="' + T('Campus — mouse wheel or + and - to zoom, drag or arrow keys to pan, 0 to fit') + '"><div class="cmap-in" id="cmap-in" style="width:' + W + 'px;height:' + H + 'px">' + s + html + '</div>' + zoom + tools + msg + (L.build ? '' : (m.tip || '') + (m.legend || '')) + '</div>' + (L.build ? '' : m.side || '') + '</div>'
  }

  // ---------- build mode
  const TOOLS = [['select', 'Select', 'M5 3l14 8-6 1.6L10.5 19z'], ['move', 'Move', 'M12 3v18M3 12h18M12 3l-3 3m3-3l3 3M12 21l-3-3m3 3l3-3M3 12l3-3m-3 3l3 3M21 12l-3-3m3 3l-3 3'], ['rotate', 'Rotate', 'M20 12a8 8 0 1 1-2.6-5.9M20 4v5h-5'], ['archive', 'Archive', 'M5 7h14M9 7V4h6v3M7 7l1 13h8l1-13']]
  const icon = (d) => '<svg viewBox="0 0 24 24" width="22" height="22" fill="none" stroke="currentColor" stroke-width="1.8" stroke-linecap="round" stroke-linejoin="round" aria-hidden="true"><path d="' + d + '"/></svg>'
  const icons = {}
  /** A type's tile in the hotbar: the same drawing as on the campus, small. */
  function tileIcon(id) {
    if (!icons[id]) icons[id] = '<svg viewBox="-155 -75 312 255" width="62" height="50" aria-hidden="true">' + building(iso(0, 0), artOf(id), '#4E7FD6', []).svg + '</svg>'
    return icons[id]
  }
  const freeName = (base) => {
    const names = new Set((model.cells || []).map((c) => c.name))
    if (!names.has(base)) return base
    for (let n = 2; n < 100; n++) if (!names.has(base + ' ' + n)) return base + ' ' + n
    return base
  }
  function setMsg(text, bad, ms) {
    bm.msg = text; bm.bad = !!bad
    const el = $('c3msg')
    if (el) { el.textContent = text; el.className = 'c3msg' + (bad ? ' bad' : ''); el.hidden = !text }
    clearTimeout(msgT)
    if (text) msgT = setTimeout(() => setMsg('', false), ms || 3500)
  }
  /** The lot under a pointer, from the plot cells of the drawing (the zoom and pan are undone). */
  function lotAt(e) {
    const inner = $('cmap-in')
    if (!inner || !lay || !cv.W) return null
    const r = inner.getBoundingClientRect(), k = r.width / cv.W
    if (!(k > 0)) return null
    const x = Math.floor(((e.clientX - r.left) / k - MX) / CW) + lay.x0, y = Math.floor(((e.clientY - r.top) / k - lay.my) / CH) + lay.y0
    return x >= lay.x0 && x <= lay.x1 && y >= lay.y0 && y <= lay.y1 ? { x, y } : null
  }
  function clearGhost() {
    for (const id of ['cghost', 'cghost-lab']) { const el = $(id); if (el) el.remove() }
    ghostLot = null
  }
  function showGhost(lot, type, rot, free, text) {
    clearGhost()
    const svg = document.querySelector('#cmap-in > svg')
    if (!svg) return
    const [ox, oy] = origin(lay, lot.x, lot.y, PLOT), I = iso(ox, oy), { P, flat } = I
    let g = ''
    if (free) { g = building(I, artOf(type), '#3B6FE0', []).svg; if (rot % 2 === 1) g = mirrored(g, ox) }
    svg.insertAdjacentHTML('beforeend', '<g id="cghost" pointer-events="none">' + flat([P(E, E, 3), P(PLOT - E, E, 3), P(PLOT - E, PLOT - E, 3), P(E, PLOT - E, 3)], free ? '#3B6FE0' : '#D64545', ' fill-opacity=".3"') + '<g opacity=".66">' + g + '</g></g>')
    const lab = document.createElement('div')
    lab.id = 'cghost-lab'; lab.className = 'c3gl' + (free ? '' : ' bad'); lab.textContent = text
    lab.style.left = ox + 'px'; lab.style.top = Math.round(oy + PLOT * TH / 2 + 8) + 'px'
    $('cmap-in').appendChild(lab)
    ghostLot = lot
  }
  /** The ghost for the lot under the pointer: a new building of the chosen type, or the one the move tool carries. */
  function ghostFor(lot) {
    if (!building$() || !lot) { clearGhost(); return }
    const mover = bm.tool === 'move' && !bm.type && bm.sel ? model.campus.buildings.find((b) => b.id === bm.sel) : null
    const type = mover ? mover.type : bm.type
    if (!type) { clearGhost(); return }
    const taken = byLot().get(lot.x + ',' + lot.y)
    const free = !taken || (mover && taken.id === mover.id)
    showGhost(lot, type, mover ? mover.rot : bm.rot, free, free ? (mover ? 'Move ' + cellOf(mover.officeId).name + ' here' : typeOf(type).name + ' · click to place') : 'Lot taken: ' + cellOf(taken.officeId).name)
  }
  const markSel = () => document.querySelectorAll('#cmap g.bld[data-b]').forEach((g) => g.classList.toggle('sel', g.getAttribute('data-b') === bm.sel))
  const rebuild = () => { clearGhost(); if (h.redraw) h.redraw() }

  async function act(body) {
    try {
      const r = await post('api/campus', body)
      const res = r.result || r.gate || {}
      setMsg((res.summary || 'Saved').replace(/^./, (ch) => ch.toUpperCase()), false)
      bm.armed = ''
      await refresh()
    } catch (err) { setMsg(String(err && err.message || err), true, 5000) }
  }
  async function archive(id) {
    const b = model.campus.buildings.find((q) => q.id === id)
    if (!b) return
    if (bm.armed !== id) { bm.armed = id; bm.sel = id; markSel(); setMsg('Click again to archive ' + cellOf(b.officeId).name + ' (its history stays)', false, 6000); return }
    bm.armed = ''; bm.sel = ''
    await act({ op: 'remove', id })
  }

  document.addEventListener('pointermove', (e) => {
    if (!model || !building$() || !$('cmap') || !inMap(e)) return
    if (e.target.closest && e.target.closest('.czoom,.c3tools,.c3hot,.c3msg')) { if (ghostLot) clearGhost(); return }
    const lot = lotAt(e)
    if (lot && ghostLot && lot.x === ghostLot.x && lot.y === ghostLot.y) return
    ghostFor(lot)
  })
  document.addEventListener('click', async (e) => {
    if (!model || !e.target.closest) return
    const t = e.target.closest('[data-c3],[data-c3tool],[data-c3type]')
    if (t && $('cmap') && $('cmap').contains(t)) {
      if (t.dataset.c3 === 'build') {
        bm.on = !bm.on; bm.type = ''; bm.tool = 'select'; bm.sel = ''; bm.armed = ''; bm.rot = 0
        cv.z = 1; cv.x = 0; cv.y = 0
        rebuild()
      } else if (t.dataset.c3tool) { bm.tool = t.dataset.c3tool; bm.type = ''; bm.sel = ''; bm.armed = ''; rebuild() }
      else if (t.dataset.c3type) { bm.type = bm.type === t.dataset.c3type ? '' : t.dataset.c3type; bm.sel = ''; rebuild() }
      return
    }
    if (!building$() || !inMap(e) || e.target.closest('.czoom,.c3tools,.c3hot,.c3msg,.today,.sign')) return
    const lot = lotAt(e)
    if (!lot) return
    const taken = byLot().get(lot.x + ',' + lot.y)
    if (bm.type) {
      if (taken) { setMsg('Lot taken: ' + cellOf(taken.officeId).name, true); return }
      await act({ op: 'place', type: bm.type, x: lot.x, y: lot.y, rot: bm.rot, name: freeName(typeOf(bm.type).name) })
      return
    }
    if (bm.tool === 'move') {
      // a click on a building picks it up; the next click on a lot puts it down
      if (bm.sel && (!taken || taken.id !== bm.sel)) {
        if (taken) { setMsg('Lot taken: ' + cellOf(taken.officeId).name, true); bm.sel = ''; clearGhost(); markSel(); return }
        const id = bm.sel
        bm.sel = ''; clearGhost()
        await act({ op: 'move', id, x: lot.x, y: lot.y })
        return
      }
      bm.sel = taken ? taken.id : ''
      if (taken) setMsg('Click a lot to move it there', false, 6000)
      markSel()
      return
    }
    if (bm.tool === 'rotate') { if (taken) await act({ op: 'rotate', id: taken.id }); return }
    if (bm.tool === 'archive') { if (taken) await archive(taken.id); return }
    bm.sel = taken ? taken.id : ''
    markSel()
  })
  document.addEventListener('keydown', (e) => {
    if (!model || !building$() || !$('cmap')) return
    if (e.target && e.target.closest && e.target.closest('input,textarea,select,[contenteditable]')) return
    if (e.ctrlKey || e.metaKey || e.altKey) return
    const n = e.key >= '1' && e.key <= '9' ? Number(e.key) : 0
    if (n && model.campus.types[n - 1]) { const id = model.campus.types[n - 1].id; bm.type = bm.type === id ? '' : id; bm.sel = ''; rebuild() }
    else if (e.key === 'r' || e.key === 'R') {
      if (bm.type) { bm.rot = (bm.rot + 1) % 4; if (ghostLot) ghostFor(ghostLot) }
      else if (bm.sel) act({ op: 'rotate', id: bm.sel })
    } else if (e.key === 'Delete' || e.key === 'Backspace') { if (bm.sel) archive(bm.sel) }
    else if (e.key === 'v' || e.key === 'V') { bm.tool = 'select'; bm.type = ''; rebuild() }
    else if (e.key === 'm' || e.key === 'M') { bm.tool = 'move'; bm.type = ''; rebuild() }
    else if (e.key === 'Escape') { if (bm.type || bm.sel) { bm.type = ''; bm.sel = ''; rebuild() } else { bm.on = false; cv.z = 1; cv.x = 0; cv.y = 0; rebuild() } }
    else return
    e.preventDefault()
  })

  // ---------- zoom and pan; z is relative to "the whole campus fits"
  const CZ_MIN = 0.5, CZ_MAX = 4
  function campusClamp(v, SW, SH, W, H) {
    const k = Math.max(0.05, Math.min(SW / W, SH / H))
    const z = Math.min(CZ_MAX, Math.max(CZ_MIN, Number(v.z) || 1))
    const s = k * z
    // the campus may slide past an edge by at most 30% of itself or the map,
    // so it can never be pushed out of sight
    const lim = (S, c, x) => {
      const slack = 0.3 * Math.min(S, c), base = (S - c) / 2
      return Math.min(Math.max(0, S - c) + slack - base, Math.max(Math.min(0, S - c) - slack - base, Number(x) || 0))
    }
    return { z, x: lim(SW, W * s, v.x), y: lim(SH, H * s, v.y), k, s }
  }
  // Cards keep a readable size: they follow the zoom only between 85% and
  // 115% of their real size, and counter-scale past that.
  const campusCardScale = (s) => Math.min(1.15, Math.max(0.85, s)) / s
  const calmMotion = () => window.matchMedia && window.matchMedia('(prefers-reduced-motion: reduce)').matches
  let cEaseT = 0
  function applyCampus(ease) {
    const box = document.getElementById('cmap'), inner = document.getElementById('cmap-in')
    if (!box || !inner) return
    cv.SW = box.clientWidth; cv.SH = box.clientHeight
    const v = campusClamp(cv, cv.SW, cv.SH, cv.W, cv.H)
    cv.z = v.z; cv.x = v.x; cv.y = v.y
    if (ease && !calmMotion()) { inner.classList.add('ease'); clearTimeout(cEaseT); cEaseT = setTimeout(() => { const i = document.getElementById('cmap-in'); if (i) i.classList.remove('ease') }, 240) }
    inner.style.transform = 'translate(' + ((cv.SW - cv.W * v.s) / 2 + v.x).toFixed(1) + 'px,' + ((cv.SH - cv.H * v.s) / 2 + v.y).toFixed(1) + 'px) scale(' + v.s.toFixed(4) + ')'
    inner.style.setProperty('--bs', campusCardScale(v.s).toFixed(3))
    // far out, full cards would cover each other: they shrink to the name and the counts
    inner.classList.toggle('far', v.s < 0.5)
    const out = document.getElementById('czoomv')
    if (out) out.textContent = fa(Math.round(v.z * 100)) + T('%')
  }
  /** Zoom by f, keeping the campus point under (mx, my) where it is. */
  function campusZoomAt(mx, my, f, ease) {
    const k = Math.max(0.05, Math.min(cv.SW / cv.W, cv.SH / cv.H)), s = k * cv.z
    const tx = (cv.SW - cv.W * s) / 2 + cv.x, ty = (cv.SH - cv.H * s) / 2 + cv.y
    const z2 = Math.min(CZ_MAX, Math.max(CZ_MIN, cv.z * f)), s2 = k * z2
    cv.z = z2
    cv.x = mx - (mx - tx) * s2 / s - (cv.SW - cv.W * s2) / 2
    cv.y = my - (my - ty) * s2 / s - (cv.SH - cv.H * s2) / 2
    applyCampus(ease)
  }
  const campusFit = () => { cv.z = 1; cv.x = 0; cv.y = 0; applyCampus(true) }
  const inMap = (e) => e.target && e.target.closest && e.target.closest('#cmap')

  document.addEventListener('wheel', (e) => {
    const box = inMap(e)
    if (!box) return
    e.preventDefault()
    const unit = e.deltaMode === 1 ? 16 : e.deltaMode === 2 ? cv.SH : 1
    const dx = e.deltaX * unit, dy = e.deltaY * unit
    // a sideways swipe (touchpad, or Shift+wheel) pans; everything else zooms.
    // A touchpad pinch arrives as Ctrl+wheel in small steps, hence its larger factor.
    if (!e.ctrlKey && Math.abs(dx) > Math.abs(dy)) { cv.x -= dx; applyCampus(); return }
    const r = box.getBoundingClientRect()
    campusZoomAt(e.clientX - r.left, e.clientY - r.top, Math.exp(-Math.max(-60, Math.min(60, dy)) * (e.ctrlKey ? 0.008 : 0.0016)))
  }, { passive: false })

  // Dragging pans; two fingers pinch. A drag only counts after 5px, so a click
  // on a building or a card still enters the office; the click that ends a
  // drag is swallowed. The listeners sit on the window, not the map: the map
  // is replaced by every redraw (redraws wait while a button is held, up to 4 s).
  const ptrs = new Map()
  let drag = null, pinch = null, cSwallow = false
  document.addEventListener('mousedown', (e) => { if (e.button === 1 && inMap(e)) e.preventDefault() }) // no autoscroll
  document.addEventListener('pointerdown', (e) => {
    if (!inMap(e) || e.target.closest('.czoom,.cleg,.ctip,.c3tools,.c3hot,.c3msg')) return
    if (e.button !== 0 && e.button !== 1) return
    ptrs.set(e.pointerId, [e.clientX, e.clientY])
    if (ptrs.size === 2) {
      const [a, b] = [...ptrs.values()]
      pinch = { d: Math.hypot(a[0] - b[0], a[1] - b[1]) || 1, m: [(a[0] + b[0]) / 2, (a[1] + b[1]) / 2] }
      if (drag) drag.on = true // a pinch is never a click
    } else if (ptrs.size === 1) drag = { id: e.pointerId, x: e.clientX, y: e.clientY, vx: cv.x, vy: cv.y, on: e.button === 1 }
  })
  window.addEventListener('pointermove', (e) => {
    if (!ptrs.has(e.pointerId)) return
    ptrs.set(e.pointerId, [e.clientX, e.clientY])
    const box = document.getElementById('cmap')
    if (!box) return
    if (pinch && ptrs.size >= 2) {
      const [a, b] = [...ptrs.values()]
      const d = Math.hypot(a[0] - b[0], a[1] - b[1]) || 1, mid = [(a[0] + b[0]) / 2, (a[1] + b[1]) / 2]
      const r = box.getBoundingClientRect()
      cv.x += mid[0] - pinch.m[0]; cv.y += mid[1] - pinch.m[1]
      campusZoomAt(mid[0] - r.left, mid[1] - r.top, d / pinch.d)
      pinch = { d, m: mid }
      return
    }
    if (!drag || e.pointerId !== drag.id) return
    const dx = e.clientX - drag.x, dy = e.clientY - drag.y
    if (!drag.on && Math.hypot(dx, dy) > 5) drag.on = true
    if (drag.on) { box.classList.add('panning'); cv.x = drag.vx + dx; cv.y = drag.vy + dy; applyCampus() }
  })
  const endDrag = (e) => {
    if (!ptrs.delete(e.pointerId)) return
    if (ptrs.size < 2) pinch = null
    if (drag && (e.pointerId === drag.id || !ptrs.size)) {
      if (drag.on) { cSwallow = true; setTimeout(() => { cSwallow = false }, 0) }
      drag = null
      const box = document.getElementById('cmap')
      if (box) box.classList.remove('panning')
    }
  }
  window.addEventListener('pointerup', endDrag)
  window.addEventListener('pointercancel', endDrag)
  window.addEventListener('click', (e) => { if (cSwallow) { cSwallow = false; e.stopPropagation(); e.preventDefault() } }, true)
  document.addEventListener('click', (e) => {
    const b = e.target.closest && e.target.closest('[data-czoom]')
    if (!b) return
    if (b.dataset.czoom === 'fit') campusFit()
    else campusZoomAt(cv.SW / 2, cv.SH / 2, b.dataset.czoom === 'in' ? 1.25 : 0.8, true)
  })
  // the keyboard, while the map has the focus; the redraw would drop that
  // focus, so it is given back to the new map (see fit)
  document.addEventListener('focusin', (e) => { cv.kbd = e.target && e.target.id === 'cmap' })
  document.addEventListener('keydown', (e) => {
    if (!e.target || e.target.id !== 'cmap') return
    const pans = { ArrowLeft: [60, 0], ArrowRight: [-60, 0], ArrowUp: [0, 60], ArrowDown: [0, -60] }
    if (pans[e.key]) { cv.x += pans[e.key][0]; cv.y += pans[e.key][1]; applyCampus(true) }
    else if (e.key === '+' || e.key === '=') campusZoomAt(cv.SW / 2, cv.SH / 2, 1.25, true)
    else if (e.key === '-' || e.key === '_') campusZoomAt(cv.SW / 2, cv.SH / 2, 0.8, true)
    else if (e.key === '0') campusFit()
    else return
    e.preventDefault()
  })
  // keyboard: Enter on a building enters it, like a click
  document.addEventListener('keydown', (e) => { if (e.key === 'Enter' && e.target.matches && e.target.matches('g.bld[data-goto]') && h.go) h.go(e.target.getAttribute('data-goto')) })

  /** Lays the freshly drawn campus into the space it has, at the zoom and pan
   *  it was left at. */
  function fit() {
    applyCampus(false)
    const box = $('cmap')
    if (box && cv.kbd && (!document.activeElement || document.activeElement === document.body)) box.focus({ preventScroll: true })
    // the drawing was replaced: the ghost goes back on the lot the pointer is over
    if (box && building$() && ghostLot) ghostFor(ghostLot)
  }

  // what a test or a tool may ask: the lots, the buildings and where a lot is on the screen
  const info = () => {
    const inner = $('cmap-in'), r = inner ? inner.getBoundingClientRect() : { left: 0, top: 0, width: 1 }, k = r.width / (cv.W || 1)
    return {
      build: bm.on, type: bm.type, tool: bm.tool, sel: bm.sel, ghost: ghostLot,
      lots: lay ? { x0: lay.x0, y0: lay.y0, x1: lay.x1, y1: lay.y1 } : null,
      buildings: model ? model.campus.buildings.map((b) => ({ id: b.id, officeId: b.officeId, type: b.type, x: b.x, y: b.y, rot: b.rot })) : [],
      outlines: document.querySelectorAll('#cmap polygon.lot').length,
      // the middle of a lot's plot, in viewport pixels
      lotXY: (x, y) => [r.left + (MX + (x - lay.x0) * CW + CW / 2) * k, r.top + (lay.my + (y - lay.y0) * CH + 196 + PLOT * TH / 4) * k],
    }
  }

  return { draw, fit, ST_COL, cv, info, bm }
}

module.exports = { campusArt }
