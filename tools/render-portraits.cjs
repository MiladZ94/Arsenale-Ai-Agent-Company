/* Renders the pictures in tools/assets/portraits/ and tools/assets/icons/ from
 * the shipped Kenney models, headless:
 *
 *   node tools/render-portraits.cjs
 *
 *   portraits/<view>-<n>.png   the one office character in outfit n (0 to 9, the
 *                              ten suit colours of pages/world/palette.cjs OUTFIT),
 *                              head and shoulders from three camera angles, front,
 *                              left and right (the Team, Tasks, Approvals and org
 *                              chart portraits), and the same figure seated at the
 *                              Kenney desk, screen and chair, from the office camera
 *                              (view "desk", the Team screen)
 *   icons/<type>.png           each of the twelve campus buildings from the office
 *                              camera, for the setup wizard's campus (the 3D campus
 *                              draws the models themselves)
 *
 * The scaling, the centring and the recolouring are the office's own (the kit,
 * pages/world/kit.cjs), so a portrait is the person you see at the desk.
 * Transparent backgrounds. The zone colour and the initials are drawn by the
 * page around a picture, never baked in. The PNGs are derived from CC0 models
 * and are listed in manifest.json as such. Run this again only when a model or
 * the outfit palette changes: it rewrites the entries (sizes, hashes) of what it
 * renders. Needs Chrome or Edge, like the browser tests.
 */
const fs = require('fs')
const os = require('os')
const path = require('path')
const { launch, unavailable } = require('./test/browser.cjs')
const { worldScripts } = require('./pages/world/scripts.cjs')
const { WORLD_PALETTE, outfitIndex } = require('./pages/world/palette.cjs')
const { worldKit } = require('./pages/world/kit.cjs')
const { TYPES } = require('./campus.cjs')

const ASSETS = path.join(__dirname, 'assets')
// the bust: camera azimuth in degrees from the front
const VIEWS = { front: 0, left: -32, right: 32 }

