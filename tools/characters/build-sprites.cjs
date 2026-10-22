/* Renders the portraits and sprites of the shipped characters, headless.
 *
 *   node tools/characters/build-sprites.cjs [--contact <png>]
 *
 * For every character and every office colour (the named THEMES) it writes,
 * into sprites/:
 *   p-<character>-<colour>.webp  a 256 px portrait (head and shoulders)
 *   s-<character>-<colour>.webp  a 320 x 64 strip: the idle pose, then four
 *                                walk frames, each frame 64 px
 * plus atlas.json, which the page reads to find them. The campus, the flat
 * office and the lists draw these instead of the pixel people.
 *
 * The models are drawn with the same three.js files the 3D office uses
 * (tools/vendor/three), in a headless Chrome or Edge that this script
 * starts itself (its own profile folder under the temp folder). Nothing is
 * downloaded and nothing is run from a downloaded file. The same models give
 * the same images. --contact also writes one sheet with every character
 * standing, walking and typing, for a look by eye. */
const fs = require('fs')
const path = require('path')
const http = require('http')
const manifest = require('./manifest.cjs')
const browser = require('../test/browser.cjs')

const DIR = __dirname
const OUT = path.join(DIR, 'sprites')
const VENDOR = path.join(DIR, '..', 'vendor', 'three')
const { SET } = require('./build-characters.cjs')
const { THEMES } = require('../agent-company.cjs')

const VARIANTS = SET.map((s) => s.file.replace(/^person-|\.glb$/g, ''))
const PORTRAIT = 256, SPRITE = 64, WALK_FRAMES = 4

