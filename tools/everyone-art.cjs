/* The drawings of the 1.0 screens: the people (the one Kenney character of the
 * office, as a round portrait with the office colour and an initials badge),
 * the assistant's round robot, the line icons, file thumbnails and the
 * isometric campus of the wizard.
 *
 * everyoneArt is never run in Node: like everyoneViews its source is written
 * into the page, so it uses only what the browser has and returns strings.
 * Nothing here reads data or the page language; a caller passes what is drawn
 * and any text (already through T()), and every text that comes from data is
 * escaped here or by the caller.
 *
 * A person's angle is a pure function of a seed (their id, or id + ':' + the
 * look they picked), so the same member looks the same on every screen and in
 * every browser, with nothing stored but an optional small number.
 */

function everyoneArt() {
  const hash = (s) => { let h = 2166136261; for (const c of String(s)) { h ^= c.charCodeAt(0); h = Math.imul(h, 16777619) } return h >>> 0 }
  const SKIN = ['#F1C8A5', '#DDA77F', '#B97A56', '#8A5A3C']
  const HAIR = ['#2B2118', '#5A3A22', '#C9A24B', '#1A1A1F', '#8C4A2F', '#A9B2BC']
  function shade(hex, f) {
    const n = parseInt(String(hex || '#8A97A6').slice(1), 16) || 0
    const m = (v) => Math.max(0, Math.min(255, Math.round(v * f)))
    return '#' + [m(n >> 16), m((n >> 8) & 255), m(n & 255)].map((v) => v.toString(16).padStart(2, '0')).join('')
  }
  /** A light tint of a colour (k: how much white), for a portrait's background. */
  const tint = (hex, k) => '#' + [1, 3, 5].map((i) => Math.round((parseInt(String(hex || '#56B6C2').substr(i, 2), 16) || 0) * (1 - k) + 255 * k).toString(16).padStart(2, '0')).join('')
  const esc = (s) => String(s).replace(/[&<>"']/g, (c) => ({ '&': '&amp;', '<': '&lt;', '>': '&gt;', '"': '&quot;', "'": '&#39;' })[c])
  /** Up to two letters for the badge: the first letters of the first two words ("Code reviewer" gives CR), else the first two letters. */
  function initials(name) {
    const w = String(name || '').split(/[\s\-_:.]+/).filter(Boolean)
    const a = w.length > 1 ? Array.from(w[0])[0] + Array.from(w[1])[0] : Array.from(w[0] || '?').slice(0, 2).join('')
    return a.toUpperCase()
  }

  // ---------- people: the one office character, drawn from its rendered portraits
  // The pictures are the manifest's portrait:<view> entries (tools/render-portraits.cjs
  // renders them from the Kenney figure the office uses), reaching the page in
  // ASSET_MODELS as base64. With none (the archive page, or a refused file) a round
  // head on a coloured body is drawn, so a person is never missing.
  const VIEW = ['front', 'left', 'right']
  const pic = (v) => { try { return typeof ASSET_MODELS === 'object' && ASSET_MODELS && ASSET_MODELS['portrait:' + v] ? 'data:image/png;base64,' + ASSET_MODELS['portrait:' + v] : '' } catch (e) { return '' } }
  /** The pictures as CSS classes, written once: a page with hundreds of faces carries each picture once. */
  function css() {
    if (typeof document === 'undefined' || !document.head) return
    const have = !!pic('front')
    const old = document.getElementById('ptcss')
    if (old && old.dataset.have === String(have)) return
    if (old) old.remove()
    const el = document.createElement('style')
    el.id = 'ptcss'; el.dataset.have = String(have)
    el.textContent = VIEW.map((v, i) => pic(v) ? '.pt .pv' + i + '{background-image:url(' + pic(v) + ')}' : '').join('') +
      (pic('desk') ? '.dk .di{background-image:url(' + pic('desk') + ')}' : '')
    document.head.appendChild(el)
  }
  /** The round head on a coloured body, when there is no picture. */
  const plainG = (h, color) => '<ellipse cx="20" cy="40" rx="15" ry="13" fill="' + color + '"/><circle cx="20" cy="18" r="9" fill="' + SKIN[h % 4] + '"/><path d="M11 17a9 9 0 0 1 18 0c-3-3-6-4-9-4s-6 1-9 4z" fill="' + HAIR[(h >> 3) % 6] + '"/>'
  /** A person: `seed` picks the angle (and the mirror) of the one figure, `color` is the office (the tint, the ring and the badge), `name` gives the initials (else the id in the seed). */
  function person(seed, color, size, back, name) {
    css()
    size = size || 32
    color = color || '#56B6C2'
    const h = hash(seed), v = h % 6
    const bd = size >= 32 ? Math.max(16, Math.round(size * 0.42)) : 0
    const badge = bd ? '<b class="ini" dir="auto" data-i="' + esc(initials(name || String(seed).split(':')[0])) + '" style="width:' + bd + 'px;height:' + bd + 'px;font-size:' + Math.max(9, Math.round(bd * 0.5)) + 'px;background:' + color + '"></b>' : ''
    const inner = pic('front') ? '<span class="pi pv' + (v % 3) + (v > 2 ? ' fl' : '') + '"></span>' : '<svg viewBox="0 0 40 40" width="100%" height="100%" aria-hidden="true">' + plainG(h, color) + '</svg>'
    return '<span class="av pt" style="width:' + size + 'px;height:' + size + 'px"><span class="pp" style="background:' + tint(color, 0.78) + ';box-shadow:0 0 0 2px ' + color + '">' + inner + '</span>' + badge + '</span>'
  }
  const owner = (size) => person('owner-of-the-company', '#0C8A62', size, false, 'Me')
  /** The assistant: a flat round robot head, in the same round frame. */
  function robot(size) {
    size = size || 32
    return '<span class="av pt" style="width:' + size + 'px;height:' + size + 'px"><span class="pp" style="background:#E4F3EC;box-shadow:0 0 0 2px #0C8A62"><svg viewBox="0 0 40 40" width="100%" height="100%" aria-hidden="true"><line x1="20" y1="6" x2="20" y2="11" stroke="#0C8A62" stroke-width="2" stroke-linecap="round"/><circle cx="20" cy="5.5" r="2.2" fill="#0C8A62"/><rect x="8" y="11" width="24" height="19" rx="6" fill="#C6D0DA"/><circle cx="15" cy="20" r="3" fill="#1F2A36"/><circle cx="25" cy="20" r="3" fill="#1F2A36"/><rect x="15" y="25" width="10" height="2" rx="1" fill="#0C8A62"/><rect x="11" y="33" width="18" height="9" rx="4" fill="#8A97A6"/></svg></span></span>'
  }
  /** The desk picture of the Team screen: the one figure seated at the Kenney desk, on a light tile of the office colour. */
  const desk = (color) => { css(); return '<span class="dk"><span class="tile" style="background:' + tint(color, 0.86) + '"></span><span class="di"></span></span>' }
  /** The same person as an SVG group, for the iso scenes (scale * 12 px across); needs personDefs(d) once in the same svg. */
  function personG(seed, color, x, y, scale, name) {
    const d = (scale || 3) * 12, h = hash(seed), v = h % 6, r = d / 2
    color = color || '#56B6C2'
    const bd = Math.max(14, d * 0.42), bx = d - bd * 0.3
    const inner = pic('front')
      ? '<use href="#ptimg' + (v % 3) + '" transform="' + (v > 2 ? 'translate(' + d + ',0) scale(' + (-d / 192) + ',' + (d / 192) + ')' : 'scale(' + (d / 192) + ')') + '"/>'
      : '<g transform="scale(' + (d / 40) + ')">' + plainG(h, color) + '</g>'
    return '<g transform="translate(' + x.toFixed(1) + ',' + y.toFixed(1) + ')"><circle cx="' + r + '" cy="' + r + '" r="' + r + '" fill="' + tint(color, 0.78) + '"/><g clip-path="url(#ptclip' + d + ')">' + inner + '</g><circle cx="' + r + '" cy="' + r + '" r="' + (r - 1) + '" fill="none" stroke="' + color + '" stroke-width="2"/><circle cx="' + bx + '" cy="' + bx + '" r="' + bd / 2 + '" fill="' + color + '"/><text x="' + bx + '" y="' + (bx + bd * 0.17).toFixed(1) + '" text-anchor="middle" dir="auto" style="font:700 ' + Math.round(bd * 0.46) + 'px var(--font-ui);fill:#fff">' + esc(initials(name || String(seed).split(':')[0])) + '</text></g>'
  }
  /** The <defs> the personG people of one svg share: a round clip of d px and the three pictures. */
  const personDefs = (d) => '<defs><clipPath id="ptclip' + d + '"><circle cx="' + d / 2 + '" cy="' + d / 2 + '" r="' + d / 2 + '"/></clipPath>' + (pic('front') ? VIEW.map((v, i) => '<image id="ptimg' + i + '" width="192" height="192" href="' + pic(v) + '"/>').join('') : '') + '</defs>'

  const IC = {
    check: 'M5 12l5 5 9-10', x: 'M6 6l12 12M18 6L6 18', plus: 'M12 5v14M5 12h14', chev: 'M9 6l6 6-6 6', back: 'M15 6l-6 6 6 6',
    bell: 'M6 17V11a6 6 0 0 1 12 0v6l2 2H4zM10 21h4', out: 'M14 4h6v6M20 4l-9 9M18 14v5a1 1 0 0 1-1 1H5a1 1 0 0 1-1-1V7a1 1 0 0 1 1-1h5',
    lock: 'M6 11h12v9H6zM8 11V8a4 4 0 0 1 8 0v3', shield: 'M12 3l8 3v6c0 5-3.5 8-8 9-4.5-1-8-4-8-9V6z', info: 'M12 21a9 9 0 1 0 0-18 9 9 0 0 0 0 18zM12 11v5M12 8h.01',
    cal: 'M4 6h16v14H4zM4 10h16M8 3v4M16 3v4', clock: 'M12 7v5l3 2M12 21a9 9 0 1 0 0-18 9 9 0 0 0 0 18z', send: 'M3 11l18-8-8 18-2-8z',
    comment: 'M4 5h16v11H9l-5 4z', pencil: 'M4 20l1-5L16 4l4 4L9 19zM14 6l4 4', eye: 'M2 12s4-7 10-7 10 7 10 7-4 7-10 7S2 12 2 12zM12 15a3 3 0 1 0 0-6 3 3 0 0 0 0 6z',
    doc: 'M7 3h7l5 5v12a1 1 0 0 1-1 1H7a1 1 0 0 1-1-1V4a1 1 0 0 1 1-1zM14 3v5h5M9 13h6M9 17h6', image: 'M4 5h16v14H4zM4 16l5-5 4 4 3-3 4 4M15 9.5h.01',
    table: 'M4 5h16v14H4zM4 10h16M4 15h16M10 5v14', link: 'M10 14a4 4 0 0 0 5.7 0l3-3a4 4 0 0 0-5.7-5.7l-1 1M14 10a4 4 0 0 0-5.7 0l-3 3a4 4 0 0 0 5.7 5.7l1-1',
    globe: 'M12 21a9 9 0 1 0 0-18 9 9 0 0 0 0 18zM3 12h18M12 3c3 3 3 15 0 18M12 3c-3 3-3 15 0 18', download: 'M12 4v11M7 11l5 5 5-5M5 20h14',
    search: 'M11 4a7 7 0 1 0 0 14 7 7 0 0 0 0-14zM20 20l-4-4', plug: 'M9 3v5M15 3v5M6 8h12v3a6 6 0 0 1-12 0zM12 17v4', phone: 'M8 3h8a1 1 0 0 1 1 1v16a1 1 0 0 1-1 1H8a1 1 0 0 1-1-1V4a1 1 0 0 1 1-1zM11 18h2',
    box: 'M3 8l9-5 9 5v8l-9 5-9-5zM3 8l9 5 9-5M12 13v8', warn: 'M12 3l10 18H2zM12 10v5M12 18h.01', home: 'M3 11l9-8 9 8v9a1 1 0 0 1-1 1h-5v-6H9v6H4a1 1 0 0 1-1-1z',
    copy: 'M8 8h11v12H8zM5 16V4h11', trash: 'M5 7h14M9 7V4h6v3M7 7l1 13h8l1-13', spark: 'M12 3l2 6 6 2-6 2-2 6-2-6-6-2 6-2z', pause: 'M8 5v14M16 5v14',
  }
  /** A line icon, decorative (aria-hidden): the button or label next to it says what it is. */
  const ic = (n, s, sw) => '<svg class="ic" width="' + (s || 16) + '" height="' + (s || 16) + '" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="' + (sw || 1.9) + '" stroke-linecap="round" stroke-linejoin="round" aria-hidden="true"><path d="' + (IC[n] || '') + '"/></svg>'

  /** A drawn stand-in for a file that has no picture of its own. */
  function thumb(kind, c) {
    const W = 260, H = 150
    let s = ''
    if (kind === 'doc') s = '<rect x="70" y="14" width="120" height="122" rx="3" fill="#1F2A36"/><rect x="82" y="28" width="60" height="8" fill="#10161D"/><rect x="82" y="46" width="96" height="4" fill="#9AA7B5"/><rect x="82" y="56" width="90" height="4" fill="#9AA7B5"/><rect x="82" y="66" width="96" height="4" fill="#9AA7B5"/><rect x="82" y="82" width="40" height="22" fill="' + c + '"/><rect x="128" y="82" width="50" height="4" fill="#9AA7B5"/><rect x="128" y="92" width="44" height="4" fill="#9AA7B5"/><rect x="82" y="112" width="96" height="4" fill="#9AA7B5"/>'
    else if (kind === 'sheet') { for (let r = 0; r < 6; r++) for (let q = 0; q < 5; q++) s += '<rect x="' + (22 + q * 44) + '" y="' + (18 + r * 20) + '" width="42" height="18" fill="' + (r === 0 ? c : (r + q) % 2 ? '#1B2530' : '#E3E8ED') + '"/>' }
    else if (kind === 'link') s = '<rect x="22" y="22" width="216" height="106" rx="6" fill="#F6F8FA" stroke="#B8C3CE"/><rect x="36" y="38" width="22" height="22" rx="4" fill="' + c + '"/><rect x="68" y="40" width="110" height="7" fill="#C6D0DA"/><rect x="68" y="54" width="70" height="5" fill="#8A97A6"/><rect x="36" y="78" width="188" height="5" fill="#B8C3CE"/><rect x="36" y="90" width="160" height="5" fill="#B8C3CE"/><rect x="36" y="102" width="120" height="5" fill="#B8C3CE"/>'
    else s = '<rect x="30" y="20" width="200" height="110" rx="4" fill="#F1F4F7" stroke="#B8C3CE"/><rect x="44" y="36" width="12" height="5" fill="' + c + '"/><rect x="62" y="36" width="90" height="5" fill="#A6B1BD"/><rect x="44" y="52" width="150" height="5" fill="#6A7785"/><rect x="44" y="66" width="170" height="5" fill="#6A7785"/><rect x="44" y="80" width="130" height="5" fill="#6A7785"/><rect x="44" y="94" width="160" height="5" fill="#6A7785"/>'
    return '<svg viewBox="0 0 ' + W + ' ' + H + '" width="100%" height="100%" preserveAspectRatio="xMidYMid slice" shape-rendering="crispEdges" aria-hidden="true">' + s + '</svg>'
  }

  // ---------- isometric scenes
  function iso(ox, oy, TW, TH) {
    const P = (x, y, z) => [ox + (x - y) * TW / 2, oy + (x + y) * TH / 2 - (z || 0)]
    const poly = (pts, fill, stroke, extra) => '<polygon points="' + pts.map((p) => p[0].toFixed(1) + ',' + p[1].toFixed(1)).join(' ') + '" fill="' + fill + '" stroke="' + (stroke || 'none') + '" stroke-width="1" stroke-linejoin="round"' + (extra || '') + '/>'
    const box = (x, y, w, d, h, top, left, right, z0) => {
      z0 = z0 || 0
      const A = P(x, y, z0 + h), B = P(x + w, y, z0 + h), C = P(x + w, y + d, z0 + h), D = P(x, y + d, z0 + h)
      const B0 = P(x + w, y, z0), C0 = P(x + w, y + d, z0), D0 = P(x, y + d, z0)
      return poly([D, C, C0, D0], left) + poly([B, C, C0, B0], right) + poly([A, B, C, D], top)
    }
    return { P, poly, box }
  }
  const text = (x, y, s, o) => { o = o || {}; return '<text x="' + x.toFixed(1) + '" y="' + y.toFixed(1) + '" text-anchor="middle" style="font:' + (o.w || 700) + ' ' + (o.size || 12) + 'px ' + (o.mono ? 'var(--font-ui)' : 'var(--font-ui)') + ';fill:' + (o.fill || '#C6D0DA') + '">' + s + '</text>' }
  // `s` is already escaped by the caller; its length only sizes the label
  const tag = (x, y, s, o) => {
    o = o || {}
    const plain = String(s).replace(/&[a-z#0-9]+;/g, 'x')
    const w = Math.max(36, plain.length * 7 + 18)
    return '<g class="tagg"><rect x="' + (x - w / 2).toFixed(1) + '" y="' + (y - 12).toFixed(1) + '" width="' + w + '" height="22" rx="4" fill="' + (o.bg || '#FFFFFF') + '" stroke="' + (o.stroke || '#B8C3CE') + '"/>' + text(x, y + 4, s, { size: 12, fill: o.fill || '#1F2A36' }) + '</g>'
  }

  /** The campus: up to six buildings on a light grey checkerboard slab. plots: [{ color, label,
   *  count, h, built }], people: [{ seed, color, plot }] standing at a plot. */
  function campus(plots, people) {
    const SPOTS = [[1, 1], [5, 1], [1, 5], [5, 5], [3, 0.2], [3, 6.2]]
    const I = iso(450, 110, 100, 50), P = I.P, poly = I.poly, box = I.box
    const size = 8, mid = size / 2
    let s = poly([P(0, 0), P(size, 0), P(size, size), P(0, size)], '#EEF0F3', '#CBD1D9')
    for (let i = 0; i < size; i++) for (let j = 0; j < size; j++) if ((i + j) % 2) s += poly([P(i, j), P(i + 1, j), P(i + 1, j + 1), P(i, j + 1)], '#E3E7EC')
    s += poly([P(mid - 0.3, 0), P(mid + 0.3, 0), P(mid + 0.3, size), P(mid - 0.3, size)], '#D5DBE1') + poly([P(0, mid - 0.3), P(size, mid - 0.3), P(size, mid + 0.3), P(0, mid + 0.3)], '#D5DBE1')
    s += poly([P(0, size), P(size, size), P(size, size, -14), P(0, size, -14)], '#C9CFD6') + poly([P(size, 0), P(size, size), P(size, size, -14), P(size, 0, -14)], '#BBC2CA')
    const placed = plots.slice(0, SPOTS.length).map((p, i) => Object.assign({ x: SPOTS[i][0], y: SPOTS[i][1] }, p))
    const labels = []
    for (const p of placed.slice().sort((a, b) => (a.x + a.y) - (b.x + b.y))) {
      const w = 2, d = 2
      if (!p.built) {
        s += poly([P(p.x, p.y), P(p.x + w, p.y), P(p.x + w, p.y + d), P(p.x, p.y + d)], 'rgba(255,255,255,.025)', '#B8C3CE', ' stroke-dasharray="6 5"')
        const c = P(p.x + w / 2, p.y + d / 2)
        s += text(c[0], c[1] + 8, '+', { size: 26, fill: '#6A7785', w: 400 })
        continue
      }
      const h = p.h || 90, col = p.color
      s += poly([P(p.x - 0.15, p.y - 0.15), P(p.x + w + 0.15, p.y - 0.15), P(p.x + w + 0.15, p.y + d + 0.15), P(p.x - 0.15, p.y + d + 0.15)], '#E3E8ED')
      s += box(p.x, p.y, w, d, h, shade(col, 0.55), '#F2F4F6', '#E2E6EA')
      s += box(p.x - 0.05, p.y - 0.05, w + 0.1, d + 0.1, 10, col, shade(col, 0.75), shade(col, 0.6), h)
      const rows = Math.floor((h - 20) / 26), cols = Math.round(w * 2.2)
      for (let r = 0; r < rows; r++) {
        for (let c = 0; c < cols; c++) { const u = 0.22 + c * (w - 0.44) / Math.max(1, cols - 1) - 0.1, z = 14 + r * 26; s += poly([P(p.x + u, p.y + d, z), P(p.x + u + 0.22, p.y + d, z), P(p.x + u + 0.22, p.y + d, z + 15), P(p.x + u, p.y + d, z + 15)], (r + c + p.x) % 3 === 0 ? col : '#2A3A4B') }
        for (let c = 0; c < cols; c++) { const u = 0.22 + c * (d - 0.44) / Math.max(1, cols - 1) - 0.1, z = 14 + r * 26; s += poly([P(p.x + w, p.y + u, z), P(p.x + w, p.y + u + 0.22, z), P(p.x + w, p.y + u + 0.22, z + 15), P(p.x + w, p.y + u, z + 15)], (r + c) % 4 === 1 ? col : '#223040') }
      }
      const t = P(p.x + w / 2, p.y + d / 2, h + 10)
      labels.push(tag(t[0], t[1] - 22, p.label + (p.count !== undefined && p.count !== '' ? ' · ' + p.count : ''), { stroke: col }))
    }
    if ((people || []).length) s = personDefs(36) + s
    for (const a of people || []) {
      const p = placed[a.plot]
      if (!p) continue
      const q = P(p.x + 0.35 + (a.n || 0) * 0.75, p.y + 2.45)
      s += '<ellipse cx="' + q[0].toFixed(1) + '" cy="' + (q[1] + 2).toFixed(1) + '" rx="14" ry="6" fill="rgba(0,0,0,.16)"/>' + personG(a.seed, a.color, q[0] - 18, q[1] - 40, 3, a.name)
    }
    return s + labels.join('')
  }

  /** The assistant's laptop, next to the campus while the wizard waits for its hello. */
  function laptop(label, sub, linked) {
    const I = iso(660, 215, 100, 50), P = I.P, box = I.box
    const sp = P(1.2, 0.14, 70)
    let wire = ''
    for (let i = 0; i < 8; i++) wire += '<rect x="' + (540 + i * 22) + '" y="' + (430 - i * 11) + '" width="8" height="8" fill="' + (linked || i < 4 ? '#0C8A62' : '#B8C3CE') + '"/>'
    return wire + box(0, 0, 2.4, 1.6, 10, '#C6D0DA', '#8A97A6', '#6A7785') + box(0, 0, 2.4, 0.14, 100, '#E3E8ED', linked ? '#CDEBDD' : '#CFE0EE', '#E2E6EA', 10) +
      '<g transform="translate(' + sp[0].toFixed(1) + ',' + sp[1].toFixed(1) + ') matrix(1,.5,0,1,0,0)">' + text(0, 0, label, { size: 17, fill: linked ? '#0C8A62' : '#1F7A8C' }) + text(0, 22, sub, { size: 13, fill: '#8A97A6', w: 400 }) + '</g>'
  }

  return { hash, shade, tint, initials, person, owner, robot, desk, personG, ic, thumb, campus, laptop }
}

module.exports = { everyoneArt }