const PAGE = `
window.RESULT = null
const T3 = window.THREE
const K = worldKit()
const lights = (sc) => {
  sc.add(new T3.HemisphereLight('#ffffff', '#c3c9d2', 1.9))
  const sun = new T3.DirectionalLight('#fff6e6', 1.5); sun.position.set(-6, 10, 4); sc.add(sun)
}
function run() {
  const r = new T3.WebGLRenderer({ antialias: true, alpha: true, preserveDrawingBuffer: true })
  r.setPixelRatio(1); r.setClearColor(0x000000, 0)
  r.outputColorSpace = T3.SRGBColorSpace
  const out = {}
  const iso = (cam, tgt, el, az, d) => { cam.position.set(tgt.x + d * Math.cos(el) * Math.sin(az), tgt.y + d * Math.sin(el), tgt.z + d * Math.cos(el) * Math.cos(az)); cam.lookAt(tgt) }
  for (let n = 0; n < OUTFITS; n++) {
    // the bust
    r.setSize(SIZE, SIZE, false)
    let sc = new T3.Scene(); lights(sc)
    const o = K.character('office', 'idle', n); sc.add(o)
    const box = new T3.Box3().setFromObject(o), size = box.getSize(new T3.Vector3()), ctr = box.getCenter(new T3.Vector3())
    const h = size.y * 0.72, mid = box.max.y - h / 2
    const cam = new T3.OrthographicCamera(-h / 2, h / 2, h / 2, -h / 2, 0.01, 100)
    for (const [name, deg] of Object.entries(VIEWS)) {
      const a = deg * Math.PI / 180
      cam.position.set(ctr.x + 10 * Math.sin(a), mid + 1.2, ctr.z + 10 * Math.cos(a)); cam.lookAt(ctr.x, mid, ctr.z)
      r.render(sc, cam)
      out['portraits/' + name + '-' + n] = r.domElement.toDataURL('image/png')
    }
    // the desk: the office's arrangement (kit.cjs, office3d.cjs makeDesk and buildShell), seen from its camera
    const W = 300, H = 260
    r.setSize(W, H, false)
    sc = new T3.Scene(); lights(sc)
    const dk = K.furniture('desk'), top = new T3.Box3().setFromObject(dk).max.y
    const scr = K.furniture('screen'); scr.position.set(0, top, -0.08)
    const unit = new T3.Group(); unit.add(dk); unit.add(scr); unit.rotation.y = Math.PI; unit.position.set(0, 0, 0.12)
    const ch = K.furniture('chair'); ch.position.set(0, 0, -0.52)
    const p = K.character('office', 'sit', n); p.position.set(0, 0, -0.52)
    sc.add(unit, ch, p)
    const hw = 1.12
    const c2 = new T3.OrthographicCamera(-hw, hw, hw * H / W, -hw * H / W, 0.1, 100)
    iso(c2, new T3.Vector3(0.02, 0.5, -0.2), K.EL, K.AZ, 10)
    r.render(sc, c2)
    out['portraits/desk-' + n] = r.domElement.toDataURL('image/png')
  }
  // the buildings, as the hotbar of the campus draws them (kit.icons), but larger and without the colour band at the door.
  // One frame for all twelve, measured on the tallest and widest, so the sizes stay true to each other.
  const BW = 220, BH = 190
  r.setSize(BW, BH, false)
  const sc = new T3.Scene(); lights(sc)
  const cam = new T3.OrthographicCamera(-1, 1, 1, -1, 0.1, 100)
  iso(cam, new T3.Vector3(0, 0.3, 0), K.EL, K.AZ, 10)
  cam.updateMatrixWorld(true)
  const all = TYPE_IDS.map((id) => { const b = K.building(id, '#8A97A6', 0); b.remove(b.children[b.children.length - 1]); return [id, b] })
  let x0 = 9, x1 = -9, y0 = 9, y1 = -9
  const inv = cam.matrixWorldInverse
  for (const [, b] of all) {
    const bx = new T3.Box3().setFromObject(b)
    for (const x of [bx.min.x, bx.max.x]) for (const y of [bx.min.y, bx.max.y]) for (const z of [bx.min.z, bx.max.z]) {
      const v = new T3.Vector3(x, y, z).applyMatrix4(inv)
      x0 = Math.min(x0, v.x); x1 = Math.max(x1, v.x); y0 = Math.min(y0, v.y); y1 = Math.max(y1, v.y)
    }
  }
  // the lot's centre on the ground stays at one pixel of every picture (the wizard stands them on its grid by it): centred across, and at a fixed height
  const oy = new T3.Vector3(0, 0, 0).applyMatrix4(inv).y, up = (y1 - oy) * 1.05, down = (oy - y0) * 1.05
  const hh = Math.max((up + down) / 2, Math.max(-x0, x1) * 1.05 * BH / BW), hw = hh * BW / BH
  cam.left = -hw; cam.right = hw; cam.top = oy + up + (hh - (up + down) / 2); cam.bottom = cam.top - 2 * hh; cam.updateProjectionMatrix()
  out.meta = JSON.stringify({ unitsAcross: 2 * hw, originFromTop: (cam.top - oy) / (2 * hh) })
  for (const [id, b] of all) { sc.add(b); r.render(sc, cam); out['icons/' + id] = r.domElement.toDataURL('image/png'); sc.remove(b) }
  return out
}
// the models load asynchronously: render when every one is in
let left = Object.keys(ASSET_MODELS).filter((k) => /^(building|furniture|character):/.test(k)).length
K.loadModels(() => {
  if (--left) return
  try { window.RESULT = run() } catch (e) { window.RESULT = { error: String(e && e.stack || e) } }
})
`