const PAGE = String.raw`
const T = window.THREE, X = window.THREE_ADDONS
const loader = new X.GLTFLoader()
const cache = new Map()
const getGlb = (name) => { if (!cache.has(name)) cache.set(name, fetch('/glb/' + name).then((r) => r.arrayBuffer()).then((b) => new Promise((res, rej) => loader.parse(b, '', res, rej)))); return cache.get(name) }
let renderer = null
function stage(size) {
  if (!renderer) {
    renderer = new T.WebGLRenderer({ antialias: true, alpha: true, preserveDrawingBuffer: true })
    renderer.outputColorSpace = T.SRGBColorSpace
    renderer.toneMapping = T.NeutralToneMapping
    renderer.setClearColor(0xffffff, 0)
    renderer.setPixelRatio(1)
  }
  renderer.setSize(size, size)
  const scene = new T.Scene()
  scene.add(new T.HemisphereLight('#f4f6ff', '#e8e2d8', 1.75))
  const sun = new T.DirectionalLight('#fffaf3', 2.1); sun.position.set(-10, 14, -8); scene.add(sun)
  const fill = new T.DirectionalLight('#e9eeff', 0.45); fill.position.set(12, 6, 10); scene.add(fill)
  return scene
}
function camera(scene, o) {
  const cam = new T.OrthographicCamera(-o.fr / 2, o.fr / 2, o.fr / 2, -o.fr / 2, 0.1, 400), d = 60, az = o.azim, el = o.elev
  cam.position.set(o.tx + d * Math.cos(el) * Math.sin(az), o.ty + d * Math.sin(el), o.tz + d * Math.cos(el) * Math.cos(az))
  cam.lookAt(o.tx, o.ty, o.tz); cam.updateProjectionMatrix(); cam.updateMatrixWorld()
  return cam
}
async function person(scene, glbName, colour) {
  const gl = await getGlb(glbName)
  const m = X.clone(gl.scene)
  m.traverse((o) => { if (o.isMesh && o.material && o.material.name === 'Shirt') { o.material = o.material.clone(); o.material.color.set(colour) } })
  const probe = X.clone(gl.scene), mx = new T.AnimationMixer(probe)
  mx.clipAction(gl.animations.find((c) => c.name === 'Idle')).play(); mx.setTime(0.4); probe.updateMatrixWorld(true)
  const bb = new T.Box3().setFromObject(probe, true), h = bb.max.y - bb.min.y, s = 1.5 / h
  const holder = new T.Group(); holder.add(m); m.scale.setScalar(s); m.position.y = -bb.min.y * s
  scene.add(holder)
  const mixer = new T.AnimationMixer(m)
  const pose = (clip, t) => { mixer.stopAllAction(); mixer.clipAction(gl.animations.find((c) => c.name === clip)).play(); mixer.setTime(t); holder.updateMatrixWorld(true) }
  const head = () => { let b = null; m.traverse((n) => { if (!b && n.name === 'head') b = n }); const v = new T.Vector3(); b.getWorldPosition(v); return v }
  return { holder, pose, head, clips: gl.animations.map((c) => c.name), len: (n) => gl.animations.find((c) => c.name === n).duration }
}
const img = (u) => new Promise((res, rej) => { const i = new Image(); i.onload = () => res(i); i.onerror = rej; i.src = u })
const png = (scene, cam) => { renderer.render(scene, cam); return renderer.domElement.toDataURL('image/png') }
async function bounds(u) {
  const i = await img(u), c = document.createElement('canvas'); c.width = i.width; c.height = i.height
  const g = c.getContext('2d'); g.drawImage(i, 0, 0); const d = g.getImageData(0, 0, i.width, i.height).data
  let x0 = i.width, y0 = i.height, x1 = 0, y1 = 0
  for (let y = 0; y < i.height; y++) for (let x = 0; x < i.width; x++) if (d[(y * i.width + x) * 4 + 3] > 16) { if (x < x0) x0 = x; if (x > x1) x1 = x; if (y < y0) y0 = y; if (y > y1) y1 = y }
  return { x0, y0, x1, y1 }
}
// the crop, scaled into a size x size cell in halves so the small result stays clean; the feet sit on the cell's floor
async function cell(g, u, b, size, ox, pad) {
  const i = await img(u), bw = b.x1 - b.x0 + 1, bh = b.y1 - b.y0 + 1, s = Math.min((size - pad * 2) / bw, (size - pad * 2) / bh), dw = bw * s, dh = bh * s
  let cur = document.createElement('canvas'); cur.width = bw; cur.height = bh; cur.getContext('2d').drawImage(i, b.x0, b.y0, bw, bh, 0, 0, bw, bh)
  while (cur.width / 2 > dw && cur.height / 2 > dh) { const n = document.createElement('canvas'); n.width = Math.ceil(cur.width / 2); n.height = Math.ceil(cur.height / 2); const ng = n.getContext('2d'); ng.imageSmoothingQuality = 'high'; ng.drawImage(cur, 0, 0, n.width, n.height); cur = n }
  g.imageSmoothingQuality = 'high'
  g.drawImage(cur, ox + (size - dw) / 2, size - pad - dh, dw, dh)
}
const union = (a, b) => (a ? { x0: Math.min(a.x0, b.x0), y0: Math.min(a.y0, b.y0), x1: Math.max(a.x1, b.x1), y1: Math.max(a.y1, b.y1) } : b)
const ISO = { tx: 0, ty: 0.75, tz: 0, azim: Math.PI / 4, elev: 0.64, fr: 2.2 }

window.H = {
  async portrait(glb, colour, size) {
    const scene = stage(512), p = await person(scene, glb, colour)
    p.holder.rotation.y = 0.25; p.pose('Idle', 0.4)
    const hp = p.head()
    const cam = camera(scene, { tx: 0, ty: hp.y + 0.02, tz: 0, azim: 0.2, elev: 0.12, fr: 0.95 })
    const u = png(scene, cam), c = document.createElement('canvas'); c.width = size; c.height = size
    await cell(c.getContext('2d'), u, { x0: 0, y0: 0, x1: 511, y1: 511 }, size, 0, 0)
    return c.toDataURL('image/webp', 0.9)
  },
  async strip(glb, colour, size, frames) {
    const scene = stage(512), p = await person(scene, glb, colour)
    p.holder.rotation.y = Math.PI / 4
    const cam = camera(scene, ISO), shots = []
    p.pose('Idle', 0.4); shots.push(png(scene, cam))
    const len = p.len('Walk')
    for (let f = 0; f < frames; f++) { p.pose('Walk', len * f / frames); shots.push(png(scene, cam)) }
    let b = null
    for (const u of shots) b = union(b, await bounds(u))
    const c = document.createElement('canvas'); c.width = size * shots.length; c.height = size
    const g = c.getContext('2d')
    for (let k = 0; k < shots.length; k++) await cell(g, shots[k], b, size, k * size, 2)
    return c.toDataURL('image/webp', 0.92)
  },
  // a look by eye: standing, walking, seated typing, from the office's own angle
  async contact(glbs, colour) {
    const W = 300, c = document.createElement('canvas'); c.width = W * 4; c.height = W * glbs.length
    const g = c.getContext('2d')
    for (let r = 0; r < glbs.length; r++) {
      for (const [k, clip, t] of [[0, 'Idle', 0.4], [1, 'Walk', 0.2], [2, 'Typing', 0.3], [3, 'Celebrate', 0.5]]) {
        const scene = stage(512), p = await person(scene, glbs[r], colour)
        p.holder.rotation.y = Math.PI / 4; p.pose(clip, t)
        const u = png(scene, camera(scene, Object.assign({}, ISO, { fr: 2.3, ty: 0.8 })))
        const i = await img(u); g.drawImage(i, k * W, r * W, W, W)
      }
    }
    return c.toDataURL('image/png')
  },
  clips: async (glb) => (await person(stage(64), glb, '#888888')).clips,
}
`

