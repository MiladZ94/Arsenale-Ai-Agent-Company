/* Renders the pictures in tools/assets/portraits/ from the shipped Kenney
 * models, headless:
 *
 *   node tools/render-portraits.cjs
 *
 *   front, left, right   the one office character, head and shoulders, from
 *                        three camera angles (the Team, Tasks, Approvals and
 *                        org chart portraits)
 *   desk                 the same character seated at the Kenney desk, screen
 *                        and chair, from the office camera (the Team screen)
 *
 * Transparent backgrounds. The zone colour and the initials are drawn by the
 * page around a picture, never baked in. The PNGs are derived from CC0 models
 * and are listed in manifest.json as such; run this again only when a model
 * changes, then update the sizes and hashes in the manifest (the asset test
 * names any that differ). Needs Chrome or Edge, like the browser tests.
 */
const fs = require('fs')
const os = require('os')
const path = require('path')
const { launch, unavailable } = require('./test/browser.cjs')
const { worldScripts } = require('./pages/world/scripts.cjs')

const OUT = path.join(__dirname, 'assets', 'portraits')
const K = path.join(__dirname, 'assets', 'kenney')
const b64 = (...p) => fs.readFileSync(path.join(K, ...p)).toString('base64')
// the bust: camera azimuth in degrees from the front
const VIEWS = { front: 0, left: -32, right: 32 }

const PAGE = `
window.RESULT = null
const T3 = window.THREE
const load = (b64) => new Promise((ok, no) => {
  const bin = atob(b64), buf = new Uint8Array(bin.length)
  for (let i = 0; i < bin.length; i++) buf[i] = bin.charCodeAt(i)
  new window.THREE_ADDONS.GLTFLoader().parse(buf.buffer, '', ok, no)
})
// the same scaling and centring as the office (pages/world/kit.cjs loadModels)
function fit(gltf, w, h) {
  const s = gltf.scene, size = new T3.Box3().setFromObject(s).getSize(new T3.Vector3())
  s.scale.setScalar(h ? h / size.y : w / size.x)
  const b = new T3.Box3().setFromObject(s)
  s.position.set(-(b.min.x + b.max.x) / 2, -b.min.y, -(b.min.z + b.max.z) / 2)
  const g = new T3.Group(); g.add(s); return g
}
const pose = (gltf, name) => {
  const c = gltf.animations.find((a) => a.name === name)
  if (c) { const mx = new T3.AnimationMixer(gltf.scene); mx.clipAction(c).play(); mx.update(0) }
  gltf.scene.updateMatrixWorld(true)
}
;(async () => {
  const man = await load(MAN), desk = await load(DESK), chair = await load(CHAIR), screen = await load(SCREEN)
  const r = new T3.WebGLRenderer({ antialias: true, alpha: true, preserveDrawingBuffer: true })
  r.setPixelRatio(1); r.setClearColor(0x000000, 0)
  r.outputColorSpace = T3.SRGBColorSpace
  const lights = (sc) => {
    sc.add(new T3.HemisphereLight('#ffffff', '#c3c9d2', 1.9))
    const sun = new T3.DirectionalLight('#fff6e6', 1.5); sun.position.set(-6, 10, 4); sc.add(sun)
  }
  const out = {}

  // the bust
  r.setSize(SIZE, SIZE, false)
  let sc = new T3.Scene(); lights(sc)
  pose(man, 'idle')
  const o = man.scene; sc.add(o)
  const box = new T3.Box3().setFromObject(o), size = box.getSize(new T3.Vector3()), ctr = box.getCenter(new T3.Vector3())
  const h = size.y * 0.72, mid = box.max.y - h / 2
  const cam = new T3.OrthographicCamera(-h / 2, h / 2, h / 2, -h / 2, 0.01, 100)
  for (const [name, deg] of Object.entries(VIEWS)) {
    const a = deg * Math.PI / 180
    cam.position.set(ctr.x + 10 * Math.sin(a), mid + 1.2, ctr.z + 10 * Math.cos(a)); cam.lookAt(ctr.x, mid, ctr.z)
    r.render(sc, cam)
    out[name] = r.domElement.toDataURL('image/png')
  }

  // the desk: the office's arrangement (kit.cjs, office3d.cjs makeDesk and buildShell), seen from its camera
  const W = 300, H = 260
  r.setSize(W, H, false)
  sc = new T3.Scene(); lights(sc)
  const dk = fit(desk, 1.0), top = new T3.Box3().setFromObject(dk).max.y
  const scr = fit(screen, 0.42); scr.position.set(0, top, -0.08)
  const unit = new T3.Group(); unit.add(dk); unit.add(scr); unit.rotation.y = Math.PI; unit.position.set(0, 0, 0.12)
  const ch = fit(chair, 0.5); ch.position.set(0, 0, -0.52)
  const p = fit(man, null, 1.1); p.position.set(0, 0, -0.52)
  sc.add(unit, ch, p)
  const AZ = Math.PI / 4, EL = 0.62, hw = 1.12
  const c2 = new T3.OrthographicCamera(-hw, hw, hw * H / W, -hw * H / W, 0.1, 100)
  const tgt = new T3.Vector3(0.02, 0.5, -0.2)
  c2.position.set(tgt.x + 10 * Math.cos(EL) * Math.sin(AZ), tgt.y + 10 * Math.sin(EL), tgt.z + 10 * Math.cos(EL) * Math.cos(AZ)); c2.lookAt(tgt)
  pose(man, 'sit')
  r.render(sc, c2)
  out.desk = r.domElement.toDataURL('image/png')
  window.RESULT = out
})().catch((e) => { window.RESULT = { error: String(e && e.stack || e) } })
`

async function main() {
  const why = unavailable()
  if (why) throw new Error(why)
  const consts = 'const MAN = ' + JSON.stringify(b64('characters', 'character-male-d.glb')) + ', DESK = ' + JSON.stringify(b64('furniture', 'desk.glb')) +
    ', CHAIR = ' + JSON.stringify(b64('furniture', 'chairDesk.glb')) + ', SCREEN = ' + JSON.stringify(b64('furniture', 'computerScreen.glb')) +
    ', SIZE = 192, VIEWS = ' + JSON.stringify(VIEWS) + ';'
  const html = '<!doctype html><meta charset="utf-8"><body style="margin:0;background:transparent">' + worldScripts() + '<script>' + consts + PAGE + '</script>'
  const tmp = fs.mkdtempSync(path.join(os.tmpdir(), 'arsenale-portraits-'))
  const file = path.join(tmp, 'render.html')
  fs.writeFileSync(file, html)
  const page = await launch()
  try {
    await page.goto(require('url').pathToFileURL(file).href)
    await page.waitFor('window.RESULT', 30000)
    const res = await page.eval('window.RESULT')
    if (res.error) throw new Error(res.error)
    fs.mkdirSync(OUT, { recursive: true })
    for (const [name, url] of Object.entries(res)) fs.writeFileSync(path.join(OUT, name + '.png'), Buffer.from(url.split(',')[1], 'base64'))
    console.log('wrote ' + Object.keys(res).join(', ') + ' to ' + OUT)
  } finally { await page.close(); fs.rmSync(tmp, { recursive: true, force: true }) }
}
main().then(() => process.exit(0), (e) => { console.error(e.message); process.exit(1) })
