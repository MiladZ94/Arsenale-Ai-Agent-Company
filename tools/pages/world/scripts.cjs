const fs = require('fs')
const path = require('path')

/* ======================================================================
 * Node: the pinned three.js and the asset models, inlined into the page.
 * ====================================================================== */
const VENDOR_DIR = path.join(__dirname, '..', '..', 'vendor', 'three')
const VENDOR_FILES = ['three.cjs', 'BufferGeometryUtils.js', 'SkeletonUtils.js', 'GLTFLoader.js']
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

/** The <script> blocks the 3D pages need, or '' when the vendor files are
 *  missing (the pages then keep their flat views). three.cjs is CommonJS: it
 *  runs inside a function, so its hundreds of top-level names stay out of
 *  the page's own global scope. ASSET_MODELS: the real models of the asset
 *  manifest (tools/assets.cjs), if any; a building type without one is drawn
 *  from shapes. */
function worldScripts() {
  const parts = []
  for (const f of VENDOR_FILES) {
    const src = cached(path.join(VENDOR_DIR, f), (b) => scriptSafe(b.toString('utf8')))
    if (src === null) return ''
    parts.push(f === 'three.cjs'
      ? '<script>(function (exports) {\n' + src + '\n})(window.THREE = {});</script>'
      : '<script>' + src + '</script>')
  }
  parts.push('<script>const ASSET_MODELS = ' + scriptSafe(JSON.stringify(require('../../assets.cjs').pageAssets().models)) + ';</script>')
  return parts.join('\n')
}

module.exports = { worldScripts, VENDOR_FILES }