function vendor(f) { return fs.readFileSync(path.join(VENDOR, f), 'utf8').replace(/<\/(script)/gi, '<\\/$1') }
function pageHtml() {
  return '<!DOCTYPE html><html><body><script>(function (exports) {\n' + vendor('three.cjs') + '\n})(window.THREE = {});</script>' +
    ['BufferGeometryUtils.js', 'SkeletonUtils.js', 'GLTFLoader.js'].map((f) => '<script>' + vendor(f) + '</script>').join('') + '<script>' + PAGE + '</script></body></html>'
}

const pngOf = (dataUrl) => {
  const b = Buffer.from(dataUrl.split(',')[1], 'base64')
  // the canvas writes no text chunks; strip any that a browser might add so no tool name rides along
  const out = [b.subarray(0, 8)]
  let off = 8
  while (off < b.length) {
    const len = b.readUInt32BE(off), kind = b.toString('latin1', off + 4, off + 8)
    if (!/^(tEXt|zTXt|iTXt|tIME|eXIf)$/.test(kind)) out.push(b.subarray(off, off + 12 + len))
    off += 12 + len
  }
  return Buffer.concat(out)
}

async function main() {
  const contact = process.argv.includes('--contact') ? process.argv[process.argv.indexOf('--contact') + 1] : ''
  const why = browser.unavailable()
  if (why) { console.error('cannot render: ' + why); process.exit(2) }
  const html = pageHtml()
  const server = http.createServer((req, res) => {
    if (req.url === '/') { res.writeHead(200, { 'Content-Type': 'text/html; charset=utf-8' }); return res.end(html) }
    const m = /^\/glb\/(person-[\w-]+\.glb)$/.exec(req.url)
    if (m && fs.existsSync(path.join(DIR, m[1]))) { res.writeHead(200, { 'Content-Type': 'model/gltf-binary' }); return res.end(fs.readFileSync(path.join(DIR, m[1]))) }
    res.writeHead(404); res.end()
  })
  await new Promise((r) => server.listen(0, '127.0.0.1', r))
  const page = await browser.launch()
  try {
    await page.goto('http://127.0.0.1:' + server.address().port + '/')
    await page.waitFor('window.H', 20000)
    if (contact) {
      const names = SET.map((s) => s.file)
      fs.writeFileSync(contact, pngOf(await page.eval('H.contact(' + JSON.stringify(names) + ', ' + JSON.stringify(THEMES.teal) + ')')))
      console.log('contact sheet', contact)
      return
    }
    fs.rmSync(OUT, { recursive: true, force: true })
    fs.mkdirSync(OUT, { recursive: true })
    const entries = []
    for (const s of SET) {
      const v = s.file.replace(/^person-|\.glb$/g, '')
      for (const [colour, hexv] of Object.entries(THEMES)) {
        for (const [kind, expr, name] of [
          ['portrait', 'H.portrait(' + JSON.stringify(s.file) + ',' + JSON.stringify(hexv) + ',' + PORTRAIT + ')', 'p-' + v + '-' + colour + '.webp'],
          ['sprite', 'H.strip(' + JSON.stringify(s.file) + ',' + JSON.stringify(hexv) + ',' + SPRITE + ',' + WALK_FRAMES + ')', 's-' + v + '-' + colour + '.webp'],
        ]) {
          fs.writeFileSync(path.join(OUT, name), Buffer.from((await page.eval(expr)).split(',')[1], 'base64'))
          entries.push({ file: 'sprites/' + name, kind, derivedFrom: s.file, sources: [{ library: 'KayKit (Kay Lousberg)', originalFile: s.file }], licenceText: ['LICENCES.md'], changes: ['rendered by build-sprites.cjs in the office colour ' + colour] })
        }
      }
    }
    const atlas = { schemaVersion: 1, portrait: PORTRAIT, sprite: SPRITE, frames: { idle: 0, walk: [1, 2, 3, 4] }, variants: VARIANTS, plain: 'plain', colours: THEMES, file: { portrait: 'p-{v}-{c}.webp', sprite: 's-{v}-{c}.webp' } }
    fs.writeFileSync(path.join(OUT, 'atlas.json'), JSON.stringify(atlas, null, 1) + '\n')
    entries.push({ file: 'sprites/atlas.json', kind: 'atlas', derivedFrom: 'sprites/', licenceText: ['LICENCES.md'], changes: ['index of the rendered images'] })
    manifest.setImages(entries)
    manifest.refresh()
    const total = fs.readdirSync(OUT).reduce((n, f) => n + fs.statSync(path.join(OUT, f)).size, 0)
    console.log(entries.length, 'files in sprites/,', total, 'bytes')
  } finally {
    await page.close()
    server.close()
  }
}
main().then(() => process.exit(0), (e) => { console.error(e); process.exit(1) })
