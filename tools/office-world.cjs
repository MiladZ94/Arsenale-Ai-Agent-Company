/* The look of the company's world, shared by two dashboards: Arsenale and a
 * private copy of it that its author runs at home. Both draw the campus and
 * the office floor with this file, so the two always look and behave alike.
 *
 * SOURCE OF TRUTH: Arsenale, tools/office-world.cjs (with tools/vendor/three/
 * and tools/characters/default.glb). Other copies are synced from there and
 * never edited in place; see tools/OFFICE-WORLD-NOTE.md. Keep this file free
 * of any one company's names, offices or people: it is public.
 *
 * Three parts:
 *  - campusArt(h): the campus, light isometric white buildings on plinths,
 *    one plot per office, the office's card above its building, zoom and pan.
 *    It draws what the page hands it; counting work, money and budgets stays
 *    in the page (companyViews).
 *  - office3d(h): the office floor in three.js r184: one floating white
 *    podium per person with a desk, a chair and their character, a portrait
 *    card above it whose frame is the person's state, the handed-in tray, and
 *    a camera that pans, orbits and zooms and survives every redraw. Returns
 *    null when three.js or WebGL is not there, and the page keeps its flat
 *    office.
 *  - worldScripts(opts), in Node: the pinned three.js files and the
 *    characters, inlined into the page as <script> blocks (the dashboards'
 *    servers serve pages and JSON only, and the pages load nothing from a CDN).
 *
 * campusArt and office3d are never run in Node: like the pages' own client
 * code their source is written into the page, so they may use only what a
 * browser has, plus the page's globals T(key), LANG, THREE and THREE_ADDONS.
 * Every font is Arial (the house rule), canvas text included.
 */
const fs = require('fs')
const path = require('path')

const FONT = 'Arial, "Helvetica Neue", Helvetica, sans-serif'

