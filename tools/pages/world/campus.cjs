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
 * h: { esc, digits, go(to), post(url, body), refresh(), redraw() }. Never run in
 * Node: the source is written into the page.
 * ====================================================================== */
function campusArt(h) {
  const { esc, digits, post, refresh } = h
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
  // The 12 office types. A building's shape comes from how many desks the office has
  // (a tower, a glass block or a long bar, see building()); the type picks which of the two
  // a size has (v 0 or 1), what stands on the roof, and one storey more (up).
  const ART = {
    engineering: { v: 0 }, verification: { v: 1, up: 1, crown: 'tank' }, docs: { v: 0, crown: 'solar' },
    planning: { v: 1 }, design: { v: 0, crown: 'solar' },
    domain: { v: 1 }, release: { v: 0, crown: 'mast' }, legal: { v: 1, up: 1 },
    business: { v: 0 }, security: { v: 1, crown: 'mast' }, data: { v: 0, up: 1 }, archive: { v: 1, crown: 'tank' },
  }
  const ART_DEFAULT = ART.business
  // the hotbar and the ghost have no staff: they show the 12 types in the three sizes in turn
  const SIZES = [9, 5, 2]
  const artOf = (type, n) => Object.assign({}, ART[type] || ART_DEFAULT, n === undefined ? {} : { n })
  const iconN = (type) => SIZES[Math.max(0, Object.keys(ART).indexOf(type)) % 3]
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

  /** One building on its plot, drawn from the office's size:
   *  8 or more desks: a tower (0 slab on a podium, 1 stepped);
   *  4 to 7: a glass block (0 cantilever over the lobby, 1 block with a low wing);
   *  3 or fewer: a long bar with a glass atrium; 'shed' is the unassigned work.
   *  The office type picks which of the two a size has, and what stands on the roof.
   *  One window pane belongs to each employee, coloured by state, filled from the
   *  top floor down. The way in is a flat canopy in the office colour over glass
   *  doors. Returns the svg, its highest point (the card hangs there) and the door
   *  (visitors stand there). */
  function building(I, art, c, wins) {
    const up = art.up || 0
    const { P, poly, box, onL, onR } = I
    const FH = 26
    let s = '', top = Infinity
    // the employees' panes are given out after the drawing: highest first, so the busiest people
    // sit on the top floor whichever block that is. A pane is a placeholder until then.
    const slots = []
    const pane = (z, f, side) => { slots.push({ z, f, side }); return '\u0001' + (slots.length - 1) + '\u0001' }
    // the tallest a roof may stand: so a tower never rises over the name sign of the plot behind it
    const capFloors = (x, y, z0, fh, want) => Math.max(1, Math.min(want, Math.floor((124 + 14 * (x + y) - z0 - 8) / fh)))
    function block(b) {
      const fh = b.fh || FH, z = b.z || 0, base = b.base || 0, hgt = base + b.floors * fh + 8
      s += box(b.x, b.y, b.w, b.d, z, hgt, WALL)
      const i = 0.17
      s += poly([P(b.x + i, b.y + i, z + hgt), P(b.x + b.w - i, b.y + i, z + hgt), P(b.x + b.w - i, b.y + b.d - i, z + hgt), P(b.x + i, b.y + b.d - i, z + hgt)], b.roof || ROOF)
      if (b.band) s += onL(b.y + b.d, b.x, b.x + b.w, z + hgt - 8, z + hgt - 2, c) + onR(b.x + b.w, b.y, b.y + b.d, z + hgt - 8, z + hgt - 2, shade(c, 0.8))
      const pw = b.pw || 0.62
      const nl = Math.max(1, Math.round(b.w / pw)), nr = Math.max(1, Math.round(b.d / pw))
      const lo = fh >= 24 ? 8 : 4, hi = fh >= 24 ? 14 : 8 // a tall storey has a window with a sill; a ribbon storey is nearly all glass
      for (let f = b.floors - 1; f >= 0; f--) {
        const z0 = z + base + f * fh + lo, z1 = z0 + fh - hi
        for (let k = 0; k < nl; k++) s += onL(b.y + b.d, b.x + (k + 0.16) * b.w / nl, b.x + (k + 0.84) * b.w / nl, z0, z1, b.staff ? pane(z0, k, 0) : GLASS[0])
        for (let k = 0; k < nr; k++) s += onR(b.x + b.w, b.y + (k + 0.16) * b.d / nr, b.y + (k + 0.84) * b.d / nr, z0, z1, b.staff ? pane(z0, k, 1) : GLASS[1])
      }
      top = Math.min(top, P(b.x, b.y, z + hgt)[1])
      return z + hgt
    }
    // a glazed lobby, its glass split by thin mullions
    function lobbyL(Y, x0, x1, z0, z1) {
      s += onL(Y, x0, x1, z0, z1, GLASS[0])
      const k = Math.max(2, Math.round((x1 - x0) / 0.7))
      for (let j = 1; j < k; j++) { const a = x0 + j * (x1 - x0) / k; s += onL(Y, a - 0.03, a + 0.03, z0, z1, WALL[1]) }
    }
    function lobbyR(X, y0, y1, z0, z1) {
      s += onR(X, y0, y1, z0, z1, GLASS[1])
      const k = Math.max(2, Math.round((y1 - y0) / 0.7))
      for (let j = 1; j < k; j++) { const a = y0 + j * (y1 - y0) / k; s += onR(X, a - 0.03, a + 0.03, z0, z1, WALL[2]) }
    }
    // the way in: glass doors, and a flat canopy in the office colour on two posts
    function entrance(Y, x0, x1, za) {
      const mid = (x0 + x1) / 2
      s += onL(Y, x0 + 0.2, x1 - 0.2, 0, za - 2, '#8FA9BE')
      s += onL(Y, mid - 0.02, mid + 0.02, 0, za - 2, '#4F6578')
      s += onL(Y, x0 + 0.2, x1 - 0.2, za - 5, za - 2, '#4F6578')
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
    const n = art.n !== undefined ? art.n : wins.length
    const v = art.v || 0
    let door
    if (art.k === 'shed') {
      const b = { x: 1.4, y: 1.5, w: 2.6, d: 2.1, base: 28, floors: 0, roof: '#D3D9DF' }
      block(b)
      s += onL(b.y + b.d, b.x + 0.5, b.x + 1.9, 0, 17, '#C5CDD5')
      for (let z = 3; z < 17; z += 3) s += onL(b.y + b.d, b.x + 0.5, b.x + 1.9, z, z + 0.8, '#B2BCC6')
      unit(b.x + 1.6, b.y + 0.4, 30, 0.6, 0.6, 6, true)
      door = [b.x + 1.2, b.y + b.d + 0.7]
    } else if (n >= 8 && v === 0) {
      // B1: a ribbon-window slab on a dark glass podium
      const pd = { x: 1.0, y: 1.2, w: 5.6, d: 5.0, base: 26, floors: 0, band: 1 }
      const pz = block(pd)
      lobbyL(pd.y + pd.d, pd.x + 0.2, pd.x + pd.w - 0.2, 3, 24)
      lobbyR(pd.x + pd.w, pd.y + 0.2, pd.y + pd.d - 0.2, 3, 24)
      const sl = { x: 2.2, y: 1.8, w: 3.4, d: 2.2, z: pz, base: 0, fh: 16, pw: 0.5, staff: 1, band: 1 }
      sl.floors = capFloors(sl.x, sl.y, pz, 16, 8 + up)
      const rz = block(sl)
      crown(sl.x + 0.6, sl.y + 0.7, rz)
      unit(sl.x + 1.9, sl.y + 0.6, rz, 0.8, 0.8, 9, true)
      entrance(pd.y + pd.d, pd.x + 2.0, pd.x + 3.4, 26)
      door = [pd.x + 2.7, pd.y + pd.d + 0.9]
    } else if (n >= 8) {
      // B2: three set-backs over a glazed lobby, each with its own band
      const lb = { x: 1.2, y: 1.3, w: 5.0, d: 4.6, base: 26, floors: 0, band: 1 }
      const lz = block(lb)
      lobbyL(lb.y + lb.d, lb.x + 0.2, lb.x + lb.w - 0.2, 3, 24)
      lobbyR(lb.x + lb.w, lb.y + 0.2, lb.y + lb.d - 0.2, 3, 24)
      const t1 = { x: 1.5, y: 1.6, w: 4.4, d: 3.8, z: lz, base: 0, fh: 16, pw: 0.5, staff: 1, band: 1 }
      t1.floors = 3
      const z1 = block(t1)
      const t2 = { x: 2.2, y: 2.2, w: 3.0, d: 2.6, z: z1, base: 0, fh: 16, pw: 0.5, staff: 1, band: 1 }
      t2.floors = 3
      const z2 = block(t2)
      const t3 = { x: 2.8, y: 2.8, w: 1.8, d: 1.5, z: z2, base: 0, fh: 16, pw: 0.5, staff: 1, band: 1 }
      t3.floors = capFloors(t3.x, t3.y, z2, 16, 2 + up)
      const rz = block(t3)
      crown(t3.x + 0.5, t3.y + 0.4, rz)
      entrance(lb.y + lb.d, lb.x + 1.6, lb.x + 3.0, 26)
      door = [lb.x + 2.3, lb.y + lb.d + 0.9]
    } else if (n >= 4 && v === 0) {
      // A1: a curtain-wall box that overhangs a dark glass lobby; the overhang is the way in
      const lb = { x: 1.8, y: 2.2, w: 3.2, d: 2.6, base: 28, floors: 0 }
      const lz = block(lb)
      lobbyL(lb.y + lb.d, lb.x + 0.2, lb.x + lb.w - 0.2, 3, 26)
      lobbyR(lb.x + lb.w, lb.y + 0.2, lb.y + lb.d - 0.2, 3, 26)
      const u = { x: 1.2, y: 1.4, w: 4.6, d: 4.4, z: lz, base: 0, band: 1, staff: 1, fh: 22, pw: 0.55 }
      u.floors = n >= 6 ? 3 : 2
      const rz = block(u)
      crown(u.x + 0.9, u.y + 1.0, rz)
      unit(u.x + 2.8, u.y + 0.8, rz, 1.1, 0.8, 8)
      entrance(lb.y + lb.d, lb.x + 0.9, lb.x + 2.3, 26)
      door = [lb.x + 1.6, u.y + u.d + 0.9]
    } else if (n >= 4) {
      // A2: a tall block and a low wing; the way in is on the wing, so the tall block stays clear
      const m = { x: 1.2, y: 1.2, w: 3.4, d: 3.4, base: 0, band: 1, staff: 1, fh: 20, pw: 0.55 }
      m.floors = n >= 6 ? 4 : 3
      const rz = block(m)
      crown(m.x + 0.8, m.y + 0.8, rz)
      unit(m.x + 1.8, m.y + 0.6, rz, 0.9, 0.8, 8, true)
      const w = { x: 3.4, y: 3.0, w: 3.0, d: 3.4, base: 0, band: 1, staff: 1, fh: 20, pw: 0.55, floors: 2 }
      block(w)
      lobbyL(w.y + w.d, w.x + 0.2, w.x + w.w - 0.2, 3, 12)
      entrance(w.y + w.d, w.x + 0.9, w.x + 2.1, 26)
      door = [w.x + 1.5, w.y + w.d + 0.9]
    } else {
      // C2: a three-storey bar with a glass atrium that projects at the front, a flat canopy over its doors
      const b = { x: 1.0, y: 2.0, w: 5.6, d: 3.0, base: 0, band: 1, staff: 1, fh: 22, pw: 0.6, floors: 3 }
      const rz = block(b)
      // the second variant has the atrium at the other end, so two types of one size still read apart
      const ax = v ? 4.2 : 1.4
      crown(b.x + (v ? 0.8 : 4.2), b.y + 1.0, rz)
      unit(b.x + (v ? 4.6 : 0.5), b.y + 0.5, rz, 0.8, 0.8, 7, true)
      const at = { x: ax, y: b.y + b.d, w: 2.0, d: 1.3, base: 0, floors: 2, fh: 22, roof: '#D3D9DF' }
      block(at)
      lobbyL(at.y + at.d, at.x + 0.15, at.x + at.w - 0.15, 3, 40)
      lobbyR(at.x + at.w, at.y + 0.15, at.y + at.d - 0.15, 3, 40)
      entrance(at.y + at.d, at.x + 0.3, at.x + 1.7, 28)
      door = [at.x + 1.0, at.y + at.d + 0.9]
    }
    // hand the panes out, highest first, then paint them by state
    const order = slots.map((q, i) => i).sort((a, b) => slots[b].z - slots[a].z || a - b)
    const fill = []
    order.forEach((idx, rank) => {
      const who = wins[rank], q = slots[idx]
      fill[idx] = who ? (q.side ? shade(ST_COL[who.s], 0.86) : ST_COL[who.s]) : GLASS[q.side]
    })
    s = s.replace(/\u0001(\d+)\u0001/g, (m, i) => fill[Number(i)])
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
    const zoom = '<div class="czoom" id="czoom" role="group" aria-label="' + T('Campus zoom') + '"><button type="button" data-czoom="out" title="' + T('Zoom out (-)') + '" aria-label="' + T('Zoom out') + '">−</button><output id="czoomv">' + digits(Math.round(cv.z * 100)) + T('%') + '</output><button type="button" data-czoom="in" title="' + T('Zoom in (+)') + '" aria-label="' + T('Zoom in') + '">+</button><button type="button" class="fitb" data-czoom="fit" title="' + T('Fit whole campus (0)') + '">' + T('Fit all') + '</button>' +
      (editable() ? '<button type="button" class="cbuild' + (L.build ? ' on' : '') + '" data-c3="build">' + (L.build ? 'Done building' : 'Build') + '</button>' : '') +
      '<span class="zh">' + (L.build ? digits(c.buildings.length) + ' of ' + digits(total) + ' lots' : c.readOnly ? 'Read-only: newer file' : T('Mouse wheel: zoom · Drag: pan')) + '</span></div>'
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
    if (!icons[id]) icons[id] = '<svg viewBox="-150 -155 300 330" width="66" height="58" aria-hidden="true">' + building(iso(0, 0), artOf(id, iconN(id)), '#4E7FD6', []).svg + '</svg>'
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
    if (free) { g = building(I, artOf(type, iconN(type)), '#3B6FE0', []).svg; if (rot % 2 === 1) g = mirrored(g, ox) }
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
  // the Today strip and the zoom control lie over the top of the map: "fit" keeps the campus below them
  const CZ_TOP = 56
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
    cv.SW = box.clientWidth; cv.SH = Math.max(120, box.clientHeight - CZ_TOP)
    const v = campusClamp(cv, cv.SW, cv.SH, cv.W, cv.H)
    cv.z = v.z; cv.x = v.x; cv.y = v.y
    if (ease && !calmMotion()) { inner.classList.add('ease'); clearTimeout(cEaseT); cEaseT = setTimeout(() => { const i = document.getElementById('cmap-in'); if (i) i.classList.remove('ease') }, 240) }
    inner.style.transform = 'translate(' + ((cv.SW - cv.W * v.s) / 2 + v.x).toFixed(1) + 'px,' + ((cv.SH - cv.H * v.s) / 2 + v.y + CZ_TOP).toFixed(1) + 'px) scale(' + v.s.toFixed(4) + ')'
    inner.style.setProperty('--bs', campusCardScale(v.s).toFixed(3))
    // far out, full cards would cover each other: they shrink to the name and the counts
    inner.classList.toggle('far', v.s < 0.5)
    const out = document.getElementById('czoomv')
    if (out) out.textContent = digits(Math.round(v.z * 100)) + T('%')
  }
  /** Zoom by f, keeping the campus point under (mx, my) where it is. */
  function campusZoomAt(mx, my, f, ease) {
    my -= CZ_TOP // box coordinates in, the fitted area's out
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
    else campusZoomAt(cv.SW / 2, cv.SH / 2 + CZ_TOP, b.dataset.czoom === 'in' ? 1.25 : 0.8, true)
  })
  // the keyboard, while the map has the focus; the redraw would drop that
  // focus, so it is given back to the new map (see fit)
  document.addEventListener('focusin', (e) => { cv.kbd = e.target && e.target.id === 'cmap' })
  document.addEventListener('keydown', (e) => {
    if (!e.target || e.target.id !== 'cmap') return
    const pans = { ArrowLeft: [60, 0], ArrowRight: [-60, 0], ArrowUp: [0, 60], ArrowDown: [0, -60] }
    if (pans[e.key]) { cv.x += pans[e.key][0]; cv.y += pans[e.key][1]; applyCampus(true) }
    else if (e.key === '+' || e.key === '=') campusZoomAt(cv.SW / 2, cv.SH / 2 + CZ_TOP, 1.25, true)
    else if (e.key === '-' || e.key === '_') campusZoomAt(cv.SW / 2, cv.SH / 2 + CZ_TOP, 0.8, true)
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