const NAMES = { front: 'camera in front', left: 'camera 32 degrees left', right: 'camera 32 degrees right' }
/** The manifest entry of a rendered file (the same fields as the Kenney originals; "derived" says how it was made). */
function entry(rel, buf) {
  const [kind, name] = rel.split('/')
  const base = { file: rel + '.png', pack: 'Mini Characters 1.0 (derived)', author: 'Kenney (www.kenney.nl)', source: 'https://kenney.nl/assets/mini-characters', licence: 'CC0-1.0', licenceFile: 'licenses/kenney-mini-characters-License.txt', fetched: '2026-10-17' }
  let use, nm, how
  if (kind === 'icons') {
    Object.assign(base, { pack: 'City Kit (derived)', source: 'https://kenney.nl/assets/city-kit-commercial', licenceFile: 'licenses/kenney-city-commercial-License.txt' })
    const src = require(path.join(ASSETS, 'manifest.json')).assets.find((a) => a.use === 'building:' + name)
    use = 'icon:' + name; nm = 'icon-' + name
    how = 'derived: 220 x 190 px render of ' + src.file + ' from the office camera, transparent background, the colour band at the door left out, made by tools/render-portraits.cjs; CC0 as its source'
    Object.assign(base, { pack: src.pack + ' (derived)', source: src.source, licenceFile: src.licenceFile })
  } else {
    const [view, n] = name.split('-')
    use = 'portrait:' + view + n; nm = 'portrait-' + view + '-' + n
    const suit = WORLD_PALETTE.OUTFIT[Number(n)]
    if (view === 'desk') {
      Object.assign(base, { pack: 'Mini Characters 1.0 + Furniture Kit 2.0 (derived)', source: 'https://kenney.nl/assets/furniture-kit', licenceFile: 'licenses/kenney-furniture-kit-License.txt' })
      how = 'derived: 300 x 260 px render of kenney/characters/character-male-d.glb (sit pose, suit recoloured to outfit ' + n + ', ' + suit + ') at kenney/furniture/desk.glb, computerScreen.glb and chairDesk.glb, from the office camera, transparent background, made by tools/render-portraits.cjs; CC0 as its sources'
    } else how = 'derived: 192 px head-and-shoulders render of kenney/characters/character-male-d.glb (idle pose, ' + NAMES[view] + ', suit recoloured to outfit ' + n + ', ' + suit + '), transparent background, made by tools/render-portraits.cjs; CC0 as its sources'
  }
  return Object.assign({ file: base.file, use, name: nm }, base, { size: buf.length, sha256: require('./assets.cjs').sha256(buf), modified: how })
}

async function main() {
  const why = unavailable()
  if (why) throw new Error(why)
  const consts = 'const OUTFITS = ' + WORLD_PALETTE.OUTFIT.length + ', SIZE = 192, VIEWS = ' + JSON.stringify(VIEWS) + ', TYPE_IDS = ' + JSON.stringify(TYPES.map((t) => t.id)) + ';' +
    'const WORLD_PALETTE = ' + JSON.stringify(WORLD_PALETTE) + '; const outfitIndex = (' + outfitIndex.toString() + '); const worldKit = (' + worldKit.toString() + ');'
  const html = '<!doctype html><meta charset="utf-8"><body style="margin:0;background:transparent">' + worldScripts() + '<script>' + consts + PAGE + '</script>'
  const tmp = fs.mkdtempSync(path.join(os.tmpdir(), 'arsenale-portraits-'))
  const file = path.join(tmp, 'render.html')
  fs.writeFileSync(file, html)
  const page = await launch()
  try {
    await page.goto(require('url').pathToFileURL(file).href)
    await page.waitFor('window.RESULT', 60000)
    const res = await page.eval('window.RESULT')
    if (res.error) throw new Error(res.error)
    for (const d of ['portraits', 'icons']) { fs.rmSync(path.join(ASSETS, d), { recursive: true, force: true }); fs.mkdirSync(path.join(ASSETS, d), { recursive: true }) }
    const mf = path.join(ASSETS, 'manifest.json')
    const man = JSON.parse(fs.readFileSync(mf, 'utf8'))
    man.assets = man.assets.filter((a) => !/^(portraits|icons)\//.test(a.file))
    let total = 0
    console.log('icon frame: ' + res.meta)
    delete res.meta
    for (const [rel, url] of Object.entries(res)) {
      const buf = Buffer.from(url.split(',')[1], 'base64')
      fs.writeFileSync(path.join(ASSETS, rel + '.png'), buf)
      man.assets.push(entry(rel, buf)); total += buf.length
    }
    fs.writeFileSync(mf, JSON.stringify(man, null, 2) + '\n')
    console.log('wrote ' + Object.keys(res).length + ' pictures (' + total + ' bytes) to ' + ASSETS + ' and their manifest entries')
  } finally { await page.close(); fs.rmSync(tmp, { recursive: true, force: true }) }
}
main().then(() => process.exit(0), (e) => { console.error(e.message); process.exit(1) })