const WORLD_STYLE = `
/* ---------- campus: a light site plan inside the dark board */
.cwrap{display:flex;height:100%}
.cmap{flex:1;position:relative;overflow:hidden;background:#ECEFF2;min-width:0;touch-action:none;user-select:none;cursor:grab;outline:none}
.cmap.panning{cursor:grabbing}
.cmap:focus-visible{box-shadow:inset 0 0 0 2px #4E8BD4}
.cmap-in{position:absolute;left:0;top:0;transform-origin:0 0}
.cmap-in.ease{transition:transform .22s ease-out}
.cmap-in>svg{position:absolute;left:0;top:0;overflow:visible}
.cmap svg text{font-family:var(--font-ui);font-weight:700}
.cmap .bld{cursor:pointer;outline:none}
.cmap .bld:hover .pl,.cmap .bld:focus-visible .pl{stroke:var(--c);stroke-width:3}
.sign{position:absolute;width:224px;transform:translate(-50%,-100%) scale(var(--bs,1));transform-origin:50% 100%;background:#fff;border:1px solid #D3D9DF;border-top:3px solid var(--c);border-radius:6px;padding:8px 10px 9px;text-align:start;color:#3A4654;box-shadow:0 6px 18px rgba(40,55,70,.13);cursor:default}
.sign:after{content:"";position:absolute;left:50%;bottom:-6px;width:10px;height:10px;background:#fff;border-right:1px solid #D3D9DF;border-bottom:1px solid #D3D9DF;transform:translateX(-50%) rotate(45deg)}
.sign h3{margin:0 0 5px;font-size:14px;color:#17212B;white-space:nowrap;overflow:hidden;text-overflow:ellipsis}
.sign .n{display:flex;gap:11px;font-size:12px;font-variant-numeric:tabular-nums;margin-bottom:6px;white-space:nowrap;direction:ltr;justify-content:flex-end}
[dir=ltr] .sign .n{justify-content:flex-start}
.sign .n .a{color:#0C9468}.sign .n .b{color:#B26E12}.sign .n .c{color:#3A4654}
.sign .cbar{margin:0 0 7px;background:#E3E8ED}
.sign .cbar b{background:#8A97A6}
.sign .cbtn.go{color:#0B7A57;border-color:rgba(12,148,104,.4);background:rgba(12,148,104,.07)}
.sign .cbtn.go:hover{background:rgba(12,148,104,.14)}
.cmap-in.far .sign{width:auto;max-width:210px;padding:5px 9px}
.cmap-in.far .sign .c,.cmap-in.far .sign .cbar,.cmap-in.far .sign .cbtn{display:none}
.cmap-in.far .sign .n{margin:0}
.sign.small{width:auto;padding:4px 8px}
.sign.small h3{font-size:12px}
.ctip{position:absolute;inset-inline-start:16px;bottom:56px;font-size:12px;color:#5A6673;background:rgba(255,255,255,.92);border:1px solid #D3D9DF;padding:6px 10px;border-radius:5px}
.ctip b{color:#17212B}
.cleg{position:absolute;inset-inline-end:16px;bottom:16px;display:flex;gap:14px;font-size:12px;color:#4A5663;background:rgba(255,255,255,.92);border:1px solid #D3D9DF;padding:6px 10px;border-radius:5px;flex-wrap:wrap}
.cleg i{display:inline-block;width:9px;height:9px;margin-inline-end:6px;vertical-align:-1px;border-radius:1px}
.czoom{position:absolute;inset-inline-end:12px;top:12px;z-index:3;display:flex;gap:3px;align-items:center;background:rgba(255,255,255,.92);border:1px solid #D3D9DF;border-radius:4px;padding:3px;direction:ltr;cursor:default}
.czoom button{font:14px/1 var(--font-ui);color:#3A4654;background:#F4F6F8;border:1px solid #D3D9DF;border-radius:3px;min-width:26px;height:24px;cursor:pointer;padding:0 6px}
.czoom button:hover{color:#17212B;border-color:#AEB8C2;background:#fff}
.czoom .fitb{font:12px var(--font-ui)}
.czoom output{font:11.5px var(--font-ui);font-variant-numeric:tabular-nums;color:#17212B;min-width:44px;text-align:center}
.czoom .zh{font:11px var(--font-ui);color:#6A7683;padding:0 6px 0 4px;white-space:nowrap}

/* ---------- the 3D office: a light void with floating podiums */
.stage.w3on{background:radial-gradient(ellipse 75% 70% at 50% 46%,#FBFBFC 0%,#F1F2F5 48%,#E3E5EA 100%)}
.stage.w3on .stage-in{display:none}
.w3host{position:absolute;inset:0;display:none}
.stage.w3on .w3host{display:block}
.w3host canvas{display:block;width:100%;height:100%;outline:none}
.w3ov{position:absolute;inset:0;pointer-events:none;overflow:hidden;--bs:1}
.w3ov div{pointer-events:none}
.w3ov [data-anchor],.w3ov [data-anchor] *{pointer-events:auto}
.w3ov [data-anchor]{will-change:left,top}
.w3card{position:absolute;transform:translate(-50%,-100%) scale(var(--bs,1));transform-origin:50% 100%;display:flex;flex-direction:column;align-items:center;background:none;border:0;padding:0;cursor:pointer;font:11px var(--font-ui);color:#0F172A;transition:opacity .25s;z-index:1}
.w3card .fr{width:58px;height:58px;border-radius:14px;padding:3px;background:#fff;border:2px solid var(--sc,#A3AAB5);box-shadow:0 8px 20px rgba(15,23,42,.13),0 1px 2px rgba(15,23,42,.08);display:block}
.w3card .fr .in{display:block;width:100%;height:100%;border-radius:10px;overflow:hidden}
.w3card .fr svg{width:100%;height:100%;display:block}
.w3card .nm{margin-top:5px;display:flex;gap:5px;align-items:center;font-weight:700;background:rgba(255,255,255,.88);padding:1px 7px;border-radius:6px;white-space:nowrap;max-width:190px}
.w3card .nm b{overflow:hidden;text-overflow:ellipsis}
.w3card .nm small{font-weight:400;color:#64748B}
.w3card .nm i{font-style:normal;color:var(--sc,#64748B)}
.w3card.sel .fr{box-shadow:0 0 0 3px rgba(37,99,235,.3),0 10px 24px rgba(15,23,42,.16)}
.w3card.away .fr{border-style:dashed}
.w3card.absent{opacity:.62}
.w3card.dim{opacity:.55}
.w3card.glb .nm::after{content:"GLB";font-size:9px;color:#fff;background:#0F172A;border-radius:4px;padding:0 4px}
.w3card.tray .fr{width:46px;height:46px;border-radius:12px;display:grid;place-items:center;color:#2563EB;border-color:#2563EB}
.w3card.tray .fr svg{width:24px;height:24px}
.w3drop{position:absolute;inset:10px;border:2px dashed rgba(37,99,235,.6);border-radius:18px;display:none;align-items:flex-start;justify-content:center;pointer-events:none;z-index:9}
.w3drop.on{display:flex}
.w3drop span,.w3toast{margin-top:64px;background:#2563EB;color:#fff;font:700 12.5px var(--font-ui);padding:8px 14px;border-radius:10px;box-shadow:0 8px 24px rgba(15,23,42,.18)}
.w3toast{position:absolute;left:50%;top:0;transform:translateX(-50%);opacity:0;transition:opacity .25s;pointer-events:none;z-index:9;white-space:nowrap}
.w3toast.on{opacity:1}
.w3toast.bad{background:#B91C1C}
/* the office's own labels, restyled for the light floor */
.stage.w3on .bub{background:rgba(255,255,255,.95);color:#0F172A;border:1px solid #fff;border-radius:12px;box-shadow:0 6px 18px rgba(15,23,42,.14);padding:6px 10px 7px}
.stage.w3on .bub::after{display:none}
.stage.w3on .bub[data-at=card]{transform:translate(34px,calc(-100% - 22px)) scale(var(--bs,1));transform-origin:0 100%}
[dir=rtl] .stage.w3on .bub[data-at=card]{transform:translate(calc(-100% - 34px),calc(-100% - 22px)) scale(var(--bs,1));transform-origin:100% 100%}
.stage.w3on .bub.w3gone{visibility:hidden}
.stage.w3on .bub[data-at=card].w3flip{transform:translate(calc(-100% - 34px),calc(-100% - 22px)) scale(var(--bs,1));transform-origin:100% 100%}
[dir=rtl] .stage.w3on .bub[data-at=card].w3flip{transform:translate(34px,calc(-100% - 22px)) scale(var(--bs,1));transform-origin:0 100%}
.stage.w3on .bub.stale{background:#FFF7E6;border:1px dashed #D97706}
.stage.w3on .bub.mini{box-shadow:0 4px 12px rgba(15,23,42,.12);border-radius:9px}
.stage.w3on .bub.sel{outline:2px solid #2563EB}
.stage.w3on .bub.hand{background:#ECFDF3}
.stage.w3on .bub.hand.g-failed{background:#FEF2F2}.stage.w3on .bub.hand.g-findings{background:#FFF7E6}
.stage.w3on .tray-label,.stage.w3on .tag,.stage.w3on .deleg{background:rgba(255,255,255,.95);color:#0F172A;border:1px solid #D7DCE3;border-radius:8px;box-shadow:0 4px 12px rgba(15,23,42,.1);padding:3px 8px}
.stage.w3on .tag::after{display:none}
.stage.w3on .deleg{color:#1D4ED8}
.stage.w3on .legend{background:rgba(255,255,255,.9);color:#334155;border-color:#D7DCE3}
.stage.w3on .crumb button{color:#475569}.stage.w3on .crumb button:hover{color:#0F172A}.stage.w3on .crumb b{color:#0F172A}.stage.w3on .crumb .dim{color:#94A3B8}
.w3proj{position:absolute;inset-inline-end:14px;bottom:44px;display:flex;flex-direction:column;gap:6px;z-index:3;pointer-events:none}
.w3proj div{background:rgba(255,255,255,.92);border:1px solid #D7DCE3;border-radius:8px;padding:5px 10px;font:11.5px/1.45 var(--font-ui);color:#334155;min-width:170px;box-shadow:0 4px 12px rgba(15,23,42,.08)}
.w3proj b{display:block;color:#0F172A}
.w3proj .bad{color:#B91C1C!important}
.w3box{margin-top:6px;padding:8px 10px;border:1px solid var(--line);border-radius:4px;background:var(--panel-raised);font-size:12px}
.w3box .h{display:flex;justify-content:space-between;gap:8px}
.w3box .map{color:var(--ink-dim);font-size:11.5px;margin-top:4px;overflow-wrap:anywhere}
.w3box .acts{display:flex;gap:6px;margin-top:8px;flex-wrap:wrap}
.w3box button{font:12px var(--font-ui);color:var(--ink);background:var(--panel);border:1px solid var(--line);border-radius:3px;padding:2px 8px;cursor:pointer}
`

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
    const { P, poly, flat, box, onL, onR } = I
    const FH = 30
    let s = '', sh = '', n = 0, top = Infinity
    const pane = (f, side) => { const who = wins[n++]; return who ? (side ? shade(ST_COL[who.s], 0.86) : ST_COL[who.s]) : f }
    const per = (b) => Math.max(1, Math.round(b.w / 0.62)) + Math.max(1, Math.round(b.d / 0.62))
    const floorsFor = (b, min, max) => Math.max(min, Math.min(max, Math.ceil(wins.length / per(b))))
    function block(b) {
      const z = b.z || 0, base = b.base || 0, hgt = base + b.floors * FH + 8
      // the shadow falls to the side face's side: the light comes from the street-face side
      if (!z) sh += flat([P(b.x + b.w, b.y), P(b.x + b.w + Math.min(1.5, hgt / 48), b.y), P(b.x + b.w + Math.min(1.5, hgt / 48), b.y + b.d), P(b.x + b.w, b.y + b.d)], 'rgba(60,75,90,.13)', ' filter="url(#cmap-soft)"')
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
    return { svg: sh + s, top, door }
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
    return s + '<text transform="matrix(1,-.5,0,1,' + px.toFixed(1) + ',' + py.toFixed(1) + ')" x="' + (L * TW / 4).toFixed(1) + '" y="-7" text-anchor="middle" font-size="13" fill="#fff" direction="' + (LANG === 'fa' ? 'rtl' : 'ltr') + '"' +
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
      '<defs><filter id="cmap-blur" x="-30%" y="-30%" width="160%" height="160%"><feGaussianBlur stdDeviation="11"/></filter>' +
      '<filter id="cmap-soft" x="-30%" y="-30%" width="160%" height="160%"><feGaussianBlur stdDeviation="2.5"/></filter>' +
      '<pattern id="cmap-grid" width="' + TW + '" height="' + TH + '" patternUnits="userSpaceOnUse"><path d="M0 ' + TH / 2 + 'L' + TW / 2 + ' 0L' + TW + ' ' + TH / 2 + 'L' + TW / 2 + ' ' + TH + 'Z" fill="none" stroke="#E2E6EA" stroke-width="1"/></pattern></defs>' +
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
      s += flat([P(E + 0.4, E + 0.6, -18), P(PL - E + 0.4, E + 0.6, -18), P(PL - E + 0.4, PL - E + 0.6, -18), P(E + 0.4, PL - E + 0.6, -18)], 'rgba(40,55,70,.20)', ' filter="url(#cmap-blur)"')
      let g = box(E, E, PL - 2 * E, PL - 2 * E, -10, 10, PLINTH)
      g += poly([P(E, E), P(PL - E, E), P(PL - E, PL - E), P(E, PL - E)], PLINTH[0], ' class="pl"')
      const b = building(I, cell.kind, c, shed ? [] : cell.wins || [])
      // a paved way from the door to the edge of the plot
      g += flat([P(b.door[0] - 0.45, b.door[1] - 0.6), P(b.door[0] + 0.45, b.door[1] - 0.6), P(b.door[0] + 0.45, PL - E), P(b.door[0] - 0.45, PL - E)], '#ECEFF2')
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

/* ======================================================================
 * The office floor in 3D (Arsenale spike v2, "podium offices").
 *
 * h: { esc, fa, calm(), onPick(id), onView(view), characters: { default,
 *      byAgent } (base64 GLB), onLost() }.
 * The page calls sync(model) on every redraw. Nothing in sync touches the
 * camera except a change of office (model.key) or the first layout; the
 * page's 1.5 s poll therefore never moves the view.
 *
 * model: { key, view (saved view or null), selected (podium id),
 *          podiums: [{ id, kind: 'desk'|'lead'|'tray', agent, state, anim,
 *            shirt, hair, skin, name, sub, glyph, attrs, aria, present,
 *            count (tray) }],
 *          links: [[fromId, toId]], fly: { from, key } or null,
 *          overlay: html whose elements carry data-anchor="<podium id>" and
 *            data-at="head" | "card" | "tray" | "mid" (with data-anchor2) }
 * ====================================================================== */
function office3d(h) {
  const T3 = window.THREE, X = window.THREE_ADDONS
  if (!T3 || !X || !X.GLTFLoader || !X.toCreasedNormals || !X.clone) return null
  let renderer
  try {
    renderer = new T3.WebGLRenderer({ antialias: true, alpha: true, powerPreference: 'high-performance' })
  } catch (e) {
    return null // no WebGL here: the page keeps its flat office
  }
  const { esc } = h
  const FONT_UI = 'Arial, "Helvetica Neue", Helvetica, sans-serif'
  renderer.setPixelRatio(Math.min(window.devicePixelRatio || 1, 2))
  renderer.shadowMap.enabled = true
  renderer.shadowMap.type = T3.PCFShadowMap // r184: PCF + shadow.radius gives the soft edge
  renderer.outputColorSpace = T3.SRGBColorSpace
  renderer.toneMapping = T3.NeutralToneMapping
  // A software renderer (no GPU, a remote desktop, a headless test browser)
  // draws every shadow on the CPU: there the floor goes without shadows, at
  // one pixel per pixel and fewer frames, so the rest of the page stays quick.
  let soft = false
  try {
    const gl = renderer.getContext(), dbg = gl.getExtension('WEBGL_debug_renderer_info')
    soft = /swiftshader|basic render|llvmpipe|software|warp/i.test(dbg ? String(gl.getParameter(dbg.UNMASKED_RENDERER_WEBGL)) : '')
  } catch (e) { /* unknown: treat it as a GPU */ }
  if (soft) { renderer.shadowMap.enabled = false; renderer.setPixelRatio(1) }
  const cvs = renderer.domElement
  cvs.setAttribute('aria-hidden', 'true')
  const host = document.createElement('div'); host.className = 'w3host'
  const ov = document.createElement('div'); ov.className = 'w3ov'
  const cardsEl = document.createElement('div'), pageEl = document.createElement('div')
  ov.append(cardsEl, pageEl)
  const projEl = document.createElement('div'); projEl.className = 'w3proj'
  const dropEl = document.createElement('div'); dropEl.className = 'w3drop'; dropEl.innerHTML = '<span>' + T('Drop the .glb on a desk') + '</span>'
  const toastEl = document.createElement('div'); toastEl.className = 'w3toast'; toastEl.setAttribute('role', 'status')
  host.append(cvs, ov, projEl, dropEl, toastEl)
  const fileIn = document.createElement('input'); fileIn.type = 'file'; fileIn.accept = '.glb,model/gltf-binary'; fileIn.hidden = true
  host.appendChild(fileIn)

  const scene = new T3.Scene()
  // soft studio light: cool sky, warm-lilac bounce, ONE shadow-casting key light
  scene.add(new T3.HemisphereLight('#f4f6ff', '#ddd6e6', 1.7))
  const sun = new T3.DirectionalLight('#fffaf3', 2.35)
  sun.castShadow = true; sun.shadow.mapSize.set(2048, 2048)
  sun.shadow.bias = -0.0005; sun.shadow.normalBias = 0.03; sun.shadow.radius = 5
  scene.add(sun, sun.target)
  const fill = new T3.DirectionalLight('#e9eeff', 0.3); fill.position.set(12, 4, 6); scene.add(fill)

  // ---------- camera: orthographic isometric, with our own pan, orbit and zoom
  const cam = new T3.OrthographicCamera(-1, 1, 1, -1, 0.1, 400)
  const VIEW0 = { azim: Math.PI / 4, elev: 0.64 }
  const FR = 15 // frustum height at zoom 1
  const view = { target: new T3.Vector3(0, 0.4, 0), azim: VIEW0.azim, elev: VIEW0.elev, zoom: 1, auto: true }
  let W = 800, H = 500, tween = null, overview = null, focusId = null
  const clamp = (v, a, b) => Math.max(a, Math.min(b, v))
  const lerp = (a, b, t) => a + (b - a) * t
  function applyCam() {
    const a = W / H, d = 60
    cam.left = -FR * a / 2; cam.right = FR * a / 2; cam.top = FR / 2; cam.bottom = -FR / 2
    cam.zoom = view.zoom
    cam.position.set(view.target.x + d * Math.cos(view.elev) * Math.sin(view.azim), view.target.y + d * Math.sin(view.elev), view.target.z + d * Math.cos(view.elev) * Math.cos(view.azim))
    cam.lookAt(view.target); cam.updateProjectionMatrix(); cam.updateMatrixWorld()
    ovDirty = true
  }
  // the zoom that fits `pts` (world) around `tgt` into availW x availH pixels, at the default angles
  function zoomFor(pts, tgt, availW, availH) {
    const keep = { t: view.target.clone(), az: view.azim, el: view.elev, z: view.zoom }
    view.target.copy(tgt); view.azim = VIEW0.azim; view.elev = VIEW0.elev; view.zoom = 1; applyCam()
    let mx = 1e-3, my = 1e-3
    const v = new T3.Vector3()
    for (const p of pts) { v.copy(p).applyMatrix4(cam.matrixWorldInverse); mx = Math.max(mx, Math.abs(v.x)); my = Math.max(my, Math.abs(v.y)) }
    view.target.copy(keep.t); view.azim = keep.az; view.elev = keep.el; view.zoom = keep.z; applyCam()
    return Math.min((FR * W / H / 2) * (availW / W) / mx, (FR / 2) * (availH / H) / my)
  }
  const boxPts = (x0, x1, z0, z1, y0, y1) => { const o = []; for (const x of [x0, x1]) for (const z of [z0, z1]) for (const y of [y0, y1]) o.push(new T3.Vector3(x, y, z)); return o }
  const viewOf = () => ({ tx: view.target.x, ty: view.target.y, tz: view.target.z, azim: view.azim, elev: view.elev, zoom: view.zoom })
  function startTween(goal, d) {
    if (h.calm && h.calm()) { setView(goal); return }
    tween = { from: viewOf(), to: goal, t: 0, d: d || 0.75 }
  }
  function setView(g) {
    view.target.set(g.tx, g.ty, g.tz); view.azim = g.azim; view.elev = g.elev; view.zoom = g.zoom
    applyCam()
  }
  let viewSaveT = 0
  function viewChanged(byUser) {
    // a pan, an orbit or a zoom by hand ends a focus: the other cards light up again
    if (byUser) { view.auto = false; if (focusId) { focusId = null; ovDirty = true } }
    clearTimeout(viewSaveT)
    viewSaveT = setTimeout(() => { if (h.onView) h.onView(Object.assign(viewOf(), { auto: view.auto })) }, 400)
  }
  function fit(animated) {
    focusId = null; view.auto = true
    if (!overview) return
    if (animated) startTween(overview, 0.7); else setView(overview)
    viewChanged(false)
  }
  function focus(id) {
    const p = O && O.byId.get(id)
    if (!p) return
    focusId = id
    const hs = p.S / 2, tgt = new T3.Vector3(p.x, 0.75, p.z)
    const zoom = clamp(zoomFor(boxPts(p.x - hs, p.x + hs, p.z - hs, p.z + hs, -0.55, 2.4), tgt, W - 120, H - 160), 0.8, 3.6)
    startTween({ tx: tgt.x, ty: tgt.y, tz: tgt.z, azim: VIEW0.azim, elev: VIEW0.elev, zoom }, 0.85)
    view.auto = false
    viewChanged(false)
  }

  // ---------- materials and geometry, cached
  const MC = new Map()
  function mat(hex, o) {
    const k = hex + JSON.stringify(o || {})
    if (!MC.has(k)) MC.set(k, new T3.MeshStandardMaterial(Object.assign({ color: hex, roughness: 0.78, metalness: 0 }, o || {})))
    return MC.get(k)
  }
  const GC = new Map()
  const geo = (key, fn) => { if (!GC.has(key)) GC.set(key, fn()); return GC.get(key) }
  function rrShape(w, d, r) {
    const s = new T3.Shape(), x = -w / 2, y = -d / 2
    r = Math.min(r, w / 2, d / 2)
    s.moveTo(x + r, y); s.lineTo(x + w - r, y); s.quadraticCurveTo(x + w, y, x + w, y + r); s.lineTo(x + w, y + d - r); s.quadraticCurveTo(x + w, y + d, x + w - r, y + d)
    s.lineTo(x + r, y + d); s.quadraticCurveTo(x, y + d, x, y + d - r); s.lineTo(x, y + r); s.quadraticCurveTo(x, y, x + r, y)
    return s
  }
  // a soft rounded box: an extruded rounded rectangle with a bevel, creased normals
  function roundedBox(w, hh, d, r) {
    const b = Math.min(r, hh / 2 - 0.001, w / 2 - 0.001, d / 2 - 0.001)
    const g = new T3.ExtrudeGeometry(rrShape(w - 2 * b, d - 2 * b, Math.max(0.001, r)), { depth: Math.max(0.0005, hh - 2 * b), bevelEnabled: true, bevelThickness: b, bevelSize: b, bevelSegments: 3, curveSegments: 4 })
    g.rotateX(-Math.PI / 2); g.translate(0, -(hh / 2 - b), 0)
    return X.toCreasedNormals(g, 0.7)
  }
  const G = {
    box: (w, hh, d) => geo('b' + [w, hh, d], () => new T3.BoxGeometry(w, hh, d)),
    cyl: (rt, rb, hh, s) => geo('c' + [rt, rb, hh, s || 12], () => new T3.CylinderGeometry(rt, rb, hh, s || 12)),
    ico: (r, d) => geo('i' + [r, d || 1], () => new T3.IcosahedronGeometry(r, d === undefined ? 1 : d)),
    cone: (r, hh, s) => geo('o' + [r, hh, s || 5], () => new T3.ConeGeometry(r, hh, s || 5)),
    rbox: (w, hh, d, r) => geo('r' + [w, hh, d, r || 0.03], () => roundedBox(w, hh, d, r || 0.03)),
    plane: () => geo('pl', () => { const g = new T3.PlaneGeometry(1, 1); g.rotateX(-Math.PI / 2); return g }),
  }
  function mesh(g, m, x, y, z, parent, o) {
    o = o || {}
    const me = new T3.Mesh(g, m)
    me.position.set(x || 0, y || 0, z || 0)
    me.castShadow = o.cast !== false; me.receiveShadow = o.recv !== false
    if (o.rx) me.rotation.x = o.rx
    if (o.ry) me.rotation.y = o.ry
    if (o.rz) me.rotation.z = o.rz
    if (parent) parent.add(me)
    return me
  }
  // the podium: a thick white slab with a big soft bevel and a flat top
  function podiumGeos(S) {
    return geo('pod' + S, () => {
      const HH = 0.62, b = 0.13, r = 0.36
      const body = new T3.ExtrudeGeometry(rrShape(S - 2 * b, S - 2 * b, r), { depth: HH - 2 * b, bevelEnabled: true, bevelThickness: b, bevelSize: b, bevelSegments: 6, curveSegments: 10 })
      body.rotateX(-Math.PI / 2); body.translate(0, -(HH - b), 0)
      const top = new T3.ShapeGeometry(rrShape(S - 2 * b, S - 2 * b, r), 10); top.rotateX(-Math.PI / 2); top.translate(0, 0.0006, 0)
      return { body: X.toCreasedNormals(body, 0.5), top }
    })
  }
  // textures are drawn in code: no image is downloaded
  function canvasTex(w, hh, draw) {
    const c = document.createElement('canvas'); c.width = w; c.height = hh
    draw(c.getContext('2d'), w, hh)
    const t = new T3.CanvasTexture(c); t.colorSpace = T3.SRGBColorSpace; t.anisotropy = 4
    return t
  }
  let seed = 7
  const rnd = () => { seed = (seed * 16807) % 2147483647; return (seed - 1) / 2147483646 }
  // one screen atlas (2x2 tiles: code, tests, dashboard, design), so every monitor shares one draw call
  const screenAtlas = canvasTex(512, 320, (g) => {
    const tile = (ox, oy, fn) => { g.save(); g.translate(ox, oy); g.beginPath(); g.rect(0, 0, 256, 160); g.clip(); fn(g, 256, 160); g.restore() }
    tile(0, 0, (g, w, hh) => {
      g.fillStyle = '#16233d'; g.fillRect(0, 0, w, hh); g.fillStyle = '#22345a'; g.fillRect(0, 0, w, 14); g.fillStyle = '#1b2b49'; g.fillRect(0, 14, 46, hh)
      const cols = ['#8fb4ff', '#8fb4ff', '#a5b4cb', '#a5b4cb', '#6ee7d4', '#d0c3ff']
      for (let y = 24; y < hh - 6; y += 9) { let x = 54 + ((y / 9) % 4) * 8; while (x < w - 26 && rnd() > 0.18) { const ww = 10 + rnd() * 38; g.fillStyle = cols[(rnd() * cols.length) | 0]; g.fillRect(x, y, ww, 4); x += ww + 6 } }
      for (let y = 24; y < hh - 10; y += 12) { g.fillStyle = '#3a4d74'; g.fillRect(8, y, 28, 4) }
    })
    tile(256, 0, (g, w, hh) => {
      g.fillStyle = '#16233d'; g.fillRect(0, 0, w, hh); g.fillStyle = '#22345a'; g.fillRect(0, 0, w, 14)
      for (let i = 0; i < 11; i++) { const y = 24 + i * 12; g.fillStyle = i === 6 ? '#f87171' : '#4ade80'; g.fillRect(12, y, 7, 7); g.fillStyle = '#a5b4cb'; g.fillRect(26, y + 1, 50 + rnd() * 80, 4) }
      g.fillStyle = '#22c55e'; g.beginPath(); g.arc(205, 70, 34, 0, Math.PI * 1.7); g.lineTo(205, 70); g.fill(); g.fillStyle = '#16233d'; g.beginPath(); g.arc(205, 70, 20, 0, Math.PI * 2); g.fill()
    })
    tile(0, 160, (g, w, hh) => {
      g.fillStyle = '#f7f9fc'; g.fillRect(0, 0, w, hh); g.fillStyle = '#e3e9f2'; g.fillRect(0, 0, w, 14)
      for (let i = 0; i < 3; i++) { g.fillStyle = '#ffffff'; g.fillRect(10 + i * 82, 22, 74, 30); g.fillStyle = ['#2563eb', '#22c55e', '#f59e0b'][i]; g.fillRect(16 + i * 82, 30, 30, 5); g.fillStyle = '#cbd5e1'; g.fillRect(16 + i * 82, 40, 50, 4) }
      for (let i = 0; i < 9; i++) { g.fillStyle = i % 3 === 0 ? '#2563eb' : '#bcd2fb'; const bh = 16 + rnd() * 66; g.fillRect(16 + i * 25, 150 - bh, 15, bh) }
      g.fillStyle = '#cbd5e1'; g.fillRect(10, 151, 236, 2)
    })
    tile(256, 160, (g, w, hh) => {
      g.fillStyle = '#fbf8f6'; g.fillRect(0, 0, w, hh); g.fillStyle = '#ece6e2'; g.fillRect(0, 0, w, 14)
      g.fillStyle = '#ffffff'; g.fillRect(24, 24, 96, 124); g.fillRect(136, 24, 96, 124)
      g.fillStyle = '#f2a7b5'; g.fillRect(32, 32, 80, 40); g.fillStyle = '#c4b5fd'; g.fillRect(144, 32, 80, 26); g.fillStyle = '#7c3aed'; g.fillRect(144, 120, 44, 14)
      g.fillStyle = '#d6d3d1'; for (let i = 0; i < 5; i++) { g.fillRect(32, 80 + i * 11, 70 - i * 6, 4); g.fillRect(144, 66 + i * 10, 76 - i * 8, 4) }
    })
  })
  function screenGeo(tile, w, hh) {
    return geo('scr' + [tile, w, hh], () => {
      const g = new T3.PlaneGeometry(w, hh), uv = g.attributes.uv, c = tile % 2, r = (tile / 2) | 0
      // tile column c -> u in [.5c, .5c+.5]; row 0 (top of the canvas) -> v in [.5, 1]
      for (let i = 0; i < uv.count; i++) uv.setXY(i, 0.5 * c + 0.5 * uv.getX(i), (r === 0 ? 0.5 : 0) + 0.5 * uv.getY(i))
      uv.needsUpdate = true
      return g
    })
  }
  const screenMat = new T3.MeshBasicMaterial({ map: screenAtlas })
  const blobTex = canvasTex(64, 64, (g) => { const gr = g.createRadialGradient(32, 32, 2, 32, 32, 32); gr.addColorStop(0, 'rgba(40,36,70,.55)'); gr.addColorStop(0.55, 'rgba(40,36,70,.22)'); gr.addColorStop(1, 'rgba(40,36,70,0)'); g.fillStyle = gr; g.fillRect(0, 0, 64, 64) })
  const blobMat = new T3.MeshBasicMaterial({ map: blobTex, transparent: true, depthWrite: false, opacity: 0.42, toneMapped: false })
  // the soft contact shadow of a floating podium on the void
  const podShadowMat = new T3.MeshBasicMaterial({ map: canvasTex(256, 256, (g) => { g.filter = 'blur(22px)'; g.fillStyle = 'rgba(52,48,84,.62)'; g.beginPath(); g.roundRect(54, 54, 148, 148, 26); g.fill() }), transparent: true, depthWrite: false, opacity: 0.7, toneMapped: false })
  const boardTex = canvasTex(256, 160, (g) => {
    g.fillStyle = '#ffffff'; g.fillRect(0, 0, 256, 160)
    ;[['#2563eb', 150], ['#94a3b8', 190], ['#94a3b8', 120], ['#f59e0b', 90], ['#22c55e', 140]].forEach(([c, ww], i) => { g.fillStyle = c; g.fillRect(16, 24 + i * 22, ww, 8) })
    g.fillStyle = '#0f172a'; g.font = '700 16px ' + FONT_UI; g.fillText('▶ ✓ ✓ ! ✓', 16, 146)
  })

  // ---------- merge the static props into a few vertex-coloured meshes
  const VCM = new Map()
  function vcMat(m) {
    const k = [m.roughness, m.metalness, m.side].join('|')
    if (!VCM.has(k)) VCM.set(k, new T3.MeshStandardMaterial({ vertexColors: true, roughness: m.roughness, metalness: m.metalness, side: m.side }))
    return VCM.get(k)
  }
  function mergeStatic(group) {
    group.updateMatrixWorld(true)
    const buckets = new Map(), kill = []
    group.traverse((o) => {
      if (!o.isMesh || Array.isArray(o.material) || o.userData.noMerge) return
      const m = o.material
      const vc = m.isMeshStandardMaterial && !m.map && !m.transparent && m.emissive.getHex() === 0
      const key = (vc ? 'vc|' + [m.roughness, m.metalness, m.side].join('|') : m.uuid) + '|' + (+o.castShadow) + (+o.receiveShadow)
      const g = o.geometry.index ? o.geometry.toNonIndexed() : o.geometry.clone()
      g.applyMatrix4(o.matrixWorld)
      if (vc) { const n = g.attributes.position.count, c = new Float32Array(n * 3); for (let i = 0; i < n; i++) { c[i * 3] = m.color.r; c[i * 3 + 1] = m.color.g; c[i * 3 + 2] = m.color.b } g.setAttribute('color', new T3.BufferAttribute(c, 3)) }
      if (!buckets.has(key)) buckets.set(key, { m: vc ? vcMat(m) : m, vc, cs: o.castShadow, rs: o.receiveShadow, gs: [] })
      buckets.get(key).gs.push(g); kill.push(o)
    })
    kill.forEach((o) => o.parent.remove(o))
    const out = new T3.Group()
    for (const b of buckets.values()) {
      let n = 0
      b.gs.forEach((g) => { n += g.attributes.position.count })
      const P = new Float32Array(n * 3), N = new Float32Array(n * 3), U = b.vc ? null : new Float32Array(n * 2), Cc = b.vc ? new Float32Array(n * 3) : null
      let o3 = 0, o2 = 0
      for (const g of b.gs) {
        const c = g.attributes.position.count
        P.set(g.attributes.position.array, o3)
        if (g.attributes.normal) N.set(g.attributes.normal.array, o3)
        if (U && g.attributes.uv) U.set(g.attributes.uv.array, o2)
        if (Cc) Cc.set(g.attributes.color.array, o3)
        o3 += c * 3; o2 += c * 2
        g.dispose()
      }
      const mg = new T3.BufferGeometry()
      mg.setAttribute('position', new T3.BufferAttribute(P, 3)); mg.setAttribute('normal', new T3.BufferAttribute(N, 3))
      if (U) mg.setAttribute('uv', new T3.BufferAttribute(U, 2))
      if (Cc) mg.setAttribute('color', new T3.BufferAttribute(Cc, 3))
      mg.computeBoundingSphere()
      const me = new T3.Mesh(mg, b.m); me.castShadow = b.cs; me.receiveShadow = b.rs
      out.add(me)
    }
    return out
  }

  // ---------- props
  const C = {
    pod: '#f8f8f9', podSide: '#e7e9ee', desk: '#f6f6f4', leg: '#c9cfd7', wood: '#c79a6b', woodSide: '#a97c51',
    chair: '#3c4149', chairD: '#2b2f35', monitor: '#1f232a', key: '#e8ebef', blue: '#2563eb', pot: '#eef0f2', potT: '#d9c6b0',
    leaf1: '#7fb58e', leaf2: '#5f9d74', leaf3: '#a3cfae', cab: '#eceef1', paper: '#ffffff',
  }
  function chair(x, z, ry, parent, col) {
    const g = new T3.Group(); g.position.set(x, 0, z); g.rotation.y = ry
    for (let k = 0; k < 5; k++) { const an = k / 5 * Math.PI * 2; mesh(G.box(0.035, 0.03, 0.24), mat(C.chairD), Math.sin(an) * 0.11, 0.04, Math.cos(an) * 0.11, g, { ry: an }); mesh(G.ico(0.025, 1), mat(C.chairD), Math.sin(an) * 0.22, 0.025, Math.cos(an) * 0.22, g) }
    mesh(G.cyl(0.026, 0.026, 0.34, 8), mat('#9aa3ae', { metalness: 0.4, roughness: 0.4 }), 0, 0.24, 0, g)
    mesh(G.rbox(0.46, 0.08, 0.44, 0.035), mat(col || C.chair), 0, 0.45, 0, g)
    mesh(G.rbox(0.42, 0.46, 0.07, 0.035), mat(col || C.chair), 0, 0.76, -0.22, g, { rx: -0.08 })
    mesh(G.box(0.04, 0.2, 0.04), mat(C.chairD), 0, 0.55, -0.2, g)
    for (const sx of [-1, 1]) mesh(G.rbox(0.05, 0.04, 0.26, 0.015), mat(C.chairD), sx * 0.24, 0.6, 0, g)
    parent.add(g)
    return g
  }
  function desk(x, z, ry, parent, o) {
    const g = new T3.Group(); g.position.set(x, 0, z); g.rotation.y = ry
    const w = o.w || 1.5, d = o.d || 0.7, hh = o.h || 0.74, top = o.top || C.desk, legc = o.leg || C.leg
    mesh(G.rbox(w, 0.05, d, 0.02), mat(top), 0, hh - 0.025, 0, g)
    mesh(G.rbox(0.42, hh - 0.06, d - 0.08, 0.02), mat(legc), w / 2 - 0.25, (hh - 0.05) / 2, 0, g)
    for (let i = 0; i < 3; i++) mesh(G.box(0.3, 0.008, 0.01), mat('#a9b0b9'), w / 2 - 0.25, 0.16 + i * 0.2, -(d - 0.08) / 2 - 0.003, g, { cast: false })
    mesh(G.box(0.04, hh - 0.05, d - 0.1), mat(legc), -w / 2 + 0.06, (hh - 0.05) / 2, 0, g)
    const mons = o.mons === undefined ? 1 : o.mons
    for (let i = 0; i < mons; i++) {
      const mx = mons === 1 ? 0 : (i - 0.5) * 0.66, myaw = mons === 1 ? 0 : (i === 0 ? 0.22 : -0.22)
      const mg = new T3.Group(); mg.position.set(mx, hh, 0.17); mg.rotation.y = myaw; g.add(mg)
      mesh(G.rbox(0.2, 0.02, 0.14, 0.008), mat(C.monitor), 0, 0.01, 0, mg); mesh(G.box(0.05, 0.17, 0.04), mat(C.monitor), 0, 0.1, 0.02, mg)
      mesh(G.rbox(0.62, 0.38, 0.035, 0.012), mat(C.monitor), 0, 0.36, 0, mg)
      const sc = new T3.Mesh(screenGeo(((o.tile || 0) + i) % 4, 0.57, 0.33), screenMat); sc.position.set(0, 0.36, -0.019); sc.rotation.y = Math.PI; sc.castShadow = false; mg.add(sc)
    }
    mesh(G.rbox(0.44, 0.02, 0.14, 0.006), mat(C.key), 0, hh + 0.01, -0.12, g); mesh(G.rbox(0.07, 0.02, 0.1, 0.01), mat(C.key), 0.32, hh + 0.01, -0.12, g)
    if (o.mug) mesh(G.cyl(0.04, 0.036, 0.09, 12), mat(o.mug), -w / 2 + 0.2, hh + 0.045, -0.08, g)
    if (o.papers) for (let i = 0; i < 3; i++) mesh(G.box(0.21, 0.006, 0.29), mat(C.paper), w / 2 - 0.3 + i * 0.012, hh + 0.004 + i * 0.006, -0.1, g, { ry: i * 0.14 - 0.1 })
    if (o.lamp) {
      const lg = new T3.Group(); lg.position.set(-w / 2 + 0.16, hh, 0.18); g.add(lg)
      mesh(G.cyl(0.07, 0.08, 0.025, 14), mat('#2f343b'), 0, 0.012, 0, lg); mesh(G.box(0.02, 0.32, 0.02), mat('#2f343b'), 0, 0.17, 0, lg, { rz: 0.25 })
      mesh(G.box(0.02, 0.26, 0.02), mat('#2f343b'), 0.1, 0.4, -0.06, lg, { rx: 0.9, rz: -0.4 }); mesh(G.cone(0.07, 0.11, 14), mat('#f3c766'), 0.14, 0.47, -0.15, lg, { rx: -2.3 })
    }
    parent.add(g)
    return g
  }
  function plant(parent, x, z, s, kind) {
    const g = new T3.Group(); g.position.set(x, 0, z); g.scale.setScalar(s); parent.add(g)
    mesh(G.cyl(0.17, 0.13, 0.3, 14), mat(kind === 1 ? C.potT : C.pot), 0, 0.15, 0, g); mesh(G.cyl(0.155, 0.155, 0.02, 14), mat('#6b5544'), 0, 0.29, 0, g, { cast: false })
    const L = mat(C.leaf1, { flatShading: true }), L2 = mat(C.leaf2, { flatShading: true }), L3 = mat(C.leaf3, { flatShading: true })
    if (kind === 1) { // a tall snake plant
      for (let i = 0; i < 7; i++) { const an = i / 7 * Math.PI * 2; mesh(G.cone(0.05, 0.6 + ((i * 37) % 5) * 0.06, 4), i % 2 ? L : L2, Math.cos(an) * 0.06, 0.58, Math.sin(an) * 0.06, g, { rx: Math.sin(an) * 0.18, rz: -Math.cos(an) * 0.18 }) }
    } else {
      mesh(G.ico(0.22, 0), L, 0, 0.5, 0, g); mesh(G.ico(0.17, 0), L2, 0.1, 0.68, -0.04, g); mesh(G.ico(0.14, 0), L3, -0.09, 0.74, 0.06, g); mesh(G.ico(0.12, 0), L, 0.02, 0.84, 0.02, g)
    }
    return g
  }
  function cabinet(parent, x, z, ry, o) {
    const g = new T3.Group(); g.position.set(x, 0, z); g.rotation.y = ry; parent.add(g)
    const w = o.w || 0.85, hh = 0.62, d = 0.4
    mesh(G.rbox(w, hh, d, 0.025), mat(C.cab), 0, hh / 2, 0, g)
    mesh(G.box(w - 0.06, 0.008, 0.01), mat('#d7dbe1'), 0, hh * 0.5, d / 2 + 0.001, g, { cast: false })
    o.binders.forEach((c, i) => mesh(G.rbox(0.075, 0.28, 0.27, 0.01), mat(c), -w / 2 + 0.09 + i * 0.085, hh + 0.14, 0, g, { rz: i === o.binders.length - 1 ? 0.28 : 0 }))
    if (o.box) mesh(G.rbox(0.26, 0.14, 0.24, 0.02), mat('#ffffff'), w / 2 - 0.16, hh + 0.07, 0, g)
    return g
  }
  function bookshelf(parent, x, z, ry) {
    const g = new T3.Group(); g.position.set(x, 0, z); g.rotation.y = ry; parent.add(g)
    const w = 0.9, hh = 1.5, d = 0.34
    for (const sx of [-1, 1]) mesh(G.box(0.035, hh, d), mat(C.cab), sx * (w / 2 - 0.0175), hh / 2, 0, g)
    mesh(G.box(w, 0.035, d), mat(C.cab), 0, hh, 0, g); mesh(G.box(w, 0.04, d), mat(C.cab), 0, 0.02, 0, g); mesh(G.box(w, hh, 0.02), mat('#e3e6ea'), 0, hh / 2, -d / 2 + 0.01, g)
    const pal = ['#2563eb', '#93b4f5', '#f0b44c', '#e07f5c', '#64748b', '#cbd5e1', '#7fb58e', '#334155']
    for (let s = 0; s < 3; s++) {
      const y = 0.04 + s * 0.48
      if (s > 0) mesh(G.box(w - 0.07, 0.03, d - 0.02), mat(C.cab), 0, y, 0, g)
      let x0 = -w / 2 + 0.06
      for (let i = 0; i < 7 && x0 < w / 2 - 0.12; i++) { const bw = 0.05 + ((i * 7 + s * 3) % 4) * 0.012, bh = 0.28 + ((i * 5 + s) % 3) * 0.04; mesh(G.box(bw, bh, 0.24), mat(pal[(i + s * 3) % pal.length]), x0 + bw / 2, y + 0.015 + bh / 2, 0, g, { rz: (i === 5 && s === 1) ? 0.3 : 0 }); x0 += bw + 0.012 }
    }
    return g
  }
  const rug = (parent, x, z, w, d, col) => mesh(geo('rug' + [w, d], () => { const g = new T3.ShapeGeometry(rrShape(w, d, 0.18), 6); g.rotateX(-Math.PI / 2); return g }), mat(col, { roughness: 0.95 }), x, 0.004, z, parent, { cast: false })
  const ao = (parent, x, z, w, d) => { const m = mesh(G.plane(), blobMat, x, 0.008, z, parent, { cast: false, recv: false }); m.scale.set(w, 1, d); return m }
  const shadeHex = (hex, k) => { const c = new T3.Color(hex); const w = new T3.Color('#ffffff'); return '#' + (k > 0 ? c.lerp(w, k) : c.multiplyScalar(1 + k)).getHexString() }
  const hash = (s) => { let x = 7; for (const ch of String(s)) x = (x * 31 + ch.charCodeAt(0)) >>> 0; return x }

  // One mini-office per podium. Station frame: desk at the back (-z), the
  // seated person faces -z. Returns where a person sits and where one stands.
  const STATION = {
    desk(p, st) {
      const k = hash(p.agent || p.id), wood = k % 2 === 0, mons = 1 + ((k >> 3) % 2)
      rug(st, 0, 0.2, 1.75, 1.25, shadeHex(p.shirt || '#94a3b8', 0.82))
      desk(0, -0.55, Math.PI, st, { w: 1.5, d: 0.7, top: wood ? C.wood : C.desk, leg: wood ? C.woodSide : C.leg, mons, tile: (k >> 5) % 4, mug: p.shirt || C.blue, papers: true, lamp: mons !== 2 })
      ao(st, 0, -0.55, 1.9, 1.0)
      chair(0, 0.24, Math.PI, st); ao(st, 0, 0.24, 0.8, 0.8)
      cabinet(st, 1.12, -0.35, -Math.PI / 2, { w: 0.8, binders: mons === 2 ? ['#334155', '#64748b', '#cbd5e1', '#2563eb', '#93b4f5'] : ['#2563eb', '#93b4f5', '#cbd5e1', '#64748b', '#f0b44c', '#e2e8f0'], box: mons !== 2 }); ao(st, 1.12, -0.35, 0.7, 1.0)
      plant(st, -1.12, -1.0, 1.0, mons === 2 ? 1 : 0); ao(st, -1.12, -1.0, 0.6, 0.6)
      plant(st, 1.1, 1.05, 0.62, 0); ao(st, 1.1, 1.05, 0.4, 0.4)
      return { sit: { x: 0, z: 0.2, ry: Math.PI }, stand: { x: 0.72, z: 0.62, cam: -0.35 } }
    },
    lead(p, st) {
      rug(st, 0.1, 0.25, 2.1, 1.5, shadeHex(p.shirt || '#94a3b8', 0.84))
      desk(-0.1, -0.78, Math.PI, st, { w: 2.0, d: 0.78, top: C.wood, leg: C.woodSide, mons: 2, tile: 2, mug: p.shirt || C.blue, papers: true })
      ao(st, -0.1, -0.78, 2.4, 1.1)
      chair(-0.1, 0.0, Math.PI, st, '#c7d3f3'); ao(st, -0.1, 0.0, 0.8, 0.8)
      bookshelf(st, 1.28, -0.95, -Math.PI / 2); ao(st, 1.28, -0.95, 0.7, 1.2)
      // a small round meeting table
      mesh(G.cyl(0.36, 0.36, 0.04, 24), mat(C.desk), 0.95, 0.62, 0.95, st); mesh(G.cyl(0.04, 0.06, 0.6, 10), mat(C.leg), 0.95, 0.31, 0.95, st); mesh(G.cyl(0.2, 0.2, 0.02, 16), mat(C.leg), 0.95, 0.01, 0.95, st)
      mesh(G.box(0.24, 0.006, 0.3), mat(C.paper), 0.9, 0.645, 0.9, st, { ry: 0.4 }); ao(st, 0.95, 0.95, 0.9, 0.9)
      const wb = new T3.Group(); wb.position.set(-1.2, 0, 0.6); wb.rotation.y = Math.PI / 2; st.add(wb)
      const b = new T3.Mesh(G.box(1.0, 0.64, 0.03), [mat('#d5dae1'), mat('#d5dae1'), mat('#d5dae1'), mat('#d5dae1'), new T3.MeshStandardMaterial({ map: boardTex, roughness: 0.5 }), mat('#d5dae1')]); b.position.y = 1.2; b.castShadow = true; wb.add(b)
      for (const sx of [-0.45, 0.45]) mesh(G.box(0.035, 1.5, 0.035), mat('#9aa3ae'), sx, 0.75, -0.03, wb)
      plant(st, -1.38, -1.22, 1.15, 1); ao(st, -1.38, -1.22, 0.6, 0.6)
      return { sit: { x: -0.1, z: -0.03, ry: Math.PI }, stand: { x: 0.45, z: 0.18, cam: -0.2 } }
    },
    tray(p, st) {
      rug(st, 0, 0, 1.4, 1.2, '#e6edfb')
      mesh(G.rbox(0.95, 0.78, 0.6, 0.03), mat('#eceef1'), 0, 0.39, 0, st)
      mesh(G.rbox(0.62, 0.04, 0.46, 0.015), mat(C.blue), 0, 0.8, 0, st)
      for (const [dx, dz, w, d] of [[0, 0.22, 0.62, 0.03], [0, -0.22, 0.62, 0.03], [0.3, 0, 0.03, 0.46], [-0.3, 0, 0.03, 0.46]]) mesh(G.box(w, 0.08, d), mat(C.blue), dx, 0.86, dz, st)
      ao(st, 0, 0, 1.3, 0.9)
      plant(st, -0.75, -0.7, 0.75, 1); plant(st, 0.78, 0.62, 0.55, 0)
      return null
    },
  }

  // ---------- characters: one GLB template, cloned and baked per person
  const TARGET_H = 1.5, SEATED_H = 1.35
  const CLIP_RX = {
    idle: [/idle/i, /breath/i, /stand/i],
    typing: [/typing/i, /working/i, /\bwork/i, /type/i, /write/i, /keyboard/i],
    thinking: [/think/i, /ponder/i, /look/i],
    celebrate: [/celebrat/i, /cheer/i, /victory/i, /dance/i, /jump/i, /wave/i],
  }
  const SEATED_RX = /sit|seated/i
  const loader = new X.GLTFLoader()
  const parse = (buf) => new Promise((res, rej) => loader.parse(buf, '', res, rej))
  const fromB64 = (b64) => { const bin = atob(b64), u = new Uint8Array(bin.length); for (let i = 0; i < bin.length; i++) u[i] = bin.charCodeAt(i); return u.buffer }
  const templates = new Map() // agent ('' = the default) -> { gltf, name, bytes, source, seated, isDefault }
  function clipFor(clips, state, seated) {
    const pick = (rxs) => { for (const rx of rxs) { const c = clips.find((x) => rx.test(x.name)); if (c) return c } return null }
    if (seated && state === 'idle') { const c = clips.find((x) => SEATED_RX.test(x.name) && /idle/i.test(x.name)); if (c) return c }
    return pick(CLIP_RX[state]) || (state !== 'idle' ? clipFor(clips, 'idle', seated) : (clips[0] || null))
  }
  async function addTemplate(agent, buf, name, source) {
    const gltf = await parse(buf)
    const ex = (gltf.scene && gltf.scene.userData && gltf.scene.userData.arsenale) || {}
    const clips = gltf.animations || []
    const tpl = { gltf, name, bytes: buf.byteLength, source, isDefault: !!ex.default, seated: !!ex.seated || clips.some((c) => SEATED_RX.test(c.name)) }
    templates.set(agent, tpl)
    return tpl
  }
  // the person's own colours on the default character: skin, hair and the
  // shirt in their role colour. A file of someone's own keeps its colours.
  const TINT = { Skin: 'skin', Hair: 'hair', Shirt: 'shirt' }
  const charMat = new T3.MeshStandardMaterial({ vertexColors: true, roughness: 0.72, metalness: 0 })
  // Bakes the plain-coloured meshes of a cloned character into ONE rigidly
  // skinned mesh (one draw call), with the meshes' own nodes as the bones, so
  // the clips still move them. The originals stay in the tree, switched off
  // with layers (visible = false would hide their children too).
  function bake(model, colours) {
    model.updateMatrixWorld(true)
    const inv = model.matrixWorld.clone().invert(), parts = [], joints = [], m4 = new T3.Matrix4()
    model.traverse((o) => {
      if (!o.isMesh || o.isSkinnedMesh) return
      const m = o.material
      if (Array.isArray(m) || !m.isMeshStandardMaterial || m.map || m.transparent || (m.emissive && m.emissive.getHex() !== 0)) return
      let ji = joints.indexOf(o)
      if (ji < 0) { joints.push(o); ji = joints.length - 1 }
      const g = o.geometry.index ? o.geometry.toNonIndexed() : o.geometry.clone()
      g.applyMatrix4(m4.multiplyMatrices(inv, o.matrixWorld))
      const tint = colours && TINT[m.name] && colours[TINT[m.name]]
      parts.push({ g, c: tint ? new T3.Color(tint) : m.color, ji })
    })
    if (!parts.length) return null
    let n = 0
    parts.forEach((p) => { n += p.g.attributes.position.count })
    const P = new Float32Array(n * 3), N = new Float32Array(n * 3), Cc = new Float32Array(n * 3), SI = new Uint16Array(n * 4), SW = new Float32Array(n * 4)
    let o = 0
    for (const p of parts) {
      const c = p.g.attributes.position.count
      P.set(p.g.attributes.position.array, o * 3); N.set(p.g.attributes.normal.array, o * 3)
      for (let i = 0; i < c; i++) { Cc[(o + i) * 3] = p.c.r; Cc[(o + i) * 3 + 1] = p.c.g; Cc[(o + i) * 3 + 2] = p.c.b; SI[(o + i) * 4] = p.ji; SW[(o + i) * 4] = 1 }
      o += c
      p.g.dispose()
    }
    const g = new T3.BufferGeometry()
    g.setAttribute('position', new T3.BufferAttribute(P, 3)); g.setAttribute('normal', new T3.BufferAttribute(N, 3)); g.setAttribute('color', new T3.BufferAttribute(Cc, 3))
    g.setAttribute('skinIndex', new T3.Uint16BufferAttribute(SI, 4)); g.setAttribute('skinWeight', new T3.BufferAttribute(SW, 4))
    const sm = new T3.SkinnedMesh(g, charMat); sm.castShadow = true; sm.receiveShadow = true; sm.frustumCulled = false
    model.add(sm); model.updateMatrixWorld(true); sm.bind(new T3.Skeleton(joints), sm.matrixWorld)
    for (const j of joints) j.layers.disableAll()
    return sm
  }
  function makeCharacter(p, tpl) {
    const model = X.clone(tpl.gltf.scene)
    let tris = 0
    model.traverse((o) => { if (o.isMesh) { o.castShadow = true; o.receiveShadow = true; if (o.isSkinnedMesh) o.frustumCulled = false; const g = o.geometry; tris += (g.index ? g.index.count : g.attributes.position.count) / 3 } })
    const holder = new T3.Group(); holder.add(model)
    model.updateMatrixWorld(true)
    const box = new T3.Box3().setFromObject(model, true), size = box.getSize(new T3.Vector3())
    const want = tpl.seated ? SEATED_H : TARGET_H
    const s = tpl.isDefault ? 1 : want / (size.y || 1) // the default is made to size
    model.scale.multiplyScalar(s)
    model.updateMatrixWorld(true); box.setFromObject(model, true)
    const c = box.getCenter(new T3.Vector3())
    model.position.y -= box.min.y // the feet on the podium
    if (Math.hypot(c.x, c.z) > 0.25 * TARGET_H) { model.position.x -= c.x; model.position.z -= c.z } // a badly placed origin
    bake(model, tpl.isDefault ? { skin: p.skin, hair: p.hair, shirt: p.shirt } : null)
    const clips = tpl.gltf.animations || []
    const mixer = new T3.AnimationMixer(model), map = {}
    for (const k of Object.keys(CLIP_RX)) { const cl = clipFor(clips, k, tpl.seated); map[k] = cl ? cl.name : null }
    return { holder, model, mixer, clips, map, tpl, tris: Math.round(tris), actions: {}, cur: null, height: size.y * s }
  }
  function playState(ch, state, now) {
    if (!ch || (ch.cur === state && !now)) return
    const name = ch.map[state] || ch.map.idle
    const prev = ch.cur ? ch.actions[ch.cur] : null
    ch.cur = state
    if (!name) { if (prev) prev.fadeOut(0.3); return }
    const clip = ch.clips.find((c) => c.name === name)
    let act = Object.values(ch.actions).find((x) => x.getClip() === clip)
    if (!act) act = ch.mixer.clipAction(clip)
    ch.actions[state] = act
    if (prev === act) return
    act.reset().setEffectiveWeight(1).fadeIn(now ? 0 : 0.3).play()
    if (prev) prev.fadeOut(0.3)
  }

  // remember dropped characters in this browser; every call is wrapped so the page works without IndexedDB
  let idb = null
  const idbOpen = () => new Promise((res) => { try { const r = indexedDB.open('arsenale-office-characters', 1); r.onupgradeneeded = () => r.result.createObjectStore('glb'); r.onsuccess = () => res(idb = r.result); r.onerror = () => res(null) } catch (e) { res(null) } })
  const idbPut = (k, v) => { try { if (idb) idb.transaction('glb', 'readwrite').objectStore('glb').put(v, k) } catch (e) { /* not kept */ } }
  const idbDel = (k) => { try { if (idb) idb.transaction('glb', 'readwrite').objectStore('glb').delete(k) } catch (e) { /* nothing to forget */ } }
  const idbAll = () => new Promise((res) => { try { if (!idb) return res([]); const out = [], rq = idb.transaction('glb', 'readonly').objectStore('glb').openCursor(); rq.onsuccess = () => { const c = rq.result; if (c) { out.push([c.key, c.value]); c.continue() } else res(out) }; rq.onerror = () => res([]) } catch (e) { res([]) } })

  // ---------- the office: a cluster of podiums
  const PITCH = 4.75
  let O = null // { key, group, merged, byId, pick, sig, bounds }
  const cells = new Map() // office key -> Map(podium id -> [i, j])
  const ringGeo = new Map()
  function podRing(S, w) {
    const k = S + '|' + w
    if (!ringGeo.has(k)) { const sh = rrShape(S + 0.02, S + 0.02, 0.44); sh.holes.push(rrShape(S + 0.02 - 2 * w, S + 0.02 - 2 * w, 0.44 - w)); const g = new T3.ShapeGeometry(sh, 12); g.rotateX(-Math.PI / 2); ringGeo.set(k, g) }
    return ringGeo.get(k)
  }
  const selRing = new T3.Mesh(podRing(3, 0.05), new T3.MeshBasicMaterial({ color: C.blue, transparent: true, opacity: 0.8, depthWrite: false, toneMapped: false }))
  const hovRing = new T3.Mesh(podRing(3, 0.05), new T3.MeshBasicMaterial({ color: '#94a3b8', transparent: true, opacity: 0.55, depthWrite: false, toneMapped: false }))
  selRing.visible = hovRing.visible = false; selRing.renderOrder = hovRing.renderOrder = 2
  scene.add(selRing, hovRing)
  const TRAY_MAX = 14
  const trayPapers = new T3.InstancedMesh(G.box(0.3, 0.012, 0.4), mat('#ffffff'), TRAY_MAX)
  trayPapers.castShadow = trayPapers.receiveShadow = true; trayPapers.count = 0
  scene.add(trayPapers)
  const flyPaper = mesh(G.box(0.22, 0.012, 0.3), mat('#ffffff'), 0, 0, 0, scene, { recv: false }); flyPaper.visible = false
  let fly = null, flownKey = ''
  const linkMat = new T3.LineDashedMaterial({ color: '#2B6CB0', dashSize: 0.18, gapSize: 0.12, transparent: true, opacity: 0.9 })
  let links = null, linkSig = ''
  const STATE_COL = { working: '#2563eb', quiet: '#f59e0b', waiting: '#f59e0b', findings: '#f59e0b', failed: '#ef4444', done: '#22c55e', idle: '#a3aab5', away: '#a3aab5', none: '#a3aab5' }

  // cells around the centre, nearest first: the lead's at the centre, the tray next to it
  function cellOrder(n) {
    const out = []
    for (let r = 1; out.length < n + 8; r++) {
      const ring = []
      for (let i = -r; i <= r; i++) for (let j = -r; j <= r; j++) if (Math.max(Math.abs(i), Math.abs(j)) === r) ring.push([i, j])
      ring.sort((a, b) => (Math.atan2(a[1], a[0]) + 7) % (2 * Math.PI) - (Math.atan2(b[1], b[0]) + 7) % (2 * Math.PI))
      out.push(...ring)
    }
    return out
  }
  // A podium keeps its cell while it is on the floor: someone starting work
  // never makes the others move.
  function layout(key, pods) {
    let map = cells.get(key)
    if (!map) { map = new Map(); cells.set(key, map) }
    const ids = new Set(pods.map((p) => p.id))
    for (const id of [...map.keys()]) if (!ids.has(id)) map.delete(id)
    const used = new Set([...map.values()].map((c) => c.join(',')))
    const lead = pods.find((p) => p.kind === 'lead'), tray = pods.find((p) => p.kind === 'tray')
    if (lead && !map.has(lead.id)) { map.set(lead.id, [0, 0]); used.add('0,0') }
    if (tray && !map.has(tray.id)) { map.set(tray.id, [-1, -1]); used.add('-1,-1') }
    used.add('0,0'); used.add('-1,-1')
    const free = cellOrder(pods.length).filter((c) => !used.has(c.join(',')))
    for (const p of pods) if (!map.has(p.id)) map.set(p.id, free.shift())
    return map
  }
  function disposeOffice() {
    if (!O) return
    scene.remove(O.group)
    O.merged.children.forEach((m) => m.geometry.dispose())
    for (const p of O.byId.values()) if (p.ch) p.ch.mixer.stopAllAction()
    O = null
  }
  function build(model) {
    const prevChars = new Map()
    if (O) for (const p of O.byId.values()) if (p.ch) prevChars.set(p.id + '|' + p.charSig, p.ch)
    disposeOffice()
    const map = layout(model.key, model.podiums)
    const group = new T3.Group(), decor = new T3.Group(), dyn = new T3.Group(), pick = []
    const byId = new Map()
    let minX = 1e9, maxX = -1e9, minZ = 1e9, maxZ = -1e9
    for (const src of model.podiums) {
      const S = src.kind === 'lead' ? 3.5 : src.kind === 'tray' ? 2.5 : 3.0
      const [i, j] = map.get(src.id)
      const x = i * PITCH, z = j * PITCH, hs = S / 2
      minX = Math.min(minX, x - hs); maxX = Math.max(maxX, x + hs); minZ = Math.min(minZ, z - hs); maxZ = Math.max(maxZ, z + hs)
      const pg = new T3.Group(); pg.position.set(x, 0, z); decor.add(pg)
      const pgeo = podiumGeos(S)
      mesh(pgeo.body, mat(C.podSide, { roughness: 0.55 }), 0, 0, 0, pg); mesh(pgeo.top, mat(C.pod, { roughness: 0.7 }), 0, 0, 0, pg, { cast: false })
      // the contact shadow on the void, a little toward the viewer (the key light is back-left)
      const sh = mesh(G.plane(), podShadowMat, 0.22, -1.55, 0.26, pg, { cast: false, recv: false }); sh.scale.set(S * 1.8, 1, S * 1.8)
      const p = { id: src.id, kind: src.kind, x, z, S, src }
      const st = new T3.Group(); st.rotation.y = src.kind === 'desk' && hash(src.id) % 3 === 1 ? Math.PI / 2 : 0; pg.add(st)
      const spots = STATION[src.kind] ? STATION[src.kind](src, st) : null
      decor.updateMatrixWorld(true)
      if (spots) {
        const Wp = (s) => { const v = new T3.Vector3(s.x, 0, s.z); st.localToWorld(v); return { x: v.x, z: v.z, rot: s.cam !== undefined ? VIEW0.azim + s.cam : st.rotation.y + (s.ry || 0) } }
        p.sit = Wp(spots.sit); p.stand = Wp(spots.stand)
      }
      if (src.kind === 'tray') p.trayAt = new T3.Vector3(x, 0.83, z)
      // the pick proxy covers the podium and its person
      const pr = new T3.Mesh(G.box(S, 2.6, S), new T3.MeshBasicMaterial()); pr.visible = false; pr.position.set(x, 0.8, z); pr.userData.id = src.id
      group.add(pr); pick.push(pr)
      // the state diamond over the head
      if (src.kind !== 'tray') {
        p.pb = new T3.Mesh(geo('pbOct', () => new T3.OctahedronGeometry(0.11, 0)), new T3.MeshStandardMaterial({ color: '#a3aab5', emissive: '#a3aab5', emissiveIntensity: 0.45, roughness: 0.25, flatShading: true }))
        p.pb.scale.set(1, 1.75, 1); p.pb.castShadow = false
        dyn.add(p.pb)
      }
      byId.set(src.id, p)
    }
    const merged = mergeStatic(decor)
    group.add(merged, decor, dyn)
    scene.add(group)
    // the shadow camera tight around this cluster
    const span = Math.max(maxX - minX, maxZ - minZ) / 2 + 1.2
    const cx = (minX + maxX) / 2, cz = (minZ + maxZ) / 2
    sun.position.set(cx - 9, 16, cz - 4); sun.target.position.set(cx, 0, cz)
    Object.assign(sun.shadow.camera, { left: -span * 1.1, right: span * 1.1, top: span * 1.1, bottom: -span * 1.1, near: 2, far: 60 }); sun.shadow.camera.updateProjectionMatrix()
    O = { key: model.key, group, dyn, merged, byId, pick, bounds: { minX, maxX, minZ, maxZ } }
    computeOverview()
    for (const p of byId.values()) placeCharacter(p, prevChars)
    // characters nobody took back: free their baked geometry
    for (const ch of prevChars.values()) ch.model.traverse((o) => { if (o.isSkinnedMesh) o.geometry.dispose() })
  }
  // the overview: the whole cluster in the stage
  function computeOverview() {
    if (!O) return
    const b = O.bounds, tgt = new T3.Vector3((b.minX + b.maxX) / 2, 0.45, (b.minZ + b.maxZ) / 2)
    const pad = h.pad || { top: 0, bottom: 0 }
    const oz = clamp(zoomFor(boxPts(b.minX, b.maxX, b.minZ, b.maxZ, -0.7, 2.6), tgt, Math.max(200, W - 40), Math.max(160, H - 60 - pad.top - pad.bottom)), 0.12, 2.4)
    // the cluster's middle sits in the middle of the free band, not of the stage
    const shift = (pad.top - pad.bottom) / 2 * (FR / oz) / H
    tgt.addScaledVector(new T3.Vector3(-Math.sin(VIEW0.azim), 0, -Math.cos(VIEW0.azim)), shift / Math.sin(VIEW0.elev))
    overview = { tx: tgt.x, ty: tgt.y, tz: tgt.z, azim: VIEW0.azim, elev: VIEW0.elev, zoom: oz }
  }
  function charSigOf(src) { const t = templates.get(src.agent) || templates.get(''); return (t ? t.name + t.bytes : '-') + '|' + src.shirt + src.hair + src.skin }
  function placeCharacter(p, reuse) {
    const src = p.src
    if (p.kind === 'tray' || !p.sit) return
    const tpl = templates.get(src.agent) || templates.get('')
    if (p.ch) { O.dyn.remove(p.ch.holder); p.ch.mixer.stopAllAction(); p.ch.model.traverse((o) => { if (o.isSkinnedMesh) o.geometry.dispose() }); p.ch = null }
    if (!tpl || !src.present) return
    p.charSig = charSigOf(src)
    let ch = reuse && reuse.get(p.id + '|' + p.charSig)
    if (ch) reuse.delete(p.id + '|' + p.charSig)
    else { ch = makeCharacter(src, tpl); ch.cur = null }
    const sp = tpl.seated ? p.sit : p.stand
    ch.holder.position.set(sp.x, 0, sp.z); ch.holder.rotation.y = sp.rot
    p.ch = ch
    O.dyn.add(ch.holder)
    playState(ch, src.anim || 'idle', true)
  }
  const layoutSig = (model) => model.key + '|' + model.podiums.map((p) => p.id + ':' + p.kind).join(',')

  // ---------- the portrait cards (html over the canvas)
  const LOOKS = ['bun', 'spiky', 'long', 'bald', 'pony', 'curly', 'short']
  const cards = new Map()
  function faceSVG(p, expr) {
    const sk = p.skin || '#E9B994', sd = shadeHex(sk, -0.16), hr = p.hair || '#3B2A20', shirt = p.shirt || '#6F7B88', ink = '#2a2220'
    const look = LOOKS[hash(p.agent || p.id) % LOOKS.length]
    let back = '', front = ''
    let body = '<path d="M12,100 C14,81 31,74 50,74 C69,74 86,81 88,100Z" fill="' + shirt + '"/><path d="M43,74 Q50,82 57,74" fill="none" stroke="' + shadeHex(shirt, -0.2) + '" stroke-width="2"/>'
    if (look === 'spiky') body += '<path d="M33,77 C38,86 62,86 67,77" fill="none" stroke="' + shadeHex(shirt, -0.25) + '" stroke-width="3"/>'
    if (look === 'pony') body += '<path d="M43,74 L50,88 L57,74Z" fill="#dbe6fe"/>'
    if (look === 'bun') { back = '<circle cx="50" cy="15" r="10" fill="' + hr + '"/>'; front = '<path d="M25,48 C23,26 36,18 50,18 C64,18 77,26 75,48 C72,38 66,31 57,30 C52,34 44,34 38,31 C31,34 27,40 25,48Z" fill="' + hr + '"/>' }
    else if (look === 'spiky') front = '<path d="M25,47 L24,30 L31,31 L32,21 L40,25 L45,15 L51,23 L58,15 L62,24 L70,21 L69,31 L76,31 L75,47 C71,37 62,32 50,32 C38,32 29,37 25,47Z" fill="' + hr + '"/>'
    else if (look === 'long') { back = '<path d="M23,50 C21,24 35,16 50,16 C65,16 79,24 77,50 L80,82 C70,87 62,86 58,84 L57,68 L43,68 L42,84 C38,86 30,87 20,82Z" fill="' + hr + '"/>'; front = '<path d="M25,48 C24,27 37,19 52,19 C66,19 76,27 75,45 C69,35 59,29 47,30 C40,34 32,40 25,48Z" fill="' + hr + '"/>' }
    else if (look === 'bald') front = '<ellipse cx="27" cy="44" rx="4" ry="8" fill="' + hr + '"/><ellipse cx="73" cy="44" rx="4" ry="8" fill="' + hr + '"/><ellipse cx="58" cy="27" rx="7" ry="3.5" fill="#fff" opacity=".28"/>'
    else if (look === 'pony') { back = '<path d="M68,28 C86,28 92,48 85,68 C81,58 77,49 71,42Z" fill="' + hr + '"/>'; front = '<path d="M25,47 C24,25 37,18 50,18 C64,18 76,25 75,47 C70,35 60,29 50,29 C42,29 36,31 33,33 C29,37 26,42 25,47Z" fill="' + hr + '"/>' }
    else if (look === 'curly') front = '<g fill="' + hr + '"><circle cx="29" cy="40" r="8"/><circle cx="36" cy="28" r="10"/><circle cx="49" cy="22" r="11"/><circle cx="63" cy="27" r="10"/><circle cx="71" cy="39" r="8"/><circle cx="26" cy="50" r="5"/><circle cx="74" cy="50" r="5"/></g>'
    else front = '<path d="M25,46 C24,25 37,18 50,18 C64,18 76,25 75,46 C73,37 66,31 56,30 C49,33 41,33 34,31 C29,35 26,40 25,46Z" fill="' + hr + '"/>'
    const dot = (x, y, r) => '<circle cx="' + x + '" cy="' + y + '" r="' + (r || 2.6) + '" fill="' + ink + '"/>'
    const hl = (x, y) => '<circle cx="' + (x + 0.9) + '" cy="' + (y - 0.9) + '" r=".8" fill="#fff"/>'
    const line = (x1, y1, x2, y2, w) => '<path d="M' + x1 + ',' + y1 + ' L' + x2 + ',' + y2 + '" stroke="' + shadeHex(hr, -0.1) + '" stroke-width="' + (w || 2.2) + '" stroke-linecap="round"/>'
    const mpath = (d, w) => '<path d="' + d + '" fill="none" stroke="' + ink + '" stroke-width="' + (w || 2) + '" stroke-linecap="round" stroke-linejoin="round"/>'
    let eyes, brows, mouth
    if (expr === 'thinking') { eyes = dot(41.6, 49.5) + dot(61.6, 49.5) + hl(41.6, 49.5) + hl(61.6, 49.5); brows = line(35, 43, 44, 42.5) + line(56, 39.5, 65, 37.5); mouth = mpath('M45,65.5 L54,64') }
    else if (expr === 'determined') { eyes = dot(40, 51.5) + dot(60, 51.5); brows = line(34.5, 40.5, 45, 44.5, 2.6) + line(65.5, 40.5, 55, 44.5, 2.6); mouth = mpath('M44,65 L56,65', 2.4) }
    else if (expr === 'serious') { eyes = dot(40, 51.5, 2.4) + dot(60, 51.5, 2.4); brows = line(35, 42.5, 45, 44) + line(55, 44, 65, 42.5); mouth = mpath('M44,66 Q50,64 56,66') }
    else if (expr === 'smile') { eyes = mpath('M36,52 Q40,47 44,52', 2.4) + mpath('M56,52 Q60,47 64,52', 2.4); brows = line(35, 41, 44, 40) + line(56, 40, 65, 41); mouth = '<path d="M42,62 Q50,71 58,62 Q50,65 42,62Z" fill="#7a2e2e" stroke="' + ink + '" stroke-width="1.6" stroke-linejoin="round"/>' }
    else { eyes = dot(40, 51) + dot(60, 51) + hl(40, 51) + hl(60, 51); brows = line(35, 42, 44, 41.5) + line(56, 41.5, 65, 42); mouth = mpath('M45,65 Q50,66.5 55,65') }
    const blush = '<circle cx="34" cy="59" r="4" fill="#f08a8a" opacity="' + (expr === 'smile' ? 0.4 : 0.22) + '"/><circle cx="66" cy="59" r="4" fill="#f08a8a" opacity="' + (expr === 'smile' ? 0.4 : 0.22) + '"/>'
    return '<svg viewBox="0 0 100 100" xmlns="http://www.w3.org/2000/svg" aria-hidden="true">' + back + body +
      '<rect x="43" y="63" width="14" height="14" rx="5" fill="' + sd + '"/><ellipse cx="24" cy="51" rx="5" ry="6" fill="' + sk + '"/><ellipse cx="76" cy="51" rx="5" ry="6" fill="' + sk + '"/>' +
      '<ellipse cx="50" cy="47" rx="25" ry="27" fill="' + sk + '"/>' + front + blush +
      '<path d="M50,53 Q53.5,58 49,59" fill="none" stroke="' + sd + '" stroke-width="1.7" stroke-linecap="round"/>' + brows + eyes + mouth + '</svg>'
  }
  const EXPR = { working: 'thinking', quiet: 'serious', waiting: 'serious', findings: 'serious', failed: 'serious', done: 'smile', idle: 'neutral', away: 'neutral', none: 'neutral' }
  const TRAY_ICON = '<svg viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2.4" aria-hidden="true"><path d="M3 13h5l1.5 3h5L16 13h5v6H3zM6 13l2-8h8l2 8"/></svg>'
  function syncCards(model) {
    const seen = new Set()
    for (const src of model.podiums) {
      seen.add(src.id)
      let c = cards.get(src.id)
      if (!c) {
        c = { el: document.createElement('button'), key: '' }
        c.el.type = 'button'
        c.el.dataset.anchor = src.id; c.el.dataset.at = 'card'
        cards.set(src.id, c)
        cardsEl.appendChild(c.el)
      }
      const glb = templates.has(src.agent)
      const k = [src.state, src.name, src.sub, src.glyph, src.attrs, src.aria, src.shirt, src.hair, src.skin, src.present, model.selected === src.id, glb, src.count].join('|')
      if (k === c.key) continue
      c.key = k
      const el = c.el
      // the page's own attributes (data-key, data-open, …) say what a click does there
      for (const a of [...el.attributes]) if (/^data-(?!anchor$|at$)/.test(a.name)) el.removeAttribute(a.name)
      const tmp = document.createElement('div'); tmp.innerHTML = '<i ' + (src.attrs || '') + '></i>'
      for (const a of [...tmp.firstChild.attributes]) if (/^data-/.test(a.name)) el.setAttribute(a.name, a.value)
      el.className = 'w3card st-' + src.state + (src.kind === 'tray' ? ' tray' : '') + (model.selected === src.id ? ' sel' : '') + (src.state === 'away' ? ' away' : '') + (src.present === false && src.kind !== 'tray' ? ' absent' : '') + (glb ? ' glb' : '')
      el.style.setProperty('--sc', STATE_COL[src.state] || STATE_COL.none)
      el.setAttribute('aria-label', src.aria || src.name || '')
      const face = src.kind === 'tray' ? TRAY_ICON : faceSVG(src, EXPR[src.state] || 'neutral')
      const bg = src.kind === 'tray' ? '#EEF3FF' : shadeHex(src.shirt || '#94a3b8', 0.82)
      el.innerHTML = '<span class="fr"><span class="in" style="background:' + bg + '">' + face + '</span></span>' +
        '<span class="nm">' + (src.glyph ? '<i aria-hidden="true">' + src.glyph + '</i>' : '') + '<b dir="auto">' + esc(src.name || '') + '</b>' + (src.sub ? '<small>' + esc(src.sub) + '</small>' : '') + '</span>'
    }
    for (const [id, c] of cards) if (!seen.has(id)) { c.el.remove(); cards.delete(id) }
  }

  // ---------- placing the html labels over the 3D points
  const _v = new T3.Vector3()
  let ovDirty = true, declutterT = 0
  function anchorPoint(el) {
    const p = O && O.byId.get(el.dataset.anchor)
    if (!p) return null
    const at = el.dataset.at
    if (at === 'card') return _v.set(p.x - p.S * 0.14, p.kind === 'tray' ? 1.55 : 1.95 + (p.S > 3.2 ? 0.12 : 0), p.z - p.S * 0.14)
    if (at === 'tray') return _v.set(p.x, 1.05, p.z)
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
      el.style.display = pt.z > 1 || x < -200 || x > W + 200 || y < -200 || y > H + 300 ? 'none' : ''
      el.style.left = x.toFixed(1) + 'px'; el.style.top = y.toFixed(1) + 'px'
      el.classList.toggle('dim', !!focusId && el.dataset.anchor !== focusId && el.classList.contains('w3card'))
    }
    clearTimeout(declutterT)
    declutterT = setTimeout(declutter, 120)
  }
  // A speech bubble that would cover a card or a more important bubble
  // shrinks to its name tag, and with no room even for that it waits out of
  // sight; the card still says the person is working. The selected one always shows.
  function declutter() {
    // a bubble hangs off its own card, so that card never counts against it
    const placed = [...cardsEl.children].filter((c) => c.style.display !== 'none').map((c) => ({ r: c.getBoundingClientRect(), id: c.dataset.anchor }))
    const hit = (r, id) => placed.some(({ r: p, id: o }) => o !== id && r.left < p.right - 2 && r.right > p.left + 2 && r.top < p.bottom - 2 && r.bottom > p.top + 2)
    const bubs = [...pageEl.querySelectorAll('.bub[data-anchor]')].filter((b) => b.style.display !== 'none')
    bubs.sort((a, b) => Number(b.dataset.prio || 0) - Number(a.dataset.prio || 0))
    // a bubble that would run past the edge of the floor hangs on the card's other side
    const edge = ov.getBoundingClientRect(), rtl = document.documentElement.dir === 'rtl'
    const out = (r) => (rtl ? r.left < edge.left + 4 : r.right > edge.right - 4)
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
  function showHover(p, col) {
    if (!p) { hovRing.visible = false; return }
    hovRing.visible = true; hovRing.geometry = podRing(p.S, 0.05); hovRing.position.set(p.x, 0.011, p.z); hovRing.material.color.set(col || '#94a3b8')
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
    const own = templates.get(agent), tpl = own || templates.get('')
    if (!tpl) return ''
    const ch = O && [...O.byId.values()].find((p) => p.src.agent === agent && p.ch)
    const map = ch ? Object.entries(ch.ch.map).map(([k, v]) => T(k) + ' → ' + (v || '—')).join(' · ') : ''
    const src = !own ? T('Default character') : own.source === 'dropped' ? T('remembered in this browser') : T('from the characters folder')
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
      if (p.ch) playState(p.ch, src.anim || 'idle')
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
    trayPapers.visible = model.podiums.some((p) => p.kind === 'tray')
    const sel = model.selected && O.byId.get(model.selected)
    selRing.visible = !!sel
    if (sel) { selRing.geometry = podRing(sel.S, 0.05); selRing.position.set(sel.x, 0.012, sel.z) }
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
    // a report handed in: the sheet flies from the desk to the tray
    if (model.fly && model.fly.key !== flownKey && !(h.calm && h.calm())) {
      flownKey = model.fly.key
      const p = O.byId.get(model.fly.from), tr = [...O.byId.values()].find((x) => x.trayAt)
      if (p && tr) fly = { from: new T3.Vector3(p.sit ? p.sit.x : p.x, 1.2, p.sit ? p.sit.z : p.z), to: tr.trayAt.clone().add(new T3.Vector3(0, 0.05 + Math.min(tr.src.count || 0, TRAY_MAX) * 0.016, 0)), t: 0 }
    }
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
    const dt = Math.min(0.05, (now - last) / 1000)
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
      for (const p of O.byId.values()) {
        if (p.ch && !calm) p.ch.mixer.update(dt)
        if (p.pb) {
          const sp = p.sit || { x: p.x, z: p.z }
          p.pb.position.set(sp.x, (p.ch ? p.ch.height : 1.4) + 0.3 + (calm ? 0 : Math.sin(now / 450 + hash(p.id) % 7) * 0.03), sp.z)
          if (!calm) p.pb.rotation.y += dt * 1.1
        }
      }
    }
    if (fly) {
      fly.t += dt / 1.5
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
    for (const [agent, b64] of Object.entries(chars.byAgent || {})) { try { await addTemplate(agent, fromB64(b64), agent + '.glb', 'file') } catch (e) { /* a broken file: that person keeps the default */ } }
    await idbOpen()
    for (const [k, v] of await idbAll()) if (v && v.buf) { try { await addTemplate(k, v.buf, v.name, 'dropped') } catch (e) { idbDel(k) } }
    refreshCharacters()
  })()

  return {
    mount, sync, fit: () => fit(true), focus, zoomBy, panBy, characterBox, resize, ready: boot,
    zoomPct: () => Math.round(view.zoom / (overview ? overview.zoom : 1) * 100),
    view: () => Object.assign(viewOf(), { auto: view.auto }),
    /** What is on the floor, for tests and for the curious. */
    info: () => ({
      key: O ? O.key : '', calls: renderer.info.render.calls, soft,
      podiums: O ? [...O.byId.values()].map((p) => ({ id: p.id, kind: p.kind, agent: p.src.agent || '', state: p.src.state, character: !!p.ch, clip: p.ch ? p.ch.cur : null, cell: [p.x / PITCH, p.z / PITCH] })) : [],
      cards: cards.size,
    }),
  }
}

