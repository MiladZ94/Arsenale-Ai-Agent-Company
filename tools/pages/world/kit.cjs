/* The shared three.js kit of the campus and the office: the render engine
 * (orthographic isometric camera, pan, zoom, picking), the procedural low-poly
 * shapes (12 buildings, the avatar, the desk) and the asset loader.
 *
 * Like the page's other client code this is never run in Node: its source is
 * written into the page (fn.toString()), so it may use only what a browser
 * has, plus window.THREE, window.THREE_ADDONS, WORLD_PALETTE (palette.cjs)
 * and ASSET_MODELS (tools/assets.cjs: base64 .glb by "building:<type>",
 * "furniture:<name>" or "character:<style>").
 *
 * Nothing is downloaded: every shape is made here from boxes, cylinders and
 * cones. A real model in the manifest replaces the shape of its building
 * type, a piece of furniture or the person (loadModels), and the shape stays
 * when the file is absent or broken.
 * No shadows anywhere: everything stands flush on the ground.
 */
function worldKit() {
  const T3 = window.THREE
  if (!T3) return null
  const clamp = (v, a, b) => Math.max(a, Math.min(b, v))

  // ---------- engine
  const AZ = Math.PI / 4, EL = 0.62
  const RIGHT = [Math.cos(AZ), 0, -Math.sin(AZ)]
  /** A renderer, a scene and an isometric orthographic camera in a host div. Returns null with no WebGL. */
  function engine(opts) {
    let renderer
    try { renderer = new T3.WebGLRenderer({ antialias: true, alpha: true, powerPreference: 'high-performance' }) } catch (e) { return null }
    let soft = false
    try {
      const gl = renderer.getContext(), dbg = gl.getExtension('WEBGL_debug_renderer_info')
      soft = /swiftshader|basic render|llvmpipe|software|warp/i.test(dbg ? String(gl.getParameter(dbg.UNMASKED_RENDERER_WEBGL)) : '')
    } catch (e) { /* unknown: treat it as a GPU */ }
    renderer.setPixelRatio(soft ? 1 : Math.min(window.devicePixelRatio || 1, 2))
    renderer.shadowMap.enabled = false
    renderer.outputColorSpace = T3.SRGBColorSpace
    const canvas = renderer.domElement
    canvas.setAttribute('aria-hidden', 'true')
    const host = document.createElement('div')
    host.className = 'k3host'
    const ov = document.createElement('div')
    ov.className = 'k3ov'
    host.append(canvas, ov)
    const scene = new T3.Scene()
    scene.add(new T3.HemisphereLight('#ffffff', '#c3c9d2', 1.9))
    const sun = new T3.DirectionalLight('#fff6e6', 1.5)
    sun.position.set(-6, 10, 4)
    scene.add(sun)
    const cam = new T3.OrthographicCamera(-1, 1, 1, -1, 0.1, 600)
    const view = { tx: 0, tz: 0, ppu: 40, zoom: 1, fit: 40 }
    const e = { host, ov, canvas, scene, cam, view, W: 0, H: 0, bounds: null, onFrame: null, drag: false, alive: true }
    let need = true
    let lost = false
    canvas.addEventListener('webglcontextlost', (ev) => { ev.preventDefault(); lost = true; if (opts && opts.onLost) opts.onLost() })
    function place() {
      const d = 120, ppu = view.fit * view.zoom
      view.ppu = ppu
      cam.left = -e.W / 2 / ppu; cam.right = e.W / 2 / ppu; cam.top = e.H / 2 / ppu; cam.bottom = -e.H / 2 / ppu
      cam.position.set(view.tx + d * Math.cos(EL) * Math.sin(AZ), d * Math.sin(EL), view.tz + d * Math.cos(EL) * Math.cos(AZ))
      cam.lookAt(view.tx, 0, view.tz)
      cam.updateProjectionMatrix(); cam.updateMatrixWorld()
    }
    e.resize = () => {
      const w = host.clientWidth, h = host.clientHeight
      if (!w || !h || (w === e.W && h === e.H)) return !!(w && h)
      e.W = w; e.H = h
      renderer.setSize(w, h, false)
      canvas.style.width = '100%'; canvas.style.height = '100%'
      need = true
      return true
    }
    e.dirty = () => { need = true }
    e.project = (x, y, z) => {
      const v = new T3.Vector3(x, y, z).project(cam)
      return { x: (v.x + 1) / 2 * e.W, y: (1 - v.y) / 2 * e.H }
    }
    const ray = new T3.Raycaster()
    e.groundAt = (px, py) => {
      ray.setFromCamera(new T3.Vector2(px / e.W * 2 - 1, 1 - py / e.H * 2), cam)
      const o = ray.ray.origin, d = ray.ray.direction
      const t = -o.y / d.y
      return { x: o.x + d.x * t, z: o.z + d.z * t }
    }
    e.pick = (px, py, objects) => {
      ray.setFromCamera(new T3.Vector2(px / e.W * 2 - 1, 1 - py / e.H * 2), cam)
      const hit = ray.intersectObjects(objects, true)[0]
      let o = hit && hit.object
      while (o && !(o.userData && o.userData.id)) o = o.parent
      return o ? o.userData.id : null
    }
    /** Fits e.bounds ({minx,maxx,minz,maxz,h}) into the host with `pad` px on each side. */
    e.fit = (pad) => {
      const b = e.bounds
      if (!b || !e.W) return
      pad = pad || { l: 24, r: 24, t: 24, b: 24 }
      view.zoom = 1; view.fit = 1
      view.tx = (b.minx + b.maxx) / 2; view.tz = (b.minz + b.maxz) / 2
      place()
      let x0 = Infinity, x1 = -Infinity, y0 = Infinity, y1 = -Infinity
      for (const x of [b.minx, b.maxx]) for (const z of [b.minz, b.maxz]) for (const y of [0, b.h || 0]) {
        const p = e.project(x, y, z)
        x0 = Math.min(x0, p.x); x1 = Math.max(x1, p.x); y0 = Math.min(y0, p.y); y1 = Math.max(y1, p.y)
      }
      const aw = Math.max(40, e.W - pad.l - pad.r), ah = Math.max(40, e.H - pad.t - pad.b)
      view.fit = clamp(Math.min(aw / Math.max(1, x1 - x0), ah / Math.max(1, y1 - y0)), 4, 160)
      view.zoom = 1
      place()
      // the extents' centre goes to the centre of the free area
      let cx = 0, cy = 0
      x0 = Infinity; x1 = -Infinity; y0 = Infinity; y1 = -Infinity
      for (const x of [b.minx, b.maxx]) for (const z of [b.minz, b.maxz]) for (const y of [0, b.h || 0]) {
        const p = e.project(x, y, z)
        x0 = Math.min(x0, p.x); x1 = Math.max(x1, p.x); y0 = Math.min(y0, p.y); y1 = Math.max(y1, p.y)
      }
      cx = (x0 + x1) / 2; cy = (y0 + y1) / 2
      e.panPx(pad.l + aw / 2 - cx, pad.t + ah / 2 - cy)
    }
    e.panPx = (dx, dy) => {
      const f = view.ppu
      // screen right is the camera's right; screen up is "away from the camera" on the ground
      const k = dy / (f * Math.sin(EL))
      view.tx += -dx / f * RIGHT[0] - k * Math.sin(AZ)
      view.tz += -dx / f * RIGHT[2] - k * Math.cos(AZ)
      clampTarget(); place(); need = true
    }
    function clampTarget() {
      const b = e.bounds
      if (!b) return
      view.tx = clamp(view.tx, b.minx - 6, b.maxx + 6); view.tz = clamp(view.tz, b.minz - 6, b.maxz + 6)
    }
    e.zoomBy = (f, px, py) => {
      px = px === undefined ? e.W / 2 : px; py = py === undefined ? e.H / 2 : py
      const before = e.groundAt(px, py)
      view.zoom = clamp(view.zoom * f, 0.5, 5)
      place()
      const after = e.groundAt(px, py)
      view.tx += before.x - after.x; view.tz += before.z - after.z
      clampTarget(); place(); need = true
    }
    e.zoomPct = () => Math.round(view.zoom * 100)
    e.getView = () => ({ tx: view.tx, tz: view.tz, zoom: view.zoom })
    e.setView = (v) => { view.tx = v.tx; view.tz = v.tz; view.zoom = clamp(v.zoom, 0.5, 5); place(); need = true }
    e.place = place
    e.renderNow = () => {
      if (lost || !e.resize()) return false
      place()
      renderer.render(scene, cam)
      need = false
      if (e.onFrame) e.onFrame()
      return true
    }
    function frame() {
      if (!e.alive) return
      requestAnimationFrame(frame)
      if (!host.isConnected || lost) return
      const sized = e.W !== host.clientWidth || e.H !== host.clientHeight
      if (need || sized) e.renderNow()
    }
    requestAnimationFrame(frame)
    e.drop = () => { e.alive = false; renderer.dispose() }
    return e
  }

  // ---------- materials and parts
  const mats = new Map()
  const mat = (hex) => {
    let m = mats.get(hex)
    if (!m) { m = new T3.MeshLambertMaterial({ color: hex, flatShading: true }); mats.set(hex, m) }
    return m
  }
  const add = (g, geo, color, x, y, z) => { const m = new T3.Mesh(geo, mat(color)); m.position.set(x, y, z); g.add(m); return m }
  /** A box standing on y. */
  const box = (g, w, h, d, c, x, y, z) => add(g, new T3.BoxGeometry(w, h, d), c, x, y + h / 2, z)
  const cyl = (g, rt, rb, h, c, x, y, z, seg) => add(g, new T3.CylinderGeometry(rt, rb, h, seg || 10), c, x, y + h / 2, z)
  const cone = (g, r, h, c, x, y, z, seg) => add(g, new T3.ConeGeometry(r, h, seg || 4), c, x, y + h / 2, z)
  const ball = (g, r, c, x, y, z, ph) => add(g, new T3.SphereGeometry(r, 12, 8, 0, Math.PI * 2, 0, ph || Math.PI), c, x, y, z)
  /** A gabled roof: width w (x), height h, ridge along z for depth d, standing on y. */
  function gable(g, w, h, d, c, x, y, z) {
    const a = w / 2, b = d / 2
    const v = new Float32Array([
      -a, 0, b, a, 0, b, 0, h, b, a, 0, -b, -a, 0, -b, 0, h, -b,
      -a, 0, -b, -a, 0, b, 0, h, b, -a, 0, -b, 0, h, b, 0, h, -b,
      a, 0, b, a, 0, -b, 0, h, -b, a, 0, b, 0, h, -b, 0, h, b])
    const geo = new T3.BufferGeometry()
    geo.setAttribute('position', new T3.BufferAttribute(v, 3))
    geo.computeVertexNormals()
    const m = new T3.Mesh(geo, mat(c)); m.position.set(x, y, z); g.add(m); return m
  }
  /** A flat checkerboard of two light colours (tiles of `tile` units) lying on y, from one canvas texture per colour pair. */
  const checkers = new Map()
  function checker(g, w, d, tile, c1, c2, x, y, z) {
    const key = c1 + c2
    let m = checkers.get(key)
    if (!m) {
      const cv = document.createElement('canvas')
      cv.width = cv.height = 128
      const cx = cv.getContext('2d')
      for (let i = 0; i < 2; i++) for (let j = 0; j < 2; j++) { cx.fillStyle = (i + j) % 2 ? c2 : c1; cx.fillRect(i * 64, j * 64, 64, 64) }
      const tex = new T3.CanvasTexture(cv)
      tex.wrapS = tex.wrapT = T3.RepeatWrapping
      tex.colorSpace = T3.SRGBColorSpace
      tex.anisotropy = 4
      m = new T3.MeshLambertMaterial({ map: tex })
      checkers.set(key, m)
    }
    // the texture is shared, so each plane keeps its own repeat in its UVs
    const geo = new T3.PlaneGeometry(w, d)
    const uv = geo.attributes.uv
    for (let i = 0; i < uv.count; i++) uv.setXY(i, uv.getX(i) * w / tile / 2, uv.getY(i) * d / tile / 2)
    const p = new T3.Mesh(geo, m)
    p.rotation.x = -Math.PI / 2
    p.position.set(x, y, z)
    g.add(p)
    return p
  }
  const windows = (g, w, d, y, rows, cols, c, face) => {
    // small glass panes on the +z face (face 0) or the +x face (face 1)
    for (let r = 0; r < rows; r++) for (let k = 0; k < cols; k++) {
      const u = (k + 0.5) / cols - 0.5
      if (face) box(g, 0.012, 0.07, 0.07, c, w / 2 + 0.003, y + r * 0.16, u * d * 0.78)
      else box(g, 0.07, 0.07, 0.012, c, u * w * 0.78, y + r * 0.16, d / 2 + 0.003)
    }
  }

  const W = { cream: '#EFE3CC', terra: '#B5573B', brick: '#C98E6C', glass: '#8DB5D8', mint: '#BFE3D2', teal: '#5FA89B', navy: '#5B6FA8', slate: '#8A93B8', sand: '#D9C39A', stone: '#E8E1D3', wood: '#A87B52', lav: '#B8B6E4' }

  /** The 12 building shapes. Each stands within a 0.84 square on y = 0 and
   *  carries the office's accent colour on a sign band by its door. */
  const SHAPES = {
    engineering(g) {
      box(g, 0.78, 0.36, 0.56, W.cream, 0, 0, 0.1)
      for (const x of [-0.26, 0, 0.26]) gable(g, 0.26, 0.2, 0.56, W.terra, x, 0.36, 0.1)
      cyl(g, 0.05, 0.05, 0.5, '#8F7B6A', 0.3, 0.2, -0.26, 8)
      box(g, 0.78, 0.18, 0.2, W.brick, 0, 0, -0.3)
      windows(g, 0.78, 0.76, 0.12, 1, 4, W.glass, 0)
    },
    verification(g) {
      box(g, 0.6, 0.46, 0.6, W.mint, 0, 0, 0)
      box(g, 0.66, 0.05, 0.66, '#9CCDB8', 0, 0.46, 0)
      cyl(g, 0.17, 0.2, 0.1, '#6FB496', 0, 0.51, 0, 10)
      box(g, 0.05, 0.2, 0.012, '#1F7A57', -0.08, 0.1, 0.31).rotation.z = 0.7
      box(g, 0.05, 0.34, 0.012, '#1F7A57', 0.07, 0.1, 0.31).rotation.z = -0.6
    },
    security(g) {
      box(g, 0.5, 0.36, 0.5, W.slate, 0, 0, 0)
      box(g, 0.14, 0.2, 0.012, '#34406B', 0, 0, 0.255)
      for (const [x, z] of [[-0.3, -0.3], [0.3, -0.3], [-0.3, 0.3], [0.3, 0.3]]) {
        cyl(g, 0.1, 0.1, 0.5, '#7C86B0', x, 0, z, 8)
        cone(g, 0.13, 0.2, '#3F4E86', x, 0.5, z, 8)
      }
      cone(g, 0.2, 0.18, '#3F4E86', 0, 0.36, 0, 4).rotation.y = Math.PI / 4
    },
    release(g) {
      box(g, 0.76, 0.2, 0.36, '#C9B6D8', 0, 0, -0.18)
      box(g, 0.76, 0.03, 0.4, '#8E7BA6', 0, 0.2, -0.18)
      box(g, 0.05, 0.62, 0.05, '#E5A81E', 0.3, 0, 0.1)
      box(g, 0.5, 0.05, 0.05, '#E5A81E', 0.07, 0.6, 0.1)
      box(g, 0.012, 0.18, 0.012, '#6B5B3A', -0.14, 0.42, 0.1)
      box(g, 0.2, 0.12, 0.14, '#D8693E', -0.24, 0, 0.3)
      box(g, 0.2, 0.12, 0.14, '#4C8DCB', 0, 0, 0.3)
      box(g, 0.2, 0.12, 0.14, '#E8C04A', -0.12, 0.12, 0.3)
    },
    docs(g) {
      box(g, 0.74, 0.07, 0.58, '#D8CDB8', 0, 0, 0)
      box(g, 0.62, 0.26, 0.44, W.stone, 0, 0.07, -0.02)
      for (let i = 0; i < 5; i++) cyl(g, 0.026, 0.026, 0.26, '#FFFFFF', -0.26 + i * 0.13, 0.07, 0.25, 8)
      gable(g, 0.7, 0.2, 0.58, '#B5673F', 0, 0.33, 0).rotation.y = 0
      box(g, 0.66, 0.03, 0.06, '#FFFFFF', 0, 0.33, 0.27)
    },
    design(g) {
      box(g, 0.36, 0.4, 0.36, '#E78FB3', -0.2, 0, -0.14)
      box(g, 0.34, 0.26, 0.34, '#F0C24B', 0.2, 0, -0.06)
      box(g, 0.3, 0.3, 0.3, '#5B9BD5', 0.0, 0.0, 0.24)
      box(g, 0.2, 0.18, 0.2, '#7CC6A4', -0.2, 0.4, -0.14)
      cyl(g, 0.09, 0.09, 0.14, '#FFFFFF', 0.2, 0.26, -0.06, 12)
    },
    data(g) {
      box(g, 0.4, 0.88, 0.4, '#B9BCE8', 0, 0, 0)
      for (let i = 0; i < 6; i++) { box(g, 0.42, 0.035, 0.42, '#7C80C4', 0, 0.12 + i * 0.13, 0) }
      box(g, 0.28, 0.06, 0.28, '#9599D6', 0, 0.88, 0)
      box(g, 0.5, 0.14, 0.5, '#9599D6', 0, 0, 0)
    },
    planning(g) {
      box(g, 0.7, 0.2, 0.5, W.sand, 0, 0, 0.06)
      box(g, 0.28, 0.5, 0.28, '#E3CFA2', 0, 0.2, -0.04)
      cone(g, 0.24, 0.22, '#B5573B', 0, 0.7, -0.04, 4).rotation.y = Math.PI / 4
      cyl(g, 0.085, 0.085, 0.02, '#FFFFFF', 0, 0.52, 0.112, 14).rotation.x = Math.PI / 2
      box(g, 0.012, 0.07, 0.012, '#444444', 0, 0.52, 0.125)
      gable(g, 0.7, 0.14, 0.5, '#B5673F', 0, 0.2, 0.06)
    },
    legal(g) {
      box(g, 0.72, 0.06, 0.6, '#CFE3E0', 0, 0, 0)
      box(g, 0.56, 0.24, 0.42, '#E6F0EE', 0, 0.06, -0.03)
      for (let i = 0; i < 4; i++) cyl(g, 0.03, 0.03, 0.24, '#FFFFFF', -0.2 + i * 0.133, 0.06, 0.23, 8)
      box(g, 0.64, 0.04, 0.5, '#9CC8C2', 0, 0.3, -0.02)
      ball(g, 0.2, '#5FA89B', 0, 0.34, -0.03, Math.PI / 2)
      cyl(g, 0.012, 0.012, 0.1, '#6B7B78', 0, 0.54, -0.03, 6)
    },
    business(g) {
      box(g, 0.44, 0.1, 0.44, '#BFD4E8', 0, 0, 0)
      box(g, 0.36, 1.05, 0.36, '#A9CBEA', 0, 0.1, 0)
      for (let i = 0; i < 8; i++) box(g, 0.375, 0.02, 0.375, '#7FA8D1', 0, 0.2 + i * 0.12, 0)
      box(g, 0.012, 0.9, 0.38, '#7FA8D1', 0, 0.14, 0)
      cyl(g, 0.012, 0.012, 0.2, '#6B7B8A', 0, 1.15, 0, 6)
    },
    archive(g) {
      box(g, 0.78, 0.2, 0.5, '#CDB48A', 0, 0, 0)
      // a barrel vault: a long cylinder lying on its side, half sunk into the hall
      const vault = add(g, new T3.CylinderGeometry(0.25, 0.25, 0.78, 14), '#A88F66', 0, 0.2, 0)
      vault.rotation.z = Math.PI / 2; vault.scale.set(0.8, 1, 1)
      box(g, 0.12, 0.14, 0.012, '#5B4A31', -0.2, 0, 0.255)
      box(g, 0.12, 0.14, 0.012, '#5B4A31', 0.2, 0, 0.255)
    },
    domain(g) {
      for (const [x, z, r, h] of [[-0.22, -0.16, 0.15, 0.5], [0.04, -0.2, 0.13, 0.4], [0.24, -0.1, 0.12, 0.56]]) {
        cyl(g, r, r, h, '#BFE3DC', x, 0, z, 12)
        ball(g, r, '#6FB8AB', x, h, z, Math.PI / 2)
      }
      box(g, 0.5, 0.2, 0.26, '#8FCFC3', -0.06, 0, 0.22)
      box(g, 0.5, 0.03, 0.3, '#5FA89B', -0.06, 0.2, 0.22)
      box(g, 0.05, 0.5, 0.05, '#6B7B78', 0.3, 0, 0.3)
    },
  }

  /** The building of a type: a model from the manifest when one loaded, else the shape. */
  function building(type, accent, rot) {
    const g = new T3.Group()
    const model = models['building:' + type]
    if (model) {
      const m = model.clone(true)
      g.add(m)
    } else (SHAPES[type] || SHAPES.business)(g)
    // the office's colour: a sign band at the door, so offices of one type stay apart
    box(g, 0.34, 0.05, 0.02, accent || '#8A97A6', 0, 0.02, 0.43)
    g.rotation.y = (rot || 0) * Math.PI / 2
    return g
  }

  // ---------- asset models, by their manifest key: "building:<type>", "furniture:<name>", "character:<style>"
  const models = {}
  const clips = {}
  const MAX_BUILDING_H = 0.9 // a tall model (the tower) is scaled down so it never hides the lots behind it
  const FURNITURE_SIZE = { desk: { w: 1.0 }, chair: { w: 0.5 }, sofa: { w: 1.5 }, plant: { h: 0.9 }, screen: { w: 0.42 } }
  const CHARACTER_H = 1.1
  /** Loads the models of the given kinds (default all). onLoaded(key) after each one. */
  function loadModels(onLoaded, kinds) {
    const src = typeof ASSET_MODELS === 'object' && ASSET_MODELS ? ASSET_MODELS : {}
    const X = window.THREE_ADDONS
    if (!X || !X.GLTFLoader) return
    for (const key of Object.keys(src)) {
      const m = /^(building|furniture|character):([a-z]+)$/.exec(key)
      if (!m || (kinds && !kinds.includes(m[1]))) continue
      try {
        const bin = atob(src[key]), buf = new Uint8Array(bin.length)
        for (let i = 0; i < bin.length; i++) buf[i] = bin.charCodeAt(i)
        new X.GLTFLoader().parse(buf.buffer, '', (gltf) => {
          const s = gltf.scene
          const size = new T3.Box3().setFromObject(s).getSize(new T3.Vector3())
          let k
          if (m[1] === 'building') k = Math.min(0.84 / Math.max(size.x, size.z, 0.001), MAX_BUILDING_H / Math.max(size.y, 0.001))
          else if (m[1] === 'character') k = CHARACTER_H / Math.max(size.y, 0.001)
          else { const z = FURNITURE_SIZE[m[2]] || { w: 0.5 }; k = z.h ? z.h / Math.max(size.y, 0.001) : z.w / Math.max(size.x, 0.001) }
          s.scale.setScalar(k)
          const b2 = new T3.Box3().setFromObject(s)
          s.position.set(-(b2.min.x + b2.max.x) / 2, -b2.min.y, -(b2.min.z + b2.max.z) / 2)
          const wrap = new T3.Group(); wrap.add(s)
          models[key] = wrap
          clips[key] = gltf.animations || []
          if (onLoaded) onLoaded(key)
        }, () => { /* a broken file: the shape stays */ })
      } catch (e) { /* the same */ }
    }
  }
  /** A piece of furniture by name (desk, chair, sofa, plant, screen), or null when it has no model. */
  const furniture = (name) => { const m = models['furniture:' + name]; return m ? m.clone(true) : null }
  /** The person of a style in a still pose (a clip of the model, frozen at its first frame), or null. */
  function character(style, pose) {
    const key = 'character:' + style, m = models[key], X = window.THREE_ADDONS
    if (!m || !X || !X.clone) return null
    const o = X.clone(m)
    const clip = (clips[key] || []).find((c) => c.name === pose)
    if (clip) { const mx = new T3.AnimationMixer(o); mx.clipAction(clip).play(); mx.update(0) }
    return o
  }

  // ---------- people and furniture
  const SKIN = '#F1C9A5'
  const AVATAR_S = 1.22
  const AVATAR_H = 1.34 * AVATAR_S
  /** The one avatar: a round head on a coloured body. Initials and the number
   *  badge are the page's own text over it (they are DOM, never drawn twice). */
  function avatar(bodyHex) {
    const g = new T3.Group()
    add(g, new T3.CapsuleGeometry(0.21, 0.5, 4, 10), bodyHex, 0, 0.46, 0)
    add(g, new T3.SphereGeometry(0.17, 14, 10), SKIN, 0, 1.17, 0)
    g.scale.setScalar(AVATAR_S)
    return g
  }
  function desk() {
    const g = new T3.Group()
    box(g, 1.0, 0.07, 0.5, '#E9DABB', 0, 0.45, 0)
    box(g, 0.94, 0.45, 0.44, '#D6C39B', 0, 0, 0)
    box(g, 0.34, 0.02, 0.22, '#5D6670', 0, 0.52, 0.04)
    const s = box(g, 0.34, 0.24, 0.02, '#3F4650', 0, 0.54, -0.1)
    s.rotation.x = -0.25
    return g
  }
  const tree = (x, z, s) => { const g = new T3.Group(); cyl(g, 0.04, 0.05, 0.22 * s, '#8A6B4A', 0, 0, 0, 6); cone(g, 0.2 * s, 0.34 * s, '#5BA36A', 0, 0.2 * s, 0, 6); cone(g, 0.15 * s, 0.28 * s, '#6DB87B', 0, 0.4 * s, 0, 6); g.position.set(x, 0, z); return g }

  /** One small picture of each building type (data URLs), drawn once with a renderer of its own. */
  function icons(w, h) {
    let r
    try { r = new T3.WebGLRenderer({ antialias: true, alpha: true, preserveDrawingBuffer: true }) } catch (e) { return null }
    r.setPixelRatio(1); r.setSize(w, h, false)
    const sc = new T3.Scene()
    sc.add(new T3.HemisphereLight('#ffffff', '#c3c9d2', 1.9))
    const sun = new T3.DirectionalLight('#fff6e6', 1.5); sun.position.set(-6, 10, 4); sc.add(sun)
    const cam = new T3.OrthographicCamera(-0.78 * w / h, 0.78 * w / h, 0.86, -0.3, 0.1, 100)
    cam.position.set(10 * Math.cos(EL) * Math.sin(AZ), 10 * Math.sin(EL), 10 * Math.cos(EL) * Math.cos(AZ)); cam.lookAt(0, 0.3, 0)
    const out = {}
    for (const id of Object.keys(SHAPES)) {
      const b = building(id, '#8A97A6', 0)
      sc.add(b)
      r.render(sc, cam)
      out[id] = r.domElement.toDataURL('image/png')
      sc.remove(b)
    }
    r.dispose()
    return out
  }

  return { engine, icons, building, loadModels, furniture, character, checker, avatar, desk, tree, box, cyl, cone, add, mat, SHAPES, AVATAR_H, AZ, EL, clamp, models, CHARACTER_H }
}

module.exports = { worldKit }
