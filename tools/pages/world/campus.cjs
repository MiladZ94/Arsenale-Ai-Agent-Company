/* ======================================================================
 * The campus. One plot per office on a plain grid, with no streets
 * between: a building never stands in front of another, so each plot is
 * drawn back to front on its own. x and y are plot tiles, z is pixels.
 * The page calls draw() on every poll; the zoom and pan are kept here and
 * laid back on after each drawing (fit()).
 * ====================================================================== */
function campusArt(h) {
  const { esc, fa } = h
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
    return { P, poly, flat, box, onL, onR }
  }
  const shade = (hex, f) => '#' + [1, 3, 5].map((i) => Math.max(0, Math.min(255, Math.round(parseInt(hex.substr(i, 2), 16) * f))).toString(16).padStart(2, '0')).join('')

  /** One building on its plot. `kind` picks the shape (0 shop with an awning,
   *  1 tower with a low annex, 2 corner L, 3 wide low block, 'shed'). The panes
   *  of the blocks marked `staff` are the people's, one each, filled from the
   *  top floor down. Returns the svg, its highest point (the card hangs there)
   *  and the door (visitors stand there). */
  function building(I, kind, c, wins) {
    const { P, poly, box, onL, onR } = I
    const FH = 30
    let s = '', n = 0, top = Infinity
    const pane = (f, side) => { const who = wins[n++]; return who ? (side ? shade(ST_COL[who.s], 0.86) : ST_COL[who.s]) : f }
    const per = (b) => Math.max(1, Math.round(b.w / 0.62)) + Math.max(1, Math.round(b.d / 0.62))
    const floorsFor = (b, min, max) => Math.max(min, Math.min(max, Math.ceil(wins.length / per(b))))
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

  /** The whole campus. m.cells: [{ id, name, color, kind, wins:[{s}], label,
   *  sign (the card's html), small }]; m.hq: the office whose plot has the
   *  supervisor's kiosk ({ id, lit, label }); m.visitors: [{ officeId, draw(x, y) }];
   *  m.legend, m.tip and m.side: html the page made. */
  function draw(m) {
    const cells = m.cells
    const cols = Math.max(1, Math.min(cells.length, cells.length <= 4 ? 2 : cells.length <= 9 ? 3 : Math.ceil(Math.sqrt(cells.length))))
    const rows = Math.max(1, Math.ceil(cells.length / cols))
    const W = MX * 2 + cols * CW, H = MY * 2 + rows * CH
    cv.W = W; cv.H = H
    let s = '<svg width="' + W + '" height="' + H + '" viewBox="0 0 ' + W + ' ' + H + '" aria-hidden="true">' +
      '<defs><pattern id="cmap-grid" width="' + TW + '" height="' + TH + '" patternUnits="userSpaceOnUse"><path d="M0 ' + TH / 2 + 'L' + TW / 2 + ' 0L' + TW + ' ' + TH / 2 + 'L' + TW / 2 + ' ' + TH + 'Z" fill="none" stroke="#E2E6EA" stroke-width="1"/></pattern></defs>' +
      // the grid runs well past the campus, so zooming out never shows its edge
      '<rect x="' + -2 * W + '" y="' + -2 * H + '" width="' + 5 * W + '" height="' + 5 * H + '" fill="url(#cmap-grid)"/>'
    const signs = []
    cells.forEach((cell, i) => {
      const row = Math.floor(i / cols), inRow = Math.min(cols, cells.length - row * cols)
      const shed = cell.kind === 'shed'
      const PL = shed ? 6 : PLOT
      // a short last row is centred
      const ox = MX + ((i % cols) + (cols - inRow) / 2) * CW + CW / 2
      let oy = MY + row * CH + 196 + (PLOT - PL) * TH / 2
      // the plot's corner sits on a corner of the ground grid, so the grid runs on under the plinth
      if ((Math.round(ox / (TW / 2)) + Math.round(oy / (TH / 2))) % 2 === 0) oy += TH / 2
      const I = iso(ox, oy)
      const { P, poly, flat, box } = I
      const c = cell.color || '#8A97A6'
      // the plot is paved flush with the ground, behind a kerb a few centimetres high: no island, no shadow
      let g = box(E, E, PL - 2 * E, PL - 2 * E, 0, 3, PLINTH)
      g += poly([P(E, E, 3), P(PL - E, E, 3), P(PL - E, PL - E, 3), P(E, PL - E, 3)], PLINTH[0], ' class="pl"')
      const b = building(I, cell.kind, c, shed ? [] : cell.wins || [])
      // a paved way from the door to the edge of the plot
      g += flat([P(b.door[0] - 0.45, b.door[1] - 0.6, 3), P(b.door[0] + 0.45, b.door[1] - 0.6, 3), P(b.door[0] + 0.45, PL - E, 3), P(b.door[0] - 0.45, PL - E, 3)], '#E6EAEE')
      g += b.svg
      if (!shed) g += nameSign(I, cell.name, c, PL - E - 0.4, PL - E - 0.45)
      s += '<g class="bld" style="--c:' + esc(c) + '" data-goto="office:' + esc(cell.id) + '" data-office="' + esc(cell.id) + '" role="button" tabindex="0" aria-label="' + esc(cell.label) + '">' + g + '</g>'
      if (m.hq && cell.id === m.hq.id && !shed) {
        // the supervisor's kiosk at the corner of its office's plot; the flag is up while it is active
        const [kx, ky] = P(6.85, 1.25, 26)
        s += '<g class="bld" style="--c:#C9B6F2" data-goto="office:' + esc(cell.id) + '" role="button" tabindex="0" aria-label="' + esc(m.hq.label) + '">' +
          box(6.5, 0.9, 0.7, 0.7, 0, 22, ['#E4DAF8', '#C9B6F2', '#9C8BC8']) + box(6.37, 0.77, 0.96, 0.96, 22, 4, ['#F1ECFB', '#B8A6E4', '#8E7DBA']) +
          '<rect x="' + (kx - 0.8).toFixed(1) + '" y="' + (ky - 30).toFixed(1) + '" width="1.6" height="30" fill="#8A97A6"/>' +
          '<rect x="' + (kx + 0.8).toFixed(1) + '" y="' + (ky - 30).toFixed(1) + '" width="15" height="9" fill="' + (m.hq.lit ? '#FFC23D' : '#AEB8C2') + '"/></g>'
      }
      // visitors: one figure at the door for each person working here from another office
      let v = 0
      for (const vis of m.visitors || []) {
        if (vis.officeId !== cell.id || v >= 4) continue
        const [px, py] = P(b.door[0] + (v % 2 ? 0.6 : -0.6) * Math.ceil(v / 2 + 0.5), b.door[1] + 0.2)
        s += '<g shape-rendering="crispEdges">' + vis.draw(px, py) + '</g>'
        v++
      }
      signs.push({ cell, x: ox, y: b.top - 16 })
    })
    s += '</svg>'
    const html = signs.map(({ cell, x, y }) => '<div class="sign' + (cell.small ? ' small' : '') + '" style="--c:' + esc(cell.color || '#8A97A6') + ';left:' + x + 'px;top:' + Math.round(y) + 'px">' + cell.sign + '</div>').join('')
    const zoom = '<div class="czoom" id="czoom" role="group" aria-label="' + T('Campus zoom') + '"><button type="button" data-czoom="out" title="' + T('Zoom out (-)') + '" aria-label="' + T('Zoom out') + '">−</button><output id="czoomv">' + fa(Math.round(cv.z * 100)) + T('%') + '</output><button type="button" data-czoom="in" title="' + T('Zoom in (+)') + '" aria-label="' + T('Zoom in') + '">+</button><button type="button" class="fitb" data-czoom="fit" title="' + T('Fit whole campus (0)') + '">' + T('Fit all') + '</button><span class="zh">' + T('Mouse wheel: zoom · Drag: pan') + '</span></div>'
    return '<div class="cwrap"><div class="cmap" id="cmap" tabindex="0" aria-label="' + T('Campus — mouse wheel or + and - to zoom, drag or arrow keys to pan, 0 to fit') + '"><div class="cmap-in" id="cmap-in" style="width:' + W + 'px;height:' + H + 'px">' + s + html + '</div>' + zoom + (m.tip || '') + (m.legend || '') + '</div>' + (m.side || '') + '</div>'
  }

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
    if (!inMap(e) || e.target.closest('.czoom,.cleg,.ctip')) return
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
  document.addEventListener('keydown', (e) => { if (e.key === 'Enter' && e.target.matches && e.target.matches('g.bld') && h.go) h.go(e.target.getAttribute('data-goto')) })

  /** Lays the freshly drawn campus into the space it has, at the zoom and pan
   *  it was left at. */
  function fit() {
    applyCampus(false)
    const box = document.getElementById('cmap')
    if (box && cv.kbd && (!document.activeElement || document.activeElement === document.body)) box.focus({ preventScroll: true })
  }

  return { draw, fit, ST_COL, cv }
}

module.exports = { campusArt }
