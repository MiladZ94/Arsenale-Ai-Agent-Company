/* The asset manifest and loader (spec 16.2 rule 15, decision A2).
 *
 * The campus and the office are drawn from procedural low-poly shapes, so
 * Arsenale needs no asset file to run. A real model may replace a shape: drop
 * a .glb into tools/assets/ and add its entry to tools/assets/manifest.json:
 *
 *   { "file": "kenney/office-tower.glb", "use": "building:business",
 *     "name": "...", "author": "...", "source": "<page URL>",
 *     "licence": "CC0-1.0", "fetched": "YYYY-MM-DD", "sha256": "<hex>" }
 *
 * `use` is "building:<type>" (see campus.cjs TYPES), "furniture:<name>" (desk,
 * chair, sofa, plant, screen) or "character:<style>" (office), "portrait:<view><n>" (a PNG render of the character in outfit n: head and shoulders, or seated at the desk, for the Team, Tasks and Approvals screens) or "icon:<type>" (a PNG render of a building, for the setup wizard). Only CC0 files are
 * accepted and only when the hash matches the entry: anything else is left
 * out of the page and named in `problems`, and the shape is drawn instead
 * (tools/test/assets.test.cjs fails for a shipped file with no entry). A
 * desk, chair, sofa, plant, screen or person with no model is drawn from shapes.
 * Files are inlined into the page like the other scripts (the dashboard
 * server serves pages and JSON only), so each is capped in size.
 */
const fs = require('fs')
const path = require('path')
const crypto = require('crypto')

const DIR = path.join(__dirname, 'assets')
const MAX_BYTES = 6 * 1024 * 1024
const NOT_ASSETS = new Set(['manifest.json', 'NOTICE.md'])
const LICENCES_DIR = 'licenses' // each pack's own licence text, kept beside the models

const sha256 = (buf) => crypto.createHash('sha256').update(buf).digest('hex')

function readManifest(dir) {
  try {
    const m = JSON.parse(fs.readFileSync(path.join(dir || DIR, 'manifest.json'), 'utf8'))
    return { assets: Array.isArray(m.assets) ? m.assets : [] }
  } catch { return { assets: [] } }
}

/** Every model file under the folder (not the manifest, the notice or the licence texts), as paths with / . */
function shippedFiles(dir) {
  const root = dir || DIR
  const out = []
  const walk = (d) => {
    let names = []
    try { names = fs.readdirSync(d, { withFileTypes: true }) } catch { return }
    for (const e of names) {
      const p = path.join(d, e.name)
      if (e.isDirectory()) { if (!(d === root && e.name === LICENCES_DIR)) walk(p) }
      else if (!(d === root && NOT_ASSETS.has(e.name))) out.push(path.relative(root, p).split(path.sep).join('/'))
    }
  }
  walk(root)
  return out.sort()
}

/** What the page may load: { models: { "building:docs": <base64 .glb>, "furniture:desk": ... }, problems }. */
function pageAssets(dir) {
  const root = dir || DIR
  const models = {}
  const problems = []
  for (const a of readManifest(root).assets) {
    const file = String(a && a.file || '')
    const use = String(a && a.use || '')
    if (!/^[\w.\/-]+$/.test(file) || file.includes('..') || !/^(building|furniture|character|portrait|icon):[a-z][a-z0-9]*$/.test(use)) { problems.push('bad entry: ' + file); continue }
    if (a.licence !== 'CC0-1.0') { problems.push(file + ': licence is not CC0-1.0'); continue }
    let buf
    try { buf = fs.readFileSync(path.join(root, file)) } catch { continue } // an entry without its file: the shape is drawn
    if (buf.length > MAX_BYTES) { problems.push(file + ': too large for the page'); continue }
    if (sha256(buf) !== a.sha256) { problems.push(file + ': hash differs from the manifest'); continue }
    models[use] = buf.toString('base64')
  }
  return { models, problems }
}

module.exports = { DIR, readManifest, shippedFiles, pageAssets, sha256 }