/* ======================================================================
 * Node: the pinned three.js and the characters, inlined into the page.
 * ====================================================================== */
const VENDOR_DIR = path.join(__dirname, 'vendor', 'three')
const CHAR_DIR = path.join(__dirname, 'characters')
const VENDOR_FILES = ['three.cjs', 'BufferGeometryUtils.js', 'SkeletonUtils.js', 'GLTFLoader.js']
const MAX_GLB = 12 * 1024 * 1024 // a character bigger than this is left out of the page
const cache = new Map()
function cached(file, make) {
  let st
  try { st = fs.statSync(file) } catch { return null }
  const hit = cache.get(file)
  if (hit && hit.m === st.mtimeMs && hit.s === st.size) return hit.v
  const v = make(fs.readFileSync(file))
  cache.set(file, { m: st.mtimeMs, s: st.size, v })
  return v
}
// nothing inside a <script> block may close it early
const scriptSafe = (s) => s.replace(/<\/(script)/gi, '<\\/$1').replace(/<!--/g, '<\\!--')

/** The <script> blocks the 3D office needs, or '' when the vendor files are
 *  missing (the page then keeps its flat office). three.cjs is CommonJS: it
 *  runs inside a function, so its hundreds of top-level names stay out of
 *  the page's own global scope. `characterDirs` are folders with
 *  <agent>.glb files that replace the default character for that agent. */
