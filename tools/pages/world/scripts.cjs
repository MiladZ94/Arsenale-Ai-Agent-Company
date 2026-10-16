const fs = require('fs')
const path = require('path')

/* ======================================================================
 * Node: the pinned three.js and the characters, inlined into the page.
 * ====================================================================== */
const VENDOR_DIR = path.join(__dirname, '..', '..', 'vendor', 'three')
const CHAR_DIR = path.join(__dirname, '..', '..', 'characters')
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

module.exports = { worldScripts, VENDOR_FILES }