function worldScripts(opts = {}) {
  const parts = []
  for (const f of VENDOR_FILES) {
    const src = cached(path.join(VENDOR_DIR, f), (b) => scriptSafe(b.toString('utf8')))
    if (src === null) return ''
    parts.push(f === 'three.cjs'
      ? '<script>(function (exports) {\n' + src + '\n})(window.THREE = {});</script>'
      : '<script>' + src + '</script>')
  }
  const characters = { default: cached(path.join(CHAR_DIR, 'default.glb'), (b) => b.toString('base64')) || '', byAgent: {} }
  for (const dir of opts.characterDirs || []) {
    let names = []
    try { names = fs.readdirSync(dir) } catch { continue }
    for (const n of names) {
      const m = /^([\w.-]+)\.glb$/i.exec(n)
      if (!m || m[1] === 'default' || characters.byAgent[m[1]]) continue
      const file = path.join(dir, n)
      try { if (fs.statSync(file).size > MAX_GLB) continue } catch { continue }
      const b64 = cached(file, (b) => b.toString('base64'))
      if (b64) characters.byAgent[m[1]] = b64
    }
  }
  parts.push('<script>const OFFICE_CHARACTERS = ' + JSON.stringify(characters) + ';</script>')
  return parts.join('\n')
}

module.exports = { FONT, WORLD_STYLE, campusArt, office3d, worldScripts, VENDOR_FILES }
